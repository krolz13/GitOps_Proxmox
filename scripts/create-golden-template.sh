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
error() { printf "${RED}[ERROR]${NC} %s\n" "$1"; exit 1; }

# Check for an existing template VM
info "Checking for existing template ID ${TEMPLATE_ID}..."
EXISTING=$(ssh root@${PVE_HOST} "qm status ${TEMPLATE_ID} 2>/dev/null || true")
if echo "$EXISTING" | grep -q "status: running\|status: stopped"; then
    warn "VM ${TEMPLATE_ID} exists. It must be destroyed first."
    read -p "Destroy VM ${TEMPLATE_ID} and recreate? [y/N] " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        ssh root@${PVE_HOST} "qm stop ${TEMPLATE_ID} >/dev/null 2>&1 || true; qm destroy ${TEMPLATE_ID}"
    else
        info "Exiting."
        exit 0
    fi
fi

# Check if image already exists on Proxmox
info "Checking if image is already downloaded..."
IMAGE_EXISTS=$(ssh root@${PVE_HOST} "test -f /var/lib/vz/template/iso/${IMAGE_NAME} && echo 'yes' || echo 'no'")

if [ "$IMAGE_EXISTS" == "yes" ]; then
    info "Image already exists. Skipping download."
else
    info "Downloading Debian 12 cloud image..."
    ssh root@${PVE_HOST} "cd /var/lib/vz/template/iso && wget --progress=bar:force ${IMAGE_URL}"
fi

# Get full path
IMAGE_PATH=$(ssh root@${PVE_HOST} "ls /var/lib/vz/template/iso/${IMAGE_NAME}")
info "Image path: ${IMAGE_PATH}"
info "Image size: $(ssh root@${PVE_HOST} "ls -lh ${IMAGE_PATH} | awk '{print \\$5}'")"

# Create the VM
info "Creating VM ${TEMPLATE_ID}..."
ssh root@${PVE_HOST} "
    qm create ${TEMPLATE_ID} \\
        --name ${TEMPLATE_NAME} \\
        --memory 2048 \\
        --cores 2 \\
        --net0 virtio,bridge=vmbr0 \\
        --scsihw virtio-scsi-single \\
        --ostype l26
"
info "Importing disk to ${STORAGE}..."
ssh root@${PVE_HOST} "
    qm importdisk ${TEMPLATE_ID} ${IMAGE_PATH} ${STORAGE} \\
        --format qcow2
"

# Detect the imported disk name
DISK_NAME=$(ssh root@${PVE_HOST} "pvesm path ${STORAGE}:vm-${TEMPLATE_ID}-disk-0 2>/dev/null || echo 'vm-${TEMPLATE_ID}-disk-0'")
info "Imported disk: ${DISK_NAME}"

# Attach disk as scsi0
info "Attaching disk as scsi0..."
ssh root@${PVE_HOST} "
    qm set ${TEMPLATE_ID} \\
        --scsi0 ${DISK_NAME},iothread=1 \\
        --boot c \\
        --bootdisk scsi0
"

# IMPORTANT: For cloud-init to work, we need to:
# 1. Remove the AMI datasource (AWS) specifically or
# 2. Add properly the cloud-init config
info "Setting up cloud-init drive..."
ssh root@${PVE_HOST} "
    # Create a minimal cloud-init drive with NoCloud datasource
    # This ensures the VM recognizes local cloud-init configs
    qm set ${TEMPLATE_ID} --ide2 none 
    qm set ${TEMPLATE_ID} --ide2 local:cloudinit,media=cdrom 
    # Configure default console
    qm set ${TEMPLATE_ID} --serial0 socket --vga serial0
"

# Enable QEMU Guest Agent
info "Enabling QEMU Guest Agent..."  
ssh root@${PVE_HOST} "
    qm set ${TEMPLATE_ID} --agent enabled=1
"

# Convert to template
info "Converting VM ${TEMPLATE_ID} to template..."
ssh root@${PVE_HOST} "qm template ${TEMPLATE_ID}"

info "========================================"
info "Golden template created successfully!"
info "========================================"
info "Template ID: ${TEMPLATE_ID}"
info "Template Name: ${TEMPLATE_NAME}"
info "Storage: ${STORAGE}"
info ""
info "Usage:")
info "  qm clone ${TEMPLATE_ID} 201 --name new-vm --full --storage ${STORAGE}")
info ""
