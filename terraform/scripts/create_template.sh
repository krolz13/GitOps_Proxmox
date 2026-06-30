#!/bin/bash
# Create a new Proxmox template with a proper disk configuration
# Run this on the Proxmox node (host1 / 192.168.8.171)

set -e

TEMPLATE_ID=9001
TEMPLATE_NAME="debian-12-gitops-template"
NODE="host1"
STORAGE="local-lvm"

# Download Debian 12 cloud image if not exists
IMAGE_URL="https://cdimage.debian.org/images/cloud/bookworm/latest/debian-12-generic-amd64.qcow2"
IMAGE_NAME="debian-12-generic-amd64.qcow2"
IMAGE_PATH="/var/lib/vz/template/iso/${IMAGE_NAME}"

echo "=== Creating new template VM ${TEMPLATE_ID} ==="

# Download image if not exists
if [ ! -f "${IMAGE_PATH}" ]; then
    echo "Downloading Debian 12 cloud image..."
    mkdir -p /var/lib/vz/template/iso
    wget -O "${IMAGE_PATH}" "${IMAGE_URL}"
fi

# Create VM
echo "Creating VM ${TEMPLATE_ID}..."
qm create ${TEMPLATE_ID} \
    --name ${TEMPLATE_NAME} \
    --memory 2048 \
    --cores 2 \
    --cpu host \
    --net0 virtio,bridge=vmbr0 \
    --machine q35 \
    --bios ovmf \
    --ostype l26

# Import disk to standard storage (not passthrough)
echo "Importing disk to ${STORAGE}..."
qm importdisk ${TEMPLATE_ID} "${IMAGE_PATH}" ${STORAGE} --format qcow2

# Attach the imported disk
# Find the disk name (e.g., vm-9001-disk-0)
DISK_ID=$(pvesh get /nodes/${NODE}/storage/${STORAGE}/content --output-format json | jq -r ".[] | select(.volid | contains(\"${TEMPLATE_ID}\")) | .volid" | head -1 | sed 's/.*://')
echo "Detected disk: ${DISK_ID}"

# Attach disk to VM
qm set ${TEMPLATE_ID} --scsi0 ${STORAGE}:${DISK_ID} --scsihw virtio-scsi-pci

# Add cloud-init drive
echo "Adding cloud-init drive..."
qmkcloudinit() {
    qm set ${TEMPLATE_ID} --ide2 ${STORAGE}:cloudinit 2>/dev/null || true
}
qmkcloudinit || true

# Configure boot
echo "Configuring boot..."
qm set ${TEMPLATE_ID} --boot order=scsi0

# Enable QEMU guest agent
qm set ${TEMPLATE_ID} --agent enabled=1,fstrim_cloned_disks=1

# Convert to template
echo "Converting VM ${TEMPLATE_ID} to template..."
qm template ${TEMPLATE_ID}

echo ""
echo "=== Template ${TEMPLATE_ID} created successfully! ==="
echo ""
echo "You can now use this template in your Terraform configuration."
echo "Update 'golden_template_id' in terraform.tfvars from 9000 to ${TEMPLATE_ID}"
echo ""