#!/bin/sh
set -eu

for directory in /app /app/node_modules "${DATAFILE_ROOT:-/app}"; do
  if [ -d "$directory" ] && [ ! -w "$directory" ]; then
    echo "Cannot write $directory as UID=$(id -u) GID=$(id -g)." >&2
    echo "Set LOCAL_UID/LOCAL_GID to your host user and fix ownership of generated directories (see README.md)." >&2
    exit 1
  fi
done

echo "Installing dependencies in $(pwd) as UID=$(id -u) GID=$(id -g)..."
npm ci
exec "$@"
