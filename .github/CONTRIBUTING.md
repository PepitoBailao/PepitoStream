# Contributing to PepitoStream

Thank you for your interest in contributing to PepitoStream! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/PepitoStream.git`
3. Add upstream: `git remote add upstream https://github.com/PepitoBailao/PepitoStream.git`
4. Create a feature branch: `git checkout -b feature/amazing-feature`
5. Make your changes
6. Test your changes: `npm run test`
7. Commit: `git commit -m 'Add amazing feature'`
8. Push: `git push origin feature/amazing-feature`
9. Open a Pull Request

## Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Be descriptive but concise
- Reference issues when relevant: "Fix #123"
- Example: "Add multi-language support for streaming"

## Code Style

- Follow the existing code style
- Use TypeScript for all new code
- Run `npm run format` to auto-format code
- Run `npm run lint` to check for linting errors
- Run `npm run type-check` to verify TypeScript

## Testing

- Write tests for new features
- Run `npm run test` before submitting PR
- Maintain or improve code coverage

## Pull Request Process

1. Update README.md with relevant changes
2. Update docs if adding new features
3. Ensure all tests pass
4. Ensure no linting errors
5. Fill out the PR template completely
6. Wait for review and address feedback

## Reporting Bugs

1. Check if the bug is already reported
2. Provide detailed reproduction steps
3. Include expected vs actual behavior
4. Include screenshots/logs if applicable
5. Note your environment (OS, Node version, etc.)

## Suggesting Features

1. Check if feature is already suggested
2. Explain the use case clearly
3. Provide examples if possible
4. Discuss implementation approach if you have one

## Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### Installation

```bash
# Clone and install
git clone https://github.com/PepitoBailao/PepitoStream.git
cd PepitoStream
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your settings

# Initialize database
npm run db:init
npm run db:migrate

# Start development
npm run dev
```

### Available Scripts

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run format       # Format code
npm run type-check   # Check TypeScript
npm run test         # Run tests
npm run db:init      # Initialize database
npm run db:migrate   # Run migrations
```

## Architecture Guidelines

### Frontend (Next.js)
- Use functional components with hooks
- Keep components small and focused
- Use Tailwind CSS for styling
- Organize by feature, not type
- Use TypeScript for type safety
- Use React Query for server state

### Backend (API Routes)
- Use TypeScript
- Validate all inputs with Zod
- Return consistent response format
- Handle errors properly
- Add proper logging
- Use parameterized queries to prevent SQL injection

### Database
- Use migrations for schema changes
- Add appropriate indexes
- Document schema changes
- Use constraints for data integrity

## Areas We Need Help With

- Bug fixes
- Documentation improvements
- Performance optimizations
- UI/UX enhancements
- Testing coverage
- Feature implementations from the roadmap

## Questions?

- Open a GitHub Discussion
- Check existing issues and docs
- Ask in our Discord community

Thank you for contributing! 🚀
