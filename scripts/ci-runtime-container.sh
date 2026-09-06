#!/usr/bin/env bash
# Build the production Core image, migrate a clean Postgres, start the runtime,
# and assert /health. Used by CI. Does not deploy and does not use Norwegian Geo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE="${AURII_IMAGE:-aurii-core:ci}"
PG_NAME="${AURII_CI_PG_NAME:-aurii-ci-postgres}"
CORE_NAME="${AURII_CI_CORE_NAME:-aurii-ci-core}"
VERSION="${AURII_VERSION:-0.1.0}"
GIT_SHA="${AURII_GIT_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo unknown)}"
BUILD_TIME="${AURII_BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
TOKEN="ci-runtime-token"
ORIGIN="https://consumer.example"
PG_PORT="${AURII_CI_PG_PORT:-5432}"
CORE_PORT="${AURII_CI_CORE_PORT:-3000}"

# From another container, reach published host ports.
HOST_GATEWAY=host.docker.internal
DATABASE_URL_FROM_CONTAINER="postgres://aurii:aurii@${HOST_GATEWAY}:${PG_PORT}/aurii"

cleanup() {
	docker rm -f "$CORE_NAME" >/dev/null 2>&1 || true
	docker rm -f "$PG_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "== Building ${IMAGE} =="
docker build \
	-f Dockerfile.core \
	--build-arg "AURII_VERSION=${VERSION}" \
	--build-arg "AURII_GIT_SHA=${GIT_SHA}" \
	--build-arg "AURII_BUILD_TIME=${BUILD_TIME}" \
	-t "$IMAGE" \
	.

echo "== Starting PostgreSQL =="
docker run -d --name "$PG_NAME" \
	-e POSTGRES_USER=aurii \
	-e POSTGRES_PASSWORD=aurii \
	-e POSTGRES_DB=aurii \
	-p "${PG_PORT}:5432" \
	postgres:16-alpine

echo "== Waiting for PostgreSQL =="
n=0
until docker exec "$PG_NAME" pg_isready -U aurii -d aurii; do
	n=$((n + 1))
	if [ "$n" -ge 60 ]; then
		echo "Postgres did not become ready" >&2
		docker logs "$PG_NAME" >&2 || true
		exit 1
	fi
	sleep 1
done

echo "== Waiting for published port ${PG_PORT} =="
n=0
until python3 -c "import socket; socket.create_connection(('127.0.0.1', int('${PG_PORT}')), 2).close()"; do
	n=$((n + 1))
	if [ "$n" -ge 30 ]; then
		echo "Postgres port ${PG_PORT} is not reachable on the host" >&2
		exit 1
	fi
	sleep 1
done

echo "== Running migrations =="
migrated=0
n=0
until [ "$n" -ge 10 ]; do
	if docker run --rm \
		--add-host="${HOST_GATEWAY}:host-gateway" \
		-e DATABASE_URL="$DATABASE_URL_FROM_CONTAINER" \
		"$IMAGE" \
		bun run packages/db/scripts/migrate.ts; then
		migrated=1
		break
	fi
	n=$((n + 1))
	sleep 2
done
if [ "$migrated" -ne 1 ]; then
	echo "Migrations failed" >&2
	exit 1
fi

echo "== Starting runtime =="
docker run -d --name "$CORE_NAME" \
	--add-host="${HOST_GATEWAY}:host-gateway" \
	-p "127.0.0.1:${CORE_PORT}:3000" \
	-e AURII_ENV=production \
	-e AURII_STORAGE=postgres \
	-e DATABASE_URL="$DATABASE_URL_FROM_CONTAINER" \
	-e AURII_API_TOKEN="$TOKEN" \
	-e AURII_CORS_ORIGINS="$ORIGIN" \
	-e AURII_VERSION="$VERSION" \
	-e AURII_GIT_SHA="$GIT_SHA" \
	-e AURII_BUILD_TIME="$BUILD_TIME" \
	"$IMAGE"

echo "== Waiting for /health =="
ok=0
for _ in $(seq 1 40); do
	if curl -fsS "http://127.0.0.1:${CORE_PORT}/health" >/tmp/aurii-health.json 2>/dev/null; then
		ok=1
		break
	fi
	sleep 1
done
if [ "$ok" -ne 1 ]; then
	echo "Health check failed" >&2
	docker logs "$CORE_NAME" >&2 || true
	exit 1
fi

python3 - <<'PY'
import json
body = json.load(open("/tmp/aurii-health.json"))
assert body["status"] == "ok", body
assert body["storage"] == "postgres", body
assert body["database"]["connected"] is True, body
assert body["release"]["version"], body
print("health ok:", json.dumps(body, indent=2))
PY

echo "== Auth boundary =="
code="$(curl -s -o /tmp/aurii-unauth.json -w '%{http_code}' "http://127.0.0.1:${CORE_PORT}/schemas")"
if [ "$code" != "401" ]; then
	echo "Expected 401 for unauthenticated /schemas, got ${code}" >&2
	cat /tmp/aurii-unauth.json >&2
	exit 1
fi

echo "== Invalid production config refuses to start =="
if docker run --rm \
	--add-host="${HOST_GATEWAY}:host-gateway" \
	-e AURII_ENV=production \
	-e AURII_STORAGE=postgres \
	-e DATABASE_URL="$DATABASE_URL_FROM_CONTAINER" \
	"$IMAGE"; then
	echo "Runtime started without AURII_API_TOKEN / CORS; expected failure" >&2
	exit 1
fi

echo "Runtime container proof PASSED."
