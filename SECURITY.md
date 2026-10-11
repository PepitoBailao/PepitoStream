# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in PepitoStream, please email us at **security@pepitostream.com** instead of using the issue tracker.

Please include the following information:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any patches or workarounds you've found

## Security Measures

### Authentication
- All passwords are hashed using bcrypt with salt rounds of 12
- JWT tokens are issued with 7-day expiry for access and 30-day for refresh
- Two-factor authentication support available

### Data Protection
- All sensitive data is encrypted at rest
- TLS 1.2+ for all communications
- CORS restrictions in place
- CSRF protection enabled

### API Security
- Rate limiting on all endpoints (10 req/s for API, 50 req/s for general)
- Input validation on all requests
- SQL injection protection via Prisma ORM
- XSS protection headers enabled

### Infrastructure
- Docker containerization for isolation
- PostgreSQL with encrypted connections
- Redis for secure session management
- Nginx reverse proxy with security headers

### Monitoring
- Sentry integration for error tracking
- Request logging with Pino
- Security scanning via Snyk
- Regular npm audit checks

## Compliance

- GDPR compliant data handling
- CCPA compliant privacy practices
- Regular security audits
- Dependency updates within 48 hours of release

## Updates

Stay informed about security updates:
- Watch our GitHub repository
- Subscribe to our security mailing list
- Follow our Twitter @PepitoStream

Thank you for helping keep PepitoStream secure!