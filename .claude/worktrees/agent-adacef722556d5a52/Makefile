# OpenVitals — convenience targets. Requires Docker (and Node 22 for local web dev).
.PHONY: up down logs build test test-web test-sidecar check fmt dev dev-down dev-logs dev-https dev-https-down

dev:           ## One-command DEV stack in Docker: Vite HMR + mock Garmin data (no creds)
	docker compose -f docker-compose.dev.yml up

dev-https:     ## DEV stack behind trusted local HTTPS via Tailscale Serve (https://<node>.ts.net)
	./scripts/dev-https.sh

dev-https-down: ## Stop the HTTPS dev stack and reset the Tailscale serve config
	./scripts/dev-https.sh --down

dev-down:      ## Stop + remove the dev stack
	docker compose -f docker-compose.dev.yml down

dev-logs:      ## Follow dev stack logs
	docker compose -f docker-compose.dev.yml logs -f

up:            ## Start the PROD stack (live-code: bind-mounted source, no image build)
	docker compose up -d

down:          ## Stop the stack
	docker compose down

logs:          ## Follow logs
	docker compose logs -f

restart-web:   ## Apply newly copied code (the live stack rebuilds on start)
	docker compose restart web

build:         ## Build the IMAGE-based stack (immutable artifact; see docker-compose.image.yml)
	docker compose -f docker-compose.image.yml build

up-image:      ## Build + start the IMAGE-based stack instead of the live one
	docker compose -f docker-compose.image.yml up -d --build

test: test-web test-sidecar  ## Run all tests

test-web:      ## Web unit + integration tests
	cd apps/web && pnpm run test

test-sidecar:  ## Sidecar tests
	cd services/garmin && pytest

check:         ## Type-check the web app
	cd apps/web && pnpm run check

fmt:           ## Format the web app
	cd apps/web && pnpm run format

# ---- NAS deploy (live-code stack: copy + restart, no image rebuild) ----
# Override on the command line, e.g. `make nas-sync NAS_HOST=192.168.1.123`.
NAS_HOST ?= 100.79.24.10
NAS_USER ?= Piotr
NAS_PORT ?= 25
NAS_DIR  ?= /volume1/system/docker/garmin-bridge

nas-sync:      ## Copy the working tree to the NAS (never touches its .env)
	@tar czf - \
	  --exclude='./.git' --exclude='./.env' --exclude='.env' --exclude='./.claude' \
	  --exclude='node_modules' --exclude='.svelte-kit' --exclude='.pnpm-store' \
	  --exclude='build' --exclude='build-mcp' --exclude='.vite' \
	  --exclude='.venv' --exclude='__pycache__' --exclude='.pytest_cache' \
	  --exclude='.DS_Store' --exclude='coverage' --exclude='*.swp' . 2>/dev/null \
	  | ssh -p $(NAS_PORT) $(NAS_USER)@$(NAS_HOST) 'tar xzf - -C $(NAS_DIR) 2>/dev/null; echo "synced to $(NAS_DIR)"'

nas-deploy:    ## Sync + restart the live stack on the NAS (needs docker rights there)
	@$(MAKE) nas-sync
	@ssh -p $(NAS_PORT) $(NAS_USER)@$(NAS_HOST) 'cd $(NAS_DIR) && docker compose up -d && docker compose restart web'
