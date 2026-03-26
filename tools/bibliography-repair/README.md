# Bibliography Repair Tool (one-off, disposable)

Repairs corrupted Bibliography sections in already-generated ebooks (PDF + DOCX)
and uploads corrected files to a separate mirrored Google Drive root.

## Setup

```bash
cd tools/bibliography-repair
npm install
cp .env.example .env   # fill in credentials
```

## Usage

Prepare a CSV with columns `title` and `domain` (and optional `author`):

```csv
title,domain
Stock Market Analysis,Economics
Web Design and HTML Rendering,Liberal Arts
```

Run:

```bash
npm run repair -- path/to/affected.csv
```

The tool is **resumable**: progress is saved to `.repair-progress.json`.
Re-running the same CSV skips already-completed books.

## Output

- Corrected PDF + DOCX uploaded to the destination Drive root (mirrored `domain/PDF` and `domain/Doc` structure).
- `results.json` — full per-book status report.
- `failures.csv` — only failed books with reasons.

## Environment variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for bibliography generation |
| `OPENAI_MODEL` | Model to use (default: `gpt-4o-mini`) |
| `GDRIVE_CLIENT_ID` | Google OAuth client ID |
| `GDRIVE_CLIENT_SECRET` | Google OAuth client secret |
| `GDRIVE_REFRESH_TOKEN` | Google OAuth refresh token |
| `GDRIVE_SOURCE_ROOT_ID` | Drive folder ID of the existing ebooks root |
| `GDRIVE_DEST_ROOT_ID` | Drive folder ID of the new output root |
| `CONCURRENCY` | Books processed in parallel (default: `2`) |
