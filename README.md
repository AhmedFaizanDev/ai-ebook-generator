# AI Ebook Generator

Generate ~250-page structured technical ebooks using OpenAI, exported as PDF and DOCX.

## Stack

- **Frontend**: Next.js 14 (App Router) — `apps/frontend` on port 3000
- **Backend**: Express.js + TypeScript — `apps/api` on port 4000
- **LLM**: OpenAI API (gpt-4o / gpt-4o-mini)
- **PDF**: Puppeteer + pdf-lib
- **DOCX**: html-to-docx
- **Drive**: Google Drive API for bulk upload
- **Deploy**: Docker + Docker Compose (AWS EC2)

## Quick Start (Local)

```bash
# Install dependencies (from repo root)
npm install

# Configure environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your OpenAI API key

# Start backend (Terminal 1)
cd apps/api
npm run dev

# Start frontend (Terminal 2)
cd apps/frontend
npm run dev
```

Open http://localhost:3000 to generate a single ebook.

## Quick Start (Docker)

```bash
# Configure environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your keys

# Build and start
docker compose up -d --build

# View logs
docker compose logs -f
```

The app will be available at http://localhost:3000.

## Bulk Generation (CLI)

Generate multiple ebooks from a CSV file. Each book is exported as PDF + DOCX and uploaded to Google Drive.

### Prerequisites

1. A Google Cloud project with Drive API enabled
2. OAuth 2.0 credentials (Web application type)
3. A refresh token (run the one-time setup below)
4. Two Google Drive folders (one for PDFs, one for DOCXs)

### One-Time Google Drive Setup

```bash
# 1. Set GDRIVE_CLIENT_ID and GDRIVE_CLIENT_SECRET in apps/api/.env
# 2. Start the API server
cd apps/api && npm run dev

# 3. Visit http://localhost:4000/auth/google in your browser
# 4. Grant Drive access
# 5. Copy the displayed refresh token into GDRIVE_REFRESH_TOKEN in .env
# 6. Set GDRIVE_PDF_FOLDER_ID and GDRIVE_DOC_FOLDER_ID from your Drive folder URLs
```

### CSV Format

Create a CSV file with book titles in column A:

```csv
title
Advanced Python Programming
Machine Learning Fundamentals
Cloud Architecture Patterns
```

### Running Bulk Generation

**Locally:**

```bash
cd apps/api
npm run batch -- path/to/books.csv
```

**Via Docker:**

The repo mounts `./apps/api` into the container at `/data`, so your CSV in `apps/api/` is available at `/data/<filename>.csv`:

```bash
docker compose run --rm app batch /data/batch-sample.csv
```

**Via SSH on EC2:**

```bash
ssh -i your-key.pem ec2-user@your-ec2-ip
cd ebook-generator/apps/api
npm run batch -- path/to/books.csv
```

**Check batch progress**

- **If the backend runs on the host** (e.g. you ran `npm run batch` directly): from the API directory run  
  `npm run batch-status`
- **If the backend runs in Docker**: SSH in, then run the status **inside** the running container:

```bash
docker compose exec app /docker-entrypoint.sh batch-status
```

(Runs the status script inside the running container where batch progress is stored.)  
Shows how many ebooks completed, how many failed, and lists the titles.

The CLI will:
1. Read all titles from the CSV
2. Generate each book sequentially (full pipeline)
3. Export PDF and DOCX for each
4. Upload both files to Google Drive
5. Print a summary of successes and failures

## AWS Deployment

### Recommended Instance

`t3.medium` or `t3.large` (2–4 vCPU, 4–8 GB RAM).

### Steps

```bash
# 1. SSH into EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# 2. Install Docker + Docker Compose
sudo yum update -y && sudo yum install -y docker
sudo systemctl start docker && sudo systemctl enable docker
sudo usermod -aG docker ec2-user
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose

# 3. Clone and configure
git clone <your-repo-url> ebook-generator && cd ebook-generator
cp apps/api/.env.example apps/api/.env
nano apps/api/.env  # Fill in API keys, Drive credentials

# 4. Update NEXT_PUBLIC_API_URL in docker-compose.yml to http://your-ec2-ip:4000

# 5. Build and run
docker compose up -d --build
```

### Security

- Restrict ports 3000/4000 via AWS Security Groups (allow only your IP)
- For public access, add an ALB or Nginx reverse proxy with HTTPS
- Never commit `.env` files — use `.env.example` as a template
- Bulk generation is CLI-only (SSH access required)

## Environment

Copy `apps/api/.env.example` or set these in `apps/api/.env`:

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `OPENAI_MODEL` | No | Primary model (default: `gpt-4o-mini`) |
| `LIGHT_MODEL` | No | Cheap model for summaries/exercises (default: `gpt-4o-mini`) |
| `DEBUG_MODE` | No | `true` for minimal output (1 unit, 1 subtopic) |
| `PORT` | No | API port (default: `4000`) |
| `NEXT_PUBLIC_API_URL` | No | API URL for frontend (default: `http://localhost:4000`) |
| `GDRIVE_CLIENT_ID` | For bulk | Google OAuth client ID |
| `GDRIVE_CLIENT_SECRET` | For bulk | Google OAuth client secret |
| `GDRIVE_REFRESH_TOKEN` | For bulk | Google OAuth refresh token |
| `GDRIVE_PDF_FOLDER_ID` | For bulk | Google Drive folder ID for PDFs |
| `GDRIVE_DOC_FOLDER_ID` | For bulk | Google Drive folder ID for DOCXs |

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full technical reference — orchestration pipeline, token budgets, Docker internals, and generation flow.
