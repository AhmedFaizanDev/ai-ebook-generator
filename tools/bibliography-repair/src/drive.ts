import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const UPLOAD_MAX_RETRIES = 3;
const UPLOAD_BASE_DELAY_MS = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getOAuth2Client() {
  const clientId = process.env.GDRIVE_CLIENT_ID;
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GDRIVE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Google Drive credentials (GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN)');
  }
  const client = new google.auth.OAuth2(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

let _drive: drive_v3.Drive | null = null;
function getDrive(): drive_v3.Drive {
  if (!_drive) _drive = google.drive({ version: 'v3', auth: getOAuth2Client() });
  return _drive;
}

function escQ(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function findFileInFolder(fileName: string, folderId: string): Promise<string | null> {
  const drive = getDrive();
  const q = `'${folderId}' in parents and name = '${escQ(fileName)}' and trashed = false`;
  const res = await drive.files.list({ q, pageSize: 1, fields: 'files(id)', supportsAllDrives: true, includeItemsFromAllDrives: true });
  return res.data.files?.[0]?.id ?? null;
}

async function getChildFolder(parentId: string, name: string): Promise<string | null> {
  const drive = getDrive();
  const q = `'${parentId}' in parents and name = '${escQ(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const res = await drive.files.list({ q, pageSize: 1, fields: 'files(id)', supportsAllDrives: true, includeItemsFromAllDrives: true });
  return res.data.files?.[0]?.id ?? null;
}

async function createFolder(parentId: string, name: string): Promise<string> {
  const drive = getDrive();
  const res = await drive.files.create({
    requestBody: { name, parents: [parentId], mimeType: FOLDER_MIME },
    fields: 'id',
    supportsAllDrives: true,
  });
  const id = res.data.id;
  if (!id) throw new Error(`Failed to create folder "${name}" under ${parentId}`);
  console.log(`[drive] Created folder "${name}" → ${id}`);
  return id;
}

export interface DomainFolders {
  pdfFolderId: string;
  docFolderId: string;
}

// Source cache stores resolved values (source folders are read-only, no race risk).
const sourceCache = new Map<string, DomainFolders>();

// Dest cache stores Promises so concurrent workers for the same domain share
// one in-flight operation instead of each creating duplicate folders on Drive.
const destPending = new Map<string, Promise<DomainFolders>>();

export async function resolveSourceFolders(domain: string): Promise<DomainFolders> {
  const rootId = process.env.GDRIVE_SOURCE_ROOT_ID;
  if (!rootId) throw new Error('GDRIVE_SOURCE_ROOT_ID not set');
  const key = domain.trim();
  if (sourceCache.has(key)) return sourceCache.get(key)!;

  const domainId = await getChildFolder(rootId, key);
  if (!domainId) throw new Error(`Source domain folder "${key}" not found under root`);
  const pdfFolderId = await getChildFolder(domainId, 'PDF');
  if (!pdfFolderId) throw new Error(`PDF folder not found under source domain "${key}"`);
  const docFolderId = await getChildFolder(domainId, 'Doc');
  if (!docFolderId) throw new Error(`Doc folder not found under source domain "${key}"`);
  const result = { pdfFolderId, docFolderId };
  sourceCache.set(key, result);
  return result;
}

export async function resolveOrCreateDestFolders(domain: string): Promise<DomainFolders> {
  const rootId = process.env.GDRIVE_DEST_ROOT_ID;
  if (!rootId) throw new Error('GDRIVE_DEST_ROOT_ID not set');
  const key = domain.trim();

  // Return the in-flight (or already-resolved) promise so concurrent workers
  // for the same domain never race to create duplicate folders.
  const inflight = destPending.get(key);
  if (inflight) return inflight;

  const promise = (async (): Promise<DomainFolders> => {
    let domainId = await getChildFolder(rootId, key);
    if (!domainId) domainId = await createFolder(rootId, key);
    let pdfFolderId = await getChildFolder(domainId, 'PDF');
    if (!pdfFolderId) pdfFolderId = await createFolder(domainId, 'PDF');
    let docFolderId = await getChildFolder(domainId, 'Doc');
    if (!docFolderId) docFolderId = await createFolder(domainId, 'Doc');
    return { pdfFolderId, docFolderId };
  })();

  // Store the promise immediately — before it resolves — so any concurrent
  // call for the same domain awaits this exact promise.
  destPending.set(key, promise);
  return promise;
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export async function uploadFile(
  buf: Buffer,
  fileName: string,
  folderId: string,
  mimeType: string,
): Promise<string> {
  const drive = getDrive();
  for (let attempt = 0; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
    try {
      const existing = await findFileInFolder(fileName, folderId);
      if (existing) {
        await drive.files.update({
          fileId: existing,
          media: { mimeType, body: Readable.from(buf) },
          fields: 'id',
          supportsAllDrives: true,
        });
        return existing;
      }
      const res = await drive.files.create({
        requestBody: { name: fileName, parents: [folderId] },
        media: { mimeType, body: Readable.from(buf) },
        fields: 'id',
        supportsAllDrives: true,
      });
      const id = res.data.id;
      if (!id) throw new Error(`Upload succeeded but no ID returned for "${fileName}"`);
      return id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as Record<string, unknown>)?.code ?? (err as Record<string, unknown>)?.status;
      const retriable = typeof status === 'number'
        ? (status >= 500 || status === 429 || status === 408)
        : (msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('socket hang up'));
      if (attempt < UPLOAD_MAX_RETRIES && retriable) {
        const delay = UPLOAD_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[drive] Upload attempt ${attempt + 1} failed for "${fileName}": ${msg}. Retrying in ${delay / 1000}s...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Upload failed after ${UPLOAD_MAX_RETRIES + 1} attempts for "${fileName}"`);
}
