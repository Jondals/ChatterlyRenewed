#!/usr/bin/env bash
# Brings the server to the newest version of the repository: pull, install, build and restart.
# Run it by hand or let the GitHub Action (.github/workflows/deploy.yml) run it after every push to main.
set -euo pipefail
cd "$(dirname "$0")/.."
git fetch origin main
git reset --hard origin/main
pnpm run install:all
pnpm build
sudo systemctl restart chatterly
echo "Updated to $(git rev-parse --short HEAD)"
