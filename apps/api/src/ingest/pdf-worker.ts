import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';

const nodeRequire = createRequire(__filename);

/**
 * Deep-copy PDF bytes so pdf.js can postMessage them to the worker (Node `Buffer`/`Uint8Array`
 * backed by pooled ArrayBuffers often throws DataCloneError with structuredClone).
 */
export function clonePdfBytes(input: Buffer | Uint8Array): Uint8Array {
  const len = input.byteLength;
  const out = new Uint8Array(len);
  out.set(input);
  return out;
}

/** Load pdf.js legacy build for Node (see pdfjs-dist warning for non-legacy imports). */
export async function loadPdfJsModule(): Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> {
  const pkgRoot = path.dirname(nodeRequire.resolve('pdfjs-dist/package.json'));
  const pdfMjs = path.join(pkgRoot, 'legacy', 'build', 'pdf.mjs');
  const workerMjs = path.join(pkgRoot, 'legacy', 'build', 'pdf.worker.mjs');
  const pdfModule = await import(pathToFileURL(pdfMjs).href);
  pdfModule.GlobalWorkerOptions.workerSrc = pathToFileURL(workerMjs).href;
  return pdfModule;
}
