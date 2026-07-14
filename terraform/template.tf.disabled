# Create a new golden template VM using Terraform
# This avoids the passthrough disk issue by properly importing the disk

resource "proxmox_download_file" "debian_cloud_image" {
  content_type = "import"
  datastore_id = "local"
  node_name    = var.target_node
  url          = "https://cdimage.debian.org/images/cloud/bookworm/latest/debian-12-generic-amd64.qcow2"
  file_name    = "debian-12-generic-amd64.qcow2"
}

resource "proxmox_virtual_environment_vm" "template" {
  name      = "debian-12-gitops-template"
  vm_id     = 9001
  node_name = var.target_node
  template  = true

  cpu {
    cores = 2
    type  = "host"
  }

  memory {
    dedicated = 2048
  }

  scsi_hardware = "virtio-scsi-pci"

  disk {
    datastore_id = "local-lvm"
    interface    = "scsi0"
    import_from  = proxmox_download_file.debian_cloud_image.id
    size         = 8
  }

  network_device {
    bridge = "vmbr0"
    model  = "virtio"
  }

  agent {
    enabled = true
  }

  operating_system {
    type = "l26"
  }

  lifecycle {
    prevent_destroy = false
  }
}


