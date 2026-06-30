#!/bin/bash
# Run this on the Proxmox node to prepare the template base image
# This script downloads the Debian cloud image and imports it to local-lvm

set -e

NODE="host1"
STORAGE="local-lvm"
IMAGE_URL="https://cdimage.debian.org/images/cloud/bookworm/latest/debian-12-generic-amd64.qcow2"
IMAGE_NAME="debian-12-generic-amd64.qcow2"
TEMP_DIR="/tmp"

echo "=== Preparing Debian 12 cloud image for template ==="

# Download image if not exists
if [ ! -f "${TEMP_DIR}/${IMAGE_NAME}" ]; then
    echo "Downloading Debian 12 cloud image..."
    wget -O "${TEMP_DIR}/${IMAGE_NAME}" "${IMAGE_URL}"
fi

# Check if volume already exists in local-lvm
if pvesm path "${STORAGE}:base-${IMAGE_NAME}" >/dev/null 2>&1; then
    echo "Image already exists in ${STORAGE}, skipping import"
else
    echo "Importing image to ${STORAGE}..."
    # For LVM thin, we need to use qemu-img to convert and import
    qm importdisk 999 "${TEMP_DIR}/${IMAGE_NAME}" "${STORAGE}" --format qcow2
    
    # Get the created disk name
    DISK_NAME=$(pvesh get /nodes/${NODE}/storage/${STORAGE}/content --output-format json | \
        jq -r ".[] | select(.volid | contains(\"999\")) | .volid" | head -1)
    
    echo "Imported disk: ${DISK_NAME}"
    
    # Rename it to a standard name for later use
    # Note: This creates a snapshot/reference that can be used
fi

echo ""
echo "=== Image preparation complete ==="
echo "You can now run 'terraform apply' to create the template VM"