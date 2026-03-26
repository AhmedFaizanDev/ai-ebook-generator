import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolsDir = path.resolve(__dirname, '..', '..');
const completedPath = path.join(toolsDir, 'compleated.txt');
const junkPath = path.join(__dirname, '..', 'Junk eBooks.csv');
const outPath = path.join(__dirname, '..', 'Junk-eBooks-remaining.csv');

const completedRaw = fs.readFileSync(completedPath, 'utf8');
const completed = new Set();
for (const m of completedRaw.matchAll(/"([^"]+)"/g)) {
  completed.add(m[1].trim());
}

const lines = fs.readFileSync(junkPath, 'utf8').split(/\r?\n/).filter(Boolean);
const header = lines[0];
const rows = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  const idx = line.indexOf(',');
  if (idx < 0) continue;
  const title = line.slice(0, idx).trim();
  const domain = line.slice(idx + 1).trim();
  if (!title || !domain) continue;
  if (!completed.has(title)) rows.push({ title, domain });
}

function csvEscape(s) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const csv = [header, ...rows.map((r) => `${csvEscape(r.title)},${csvEscape(r.domain)}`)].join('\n') + '\n';
fs.writeFileSync(outPath, csv, 'utf8');

console.log('Completed titles parsed:', completed.size);
console.log('Remaining rows:', rows.length);
console.log('Written:', outPath);
rows.forEach((r) => console.log(' -', r.title, '|', r.domain));
