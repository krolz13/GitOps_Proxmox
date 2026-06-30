#!/usr/bin/env bash
set -euo pipefail

PVE_HOST="192.168.8.171"
SNIPPET_DIR="/var/lib/vz/snippets"
SRC_DIR="/home/andrii/Playground/GitOps_Proxmox/terraform/cloud-init/rendered"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { printf "${GREEN}[INFO]${NC} %s\n" "$1"; }

# Upload rendered cloud-init configs
info "Uploading cloud-init snippets to $PVE_HOST:$SNIPPET_DIR..."

scp "$SRC_DIR/app.txt" root@$PVE_HOST:$SNIPPET_DIR/gitops-app.txt
scp "$SRC_DIR/db.txt" root@$PVE_HOST:$SNIPPET_DIR/gitops-db.txt
scp "$SRC_DIR/monitoring.txt" root@$PVE_HOST:$SNIPPET_DIR/gitops-monitoring.txt
scp "$SRC_DIR/runner.txt" root@$PVE_HOST:$SNIPPET_DIR/gitops-runner.txt

info "Snippets uploaded. You can now run terraform apply"
