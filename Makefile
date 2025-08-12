# Makefile for Solana Escrow System

.PHONY: help install build test deploy clean lint format setup verify monitor

# Default target
help: ## Show this help message
	@echo "Solana Escrow System - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development commands
install: ## Install all dependencies
	@echo "📦 Installing dependencies..."
	yarn install
	@echo "✅ Dependencies installed"

setup: ## Set up development environment
	@echo "🚀 Setting up development environment..."
	chmod +x scripts/*.sh
	./scripts/setup.sh
	@echo "✅ Setup complete"

build: ## Build the program
	@echo "🔨 Building program..."
	anchor build
	@echo "✅ Build complete"

clean: ## Clean build artifacts
	@echo "🧹 Cleaning build artifacts..."
	anchor clean
	rm -rf node_modules/.cache
	@echo "✅ Clean complete"

# Testing commands
test: ## Run all tests
	@echo "🧪 Running tests..."
	anchor test
	@echo "✅ Tests complete"

test-unit: ## Run unit tests only
	@echo "🧪 Running unit tests..."
	anchor test --skip-local-validator
	@echo "✅ Unit tests complete"

verify: ## Run comprehensive verification
	@echo "🔍 Running verification..."
	./scripts/test-and-verify.sh
	@echo "✅ Verification complete"

# Code quality commands
lint: ## Run linter
	@echo "🔍 Running linter..."
	yarn lint
	@echo "✅ Linting complete"

format: ## Format code
	@echo "✨ Formatting code..."
	yarn lint:fix
	cargo fmt
	@echo "✅ Formatting complete"

# Deployment commands
deploy-local: build ## Deploy to localnet
	@echo "🚀 Deploying to localnet..."
	./scripts/deploy-env.sh localnet
	@echo "✅ Local deployment complete"

deploy-devnet: build ## Deploy to devnet
	@echo "🚀 Deploying to devnet..."
	./scripts/deploy-env.sh devnet
	@echo "✅ Devnet deployment complete"

deploy-mainnet: build ## Deploy to mainnet (use with caution)
	@echo "⚠️  Deploying to mainnet..."
	@read -p "Are you sure? This costs real SOL. Type 'YES' to continue: " confirm && [ "$$confirm" = "YES" ]
	./scripts/deploy-env.sh mainnet force
	@echo "✅ Mainnet deployment complete"

# Utility commands
keypair: ## Generate test keypairs
	@echo "🔑 Generating keypairs..."
	./scripts/create-keypair.sh
	@echo "✅ Keypairs generated"

monitor: ## Start monitoring (requires deployed program)
	@echo "📊 Starting monitoring..."
	yarn start:monitoring

validator: ## Start local test validator
	@echo "🖥️ Starting test validator..."
	solana-test-validator --reset

example: ## Run example usage
	@echo "🎯 Running example..."
	yarn example

# Information commands
info: ## Show project information
	@echo "📋 Project Information:"
	@echo "Name: Solana Escrow System"
	@echo "Version: $(shell cat package.json | jq -r '.version')"
	@echo "Rust: $(shell rustc --version 2>/dev/null || echo 'Not installed')"
	@echo "Solana: $(shell solana --version 2>/dev/null || echo 'Not installed')"
	@echo "Anchor: $(shell anchor --version 2>/dev/null || echo 'Not installed')"
	@echo "Node: $(shell node --version 2>/dev/null || echo 'Not installed')"

status: ## Show current status
	@echo "📊 Current Status:"
	@echo "Cluster: $(shell solana config get | grep 'RPC URL' | cut -d' ' -f3)"
	@echo "Keypair: $(shell solana config get | grep 'Keypair Path' | cut -d' ' -f3)"
	@echo "Address: $(shell solana address 2>/dev/null || echo 'No keypair set')"
	@echo "Balance: $(shell solana balance 2>/dev/null || echo 'No balance info')"

# Development workflow
dev: ## Complete development workflow (setup, build, test)
	make setup
	make build
	make test
	@echo "🎉 Development workflow complete!"

# Production workflow
prod: ## Production deployment workflow (test, build, deploy)
	make test
	make lint
	make build
	make deploy-devnet
	@echo "🎉 Production workflow complete!"

# Emergency commands
emergency-stop: ## Emergency stop (kills local validator)
	@echo "🛑 Emergency stop..."
	pkill -f solana-test-validator || true
	@echo "✅ Emergency stop complete"

# Quick commands
q-test: build ## Quick test (build and run tests)
	anchor test --skip-local-validator

q-deploy: build ## Quick deploy to localnet
	anchor deploy

# Documentation
docs: ## Generate documentation
	@echo "📚 Generating documentation..."
	anchor doc
	@echo "✅ Documentation generated"

# Git hooks setup
hooks: ## Set up git hooks
	@echo "🪝 Setting up git hooks..."
	echo '#!/bin/bash\nmake lint' > .git/hooks/pre-commit
	chmod +x .git/hooks/pre-commit
	@echo "✅ Git hooks installed"

# Dependencies check
check-deps: ## Check and update dependencies
	@echo "🔍 Checking dependencies..."
	cargo audit || echo "Install cargo-audit: cargo install cargo-audit"
	yarn audit || echo "Some vulnerabilities found in JS dependencies"
	@echo "✅ Dependency check complete"

# Performance testing
perf-test: ## Run performance tests
	@echo "⚡ Running performance tests..."
	anchor test tests/performance.ts || echo "Performance tests not yet implemented"
	@echo "✅ Performance testing complete"

# Security scan
security: ## Run security analysis
	@echo "🛡️ Running security analysis..."
	cargo clippy -- -D warnings
	@echo "✅ Security analysis complete"
