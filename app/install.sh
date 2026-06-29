#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "============================================================"
echo "  EliteFlow Nebula v2 - installer"
echo "============================================================"
echo "Press Enter to accept the [default] shown in brackets."
echo

ask() { # ask VAR "prompt" "default"
  local __var="$1" __prompt="$2" __default="${3:-}" __input
  read -r -p "$__prompt [${__default}]: " __input || true
  printf -v "$__var" '%s' "${__input:-$__default}"
}

abspath() { ( cd "$1" 2>/dev/null && pwd ) || printf '%s' "$1"; }

ask PROJECT_NAME    "Project name" "EliteFlow Nebula"
ask WORKSPACE_PATH  "Workspace path (instruction/, persona/, database/)" "../workspace"
WORKSPACE_PATH="$(abspath "$WORKSPACE_PATH")"
ask SOURCE_REPO_PATH "Product repo the personas generate/edit" "../product"
SOURCE_REPO_PATH="$(abspath "$SOURCE_REPO_PATH")"
echo
echo "Claude Code authentication (the container runs unattended, so it cannot do the"
echo "browser popup at run time - supply a credential it can read):"
echo "  [1] Claude subscription token  (run 'claude setup-token' once to mint it; no per-token bill)"
echo "  [2] Anthropic API key          (Console; billed per token)"
ask AUTH_METHOD "Choose 1 or 2" "1"
CLAUDE_CODE_OAUTH_TOKEN=""
ANTHROPIC_API_KEY=""
if [ "$AUTH_METHOD" = "2" ]; then
  read -r -p "Anthropic API key (sk-ant-...): " ANTHROPIC_API_KEY || true
else
  read -r -p "Claude OAuth token (from claude setup-token): " CLAUDE_CODE_OAUTH_TOKEN || true
fi
# Subscription installs enforce OAUTH_ONLY (orchestrator refuses a stray metered key);
# api-key installs leave it blank so the metered key is allowed.
OAUTH_ONLY=""
[ "$AUTH_METHOD" != "2" ] && OAUTH_ONLY="true"
ask CLAUDE_MODEL    "Claude model" "claude-opus-4-8"
ask POSTGRES_PASSWORD "Database password" "change-me"
ask POSTGRES_PORT   "Postgres host port" "5432"
ask WEB_PORT        "Web UI port" "3000"
ask TIMEZONE        "Timezone" "Asia/Bangkok"
ask CYCLE_CRON      "Work-cycle cron (blank = on-demand only)" "*/30 * * * *"

POSTGRES_USER=agentflow
POSTGRES_DB=agentflow
DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"
# Reuse an existing APP_SECRET if .env already exists — regenerating it would make any
# stored Claude credential undecryptable. Only generate a fresh one on first install.
APP_SECRET=""
[ -f .env ] && APP_SECRET="$(grep -E '^APP_SECRET=' .env | head -1 | cut -d= -f2-)"
[ -z "${APP_SECRET}" ] && APP_SECRET="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"

echo
echo "Writing .env ..."
cat > .env <<EOF
PROJECT_NAME=${PROJECT_NAME}
TIMEZONE=${TIMEZONE}
APP_SECRET=${APP_SECRET}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_PORT=${POSTGRES_PORT}
DATABASE_URL=${DATABASE_URL}
CLAUDE_CODE_OAUTH_TOKEN=${CLAUDE_CODE_OAUTH_TOKEN}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
OAUTH_ONLY=${OAUTH_ONLY}
CLAUDE_MODEL=${CLAUDE_MODEL}
WORKSPACE_PATH=${WORKSPACE_PATH}
SOURCE_REPO_PATH=${SOURCE_REPO_PATH}
WEB_PORT=${WEB_PORT}
CYCLE_CRON=${CYCLE_CRON}
MAX_RUNS_PER_CYCLE=12
EOF

echo
echo "Starting the stack (docker compose up -d --build) ..."
docker compose -f infra/docker-compose.yml up -d --build

echo
echo "============================================================"
echo "  Done. Open the dashboard at http://localhost:${WEB_PORT}"
echo "  Logs:   docker compose -f infra/docker-compose.yml logs -f"
echo "  Stop:   docker compose -f infra/docker-compose.yml down"
echo "============================================================"
