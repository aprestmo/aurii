#!/bin/sh
# Logical PostgreSQL backup for an Aurii runtime.
# Usage: DATABASE_URL=... BACKUP_DIR=/backups ./deploy/backup-postgres.sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
	echo "DATABASE_URL is required" >&2
	exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./.tmp/backups}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="${BACKUP_DIR}/aurii-${STAMP}.dump"

mkdir -p "${BACKUP_DIR}"
echo "Writing ${FILE}"
pg_dump --format=custom --no-owner --file="${FILE}" "${DATABASE_URL}"
echo "Backup complete: ${FILE}"

if [ -n "${BACKUP_UPLOAD_COMMAND:-}" ]; then
	echo "Running BACKUP_UPLOAD_COMMAND"
	# Operator-supplied; keep secrets out of the command string when possible.
	sh -c "${BACKUP_UPLOAD_COMMAND}"
fi

# Retention: keep the newest BACKUP_KEEP dump files.
if command -v find >/dev/null 2>&1; then
	# shellcheck disable=SC2012
	ls -1t "${BACKUP_DIR}"/aurii-*.dump 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))" | while read -r old; do
		rm -f "${old}"
		echo "Removed expired backup ${old}"
	done
fi
