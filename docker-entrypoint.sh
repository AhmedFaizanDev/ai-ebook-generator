#!/bin/sh
set -e

case "$1" in
  web)
    echo "[entrypoint] Starting API server..."
    cd /app/apps/api
    node dist/index.js &
    API_PID=$!

    echo "[entrypoint] Starting frontend..."
    cd /app/apps/frontend
    npx next start -p 3000 &
    FRONTEND_PID=$!

    trap "kill $API_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGTERM SIGINT
    wait
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
