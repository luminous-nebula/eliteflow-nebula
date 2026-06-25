# Orchestrator image: Node + Claude Code (headless) + the monorepo (db + orchestrator).
FROM node:22-bookworm-slim

# git is used by Claude Code; tzdata for cron timezones; ca-certs for TLS.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/*

# Claude Code CLI (headless execution backend).
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Install workspace deps (manifests first for better layer caching).
COPY package.json ./
COPY packages/db/package.json packages/db/
COPY services/orchestrator/package.json services/orchestrator/
RUN npm install

# App source.
COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY services/orchestrator ./services/orchestrator

# Default: run the orchestrator daemon (cron-driven work-cycles).
CMD ["npm", "run", "orchestrator"]
