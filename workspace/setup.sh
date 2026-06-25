#!/usr/bin/env bash
# AgentFlow Nebula - project setup (POSIX)
set -euo pipefail

echo "Setting up the environment for AgentFlow Nebula"
echo

base_path="$(pwd)"
read -r -p "Enter the project name: " project_name
read -r -e -p "Enter the source code path: " source_code_path
created_date="$(date +%Y-%m-%d)"
timezone="$(cat /etc/timezone 2>/dev/null || echo Asia/Bangkok)"

echo
echo "Project Name:      ${project_name}"
echo "Base Path:         ${base_path}"
echo "Source Code Path:  ${source_code_path}"
echo

# Write the config table (single source of truth for runtime config)
config="database/config/config.csv"
mkdir -p "$(dirname "$config")"
cat > "$config" <<CFG
property,value
application-name,AgentFlow Nebula
version,2.0.0
project-name,${project_name}
base-path,${base_path}
source-code-path,${source_code_path}
timezone,${timezone}
created-date,${created_date}
CFG

# Runtime folders
mkdir -p output/report output/log output/archive
for d in output/report output/log output/archive; do
  [ -e "$d/.gitkeep" ] || : > "$d/.gitkeep"
done

echo "Wrote ${config}"
echo "Created output/{report,log,archive}"
echo "Setup completed."
