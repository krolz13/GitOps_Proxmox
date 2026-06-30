# vm_golden_clone - Reusable VM from golden template

variable "vm_name" {
  description = "Human-readable name of the VM"
  type        = string
}

variable "vm_id" {
  description = "VMID (unique per cluster)"
  type        = number
}

variable "cloudinit_snippet" {
  description = "Snippet filename on Proxmox snippets share"
  type        = string
}

variable "memory_mb" {
  description = "RAM"
  type        = number
  default     = 4096
}

variable "cpu_cores" {
  description = "vCPU cores"
  type        = number
  default     = 2
}

variable "disk_gb" {
  description = "Root disk size (GiB)"
  type        = number
  default     = 20
}

variable "network" {
  description = "Network configuration"
  type = object({
    bridge    = string
    ip_config = string
  })
  default = {
    bridge    = "vmbr0"
    ip_config = "ip=dhcp"
  }
}

variable "golden_template_id" {
  type        = number
}
variable "storage_pool" {
  type        = string
}
variable "proxmox_target_node" {
  type        = string
}
variable "ssh_public_key_path" {
  type        = string
}
variable "cloudinit_user" {
  type        = string
}
variable "cloudinit_password" {
  type        = string
  sensitive   = true
}
variable "proxmox_host" {
  type        = string
}
variable "auto_start" {
  type        = bool
  default     = true
}

# Create VM from golden template
resource "proxmox_vm_qemu" "vm" {
  name        = var.vm_name
  vmid        = var.vm_id
  clone       = var.golden_template_id
  target_node = var.proxmox_target_node
  memory      = var.memory_mb
  cores       = var.cpu_cores

  network {
    model  = "virtio"
    bridge = var.network.bridge
  }

  ipconfig0 = var.network.ip_config
  ciuser    = var.cloudinit_user
  cipassword = var.cloudinit_password
  sshkeys   = file(var.ssh_public_key_path)
  cicustom  = "user=local:snippets/${var.cloudinit_snippet}"

  disk {
    type    = "scsi"
    storage = var.storage_pool
    size    = "${var.disk_gb}G"
  }

  agent    = 1
  boot     = "c"
  oncreate = var.auto_start
}

output "name" {
  value = var.vm_name
}
output "ip" {
  value = var.network.ip_config == "ip=dhcp" ? "dhcp" : var.network.ip_config
}
output "id" {
  value = var.vm_id
}
