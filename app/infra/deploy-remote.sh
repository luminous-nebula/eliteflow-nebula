#!/usr/bin/env bash
set -euo pipefail

# Remote-Docker deploy (ADR-0002 D4 fast-follow, minimal path).
#
# Deploys the EliteFlow stack to a remote Docker engine over SSH. With
# DOCKER_HOST=ssh://… the compose file, env_file, and build contexts are all read on
# THIS machine (the build context streams over the SSH pipe); only the bind-mount
# paths (WORKSPACE_PATH / SOURCE_REPO_PATH) resolve on the remote host. So the deploy
# is: sync the two data dirs to the remote, point a derived env file at their remote
# paths, and run the same compose file against the remote daemon.
#
# Usage:
#   REMOTE=user@192.168.1.120 ./infra/deploy-remote.sh
# Optional env:
#   REMOTE_DIR   base dir on the remote for the data dirs (default: ~/eliteflow-nebula)
#   SSH_OPTS     extra ssh options, e.g. "-i ~/.ssh/mykey"
#
# Requirements: ssh key-based access to the remote; Docker engine + compose plugin on
# the remote; the remote user in the `docker` group. Run from the app/ directory (or
# anywhere — paths are derived from this script's location).

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # app/infra
APP="$(dirname "$HERE")"                                # app/
ROOT="$(dirname "$APP")"                                # eliteflow-nebula/

REMOTE="${REMOTE:?Set REMOTE=user@host (e.g. REMOTE=ops@192.168.1.120)}"
REMOTE_DIR="${REMOTE_DIR:-eliteflow-nebula}"            # relative to the remote $HOME
SSH_OPTS="${SSH_OPTS:-}"

# shellcheck disable=SC2086
rssh() { ssh $SSH_OPTS -o BatchMode=yes "$REMOTE" "$@"; }

echo "==> Preflight: ssh + remote docker"
rssh 'echo "remote: $(uname -sr) as $(whoami)"'
rssh 'docker version --format "docker {{.Server.Version}}" && docker compose version --short' \
  || { echo "ERROR: docker engine + compose plugin required on the remote (user in docker group)."; exit 1; }

REMOTE_HOME="$(rssh 'echo $HOME')"
RBASE="$REMOTE_HOME/$REMOTE_DIR"
echo "==> Remote base: $RBASE"

echo "==> Sync workspace/ and product/ (tar over ssh — rsync not assumed)"
rssh "mkdir -p '$RBASE/workspace' '$RBASE/product'"
tar -C "$ROOT" -cf - workspace | rssh "tar -C '$RBASE' -xf -"
[ -d "$ROOT/product" ] && tar -C "$ROOT" -cf - product | rssh "tar -C '$RBASE' -xf -" || true

echo "==> Derive .env.remote (remote bind-mount paths; LF endings)"
# Everything else (credential, secret, ports, flags) carries over from app/.env.
sed -e "s#^WORKSPACE_PATH=.*#WORKSPACE_PATH=$RBASE/workspace#" \
    -e "s#^SOURCE_REPO_PATH=.*#SOURCE_REPO_PATH=$RBASE/product#" \
    "$APP/.env" | tr -d '\r' > "$APP/.env.remote"

echo "==> Compose up against the remote daemon"
export DOCKER_HOST="ssh://$REMOTE"
docker compose --env-file "$APP/.env.remote" -f "$APP/infra/docker-compose.yml" up -d --build

echo "==> Services"
docker compose --env-file "$APP/.env.remote" -f "$APP/infra/docker-compose.yml" ps

WEB_PORT="$(grep -E '^WEB_PORT=' "$APP/.env.remote" | cut -d= -f2)"
HOST_IP="${REMOTE#*@}"
echo "==> Done. Dashboard: http://$HOST_IP:${WEB_PORT:-3000}"
