#!/bin/sh
set -e

case "$1" in
  api)
    echo "[entrypoint] Starting API server..."
    cd /app/apps/api
    exec node dist/index.js
    ;;

  batch)
    shift
    echo "[entrypoint] Running batch generation..."
    cd /app/apps/api
    npx --yes tsx src/cli/batch.ts "$@"
    ;;

  batch-status)
    cd /app/apps/api
    npx --yes tsx src/cli/batch-status.ts
    ;;

  *)
    exec "$@"
    ;;
esac
