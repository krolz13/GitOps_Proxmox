# bpg/proxmox provider variables

variable "proxmox_api_token_id" {
  type        = string
  description = "Proxmox API token ID (e.g. root@pam!gitops_key)"
  sensitive   = true
}

variable "proxmox_api_token_secret" {
  type        = string
  description = "Proxmox API token secret UUID"
  sensitive   = true
}

variable "proxmox_host" {
  type        = string
  description = "Proxmox server address"
  default     = "192.168.8.171"
}

variable "gitlab_runner_token" {
  type        = string
  description = "GitLab Runner registration token (from CI/CD Settings → Runners)"
  sensitive   = true
  default     = ""
}

variable "ssh_public_key" {
  type        = string
  description = "SSH public key to authorize on all VMs (content of id_rsa.pub / id_ed25519.pub)"
  sensitive   = false
  default     = ""
}

variable "proxmox_api_insecure" {
  type        = bool
  description = "Disable SSL verification for self-signed certificates"
  default     = true
}

variable "proxmox_api_endpoint" {
  type        = string
  description = "Proxmox API endpoint URL (e.g. https://192.168.8.171:8006/api2/json)"
}

variable "target_node" {
  type        = string
  description = "Proxmox node to provision VMs on"
  default     = "host1"
}

variable "golden_template_id" {
  type        = number
  description = "VM ID of the golden template used for cloning"
  default     = 9001
}

variable "storage_pool" {
  type        = string
  description = "Storage pool for VM disks"
  default     = "local-lvm"
}

variable "vm_specs" {
  description = "VM definitions"
  type = map(object({
    name       = string
    id         = number
    cores      = number
    memory     = number
    disk       = number
    auto_start = bool
    snippet    = string
  }))
  default = {
    "app" = {
      name = "gitops-app"
      id = 200
      cores = 2
      memory = 4096
      disk = 20
      auto_start = true
      snippet = "app.yaml"
    },
    "db" = {
      name = "gitops-db"
      id = 201
      cores = 2
      memory = 4096
      disk = 30
      auto_start = true
      snippet = "db.yaml"
    },
    "monitoring" = {
      name = "gitops-monitoring"
      id = 202
      cores = 2
      memory = 4096
      disk = 20
      auto_start = true
      snippet = "monitoring.yaml"
    },
    "runner" = {
      name = "gitops-runner"
      id = 203
      cores = 2
      memory = 4096
      disk = 20
      auto_start = true
      snippet = "runner.yaml"
    }
  }
}