#!/usr/bin/env just --justfile

# Lite-Backend Development Commands
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
  @echo -e "${GREEN}🎯 Lite-Backend Quick Start Setup${NC}"
  @echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  @echo -e "\nThis will guide you through setting up Lite-Backend for the first time.\n"
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
  @echo -e "${GREEN}🚀 Setting up Lite-Backend...${NC}"
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
  @echo -e "${GREEN}🚀 Starting Lite-Backend Development Server...${NC}"
  @just validate-env
  @echo -e "${BLUE}🗄️  Initializing database...${NC}"
  @just db-init
  @echo -e "${GREEN}🎯 Starting server...${NC}"
  @pnpm dev

# Start in production mode
start:
  @echo -e "${GREEN}🚀 Starting Lite-Backend in production mode...${NC}"
  @just validate-env
  @NODE_ENV=production pnpm start

# Start with PM2
pm2-start:
  @echo -e "${GREEN}🚀 Starting Lite-Backend with PM2...${NC}"
  @pm2 start ecosystem.config.js

# Stop PM2
pm2-stop:
  @echo -e "${YELLOW}🛑 Stopping Lite-Backend PM2 process...${NC}"
  @pm2 stop ecosystem.config.js

# Restart PM2
pm2-restart:
  @echo -e "${YELLOW}🔄 Restarting Lite-Backend PM2 process...${NC}"
  @pm2 restart ecosystem.config.js

# PM2 logs
pm2-logs:
  @pm2 logs lite-backend

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
  @echo -e "${CYAN}🔍 Validating Lite-Backend Project...${NC}"
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

# === DOCKER ===

# Build Docker image
docker-build:
  @echo -e "${BLUE}🐳 Building Docker image...${NC}"
  @docker build -t lite-backend:latest -f docker/Dockerfile .

# Run with Docker Compose
docker-up:
  @echo -e "${GREEN}🚀 Starting Lite-Backend with Docker...${NC}"
  @docker-compose -f docker/docker-compose.yml up -d

# Stop Docker services
docker-down:
  @echo -e "${YELLOW}🛑 Stopping Docker services...${NC}"
  @docker-compose -f docker/docker-compose.yml down

# View Docker logs
docker-logs:
  @docker-compose -f docker/docker-compose.yml logs -f

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
  @echo -e "${CYAN}📊 Lite-Backend Status${NC}"
  @echo -e "\n${BLUE}Services:${NC}"
  @lsof -ti:3001 >/dev/null 2>&1 && echo -e "  🟢 API Server (port 3001)" || echo -e "  🔴 API Server"
  @echo -e "\n${BLUE}Database:${NC}"
  @[ -f ./database/lite.db ] && echo -e "  🟢 SQLite database exists" || echo -e "  🔴 No database found"
  @echo -e "\n${BLUE}Configuration:${NC}"
  @[ -f .env ] && echo -e "  ✅ .env: Found" || echo -e "  ❌ .env: Missing"
  @[ -d node_modules ] && echo -e "  ✅ Dependencies: Installed" || echo -e "  ❌ Dependencies: Not installed"

# System diagnostics
doctor:
  @echo -e "${CYAN}🩺 Running Lite-Backend Doctor...${NC}"
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
  @echo -e "${GREEN}                           Lite-Backend Development Commands                           ${NC}"
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
  @echo -e "  just docker-build     - Build Docker image"
  @echo -e "  just docker-up        - Start with Docker Compose"
  @echo -e "  just docker-down      - Stop Docker services"
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