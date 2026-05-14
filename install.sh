#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  rn-token-optimizer — One-line installer
#
#  Usage (from your React Native project root):
#    curl -fsSL https://raw.githubusercontent.com/prmargas/rn-token-optimizer/main/install.sh | bash
#
#  Or with options:
#    curl ... | bash -s -- --cursor          # force Cursor
#    curl ... | bash -s -- --kiro            # force Kiro
#    curl ... | bash -s -- --all-ides        # configure every detected IDE
#    curl ... | bash -s -- --api-key sk-...  # set Anthropic API key
#    curl ... | bash -s -- --ci              # non-interactive (CI/CD, index only)
#    curl ... | bash -s -- --dir /path/app   # target a specific project directory
#
#  What it does:
#    1. Checks Node.js >= 18
#    2. Installs rn-token-optimizer globally (npm install -g)
#    3. Runs `rn-token-optimizer setup` in your project root
#       - Auto-detects Cursor / Kiro / Claude Desktop
#       - Writes MCP config, Cursor rule, and Kiro steering file
#       - Indexes your project context (package.json, requirements)
#       - Builds the AST code intelligence graph
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
BOLD='\033[1m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
DIM='\033[2m'
RESET='\033[0m'

ok()   { echo -e "${GREEN}  ✅  $*${RESET}"; }
info() { echo -e "${DIM}  ℹ   $*${RESET}"; }
warn() { echo -e "${YELLOW}  ⚠   $*${RESET}"; }
err()  { echo -e "${RED}  ✗   $*${RESET}" >&2; }
step() { echo -e "\n${BOLD}${CYAN}  ━━  $*  ━━${RESET}"; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}${CYAN}  🚀  rn-token-optimizer — Installer${RESET}"
echo -e "${DIM}       AST code graph · prompt optimizer · MCP integration${RESET}"
echo -e "${BOLD}${CYAN}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── Parse arguments ───────────────────────────────────────────────────────────
SETUP_FLAGS=""
TARGET_DIR=""
API_KEY=""
CI_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cursor)     SETUP_FLAGS="$SETUP_FLAGS --cursor";    shift ;;
    --kiro)       SETUP_FLAGS="$SETUP_FLAGS --kiro";      shift ;;
    --all-ides)   SETUP_FLAGS="$SETUP_FLAGS --all-ides";  shift ;;
    --ci)         SETUP_FLAGS="$SETUP_FLAGS --ci"; CI_MODE=true; shift ;;
    --api-key)    API_KEY="$2"; SETUP_FLAGS="$SETUP_FLAGS --api-key $2"; shift 2 ;;
    --dir)        TARGET_DIR="$2"; SETUP_FLAGS="$SETUP_FLAGS --dir $2"; shift 2 ;;
    *) warn "Unknown option: $1"; shift ;;
  esac
done

# ── Step 1: Check Node.js ─────────────────────────────────────────────────────
step "Check Node.js"

if ! command -v node &>/dev/null; then
  err "Node.js not found."
  echo ""
  echo "  Install Node.js >= 18 from https://nodejs.org"
  echo "  or via nvm:  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
  echo "               nvm install 20 && nvm use 20"
  exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

if [[ "$NODE_MAJOR" -lt 18 ]]; then
  err "Node.js $NODE_VERSION detected — version 18+ required."
  echo "  Run: nvm install 20 && nvm use 20"
  exit 1
fi

ok "Node.js $NODE_VERSION"

# ── Step 2: Install npm package ───────────────────────────────────────────────
step "Install rn-token-optimizer"

# If already installed, check version
CURRENT_VERSION=""
if command -v rn-token-optimizer &>/dev/null; then
  CURRENT_VERSION=$(rn-token-optimizer --version 2>/dev/null || echo "")
fi

if [[ -n "$CURRENT_VERSION" ]]; then
  info "Already installed: rn-token-optimizer $CURRENT_VERSION"
  info "Checking for updates…"
fi

if npm install -g rn-token-optimizer 2>&1 | grep -q "added\|updated\|changed"; then
  ok "rn-token-optimizer installed successfully"
elif command -v rn-token-optimizer &>/dev/null; then
  ok "rn-token-optimizer is ready ($(rn-token-optimizer --version 2>/dev/null || echo 'latest'))"
else
  # Try with sudo if regular install failed (common on macOS without nvm)
  warn "Global install may need elevated permissions — trying with sudo…"
  if ! sudo npm install -g rn-token-optimizer; then
    err "Installation failed."
    echo ""
    echo "  Manual install:"
    echo "    npm install -g rn-token-optimizer"
    echo "  or (fix npm permissions first):"
    echo "    https://docs.npmjs.com/resolving-eacces-permissions-errors"
    exit 1
  fi
  ok "rn-token-optimizer installed (sudo)"
fi

# Verify the binary is in PATH
if ! command -v rn-token-optimizer &>/dev/null; then
  err "rn-token-optimizer not found in PATH after install."
  echo ""
  echo "  Try adding npm global bin to your PATH:"
  echo "    export PATH=\"\$(npm prefix -g)/bin:\$PATH\""
  echo "  Add that line to your ~/.zshrc or ~/.bashrc, then re-run this script."
  exit 1
fi

ok "Binary available: $(which rn-token-optimizer)"

# ── Step 3: Locate project root ───────────────────────────────────────────────
step "Locate project root"

if [[ -n "$TARGET_DIR" ]]; then
  PROJECT_ROOT="$TARGET_DIR"
  info "Using specified directory: $PROJECT_ROOT"
else
  # Walk up from cwd to find package.json
  PROJECT_ROOT="$PWD"
  SEARCH="$PWD"
  while [[ "$SEARCH" != "/" ]]; do
    if [[ -f "$SEARCH/package.json" ]]; then
      PROJECT_ROOT="$SEARCH"
      break
    fi
    SEARCH=$(dirname "$SEARCH")
  done
fi

if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
  warn "No package.json found in $PROJECT_ROOT"
  warn "This may not be a Node.js / React Native project."
  echo ""
  read -r -p "  Continue anyway? [y/N] " CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "  Aborted. Run from your project root or pass --dir /path/to/project"
    exit 1
  fi
fi

PROJECT_NAME=$(node -e "try{const p=require('$PROJECT_ROOT/package.json');console.log(p.name||'unknown')}catch{console.log('unknown')}" 2>/dev/null || echo "unknown")
ok "Project: $PROJECT_NAME  ($PROJECT_ROOT)"

# ── Step 4: Auto-detect IDE ───────────────────────────────────────────────────
if [[ -z "$SETUP_FLAGS" || "$CI_MODE" == "false" ]]; then
  step "Auto-detect IDE"

  HAS_CURSOR=false
  HAS_KIRO=false

  [[ -d "$PROJECT_ROOT/.cursor" || -d "$HOME/.cursor" ]] && HAS_CURSOR=true
  [[ -d "$PROJECT_ROOT/.kiro"   || -d "$HOME/.kiro"   ]] && HAS_KIRO=true

  if $HAS_CURSOR; then info "Cursor detected"; fi
  if $HAS_KIRO;   then info "Kiro detected";   fi
  if ! $HAS_CURSOR && ! $HAS_KIRO; then
    info "No IDE detected — defaulting to Cursor project config"
    SETUP_FLAGS="$SETUP_FLAGS --cursor"
  fi
fi

# ── Step 5: Run rn-token-optimizer setup ──────────────────────────────────────
step "Run project setup"
echo ""

cd "$PROJECT_ROOT"

# shellcheck disable=SC2086
rn-token-optimizer setup $SETUP_FLAGS

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}  Installation complete!${RESET}"
echo ""
echo -e "${DIM}  Docs  : https://github.com/prmargas/rn-token-optimizer#readme${RESET}"
echo -e "${DIM}  Issues: https://github.com/prmargas/rn-token-optimizer/issues${RESET}"
echo ""
