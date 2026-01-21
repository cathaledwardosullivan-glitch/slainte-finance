# Sláinte Finance V2 - Future Development Notes

Last updated: November 2025

This document tracks areas for future development, improvements, and considerations for the next version of the app.

---

## Security Enhancements (Lower Priority)

These items were identified during the security audit but deferred as lower priority for the current desktop-focused release.

### Rate Limiting
- **What**: Add rate limiting to API endpoints, especially `/api/auth/login`
- **Why**: Prevents brute force attacks on the mobile access password
- **How**: Use `express-rate-limit` middleware
- **Priority**: Medium (becomes higher if app is exposed to internet)

### Security Headers
- **What**: Add HTTP security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.)
- **Why**: Defense in depth against XSS, clickjacking, MIME sniffing attacks
- **How**: Use `helmet` middleware for Express
- **Priority**: Low for Electron, Medium if PWA is widely used

### localStorage Encryption
- **What**: Encrypt sensitive data stored in localStorage/Electron userData
- **Why**: Protects data if device is compromised
- **How**: Use a library like `crypto-js` with a device-derived key
- **Priority**: Low (desktop app, single user)

### File Upload Validation
- **What**: Enhanced validation of uploaded CSV files
- **Why**: Defense against malformed data injection
- **Suggestions**:
  - Validate CSV structure before processing
  - Sanitize cell contents
  - Add maximum row count limit
- **Priority**: Low

---

## Feature Ideas

### Mobile Access Setup in Onboarding
- **What**: Add guided mobile access setup to the onboarding flow
- **Why**: Currently users must manually configure `VITE_API_URL` for remote access
- **Suggestions**:
  - Detect local IP and display it for LAN access
  - Provide QR code for easy mobile connection
  - Guided Cloudflare Tunnel setup wizard
  - Test connection from within the app
- **Priority**: Medium

### Mobile App Improvements
- Push notifications for financial alerts
- Offline mode with sync when reconnected
- Biometric authentication option

### Reporting
- Scheduled automated report generation
- Email reports directly to accountant
- Custom report templates

### AI Enhancements
- Train on user corrections over time (learning system foundations exist)
- Multi-language support for transaction descriptions
- Predictive cash flow analysis

### Integration
- Direct bank feed integration (Open Banking)
- Accounting software export (Sage, Xero formats)
- PCRS API integration (if/when available)

---

## Technical Debt

### API Key Storage Consolidation
- Currently checking both `claude_api_key` (Electron) and `anthropic_api_key` (localStorage)
- Consider fully migrating to single storage location
- Remove localStorage fallback once all users have migrated

### Code Organization
- Consider extracting API key loading into a shared hook/utility
- Standardize error handling across components

---

## Resolved Issues (Reference)

The following were addressed in the November 2025 security audit:

- [x] npm audit vulnerabilities (glob, js-yaml) - Fixed
- [x] xlsx library CVEs - Removed, CSV-only
- [x] Hardcoded JWT_SECRET - Auto-generated
- [x] Hardcoded PARTNER_PASSWORD - User-configured during onboarding
- [x] Exposed API key in .env - Removed
- [x] Permissive CORS - Whitelist configured
- [x] Hardcoded 'electron-internal' token - Random per session
- [x] SSRF vulnerability in website scraping - URL validation added

---

## Notes

- The app is designed for single-practice use on a desktop with optional mobile access
- Security measures should be balanced against usability for non-technical users
- Consider user feedback when prioritizing future features
