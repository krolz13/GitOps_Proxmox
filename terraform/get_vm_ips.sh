#!/bin/bash
# Script to get VM IPs via Proxmox API

# Load credentials from terraform.tfvars or use defaults
TFPATH="$(cd "$(dirname "$0")" && pwd)"

# API credentials - adjust these or source from env vars
API_HOST="${PROXMOX_HOST:-192.168.8.171}"
API_TOKEN_ID="${PROXMOX_API_TOKEN_ID:-gitops@pam!gitops_key}"
API_TOKEN_SECRET="${PROXMOX_API_TOKEN_SECRET:-}"

# If token secret is empty, try to read from secrets.auto.tfvars or terraform.tfvars
if [ -z "$API_TOKEN_SECRET" ]; then
    if [ -f "$TFPATH/secrets.auto.tfvars" ]; then
        API_TOKEN_SECRET=$(grep 'proxmox_api_token_secret' "$TFPATH/secrets.auto.tfvars" | sed 's/.*= *"\([^"]*\)".*/\1/')
    fi
    if [ -z "$API_TOKEN_SECRET" ] && [ -f "$TFPATH/terraform.tfvars" ]; then
        API_TOKEN_SECRET=$(grep 'proxmox_api_token_secret' "$TFPATH/terraform.tfvars" | sed 's/.*= *"\([^"]*\)".*/\1/')
    fi
fi

# Load token ID if config files have it
if [ -f "$TFPATH/secrets.auto.tfvars" ]; then
    file_token_id=$(grep 'proxmox_api_token_id' "$TFPATH/secrets.auto.tfvars" | sed 's/.*= *"\([^"]*\)".*/\1/')
    if [ -n "$file_token_id" ]; then
        API_TOKEN_ID="$file_token_id"
    fi
fi


NODE="host1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "  VM IP Discovery via Proxmox API"
echo "=========================================="
echo ""

for vmid in 200 201 202 203 204; do
    case $vmid in
        200) vmname="gitops-app" ;;
        201) vmname="gitops-db" ;;
        202) vmname="gitops-monitoring" ;;
        203) vmname="gitops-runner" ;;
        204) vmname="gitops-load-tester" ;;
    esac
    
    echo "--- VM $vmid ($vmname) ---"
    
    # Get VM status
    status=$(curl -sk --connect-timeout 5 \
        -H "Authorization: PVEAPIToken=${API_TOKEN_ID}=${API_TOKEN_SECRET}" \
        "https://${API_HOST}:8006/api2/json/nodes/${NODE}/qemu/${vmid}/status/current" 2>/dev/null | \
        python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('status','unknown'))" 2>/dev/null || echo "unknown")
    
    echo "  Status: $status"
    
    # Try to get network interfaces from QEMU agent
    if [ "$status" = "running" ]; then
        # Try QEMU guest agent network info
        net_info=$(curl -sk --connect-timeout 10 \
            -H "Authorization: PVEAPIToken=${API_TOKEN_ID}=${API_TOKEN_SECRET}" \
            "https://${API_HOST}:8006/api2/json/nodes/${NODE}/qemu/${vmid}/agent/network-get-interfaces" 2>/dev/null | \
            python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if 'data' in d and 'result' in d['data']:
        for iface in d['data']['result']:
            if iface.get('name') != 'lo' and 'ip-addresses' in iface:
                for addr in iface['ip-addresses']:
                    if addr.get('ip-address-type') == 'ipv4' and not addr['ip-address'].startswith('127.'):
                        print(addr['ip-address'])
except:
    pass
" 2>/dev/null || echo "")
        
        if [ -n "$net_info" ] && [ "$net_info" != "None" ]; then
            echo -e "  ${GREEN}IP: $net_info${NC}"
        else
            echo -e "  ${YELLOW}IP: not yet available from guest agent${NC}"
            
            # Fallback: try to get from config (MAC-based DHCP)
            echo "  Trying alternative methods..."
        fi
    else
        echo -e "  ${RED}VM not running${NC}"
    fi
    
    echo ""
done

echo "=========================================="
echo "Alternative: Try 'terraform show' for IPs"
echo "=========================================="
