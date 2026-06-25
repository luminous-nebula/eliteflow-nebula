# Web image: Next.js dashboard + API + Claude Code (for the planning chat).
FROM node:22-bookworm-slim

# git is used by Claude Code; ca-certs for TLS.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Claude Code CLI — the planning chat spawns `claude -p` with the planning MCP tools.
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

COPY package.json ./
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
RUN npm install

COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY apps/web ./apps/web

# Build the Next.js app (pages are force-dynamic, so no DB is needed at build time).
RUN npm run build -w @eliteflow/web

EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@eliteflow/web"]
