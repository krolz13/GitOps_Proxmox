terraform {
  required_version = ">= 1.5.0"
  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = ">= 0.60.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}

provider "proxmox" {
  endpoint = "https://${var.proxmox_host}:8006/api2/json"
  api_token = "${var.proxmox_api_token_id}=${var.proxmox_api_token_secret}"
  insecure  = var.proxmox_api_insecure

  ssh {
    agent = true
    username = "root"
    node {
      name    = var.target_node
      address = var.proxmox_host
    }
  }

}

# Upload cloud-init snippets via Proxmox SSH helper
resource "proxmox_virtual_environment_file" "snippets" {
  for_each = var.vm_specs

  content_type = "snippets"
  datastore_id = "local"
  node_name    = var.target_node

  source_raw {
    data = contains(["app", "db", "monitoring", "runner"], each.key) ? templatefile(
      "${path.module}/cloud-init/${each.value.snippet}",
      {
        gitlab_runner_token = var.gitlab_runner_token
        ssh_public_key      = var.ssh_public_key
      }
    ) : file("${path.module}/cloud-init/${each.value.snippet}")
    file_name = "${each.key}-cidata.yaml"
  }
}

# VM Definitions
resource "proxmox_virtual_environment_vm" "vms" {
  for_each = var.vm_specs

  vm_id       = each.value.id
  name        = each.value.name
  description = "GitOps VM: ${each.value.name}"
  tags        = ["terraform", "gitops"]
  node_name   = var.target_node

  cpu {
    cores = each.value.cores
    type  = "host"
  }

  memory {
    dedicated = each.value.memory
  }

  clone {
    vm_id = var.golden_template_id
  }

  bios    = "seabios"

  agent {
    enabled = true
    timeout = "15m"
  }

  network_device {
    bridge = "vmbr0"
    model  = "virtio"
  }

  initialization {
    type = "nocloud"
    user_data_file_id = proxmox_virtual_environment_file.snippets[each.key].id
    ip_config {
      ipv4 {
        address = "dhcp"
      }
    }
  }

  started       = true
  stop_on_destroy = true
}

output "vms" {
  value = {
    for instance, vm in proxmox_virtual_environment_vm.vms : instance => {
      id   = vm.vm_id
      name = vm.name
      ip = (
        length(vm.ipv4_addresses) > 1 && length(vm.ipv4_addresses[1]) > 0
        ? vm.ipv4_addresses[1][0]
        : length(vm.ipv4_addresses) > 0 && length(vm.ipv4_addresses[0]) > 0
        ? vm.ipv4_addresses[0][0]
        : "unknown"
      )
      role = title(instance)
    }
  }
}

locals {
  vm_ips = {
    for instance, vm in proxmox_virtual_environment_vm.vms : instance => (
      length(vm.ipv4_addresses) > 1 && length(vm.ipv4_addresses[1]) > 0
      ? vm.ipv4_addresses[1][0]
      : length(vm.ipv4_addresses) > 0 && length(vm.ipv4_addresses[0]) > 0
      ? vm.ipv4_addresses[0][0]
      : "unknown"
    )
  }
}

output "access_urls" {
  value = {
    app        = local.vm_ips["app"] != "unknown" ? "http://${local.vm_ips["app"]}:3000" : "VM not ready or IP not assigned"
    grafana    = local.vm_ips["monitoring"] != "unknown" ? "http://${local.vm_ips["monitoring"]}:3000" : "VM not ready or IP not assigned"
    prometheus = local.vm_ips["monitoring"] != "unknown" ? "http://${local.vm_ips["monitoring"]}:9090" : "VM not ready or IP not assigned"
    db         = local.vm_ips["db"] != "unknown" ? "${local.vm_ips["db"]}:5432" : "VM not ready or IP not assigned"
  }
}