import JSZip from 'jszip';

/**
 * Replace the Bibliography section in a DOCX buffer.
 *
 * Strategy: DOCX is a zip containing word/document.xml.  We search for the
 * first paragraph whose text contains "Bibliography" that is styled as a heading
 * (w:pStyle val containing "Heading").  Everything from that paragraph to the end
 * of the document body is removed and replaced with new bibliography paragraphs
 * built from the provided markdown.
 *
 * Fallback: if no heading-styled "Bibliography" paragraph is found, we search for
 * any paragraph whose full text is exactly "Bibliography" (case-insensitive).
 *
 * If neither succeeds, we append the new bibliography at the end.
 */
export async function patchDocx(docxBuf: Buffer, bibliographyMd: string): Promise<Buffer> {
  const zip = await JSZip.loadAsync(docxBuf);
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) throw new Error('word/document.xml not found in DOCX');

  let xml = await docXmlFile.async('string');

  const bibParagraphs = buildBibParagraphsXml(bibliographyMd);

  const cutResult = cutFromBibliography(xml);
  if (cutResult) {
    xml = cutResult.before + bibParagraphs + cutResult.bodyClose;
  } else {
    const bodyCloseIdx = xml.lastIndexOf('</w:body>');
    if (bodyCloseIdx < 0) throw new Error('Cannot find </w:body> in document.xml');
    xml = xml.slice(0, bodyCloseIdx) + bibParagraphs + xml.slice(bodyCloseIdx);
  }

  zip.file('word/document.xml', xml);
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

interface CutResult {
  before: string;
  bodyClose: string;
}

function cutFromBibliography(xml: string): CutResult | null {
  const bodyCloseTag = '</w:body>';
  const bodyCloseIdx = xml.lastIndexOf(bodyCloseTag);
  if (bodyCloseIdx < 0) return null;

  const bodyClose = xml.slice(bodyCloseIdx);
  const bodyContent = xml.slice(0, bodyCloseIdx);

  // Match <w:p ...>...</w:p> paragraphs; find the first one containing "Bibliography"
  // that also has a heading style (Heading1, Heading 1, etc.) OR whose run text is exactly "Bibliography".
  const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let match: RegExpExecArray | null;
  let bibStart = -1;

  while ((match = pRegex.exec(bodyContent)) !== null) {
    const pXml = match[0];
    const plainText = extractParagraphText(pXml);

    if (!/bibliography/i.test(plainText)) continue;

    // Check if this is a heading style or if the paragraph text is just "Bibliography"
    const isHeadingStyle = /w:pStyle\s+w:val="[^"]*[Hh]eading/i.test(pXml);
    const isExactText = /^\s*bibliography\s*$/i.test(plainText);
    // Avoid TOC entries: they usually contain w:fldChar or HYPERLINK or TOC
    const isTocEntry = /w:fldChar|HYPERLINK|TOC\s/i.test(pXml);

    if (isTocEntry) continue;

    if (isHeadingStyle || isExactText) {
      bibStart = match.index;
      break;
    }
  }

  if (bibStart < 0) return null;

  return { before: bodyContent.slice(0, bibStart), bodyClose };
}

function extractParagraphText(pXml: string): string {
  const texts: string[] = [];
  const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = tRegex.exec(pXml)) !== null) {
    texts.push(m[1]);
  }
  return texts.join('');
}

/**
 * Convert bibliography markdown into OOXML paragraphs.
 * Keeps formatting simple and robust: headings become bold paragraphs,
 * list items become regular paragraphs with a dash prefix.
 */
function buildBibParagraphsXml(md: string): string {
  const lines = md.split('\n').filter((l) => l.trim());
  const paragraphs: string[] = [];

  // Page break before bibliography
  paragraphs.push(
    `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>`,
  );

  for (const line of lines) {
    if (/^#\s+Bibliography/i.test(line)) {
      paragraphs.push(makeHeading1('Bibliography'));
    } else if (/^###\s+(.+)/.test(line)) {
      const title = line.replace(/^###\s+/, '').trim();
      paragraphs.push(makeHeading3(title));
    } else if (/^[-*]\s+(.+)/.test(line)) {
      const text = line.replace(/^[-*]\s+/, '').trim();
      paragraphs.push(makeListItem(text));
    }
  }

  return paragraphs.join('');
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function makeHeading1(text: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escXml(text)}</w:t></w:r></w:p>`;
}

function makeHeading3(text: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escXml(text)}</w:t></w:r></w:p>`;
}

function makeListItem(text: string): string {
  return `<w:p><w:r><w:t xml:space="preserve">- ${escXml(text)}</w:t></w:r></w:p>`;
}
