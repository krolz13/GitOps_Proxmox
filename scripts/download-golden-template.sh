#!/usr/bin/env bash
set -euo pipefail

# Golden Template Setup Script for Proxmox
# Downloads a Debian 12 cloud image and creates a templated VM
# Suitable for GitOps - fast clones with cloud-init support

PVE_HOST="192.168.8.171"
TEMPLATE_ID=9000
TEMPLATE_NAME="golden-debian12"
STORAGE="local-lvm"
IMAGE_URL="https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-genericcloud-amd64.qcow2"
IMAGE_NAME="debian-12-genericcloud-amd64.qcow2"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() { printf "${GREEN}[INFO]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$1"; }
error() { printf "${RED}[ERROR]${NC} %s\n" "$1"; }

# Check for an existing template VM
info "Checking for existing template ID ${TEMPLATE_ID}..."
EXISTING=$(ssh root@${PVE_HOST} "qm status ${TEMPLATE_ID} 2>/dev/null || true")
if echo "$EXISTING" | grep -q "status: running\|status: stopped"; then
    warn "VM ${TEMPLATE_ID} exists. It must be destroyed first."
    read -p "Destroy VM ${TEMPLATE_ID} and recreate? [y/N] " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        ssh root@${PVE_HOST} "qm stop ${TEMPLATE_ID} >/dev/null 2>&1 || true; qm destroy ${TEMPLATE_ID}"