#!/usr/bin/env bash
# Build Linux delivery artifacts with the server Docker daemon and commit them
# on an orphan local branch named delivery-artifact.
# Run this from the delivery branch. It does not modify delivery or refactor.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Run this script on the production server." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "The Docker daemon is not reachable." >&2
  exit 1
fi

current_branch="$(git branch --show-current)"
if [ "$current_branch" != "delivery" ]; then
  echo "Run this script from the delivery branch. Current branch: ${current_branch:-detached}." >&2
  exit 1
fi
if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  echo "The delivery working tree is not clean. Review and commit every change before building." >&2
  git -C "$ROOT" status --short >&2
  exit 1
fi
if git -C "$ROOT" show-ref --verify --quiet refs/heads/delivery-artifact; then
  echo "Branch delivery-artifact already exists. Inspect it and move it aside before rebuilding. This script does not delete branches." >&2
  exit 1
fi

echo "Building from the clean delivery commit."

OUT="$(mktemp -d)"
WT="$(mktemp -d)"
cleanup() {
  rm -rf "$OUT"
  if [ -d "$WT" ]; then
    git -C "$ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || true
    rm -rf "$WT"
  fi
}
trap cleanup EXIT

mkdir -p "$OUT/backend" "$OUT/frontend"
backend_log="$(mktemp)"
frontend_log="$(mktemp)"

docker build -f scripts/delivery/backend.Dockerfile -t jira-delivery-backend:build "$ROOT" >"$backend_log" 2>&1 &
backend_pid=$!
docker build -f scripts/delivery/frontend.Dockerfile -t jira-delivery-frontend:build "$ROOT" >"$frontend_log" 2>&1 &
frontend_pid=$!

backend_status=0
frontend_status=0
wait "$backend_pid" || backend_status=$?
wait "$frontend_pid" || frontend_status=$?
if [ "$backend_status" -ne 0 ]; then
  echo "Backend delivery build failed." >&2
  cat "$backend_log" >&2
  exit "$backend_status"
fi
if [ "$frontend_status" -ne 0 ]; then
  echo "Frontend delivery build failed." >&2
  cat "$frontend_log" >&2
  exit "$frontend_status"
fi
rm -f "$backend_log" "$frontend_log"

backend_container="$(docker create jira-delivery-backend:build)"
docker cp "$backend_container":/app/. "$OUT/backend/"
docker rm "$backend_container" >/dev/null
cp scripts/delivery/runtime-backend.Dockerfile "$OUT/backend/Dockerfile"

frontend_container="$(docker create jira-delivery-frontend:build)"
docker cp "$frontend_container":/app/. "$OUT/frontend/"
docker rm "$frontend_container" >/dev/null
cp scripts/delivery/runtime-frontend.Dockerfile "$OUT/frontend/Dockerfile"

py_leak="$(find "$OUT/backend/app" -name '*.py' -print -quit)"
so_module="$(find "$OUT/backend/app" -name '*.so' -print -quit)"
source_map="$(find "$OUT/frontend/.next-prod" -name '*.map' -print -quit)"
runtime_asset="$(find "$OUT/backend/app/assets" -type f -print -quit)"
packaged_secret="$(find "$OUT" \( -name '.env' -o -name '.env.*' -o -name 'users.xlsx' -o -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' \) -print -quit)"
if [ -n "$py_leak" ]; then
  echo "Python sources leaked into the compiled backend." >&2
  exit 1
fi
if [ -z "$so_module" ]; then
  echo "No compiled backend modules were exported." >&2
  exit 1
fi
if [ ! -f "$OUT/frontend/server.js" ]; then
  echo "Frontend bundle is missing server.js." >&2
  exit 1
fi
if [ -d "$OUT/frontend/src" ]; then
  echo "Frontend source directory was exported." >&2
  exit 1
fi
if [ -n "$source_map" ]; then
  echo "Source maps leaked into the frontend bundle." >&2
  exit 1
fi
if [ -z "$runtime_asset" ]; then
  echo "Runtime assets were not exported." >&2
  exit 1
fi
if [ ! -f "$OUT/backend/alembic.ini" ] || [ ! -f "$OUT/backend/alembic/env.py" ]; then
  echo "Alembic configuration was not exported." >&2
  exit 1
fi
if [ -n "$packaged_secret" ]; then
  echo "Refusing to package secrets, the employee workbook, or a database file: $packaged_secret" >&2
  exit 1
fi
if grep -R --include='*.py' -n "op.create_table" "$OUT/backend/alembic/versions" >/dev/null; then
  echo "Database migration source leaked into the delivery snapshot." >&2
  exit 1
fi

cp scripts/delivery/docker-compose.yml "$OUT/docker-compose.yml"
cp scripts/delivery/DELIVERY_README.md "$OUT/README.md"
cat > "$OUT/.gitignore" <<'EOF'
.env
.env.*
users.xlsx
data/
*.db
*.sqlite
*.sqlite3
EOF

large="$(find "$OUT" -type f -size +95M -print)"
if [ -n "$large" ]; then
  echo "These files are too large to push to most Git hosts:" >&2
  echo "$large" >&2
  exit 1
fi

rmdir "$WT"
git -C "$ROOT" worktree add --detach "$WT" HEAD
git -C "$WT" checkout --orphan delivery-artifact
git -C "$WT" rm -rf . >/dev/null
cp -a "$OUT"/. "$WT"/
git -C "$WT" add -A
git -C "$WT" commit -m "$(cat <<'EOF'
Add the compiled delivery artifact.

Ship the production frontend bundle and Cython backend on delivery-artifact so the delivery branch keeps its source.
EOF
)"

git -C "$ROOT" worktree remove --force "$WT"
WT=""

echo
echo "Local branch delivery-artifact is ready on this server."
echo "The delivery branch was not modified."
echo "Push delivery-artifact only to a remote that does not also contain the source branches."
echo "Do not merge delivery-artifact back into delivery or refactor."
