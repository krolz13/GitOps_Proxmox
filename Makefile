# Makefile - convenience shortcuts for development & deployment

.PHONY: help install start stop logs \
        terraform-init terraform-apply terraform-destroy \
        test

help:
	@echo "Makefile targets:"
	@echo "  install   - npm install (install Node dependencies)"
	@echo "  start     - npm start (run the Node app on http://localhost:3000)"
	@echo "  stop      - stop the running Node process"
	@echo "  logs      - tail the service log (journalctl -u gitops-app)"
	@echo "  test      - run a simple curl test against the local server"
	@echo "  terraform-init  - terraform init in ./terraform"
	@echo "  terraform-apply - terraform apply -auto-approve (creates VM)"
	@echo "  terraform-destroy - terraform destroy -auto-approve"
	@echo "  all       - run install -> start"

install:
	npm ci

start: install
	npm start

stop:
	@pkill -f "node src/server.js" || true

logs:
	@journalctl -u gitops-app -n 50 -f

test: start
	@echo "---- testing local endpoint ----"
	@curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ || true

terraform-init:
	@cd terraform && terraform init

terraform-apply:
	@cd terraform && terraform apply -auto-approve

terraform-destroy:
	@cd terraform && terraform destroy -auto-approve