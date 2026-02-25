import { Readable } from 'stream';
import { getDriveClient } from './auth';

const UPLOAD_MAX_RETRIES = 3;
const UPLOAD_BASE_DELAY_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Upload a file buffer to a specific Google Drive folder.
 * Retries on transient network/server errors.
 * Returns the Drive file ID on success.
 */
export async function uploadToDrive(
  fileBuffer: Buffer,
  fileName: string,
  folderId: string,
  mimeType: string,
): Promise<string> {
  const drive = getDriveClient();

  for (let attempt = 0; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
    try {
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
