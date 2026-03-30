#!/usr/bin/env just --justfile

# Lite-Admin Development Commands
# Run 'just' to see all available commands

set shell := ["bash", "-c"]
set dotenv-load := true

# Default recipe to display help
default:
  @just --list

# Colors for output
export RED := '\033[0;31m'
export GREEN := '\033[0;32m'
export YELLOW := '\033[1;33m'
export BLUE := '\033[0;34m'
export PURPLE := '\033[0;35m'
export CYAN := '\033[0;36m'
export NC := '\033[0m' # No Color

# === QUICK START ===

# Interactive setup for first-time users
quickstart:
  @echo -e "${GREEN}🎯 Lite-Admin Quick Start Setup${NC}"
  @echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  @echo -e "\nThis will guide you through setting up Lite-Admin for the first time.\n"
  @just check-requirements
  @echo -e "\n${GREEN}✅ System requirements check passed!${NC}\n"
  @echo -e "${BLUE}📦 Step 1: Installing dependencies...${NC}"
  @pnpm install
  @echo -e "\n${BLUE}🔧 Step 2: Setting up environment...${NC}"
  @just setup-env
  @echo -e "\n${BLUE}🔑 Step 3: Configuring environment variables...${NC}"
  @if [ -f .env ]; then \
    echo -e "${YELLOW}Let's configure your environment variables.${NC}"; \
    echo -e "Opening .env in your default editor..."; \
    echo -e "\n${CYAN}Required configurations:${NC}"; \
    echo -e "  1. Set ADMIN_API_KEY to a secure value"; \
    echo -e "  2. Configure database settings"; \
    echo -e "  3. Add email provider API keys"; \
    echo -e "\nPress Enter when you're ready to edit the file..."; \
    read -r; \
    ${EDITOR:-nano} .env; \
    echo -e "\n${GREEN}✅ Environment file configured${NC}"; \
  fi
  @echo -e "\n${BLUE}🗄️  Step 4: Setting up database...${NC}"
  @just db-init
  @echo -e "\n${GREEN}🎉 Setup complete! Starting development server...${NC}\n"
  @just dev

# === PREREQUISITES ===

# Check if all requirements are installed
check-requirements:
  @echo -e "${BLUE}🔍 Checking system requirements...${NC}"
  @command -v node >/dev/null && echo -e "  ✅ Node.js: $(node -v)" || (echo -e "  ❌ Node.js: Not installed" && exit 1)
  @command -v pnpm >/dev/null && echo -e "  ✅ pnpm: $(pnpm -v)" || (echo -e "  ❌ pnpm: Not installed" && exit 1)
  @echo -e "${GREEN}✅ All requirements are met!${NC}"

# === INSTALLATION & SETUP ===

# Install all dependencies
install:
  @echo -e "${GREEN}🚀 Setting up Lite-Admin...${NC}"
  @just check-requirements
  @echo -e "${BLUE}📦 Installing dependencies...${NC}"
  pnpm install
  @echo -e "${BLUE}🔧 Setting up environment...${NC}"
  @just setup-env
  @echo -e "${BLUE}📁 Creating required directories...${NC}"
  @mkdir -p ./database ./src/public/uploads/portfolio ./src/public/uploads/thumbnails
  @echo -e "${GREEN}✅ Installation complete!${NC}"
  @echo -e "${YELLOW}👉 Run 'just dev' to start development${NC}"

# Set up environment files
setup-env:
  @if [ ! -f .env ]; then \
    if [ -f .env.example ]; then \
      echo -e "${YELLOW}📝 Creating .env from example...${NC}"; \
      cp .env.example .env; \
      echo -e "${YELLOW}⚠️  Please update .env with your actual values${NC}"; \
    else \
      echo -e "${RED}❌ No environment file found!${NC}"; \
      exit 1; \
    fi \
  else \
    echo -e "${GREEN}✅ .env already exists${NC}"; \
  fi

# === DEVELOPMENT ===

# Start development server
dev:
  @echo -e "${GREEN}🚀 Starting Lite-Admin Development Server...${NC}"
  @just validate-env
  @echo -e "${BLUE}🗄️  Initializing database...${NC}"
  @just db-init
  @echo -e "${GREEN}🎯 Starting server...${NC}"
  @pnpm dev

# Start in production mode
start:
  @echo -e "${GREEN}🚀 Starting Lite-Admin in production mode...${NC}"
  @just validate-env
  @NODE_ENV=production pnpm start

# Start with PM2
pm2-start:
  @echo -e "${GREEN}🚀 Starting Lite-Admin with PM2...${NC}"
  @pm2 start ecosystem.config.js

# Stop PM2
pm2-stop:
  @echo -e "${YELLOW}🛑 Stopping Lite-Admin PM2 process...${NC}"
  @pm2 stop ecosystem.config.js

# Restart PM2
pm2-restart:
  @echo -e "${YELLOW}🔄 Restarting Lite-Admin PM2 process...${NC}"
  @pm2 restart ecosystem.config.js

# PM2 logs
pm2-logs:
  @pm2 logs lite-admin

# === DATABASE MANAGEMENT ===

# Initialize SQLite database
db-init:
  @echo -e "${BLUE}🗄️  Initializing database...${NC}"
  @mkdir -p ./database
  @echo -e "${GREEN}✅ Database initialized${NC}"

# Backup database
db-backup:
  @echo -e "${BLUE}💾 Backing up database...${NC}"
  @mkdir -p ./backups
  @cp ./database/lite.db "./backups/lite-$(date +%Y%m%d-%H%M%S).db" 2>/dev/null || echo -e "${YELLOW}⚠️  No database to backup yet${NC}"
  @echo -e "${GREEN}✅ Database backed up${NC}"

# Reset database (careful!)
db-reset:
  @echo -e "${RED}⚠️  This will delete all data! Press Ctrl+C to cancel...${NC}"
  @sleep 3
  @rm -f ./database/lite.db
  @echo -e "${GREEN}✅ Database reset complete${NC}"

# === ADMIN OPERATIONS ===

# Upload an image via CLI
upload-image FILE PROJECT="":
  @echo -e "${BLUE}📸 Uploading image...${NC}"
  @if [ -z "{{FILE}}" ]; then \
    echo -e "${RED}❌ Please specify a file: just upload-image FILE=path/to/image.jpg${NC}"; \
    exit 1; \
  fi
  @node scripts/upload-image.js --file "{{FILE}}" --project "{{PROJECT}}"

# Export form submissions
export-submissions:
  @echo -e "${BLUE}📊 Exporting submissions...${NC}"
  @node scripts/export-submissions.js

# Clean old data
clean-data DAYS="90":
  @echo -e "${YELLOW}🧹 Cleaning data older than {{DAYS}} days...${NC}"
  @node scripts/clean-database.js --days {{DAYS}}

# Run admin CLI
admin:
  @node tools/admin-cli.js

# === TESTING & VALIDATION ===

# Validate environment variables
validate-env:
  @echo -e "${BLUE}🔍 Validating environment configuration...${NC}"
  @[ -f .env ] || (echo -e "${RED}❌ .env file not found${NC}" && echo -e "   Run: just setup-env" && exit 1)
  @echo -e "  ✅ .env: Found"

# Validate project (lint + type-check)
validate:
  @echo -e "${CYAN}🔍 Validating Lite-Admin Project...${NC}"
  @echo -e "\n${BLUE}📦 Installing dependencies...${NC}"
  @pnpm install
  @echo -e "\n${BLUE}🔧 Type checking...${NC}"
  @pnpm run type-check || (echo -e "${RED}❌ Type check failed${NC}" && exit 1)
  @echo -e "${GREEN}✅ Type check passed${NC}"
  @echo -e "\n${BLUE}🎨 Linting...${NC}"
  @pnpm run lint || (echo -e "${RED}❌ Lint check failed${NC}" && exit 1)
  @echo -e "${GREEN}✅ Lint check passed${NC}"
  @echo -e "\n${GREEN}✨ All validation checks passed!${NC}"

# Run linting
lint:
  @echo -e "${BLUE}🔍 Running linter...${NC}"
  @pnpm lint

# Run tests
test:
  @echo -e "${BLUE}🧪 Running tests...${NC}"
  @pnpm test

# Check system health
health:
  @echo -e "${CYAN}🏥 System Health Check${NC}"
  @echo -e "\n${BLUE}📊 API Health:${NC}"
  @curl -s http://localhost:3001/health | jq . || echo -e "${RED}❌ API not running${NC}"

# === BUILD & DEPLOYMENT ===

# Build for production
build:
  @echo -e "${BLUE}🏗️  Building for production...${NC}"
  @NODE_ENV=production pnpm build

# === DOCKER (Development) ===

# Compute compose project name from folder + git branch
export DOCKER_NAME_BASE := `basename $(pwd) | tr '[:upper:]' '[:lower:]' | tr '.' '-'`
export BRANCH_NAME := `git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main"`

# Build Docker images (requires pre-built artifacts: run 'just build' first)
docker-build:
  @echo -e "${BLUE}🐳 Building Docker images...${NC}"
  @if [ ! -d "apps/backend/dist" ]; then echo -e "${RED}❌ Backend not built. Run 'just build' first.${NC}" && exit 1; fi
  @if [ ! -d "apps/admin/.next/standalone" ]; then echo -e "${RED}❌ Admin not built. Run 'just build' first.${NC}" && exit 1; fi
  @COMPOSE_PROJECT_NAME="${DOCKER_NAME_BASE}_${BRANCH_NAME}" \
    BACKEND_IMAGE="${DOCKER_NAME_BASE}_${BRANCH_NAME}_backend" \
    ADMIN_IMAGE="${DOCKER_NAME_BASE}_${BRANCH_NAME}_admin" \
    docker compose -f docker/docker-compose.build.yml build --parallel
  @echo -e "${GREEN}✅ Docker images built${NC}"

# Build a specific Docker image (backend or admin)
docker-build-app APP:
  @echo -e "${BLUE}🐳 Building {{APP}} image...${NC}"
  @docker build -t lite-admin-{{APP}}:latest -f docker/Dockerfiles/Dockerfile.{{APP}} .

# Run dev stack with Docker Compose
docker-up:
  @echo -e "${GREEN}🚀 Starting Lite-Admin with Docker...${NC}"
  @docker compose -f docker/docker-compose.yml up -d

# Stop Docker services
docker-down:
  @echo -e "${YELLOW}🛑 Stopping Docker services...${NC}"
  @docker compose -f docker/docker-compose.yml down

# View Docker logs
docker-logs:
  @docker compose -f docker/docker-compose.yml logs -f

# === DOCKER CI/CD ===

# Build images for CI (same as docker-build but outputs image names)
docker-build-ci:
  @echo -e "${BLUE}🐳 Building Docker images for CI...${NC}"
  @if [ ! -d "apps/backend/dist" ]; then echo -e "${RED}❌ Backend not built${NC}" && exit 1; fi
  @if [ ! -d "apps/admin/.next/standalone" ]; then echo -e "${RED}❌ Admin not built${NC}" && exit 1; fi
  @export COMPOSE_PROJECT_NAME="${DOCKER_NAME_BASE}_${BRANCH_NAME}" && \
    export BACKEND_IMAGE="${DOCKER_NAME_BASE}_${BRANCH_NAME}_backend" && \
    export ADMIN_IMAGE="${DOCKER_NAME_BASE}_${BRANCH_NAME}_admin" && \
    docker compose -p $$COMPOSE_PROJECT_NAME -f docker/docker-compose.build.yml build --parallel && \
    echo -e "${GREEN}✅ Images built:${NC}" && \
    echo -e "  Backend: $$BACKEND_IMAGE:latest" && \
    echo -e "  Admin:   $$ADMIN_IMAGE:latest"

# Save Docker images as compressed tar files
docker-save:
  @echo -e "${BLUE}💾 Saving Docker images as tar files...${NC}"
  @export BACKEND_IMAGE="${DOCKER_NAME_BASE}_${BRANCH_NAME}_backend" && \
    export ADMIN_IMAGE="${DOCKER_NAME_BASE}_${BRANCH_NAME}_admin" && \
    docker save $$BACKEND_IMAGE:latest | gzip > $$BACKEND_IMAGE.tar.gz && \
    docker save $$ADMIN_IMAGE:latest | gzip > $$ADMIN_IMAGE.tar.gz && \
    echo -e "${GREEN}✅ Images saved:${NC}" && \
    ls -lah *.tar.gz

# Load Docker images from tar files
docker-load:
  @echo -e "${BLUE}📦 Loading Docker images from tar files...${NC}"
  @for f in *.tar.gz; do \
    echo "Loading $$f..."; \
    gunzip -c "$$f" | docker load; \
  done
  @echo -e "${GREEN}✅ Images loaded${NC}"

# Run production stack locally
docker-prod:
  @echo -e "${GREEN}🚀 Starting production stack...${NC}"
  @sudo mkdir -p /opt/lite-admin/{uploads/portfolio,uploads/thumbnails,database,logs}
  @export BACKEND_IMAGE="${DOCKER_NAME_BASE}_${BRANCH_NAME}_backend" && \
    export ADMIN_IMAGE="${DOCKER_NAME_BASE}_${BRANCH_NAME}_admin" && \
    docker compose -f docker/docker-compose.prod.yml up -d

# Run demo (frontend-only, mocked data)
docker-demo:
  @echo -e "${GREEN}🚀 Starting demo (frontend-only)...${NC}"
  @echo -e "${BLUE}Building admin with DEMO_MODE...${NC}"
  @NEXT_PUBLIC_DEMO_MODE=true pnpm build
  @docker build -t lite-admin-demo-admin:latest -f docker/Dockerfiles/Dockerfile.admin .
  @export ADMIN_IMAGE="lite-admin-demo-admin" && \
    docker compose -f docker/docker-compose.demo.yml up -d

# Stop all Docker stacks (dev + prod + demo)
docker-stop-all:
  @echo -e "${YELLOW}🛑 Stopping all Docker stacks...${NC}"
  @docker compose -f docker/docker-compose.yml down 2>/dev/null || true
  @docker compose -f docker/docker-compose.prod.yml down 2>/dev/null || true
  @docker compose -f docker/docker-compose.demo.yml down 2>/dev/null || true
  @echo -e "${GREEN}✅ All stacks stopped${NC}"

# Docker health check
docker-health:
  @echo -e "${CYAN}🏥 Docker Health Check${NC}"
  @echo -e "\n${BLUE}Backend:${NC}"
  @curl -sf http://localhost:3001/health | python3 -m json.tool 2>/dev/null || echo -e "  ${RED}❌ Backend not responding${NC}"
  @echo -e "\n${BLUE}Admin:${NC}"
  @curl -sf -o /dev/null -w "  HTTP %{http_code}" http://localhost:3002 2>/dev/null && echo "" || echo -e "  ${RED}❌ Admin not responding${NC}"

# Full local deploy simulation: build → images → save → load → run
docker-deploy-test:
  @echo -e "${CYAN}🧪 Running local deploy simulation...${NC}"
  @just build
  @just docker-build-ci
  @just docker-save
  @just docker-stop-all
  @just docker-load
  @just docker-prod
  @echo -e "\n${GREEN}✅ Local deploy simulation complete${NC}"
  @sleep 5
  @just docker-health

# Clean up lite-admin Docker resources
docker-clean:
  @echo -e "${YELLOW}🧹 Cleaning Docker resources...${NC}"
  @docker ps -a --filter "name=lite-admin" -q | xargs -r docker rm -f 2>/dev/null || true
  @docker images --filter "reference=*lite-admin*" -q | xargs -r docker rmi -f 2>/dev/null || true
  @rm -f *.tar.gz
  @echo -e "${GREEN}✅ Docker resources cleaned${NC}"

# === UTILITY COMMANDS ===

# Clean build artifacts and dependencies
clean:
  @echo -e "${YELLOW}🧹 Cleaning project...${NC}"
  @rm -rf node_modules
  @rm -rf src/public/uploads/*
  @rm -rf logs/*
  @echo -e "${GREEN}✅ Clean complete!${NC}"

# Deep clean including database
clean-all: clean
  @echo -e "${RED}💣 Removing database...${NC}"
  @rm -rf database/*
  @echo -e "${GREEN}✅ Deep clean complete!${NC}"

# Check system status
status:
  @echo -e "${CYAN}📊 Lite-Admin Status${NC}"
  @echo -e "\n${BLUE}Services:${NC}"
  @lsof -ti:3001 >/dev/null 2>&1 && echo -e "  🟢 API Server (port 3001)" || echo -e "  🔴 API Server"
  @echo -e "\n${BLUE}Database:${NC}"
  @[ -f ./database/lite.db ] && echo -e "  🟢 SQLite database exists" || echo -e "  🔴 No database found"
  @echo -e "\n${BLUE}Configuration:${NC}"
  @[ -f .env ] && echo -e "  ✅ .env: Found" || echo -e "  ❌ .env: Missing"
  @[ -d node_modules ] && echo -e "  ✅ Dependencies: Installed" || echo -e "  ❌ Dependencies: Not installed"

# System diagnostics
doctor:
  @echo -e "${CYAN}🩺 Running Lite-Admin Doctor...${NC}"
  @echo -e "\n${BLUE}📋 System Requirements:${NC}"
  @command -v node >/dev/null && echo -e "  ✅ Node.js: $(node -v)" || echo -e "  ❌ Node.js: Not found"
  @command -v pnpm >/dev/null && echo -e "  ✅ pnpm: $(pnpm -v)" || echo -e "  ❌ pnpm: Not found"
  @echo -e "\n${BLUE}🔧 Configuration:${NC}"
  @[ -f .env ] && echo -e "  ✅ .env: Found" || echo -e "  ❌ .env: Missing"
  @[ -d node_modules ] && echo -e "  ✅ Dependencies: Installed" || echo -e "  ❌ Dependencies: Not installed"
  @[ -d ./database ] && echo -e "  ✅ Database directory: Exists" || echo -e "  ❌ Database directory: Missing"
  @[ -d ./src/public/uploads ] && echo -e "  ✅ Upload directory: Exists" || echo -e "  ❌ Upload directory: Missing"
  @echo -e "\n${BLUE}🌐 Ports:${NC}"
  @lsof -ti:3001 >/dev/null 2>&1 && echo -e "  ⚠️  Port 3001: In use" || echo -e "  ✅ Port 3001: Available"
  @echo -e "\n${BLUE}🔧 Quick Fixes:${NC}"
  @if [ ! -f .env ]; then echo -e "  → Run: just setup-env"; fi
  @if [ ! -d node_modules ]; then echo -e "  → Run: pnpm install"; fi
  @if [ ! -d ./database ]; then echo -e "  → Run: just db-init"; fi

# Kill process on port
kill-port PORT="3001":
  @echo -e "${YELLOW}🔫 Killing process on port {{PORT}}...${NC}"
  @if lsof -ti:{{PORT}} >/dev/null 2>&1; then \
    lsof -ti:{{PORT}} | xargs kill -9; \
    echo -e "${GREEN}✅ Process killed${NC}"; \
  else \
    echo -e "${YELLOW}⚠️  No process found on port {{PORT}}${NC}"; \
  fi

# View logs
logs:
  @echo -e "${CYAN}📜 Showing logs...${NC}"
  @tail -f logs/combined.log 2>/dev/null || echo -e "${YELLOW}No logs found yet${NC}"

# === HELP ===

# Show detailed help
help:
  @echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  @echo -e "${GREEN}                           Lite-Admin Development Commands                           ${NC}"
  @echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  @echo -e "\n${BLUE}🚀 Quick Start:${NC}"
  @echo -e "  just quickstart       - Interactive first-time setup"
  @echo -e "  just install          - Install dependencies and set up project"
  @echo -e "  just dev              - Start development server"
  @echo -e "\n${BLUE}🏃 Development:${NC}"
  @echo -e "  just dev              - Start development server"
  @echo -e "  just start            - Start in production mode"
  @echo -e "  just pm2-start        - Start with PM2"
  @echo -e "  just status           - Check service status"
  @echo -e "\n${BLUE}🗄️  Database:${NC}"
  @echo -e "  just db-init          - Initialize database"
  @echo -e "  just db-backup        - Backup database"
  @echo -e "  just db-reset         - Reset database (DELETE ALL DATA)"
  @echo -e "\n${BLUE}👨‍💼 Admin Operations:${NC}"
  @echo -e "  just admin            - Run admin CLI"
  @echo -e "  just upload-image     - Upload portfolio image"
  @echo -e "  just export-submissions - Export form submissions"
  @echo -e "  just clean-data       - Clean old data"
  @echo -e "\n${BLUE}🐳 Docker:${NC}"
  @echo -e "  just docker-build     - Build Docker images (backend + admin)"
  @echo -e "  just docker-build-app - Build a specific image (backend or admin)"
  @echo -e "  just docker-up        - Start dev stack with Docker Compose"
  @echo -e "  just docker-down      - Stop dev Docker services"
  @echo -e "  just docker-prod      - Run production stack locally"
  @echo -e "  just docker-demo      - Run demo stack locally"
  @echo -e "  just docker-stop-all  - Stop all Docker stacks"
  @echo -e "  just docker-health    - Check Docker service health"
  @echo -e "\n${BLUE}🚢 Docker CI/CD:${NC}"
  @echo -e "  just docker-build-ci  - Build images for CI pipeline"
  @echo -e "  just docker-save      - Save images as compressed tar files"
  @echo -e "  just docker-load      - Load images from tar files"
  @echo -e "  just docker-deploy-test - Full local deploy simulation"
  @echo -e "  just docker-clean     - Clean lite-admin Docker resources"
  @echo -e "\n${BLUE}🔧 Utilities:${NC}"
  @echo -e "  just doctor           - System diagnostics"
  @echo -e "  just health           - API health check"
  @echo -e "  just logs             - View logs"
  @echo -e "  just clean            - Clean build artifacts"
  @echo -e "  just kill-port        - Kill process on port"
  @echo -e "\n${GREEN}🌐 Service URLs (when running):${NC}"
  @echo -e "  🔗 API:               http://localhost:3001"
  @echo -e "  🏥 Health Check:      http://localhost:3001/health"
  @echo -e "  📁 Uploads:           http://localhost:3001/uploads"