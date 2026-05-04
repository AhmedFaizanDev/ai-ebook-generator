import { Readable } from 'stream';
import { getDriveClient } from './auth';

const UPLOAD_MAX_RETRIES = 3;
const UPLOAD_BASE_DELAY_MS = 3000;

const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** Cache for resolveUploadFolders(domain) to avoid repeated Drive list calls per batch run. */
const uploadFoldersCache = new Map<string, { pdfFolderId: string; docFolderId: string }>();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
  const q = `'${parentId}' in parents and name = '${escapeDriveQuery(folderName)}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
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
  const updateIfExists = process.env.BATCH_UPDATE_IF_EXISTS === 'true';

  for (let attempt = 0; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
    try {
      const existingId = updateIfExists ? await fileExistsInDrive(fileName, folderId) : null;

      if (existingId) {
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
      const status = (err as Record<string, unknown>)?.code ?? (err as Record<string, unknown>)?.status;
      const isRetriable = typeof status === 'number'
        ? (status >= 500 || status === 429 || status === 408)
        : (msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('socket hang up') || msg.includes('rate'));

      if (attempt < UPLOAD_MAX_RETRIES && isRetriable) {
        const delay = UPLOAD_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[DRIVE] Upload attempt ${attempt + 1} failed for "${fileName}": ${msg}. Retrying in ${delay / 1000}s...`);
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
 * Check if batch outputs already exist in Drive (duplicate prevention).
 * If folders is provided (domain-based), use those; else use GDRIVE_PDF_FOLDER_ID / GDRIVE_DOC_FOLDER_ID.
 * When requireDocx is false (BATCH_EXPORT_DOCX=false), only the PDF must exist to treat the book as already uploaded.
 */
export async function bookAlreadyInDrive(
  pdfFileName: string,
  docxFileName: string,
  folders?: UploadFolders,
  options?: { requireDocx?: boolean },
): Promise<boolean> {
  const requireDocx = options?.requireDocx !== false;
  const pdfFolderId = folders?.pdfFolderId ?? process.env.GDRIVE_PDF_FOLDER_ID;
  const docFolderId = folders?.docFolderId ?? process.env.GDRIVE_DOC_FOLDER_ID;
  if (!pdfFolderId) return false;
  if (requireDocx && !docFolderId) return false;

  const pdfExists = await fileExistsInDrive(pdfFileName, pdfFolderId);
  if (pdfExists === null) return false;
  if (!requireDocx) return true;

  const docxExists = await fileExistsInDrive(docxFileName, docFolderId!);
  return docxExists !== null;
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
