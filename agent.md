# Agent.md – Documentation for the GitLab Runner Execution Agent

## Overview
The **GitLab Runner agent** (often referred to simply as “the runner”) is a lightweight VM that runs CI/CD jobs on behalf of GitLab. In this project the runner is deployed as a **Proxmox VM** that is cloned from the same **golden‑image template** used for the application and monitoring VMs. This approach guarantees:

* **Consistent environment** – all runners are created from the same base image (2 vCPU, 1 GiB RAM, 15 GB disk).  
* **Immutable infrastructure** – any change to the runner (OS updates, package upgrades) is tracked as code in Terraform and applied through the same GitOps pipeline.  
* **Easy scaling** – additional runners can be added by cloning the same template, without manual VM installation.

## Architecture Overview
```
+----------------------------+
|  GitLab CI Server          |
|  (https://gitlab.example.com)  |
+------------+---------------+
             |
    (registered runner token)
             |
+------------v--------------+
|  GitLab Runner VM (220)  |
|  - Docker executor        |
|  - Registers on boot      |
|  - Picks up jobs from    |
|    the GitLab queue       |
+------------+--------------+
             |
   (executes jobs via Docker)
             |
+------------v-------------------+
|  Proxmox Host (192.168.8.171) |
|  - Provides VM admin API    |
|  - Hosts app, monitor, &    |
|    runner VMs              |
+------------------------------+
```

### Key Components
| Component | Purpose | Location in Repo |
|-----------|---------|------------------|
| `terraform/gitlab-runner/cloud-config.yaml` | Cloud‑init script that installs Docker, registers the runner with GitLab, and configures the executor. | `terraform/gitlab-runner/cloud-config.yaml` |
| `terraform/main.tf` | Defines the runner VM resource (`proxmox_clone.gitlab_runner_clone`) and attaches the cloud‑init script. | `terraform/main.tf` |
| `.gitlab-ci.yml` | CI pipeline that runs `terraform apply` and optionally triggers manual approvals. | Root of the repo |
| `agent.md` | This documentation. | Root of the repo (`agent.md`) |

## Lifecycle of the Runner

1. **Template Creation (once)**  
   A golden‑image VM is created on Proxmox (`qm create …`) and marked as a template (`qm set … --template 1`).  

2. **Terraform Provisioning (pipeline)**  
   The pipeline runs `terraform apply`, which clones the runner VM from the template, boots it, and executes the cloud‑init script.  

3. **Runner Registration**  
   The cloud‑init script uses the `GITLAB_RUNNER_TOKEN` CI variable to register the VM with GitLab (`gitlab-runner register …`).  

4. **Job Execution**  
   Once registered, the runner appears in GitLab → **Settings → CI/CD → Runners** as *online*. When a pipeline contains a job that matches the runner’s tags (e.g., `proxmox`), the runner pulls the job, executes it inside Docker, and reports success/failure back to GitLab.

5. **Maintenance**  
   * **Updating the runner** – modify `terraform/gitlab-runner/cloud-config.yaml` (e.g., upgrade Docker) and re‑run `terraform apply`.  
   * **Scaling** – add more runner definitions in `terraform/main.tf` (copy the `proxmox_clone.gitlab_runner_clone` block with a new `new_vm_id` and a distinct name).  
   * **Cleanup** – destroy unused runner VMs with `terraform destroy -target proxmox_clone.gitlab_runner_clone` or via the GitLab UI (if you no longer need them).

## Configuration Details

### Cloud‑Init Script (`terraform/gitlab-runner/cloud-config.yaml`)
```yaml
#cloud-config
package_update: true
package_upgrade: true

packages:
  - docker
  - curl
  - jq

runcmd:
  - curl -L https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh | sudo bash
  - apt-get install -y gitlab-runner

  # Register the runner – token is injected from CI variable
  - gitlab-runner register \
      --url https://gitlab.example.com/ \
      --registration-token ${GITLAB_RUNNER_TOKEN} \
      --description "Proxmox‑Runner‑01" \
      --tag-list "proxmox,docker" \
      --executor "docker" \
      --docker-image "docker:latest" \
      --docker-privileged

  - systemctl enable --now docker          # Ensure Docker daemon is active
```

* `${GITLAB_RUNNER_TOKEN}` is **provided by GitLab** as a protected CI variable.  
* The `--tag-list` value (`proxmox,docker`) determines which jobs the runner will claim – you can filter jobs in `.gitlab-ci.yml` with `tags: [proxmox]`.

### Registering a New Runner Manually (if you need to do it outside of Terraform)

```bash
# On the runner VM (replace <TOKEN> with your registration token)
sudo gitlab-runner register \
  --url https://gitlab.example.com/ \
  --registration-token <TOKEN> \
  --description "Proxmox‑Runner‑01" \
  --tag-list "proxmox,docker" \
  --executor "docker" \
  --docker-image "docker:latest" \
  --docker-privileged
```

After registration, the runner will appear in GitLab and start picking up jobs automatically.

## Security & Permissions

| Concern | Recommendation |
|---------|----------------|
| **Credentials** | Store the registration token and any Proxmox API credentials as **protected + masked** CI variables in GitLab. Never commit them to the repo. |
| **Runner Privileges** | Grant the Proxmox user only the permissions it needs: `VM.Image`, `VM.Audit`, `Datacenter.Storage` (read/write). This limits the impact of a compromised runner. |
| **Network Isolation** | Keep the runner on a dedicated internal network or VLAN. Set `firewall = false` in the VM definition if you do not need external access. |
| **Audit** | Enable GitLab’s built‑in **Runner Audits** to keep a record of which jobs each runner executed. |

## FAQ

| Question | Answer |
|----------|--------|
| **Do I need to manually install Docker on the runner?** | No. The cloud‑init script installs Docker automatically. |
| **Can the runner use a different executor (e.g., shell instead of Docker)?** | Yes – change the `--executor` flag in the register command and adjust the `tags` accordingly. |
| **What if the runner fails to register?** | Verify that the `GITLAB_RUNNER_TOKEN` CI variable is set, protected, and that the token matches the one shown in GitLab → **Settings → CI/CD → Runners → Set up specific runners**. Also check that the runner can reach `https://gitlab.example.com` (firewall, DNS). |
| **Can I run multiple jobs in parallel?** | With Docker executor and a runner that has enough CPU/RAM you can claim multiple jobs simultaneously. Adjust `memory` and `cores` in the Terraform definition if you need more capacity. |
| **How do I remove a runner?** | Delete its VM definition in Terraform (`terraform destroy -target proxmox_clone.gitlab_runner_clone`) or manually unregister it via `sudo gitlab-runner unregister --name "Proxmox‑Runner‑01"` inside the VM. |

## Changelog

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026‑06‑25 | Initial creation of the runner documentation. |
| 1.1 | 2026‑06‑26 | Added security recommendations and manual registration steps. |
| 1.2 | 2026‑07‑01 | Expanded FAQ and scaling instructions. |

---

*This document is part of the **GitOps_Proxmox** repository. Any changes to the runner configuration should be committed here and applied via the CI pipeline to keep the infrastructure truly declarative.*