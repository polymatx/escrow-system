# Contributing to Solana Escrow System

Thank you for your interest in contributing! Here's how to get started:

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/escrow-system.git`
3. Install dependencies: `yarn install`
4. Run setup: `make setup`
5. Build and test: `make test`

## Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Add tests for new functionality
4. Run tests: `make test`
5. Run linter: `make lint`
6. Commit changes: `git commit -m "feat: your feature description"`
7. Push and create a pull request

## Code Standards

- Follow Rust best practices for smart contracts
- Add comprehensive tests for all new features
- Update documentation for API changes
- Use conventional commits for clear history

## Testing

- Write unit tests for all functions
- Add integration tests for user flows
- Test edge cases and error conditions
- Ensure security validations work

## Security

- Never commit private keys or secrets
- Follow Solana security best practices
- Have security-sensitive changes reviewed
- Test authorization and access controls
