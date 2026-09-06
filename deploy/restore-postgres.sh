#!/bin/sh
# Destructive restore of an Aurii PostgreSQL dump.
# Stop the runtime first. This replaces the target database contents.
# Usage: DATABASE_URL=... ./deploy/restore-postgres.sh /path/to/aurii-YYYYMMDD.dump
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
	echo "DATABASE_URL is required" >&2
	exit 1
fi

DUMP="${1:-}"
if [ -z "${DUMP}" ] || [ ! -f "${DUMP}" ]; then
	echo "Usage: $0 /path/to/aurii-backup.dump" >&2
	exit 1
fi

echo "Restoring ${DUMP} into DATABASE_URL (destructive)"
pg_restore --clean --if-exists --no-owner --dbname="${DATABASE_URL}" "${DUMP}"
echo "Restore finished. Restart Aurii and verify GET /health plus a known entity."
