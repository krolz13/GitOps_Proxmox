# GitOps_Proxmox

A minimal GitOps repository that demonstrates how to:

- **Provision a Node.js application** on a Proxmox VM using Terraform.
- **Deploy the app via GitLab CI** (pipeline → Terraform → Proxmox API → cloud‑init → systemd service).
- **Expose two simple pages** (Home & About) built with Express/EJS.
- **Add monitoring** with Prometheus + Grafana on a separate VM.

---

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Repository Layout](#repository-layout)
- [Terraform Setup](#terraform-setup)
- [Cloud‑Init Configuration](#cloud-init-configuration)
- [GitLab CI/CD Pipeline](#gitlab-cilcd-pipeline)
- [Node.js Application](#nodejs-application)
- [Monitoring Stack](#monitoring-stack)
- [Running the Demo](#running-the-demo)
- [Cleanup](#cleanup)

---

## Recommended VM sizing

For this learning project we are using **2 vCPU** and **4 GiB RAM** for each virtual machine:

- **Application VM** – runs the Node.js service, 2 vCPU, 4 GiB RAM, 20 GiB root disk.
- **Monitoring VM** – hosts Prometheus and Grafana, 2 vCPU, 4 GiB RAM, 10 GiB root disk.

These sizes are more than sufficient for a demo while still illustrating the GitOps workflow. You can adjust the `memory_mb`, `cpu_cores`, and `disk_gb` variables in `terraform/variables.tf` (or via `terraform.tfvars`) to scale up or down.

## Architecture Overview
## Architecture Overview
```
+----------------+       +-------------------+       +--------------------+
| GitLab CI      |  CI → | Terraform (Proxmox|  API → | Cloud‑Init (VM)    |
| (pipeline)     |       |  Provider)        |       |  - OS install      |
+----------------+       +-------------------+       |  - Node & deps     |
                                                     |  - App clone/pull  |
                                                     +--------------------+
                                                               |
                                                               v
                                                    +-------------------+
                                                    | Node.js Service   |
                                                    | (systemd)         |
                                                    +-------------------+

Separate VM (or container) runs Prometheus + Grafana for monitoring.
```

---

## Prerequisites
| Component | Details |
|-----------|---------|
| **Proxmox Server** | https://192.168.8.171 (API endpoint) |
| **API Credentials** | A user with `Datacenter → VM.Audit` and `VM.Image` privileges. Store them as Terraform variables or environment variables (`TF_VAR_proxmox_user`, `TF_VAR_proxmox_password`). |
| **Terraform** | v1.5+ |
| **GitLab** | Self‑hosted or GitLab.com instance with a Runner that can reach the Proxmox API. |
| **Node.js** | Will be installed on the target VM by cloud‑init. |
| **Docker** (optional) | For the monitoring stack (Prometheus + Grafana). |

---

## Repository Layout
```
GitOps_Proxmox/
├─ .git/
├─ README.md
├─ .gitlab-ci.yml               # CI pipeline definition
├─ terraform/
│   ├─ main.tf
│   ├─ variables.tf
│   └─ cloud-config.yaml
├─ monitoring/
│   └─ (Grafana/Prometheus manifests)
└─ src/
    ├─ server.js
    ├─ views/
    │   ├─ index.ejs
    │   └─ about.ejs
    └─ public/
        └─ style.css
```

---

## Terraform Setup
The `terraform/` directory contains everything needed to create the VM:

- **`main.tf`** – Proxmox provider configuration and `proxmox_vm` + `proxmox_cloudinit` resources.  
- **`variables.tf`** – Input variables (VM ID, RAM, CPU, disk size, IP, etc.).  
- **`cloud-config.yaml`** – Cloud‑init script that installs Node, pulls the repo, and runs the app as a systemd service.

> **Tip:** Store the Terraform state remotely (e.g., S3, GCS, or an NFS share) so the pipeline can safely apply changes.

---

## Cloud‑Init Configuration
`terraform/cloud-config.yaml` performs the following:

1. Updates apt and installs `curl`, `git`, `nodejs`, `npm`.  
2. Clones the application repository into `/opt/gitops-app`.  
3. Installs npm dependencies (`npm ci`).  
4. Writes a **systemd** unit (`gitops-app.service`) that runs `node src/app.js`.  
5. Enables and starts the service.

The cloud‑init is attached to the VM via the `proxmox_cloudinit` resource, ensuring the VM is ready as soon as it boots.

---

## GitLab CI/CD Pipeline
`.gitlab-ci.yml` defines three stages:

1. **validate** – `terraform init` + `terraform validate`.  
2. **deploy** – `terraform apply -auto-approve` (manual approval can be added).  
3. **notify** – Simple echo or optional Slack/webhook notification.

The pipeline runs on pushes to the `deploy` branch (or any branch you configure).  
Make sure the runner has the Terraform binary and can reach `https://192.168.8.171/api2/json`.

---

## Node.js Application
A tiny Express app with two pages:

- **/** → Home page (EJS template).  
- **/about** → About page.

Static assets are served from `/public`.  
The source lives under `src/` and is installed by cloud‑init.

```text
src/
 ├─ server.js
 ├─ views/
 │   ├─ index.ejs
 │   └─ about.ejs
 └─ public/
     └─ style.css
```

The app listens on `process.env.PORT` (default 3000) and exposes a `/metrics` endpoint (useful for Prometheus).

---

## Monitoring Stack
A separate VM (or Docker container) runs:

- **Node Exporter** – gathers host metrics.  
- **Prometheus** – scrapes `/metrics` from the Node.js app and node‑exporter metrics.  
- **Grafana** – visualises the data.

All monitoring components are defined in `monitoring/` and can be deployed with additional Terraform modules or Docker Compose.

---

## Running the Demo
1. **Configure Terraform variables** (either via `terraform.tfvars` or CI environment variables).  
2. Commit any changes and push to the `deploy` branch.  
3. GitLab Runner picks up the pipeline, runs `terraform apply`, and the new VM boots.  
4. Cloud‑init finishes, systemd starts the Node service, and the app is reachable at `http://<vm_ip>:3000`.  
5. Navigate to `http://<vm_ip>:3000/` and `http://<vm_ip>:3000/about` to see the two pages.  
6. Access Grafana (usually on port 3000 of the monitoring VM) to view metrics.

---

## Cleanup
- Destroy the Proxmox VM: `terraform destroy -auto-approve`.  
- Optionally delete the monitoring VM/containers.  
- The Git repository can be archived or kept for future iterations.

---

### Next Steps
- Add TLS termination with Nginx.  
- Implement blue/green deployments via separate VM IDs.  
- Expand monitoring with alerting rules (CPU, memory, request latency).  
- Store Terraform state in a remote backend (S3, Azure Blob, etc.).  

---

Feel free to open an issue or PR if you’d like to add features, tighten security, or improve the CI pipeline. Happy GitOps! 🚀