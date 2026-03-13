import { Readable } from 'stream';
import { getDriveClient } from './auth';

const UPLOAD_MAX_RETRIES = 3;
const UPLOAD_BASE_DELAY_MS = 3000;

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

/**
 * Check if both PDF and DOCX for a book already exist in the configured Drive folders.
 * Used by batch CLI to skip generation when output already exists (duplicate prevention).
 */
export async function bookAlreadyInDrive(pdfFileName: string, docxFileName: string): Promise<boolean> {
  const pdfFolderId = process.env.GDRIVE_PDF_FOLDER_ID;
  const docFolderId = process.env.GDRIVE_DOC_FOLDER_ID;
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
): Promise<string> {
  const folderId = process.env.GDRIVE_PDF_FOLDER_ID;
  if (!folderId) {
    throw new Error('GDRIVE_PDF_FOLDER_ID not set in .env');
  }
  return uploadToDrive(pdfBuffer, fileName, folderId, 'application/pdf');
}

export async function uploadDocxToDrive(
  docxBuffer: Buffer,
  fileName: string,
): Promise<string> {
  const folderId = process.env.GDRIVE_DOC_FOLDER_ID;
  if (!folderId) {
    throw new Error('GDRIVE_DOC_FOLDER_ID not set in .env');
  }
  return uploadToDrive(
    docxBuffer,
    fileName,
    folderId,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
}
