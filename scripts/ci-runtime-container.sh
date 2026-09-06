#!/usr/bin/env bash
# Build the production Core image, migrate a clean Postgres, start the runtime,
# and assert /health. Used by CI. Does not deploy and does not use Norwegian Geo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE="${AURII_IMAGE:-aurii-core:ci}"
NETWORK="${AURII_CI_NETWORK:-aurii-ci}"
PG_NAME="${AURII_CI_PG_NAME:-aurii-ci-postgres}"
CORE_NAME="${AURII_CI_CORE_NAME:-aurii-ci-core}"
VERSION="${AURII_VERSION:-0.1.0}"
GIT_SHA="${AURII_GIT_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo unknown)}"
BUILD_TIME="${AURII_BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
TOKEN="ci-runtime-token"
ORIGIN="https://consumer.example"

cleanup() {
	docker rm -f "$CORE_NAME" >/dev/null 2>&1 || true
	docker rm -f "$PG_NAME" >/dev/null 2>&1 || true
	docker network rm "$NETWORK" >/dev/null 2>&1 || true
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

docker network create "$NETWORK"

echo "== Starting PostgreSQL =="
docker run -d --name "$PG_NAME" --network "$NETWORK" \
	-e POSTGRES_USER=aurii \
	-e POSTGRES_PASSWORD=aurii \
	-e POSTGRES_DB=aurii \
	postgres:16-alpine

for _ in $(seq 1 30); do
	if docker exec "$PG_NAME" pg_isready -U aurii -d aurii >/dev/null 2>&1; then
		break
	fi
	sleep 1
done
docker exec "$PG_NAME" pg_isready -U aurii -d aurii

DATABASE_URL="postgres://aurii:aurii@${PG_NAME}:5432/aurii"

echo "== Running migrations =="
docker run --rm --network "$NETWORK" \
	-e DATABASE_URL="$DATABASE_URL" \
	"$IMAGE" \
	bun run packages/db/scripts/migrate.ts

echo "== Starting runtime =="
docker run -d --name "$CORE_NAME" --network "$NETWORK" -p 3000:3000 \
	-e AURII_ENV=production \
	-e AURII_STORAGE=postgres \
	-e DATABASE_URL="$DATABASE_URL" \
	-e AURII_API_TOKEN="$TOKEN" \
	-e AURII_CORS_ORIGINS="$ORIGIN" \
	-e AURII_VERSION="$VERSION" \
	-e AURII_GIT_SHA="$GIT_SHA" \
	-e AURII_BUILD_TIME="$BUILD_TIME" \
	"$IMAGE"

echo "== Waiting for /health =="
ok=0
for _ in $(seq 1 30); do
	if curl -fsS "http://127.0.0.1:3000/health" >/tmp/aurii-health.json 2>/dev/null; then
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
code="$(curl -s -o /tmp/aurii-unauth.json -w '%{http_code}' http://127.0.0.1:3000/schemas)"
if [ "$code" != "401" ]; then
	echo "Expected 401 for unauthenticated /schemas, got ${code}" >&2
	cat /tmp/aurii-unauth.json >&2
	exit 1
fi

echo "== Invalid production config refuses to start =="
if docker run --rm --network "$NETWORK" \
	-e AURII_ENV=production \
	-e AURII_STORAGE=postgres \
	-e DATABASE_URL="$DATABASE_URL" \
	"$IMAGE"; then
	echo "Runtime started without AURII_API_TOKEN / CORS; expected failure" >&2
	exit 1
fi

echo "Runtime container proof PASSED."
