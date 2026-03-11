# Where batch checkpoints are stored

## When running with Docker

Session checkpoints are stored in a **Docker named volume**, not in your project folder.

- **Volume name:** `sessions` (full name: `ebook-generator_sessions` or similar)
- **Path inside container:** `/app/apps/api/.sessions/`
- **One file per book:** `<stableId>.json` (e.g. `6b2c4d5dfe55001e.json` for "Advanced Deconstruction")

### View session files

```bash
docker compose run --rm app ls -la /app/apps/api/.sessions
```

### Inspect a session (see phase, progress)

```bash
docker compose run --rm app sh -c "head -c 500 /app/apps/api/.sessions/6b2c4d5dfe55001e.json"
```

### Optional: store checkpoints on your machine

To see `.sessions` as a folder in your project, change `docker-compose.yml`:

```yaml
volumes:
  - ./apps/api/.sessions:/app/apps/api/.sessions   # bind mount (visible on host)
  - batch_progress:/app/apps/api/.batch-progress
  - ./apps/api:/data:ro
```

Remove the `sessions:` named volume and the `sessions:` entry under `volumes:` at the bottom. Then checkpoints will appear in `apps/api/.sessions/` on your disk.

---

## When running locally (e.g. `npm run batch`)

Checkpoints are stored in:

- **Directory:** `apps/api/.sessions/`
- **File per book:** `<stableId>.json`

You can open that folder directly in Explorer or your editor.
