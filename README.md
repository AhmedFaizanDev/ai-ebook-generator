# AI Ebook Generator

Generate structured technical ebooks (~250 pages) with OpenAI, exported as PDF and DOCX. Supports single-book (web UI) and bulk generation from CSV with upload to Google Drive.

## About the project

You give a **topic** (e.g. “Advanced Python Programming”). The app uses an LLM to produce a full textbook-style ebook: **cover and copyright page** (with optional author/ISBN from CSV), **preface**, **table of contents**, **10 units** of content (each with subtopics, summaries, and multiple-choice exercises), **capstone projects**, **case studies**, **glossary**, and **bibliography**. Output is academic in tone, with tables, code blocks, and consistent formatting. You can generate one book from the web UI or run **batch** from a CSV: each row becomes one ebook, exported as PDF and DOCX and uploaded to Google Drive. Batch runs support **checkpointing** (resume after a failure) and **automatic retries** for failed books.

## Stack

- **API**: Express + TypeScript (port 4000) — `apps/api`
- **Frontend**: Next.js (port 3000) — `apps/frontend`
- **LLM**: OpenAI (gpt-4o-mini). **PDF**: Puppeteer + pdf-lib. **DOCX**: html-to-docx. **Drive**: Google Drive API.

## Quick Start

**Local:**

```bash
npm install
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env: set OPENAI_API_KEY

cd apps/api && npm run dev          # Terminal 1
cd apps/frontend && npm run dev     # Terminal 2
```

Open http://localhost:3000.

**Docker:**

```bash
cp apps/api/.env.example apps/api/.env
# Edit .env with your keys

docker compose up -d --build
```

App at http://localhost:3000.

## Bulk Generation (Batch CLI)

Generate many ebooks from a CSV; each is exported as PDF + DOCX and uploaded to Google Drive.

**CSV format** (column A = title, B = optional author, C = optional ISBN):

```csv
Title of the Book,Author,ISBN
Advanced Python Programming,Dr. Jane Smith,979-8-12345-678-9
```

**One-time Drive setup:** Set `GDRIVE_CLIENT_ID`, `GDRIVE_CLIENT_SECRET` in `.env`. Start API, open http://localhost:4000/auth/google, grant access, copy the refresh token into `GDRIVE_REFRESH_TOKEN`. Set `GDRIVE_PDF_FOLDER_ID` and `GDRIVE_DOC_FOLDER_ID` to your Drive folder IDs.

**Run batch:**

```bash
# Local
cd apps/api
npm run batch -- batch-sample.csv

# Docker (CSV in apps/api is at /data in container)
docker compose up -d
docker compose exec app /docker-entrypoint.sh batch /data/batch-sample.csv

# Background on server
nohup docker compose exec app /docker-entrypoint.sh batch /data/batch-sample.csv > batch.log 2>&1 &
```

**Check progress:** `npm run batch-status` (local) or `docker compose exec app /docker-entrypoint.sh batch-status` (Docker).

## Environment

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | **Required.** OpenAI API key |
| `OPENAI_MODEL` / `LIGHT_MODEL` | Model (default: gpt-4o-mini) |
| `DEBUG_MODE` | `true` = 1 unit, 3 subtopics (testing); unset/false = full book |
| `GDRIVE_CLIENT_ID`, `GDRIVE_CLIENT_SECRET`, `GDRIVE_REFRESH_TOKEN` | For batch Drive upload |
| `GDRIVE_PDF_FOLDER_ID`, `GDRIVE_DOC_FOLDER_ID` | Drive folder IDs for PDFs and DOCXs |

See `apps/api/.env.example` for optional vars (timeouts, retry rounds, etc.).

## Deploy (e.g. AWS)

Use an instance with Docker (e.g. t3.medium). Clone repo, set `apps/api/.env`, then:

```bash
docker compose up -d --build
# Run batch via SSH as above; restrict ports via Security Groups.
```

Full technical details: [ARCHITECTURE.md](ARCHITECTURE.md).
