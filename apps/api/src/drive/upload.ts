import { Readable } from 'stream';
import { getDriveClient } from './auth';

function parseEnvInt(name: string, fallback: number, min: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min) return fallback;
  return n;
}

/** Extra retries for flaky networks / Drive rate limits (default 5 → 6 total attempts). */
const UPLOAD_MAX_RETRIES = parseEnvInt('DRIVE_UPLOAD_MAX_RETRIES', 5, 0);
const UPLOAD_BASE_DELAY_MS = parseEnvInt('DRIVE_UPLOAD_BASE_DELAY_MS', 3000, 500);

const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** Cache for resolveUploadFolders(domain) to avoid repeated Drive list calls per batch run. */
const uploadFoldersCache = new Map<string, { pdfFolderId: string; docFolderId: string }>();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** HTTP status from googleapis / Gaxios errors (shape varies by version). */
function getHttpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as {
    code?: number | string;
    status?: number;
    response?: { status?: number };
  };
  if (typeof e.response?.status === 'number') return e.response.status;
  if (typeof e.status === 'number') return e.status;
  if (typeof e.code === 'number' && e.code >= 100 && e.code < 600) return e.code;
  if (typeof e.code === 'string' && /^\d{3}$/.test(e.code)) return parseInt(e.code, 10);
  return undefined;
}

/** True when a short wait and retry may succeed (network blips, throttling, stale token). */
function isRetriableDriveError(err: unknown): boolean {
  const status = getHttpStatus(err);
  const msg = err instanceof Error ? err.message : String(err);

  if (status === 429 || status === 408) return true;
  if (status !== undefined && status >= 500 && status < 600) return true;
  // Transient auth — next attempt may refresh credentials
  if (status === 401) return true;
  // Rate / quota wording sometimes comes as 403
  if (
    status === 403 &&
    /rate|quota|usageLimits|User Rate Limit|usage limit|backendError|dailyLimit/i.test(msg)
  ) {
    return true;
  }

  if (
    /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|socket hang up|network|fetch failed|TLS|Premature close|UND_ERR_SOCKET|timeout/i.test(
      msg,
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Check if a file with the given name exists in the Drive folder.
 * Returns the file ID if found, null otherwise.
 */
function escapeDriveQuery(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function fileExistsInDrive(fileName: string, folderId: string): Promise<string | null> {
  const drive = getDriveClient();
  const q = `'${folderId}' in parents and name = '${escapeDriveQuery(fileName)}' and trashed = false`;
  const res = await drive.files.list({
    q,
    pageSize: 1,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = res.data.files;
  if (files && files.length > 0 && files[0].id) {
    return files[0].id;
  }
  return null;
}

/**
 * Find a child folder by name under a parent folder (list children, match by name).
 * Used for domain-based upload: root → domain → PDF/Doc. No folder creation.
 */
export async function getChildFolderByName(parentId: string, folderName: string): Promise<string | null> {
  const drive = getDriveClient();
  const exactQ = `'${parentId}' in parents and name = '${escapeDriveQuery(folderName)}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const res = await drive.files.list({
    q: exactQ,
    pageSize: 10,
    fields: 'files(id,name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = res.data.files ?? [];
  const want = folderName.trim().toLowerCase();
  const exact = files.find((f) => f.name?.trim() === folderName.trim());
  if (exact?.id) return exact.id;
  const ci = files.find((f) => (f.name ?? '').trim().toLowerCase() === want);
  if (ci?.id) return ci.id;

  // Broad list (Drive "name =" is exact-only; users may use "pdf" vs "PDF")
  const broadQ = `'${parentId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const res2 = await drive.files.list({
    q: broadQ,
    pageSize: 100,
    fields: 'files(id,name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const all = res2.data.files ?? [];
  const match = all.find((f) => (f.name ?? '').trim().toLowerCase() === want);
  return match?.id ?? null;
}

/**
 * Resolve PDF and Doc folder IDs for a given domain (path lookup under GDRIVE_EBOOKS_ROOT_ID).
 * Structure: root → domain → PDF, root → domain → Doc. No instance level.
 * Uses cache per domain for the process lifetime to avoid repeated Drive list calls.
 * Domain is trimmed only so Drive folder names must match CSV exactly (e.g. "Lifestyle", "Comics & Graphic Novels").
 */
export async function resolveUploadFolders(domain: string): Promise<{ pdfFolderId: string; docFolderId: string }> {
  const rootId = process.env.GDRIVE_EBOOKS_ROOT_ID;
  if (!rootId) {
    throw new Error('GDRIVE_EBOOKS_ROOT_ID is not set');
  }
  const domainName = domain.trim();
  if (!domainName) {
    throw new Error('Domain is empty');
  }
  const cacheKey = domainName;
  const cached = uploadFoldersCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const domainFolderId = await getChildFolderByName(rootId, domainName);
  if (!domainFolderId) {
    throw new Error(`Domain folder "${domainName}" not found under root`);
  }
  const pdfFolderId = await getChildFolderByName(domainFolderId, 'PDF');
  if (!pdfFolderId) {
    throw new Error(`PDF folder not found under domain "${domainName}"`);
  }
  const docFolderId = await getChildFolderByName(domainFolderId, 'Doc');
  if (!docFolderId) {
    throw new Error(`Doc folder not found under domain "${domainName}"`);
  }
  const result = { pdfFolderId, docFolderId };
  uploadFoldersCache.set(cacheKey, result);
  return result;
}

/** Clear the resolveUploadFolders cache (e.g. between batch runs if needed). */
export function clearUploadFoldersCache(): void {
  uploadFoldersCache.clear();
}

/**
 * Upload a file buffer to a specific Google Drive folder.
 * Retries on transient network/server errors.
 * Returns the Drive file ID on success.
 * If BATCH_UPDATE_IF_EXISTS=true and file already exists, updates it instead of creating a duplicate.
 */
export async function uploadToDrive(
  fileBuffer: Buffer,
  fileName: string,
  folderId: string,
  mimeType: string,
): Promise<string> {
  const drive = getDriveClient();
  /** Default true: update by name to avoid duplicate files and flaky "already exists" behavior on re-upload. Set BATCH_UPDATE_IF_EXISTS=false to always create new files. */
  const updateIfExists = process.env.BATCH_UPDATE_IF_EXISTS !== 'false';

  for (let attempt = 0; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
    try {
      let existingId: string | null = null;
      if (updateIfExists) {
        try {
          existingId = await fileExistsInDrive(fileName, folderId);
        } catch (lookupErr) {
          const lmsg = lookupErr instanceof Error ? lookupErr.message : String(lookupErr);
          if (attempt < UPLOAD_MAX_RETRIES && isRetriableDriveError(lookupErr)) {
            const delay = UPLOAD_BASE_DELAY_MS * Math.pow(2, attempt);
            console.warn(
              `[DRIVE] fileExistsInDrive failed for "${fileName}" (${lmsg}). Retrying in ${delay / 1000}s...`,
            );
            await sleep(delay);
            continue;
          }
          throw lookupErr;
        }
      }

      if (existingId) {
        try {
          await drive.files.update({
            fileId: existingId,
            media: {
              mimeType,
              body: Readable.from(fileBuffer),
            },
            fields: 'id,name',
            supportsAllDrives: true,
          });
          console.log(`[DRIVE] Updated "${fileName}" in folder ${folderId} (id: ${existingId})`);
          return existingId;
        } catch (updateErr) {
          if (getHttpStatus(updateErr) === 404) {
            console.warn(
              `[DRIVE] Update failed (404) for "${fileName}" — file may have been removed; creating new file.`,
            );
            // fall through to create
          } else {
            throw updateErr;
          }
        }
      }

      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
        },
        media: {
          mimeType,
          body: Readable.from(fileBuffer),
        },
        fields: 'id,name',
        supportsAllDrives: true,
      });

      const fileId = response.data.id;
      if (!fileId) {
        throw new Error(`Drive upload succeeded but returned no file ID for "${fileName}"`);
      }
      console.log(`[DRIVE] Uploaded "${fileName}" → folder ${folderId} (id: ${fileId})`);
      return fileId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = getHttpStatus(err);

      if (attempt < UPLOAD_MAX_RETRIES && isRetriableDriveError(err)) {
        const delay = UPLOAD_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[DRIVE] Upload attempt ${attempt + 1}/${UPLOAD_MAX_RETRIES + 1} failed for "${fileName}" (HTTP ${status ?? '?'}): ${msg}. Retrying in ${delay / 1000}s...`,
        );
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Drive upload failed after ${UPLOAD_MAX_RETRIES + 1} attempts for "${fileName}"`);
}

export interface UploadFolders {
  pdfFolderId: string;
  docFolderId: string;
}

/**
 * Check if both PDF and DOCX for a book already exist in the configured Drive folders.
 * Used by batch CLI to skip generation when output already exists (duplicate prevention).
 * If folders is provided (domain-based), use those; else use GDRIVE_PDF_FOLDER_ID / GDRIVE_DOC_FOLDER_ID.
 */
export async function bookAlreadyInDrive(
  pdfFileName: string,
  docxFileName: string,
  folders?: UploadFolders,
): Promise<boolean> {
  const pdfFolderId = folders?.pdfFolderId ?? process.env.GDRIVE_PDF_FOLDER_ID;
  const docFolderId = folders?.docFolderId ?? process.env.GDRIVE_DOC_FOLDER_ID;
  if (!pdfFolderId || !docFolderId) return false;

  const [pdfExists, docxExists] = await Promise.all([
    fileExistsInDrive(pdfFileName, pdfFolderId),
    fileExistsInDrive(docxFileName, docFolderId),
  ]);
  return pdfExists !== null && docxExists !== null;
}

export async function uploadPdfToDrive(
  pdfBuffer: Buffer,
  fileName: string,
  folderId?: string,
): Promise<string> {
  const id = folderId ?? process.env.GDRIVE_PDF_FOLDER_ID;
  if (!id) {
    throw new Error('GDRIVE_PDF_FOLDER_ID not set in .env and no folderId provided');
  }
  return uploadToDrive(pdfBuffer, fileName, id, 'application/pdf');
}

export async function uploadDocxToDrive(
  docxBuffer: Buffer,
  fileName: string,
  folderId?: string,
): Promise<string> {
  const id = folderId ?? process.env.GDRIVE_DOC_FOLDER_ID;
  if (!id) {
    throw new Error('GDRIVE_DOC_FOLDER_ID not set in .env and no folderId provided');
  }
  return uploadToDrive(
    docxBuffer,
    fileName,
    id,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
}
