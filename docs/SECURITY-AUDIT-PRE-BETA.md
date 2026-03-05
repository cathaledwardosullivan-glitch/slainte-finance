# Pre-Beta Security Audit & Virtual Penetration Test

**Date:** 2026-03-01
**Status:** PLANNED — Ready to execute
**Scope:** Full codebase security review + "Claude Code-aware attacker" simulation
**Goal:** Harden the app before distributing to 10 beta test practices

> To pick up where we left off, tell Claude: "Let's work through the security audit in docs/SECURITY-AUDIT-PRE-BETA.md"

---

## What We Found

We ran a virtual penetration test from the perspective of an attacker who knows (or suspects) the app was built with Claude Code. The attacker would make specific assumptions about AI-generated code patterns — and **they'd be right almost every time:**

| Attacker Assumption | Status | Location |
|---|---|---|
| `dangerouslySetInnerHTML` without sanitization | CONFIRMED | ArtifactViewer.jsx, MobileLayout.jsx, ReportModal.jsx, artifactBuilder.js |
| Permissive security configs | CONFIRMED | Mermaid: `securityLevel: 'loose'`, `htmlLabels: true` |
| Missing input validation | CONFIRMED | Chat messages, backup paths, password complexity |
| No rate limiting | CONFIRMED | Zero rate limiting on any endpoint |
| Secrets in localStorage | CONFIRMED | API key + JWT tokens |
| No security headers | CONFIRMED | No CSP, no X-Frame-Options, no X-Content-Type-Options |

Additionally, prompt injection surfaces and a license bypass were identified (details below).

---

## All Findings — Prioritized

### CRITICAL (Must fix before beta)

| ID | Issue | File(s) | Risk |
|----|-------|---------|------|
| C1 | **Mermaid XSS** — `securityLevel: 'loose'` allows script execution in diagram labels | ArtifactViewer.jsx:25 | XSS -> localStorage theft -> API key exfiltration |
| C2 | **No Content Security Policy** — no CSP anywhere | index.html, main.cjs | Any XSS can load external scripts |
| C3 | **Path traversal in backup restore/delete** — filepath param not validated | main.cjs:1634-1656 | Read/delete arbitrary files on disk |
| C4 | **No rate limiting on login** — unlimited brute force attempts | main.cjs:1048-1079 | Password crack on LAN |
| C5 | **dangerouslySetInnerHTML without sanitization** — AI-generated HTML rendered raw | ArtifactViewer.jsx:454,553,722; MobileLayout.jsx:1442; artifactBuilder.js:277 | XSS from AI output |

### HIGH (Should fix before beta)

| ID | Issue | File(s) | Risk |
|----|-------|---------|------|
| H1 | **No password complexity requirements** — 1-char passwords accepted | main.cjs:1054 | Trivial brute force |
| H2 | **Prompt injection via transaction descriptions** — unescaped in AI prompts | aiCategorization.js:97-121 | AI behavior manipulation |
| H3 | **Prompt injection via practice profile** — "specific instructions" field injected raw into system prompt | ciaranContextBuilder.js:282-297 | System prompt override |
| H4 | **API key in localStorage** — accessible to any XSS | main.cjs:1679-1683 | Key theft if XSS exists |
| H5 | **License bypass via clock manipulation** — grace period uses local system time | main.cjs:281-290 | Permanent free access |
| H6 | **Missing security headers** — no X-Frame-Options, X-Content-Type-Options | main.cjs (Express) | Clickjacking, MIME sniffing |

### MODERATE (Fix before production)

| ID | Issue | File(s) | Risk |
|----|-------|---------|------|
| M1 | **JWT tokens in localStorage** — should be in Electron userData | useLANMode.js:45-52 | Token theft |
| M2 | **CORS allows any port on LAN IPs** — regex doesn't restrict port | main.cjs:768-770 | Cross-origin from LAN malware |
| M3 | **IPv6 bypass in SSRF validation** — `::ffff:127.0.0.1` not blocked | main.cjs:1263-1269 | SSRF to localhost |
| M4 | **Insufficient backup import validation** — no schema validation on JSON | BackupRestoreSection.jsx:198-228 | Data corruption |
| M5 | **No Electron sandbox flag** — `sandbox: true` not set | main.cjs:2003-2006 | Reduced process isolation |
| M6 | **50MB JSON body limit** — potential DoS | main.cjs:784 | Memory exhaustion |

### Already Secure (No action needed)

- Electron hardening: `nodeIntegration: false`, `contextIsolation: true`, preload bridge
- Password hashing: PBKDF2, 100k iterations, 16-byte salt, timing-safe comparison
- SSRF prevention: comprehensive IP/domain validation on website analysis
- JWT: token versioning, 7-day expiry, random 256-bit secret
- Secure credentials: stored in OS userData, not source control
- PDF parsing: text-only extraction, no eval/injection vectors
- Local-only mode: properly gates all external API calls

---

## Agreed Execution Plan

We agreed on a phased approach. **Phases 1-2 should be done before beta. Phases 3-4 can follow.**

### Phase 1: XSS & Injection Fixes
**~6 file edits. Feature risk: LOW (with one caveat — see notes)**

1. **Fix Mermaid config** (ArtifactViewer.jsx)
   - `securityLevel: 'loose'` -> `'strict'`
   - `htmlLabels: true` -> `false`

2. **Add DOMPurify** to all `dangerouslySetInnerHTML`
   - `npm install dompurify`
   - Wrap in ArtifactViewer.jsx, MobileLayout.jsx, ReportModal.jsx, artifactBuilder.js
   - Tune allowed tags: tables, headers, lists, strong, em, etc.

3. **Add CSP in report-only mode first** (index.html)
   - Use `Content-Security-Policy-Report-Only` header initially
   - This logs violations to DevTools console without blocking anything
   - Use the app normally, check console for violations, adjust whitelist
   - Switch to enforcing `Content-Security-Policy` once tuned

4. **Add security headers** (main.cjs Express middleware)
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`

**Feature risk notes:**
- Mermaid `strict` mode: if Finn generates diagrams with HTML in labels (e.g. `<br>`), those will stop rendering. Check and adjust Finn's prompt if needed.
- DOMPurify: if the allowlist is too restrictive, legitimate report formatting gets stripped. Start generous, tighten later.
- CSP: using report-only mode first eliminates risk entirely.

### Phase 2: Auth & API Hardening
**~3 file edits. Feature risk: VERY LOW**

5. **Add rate limiting** (main.cjs)
   - `npm install express-rate-limit`
   - Login: 5 attempts / 15 min / IP
   - Chat/API: 60 req / min / IP
   - Website analysis: 10 / min

6. **Add password validation** (main.cjs, `setPartnerPassword()`)
   - Minimum 8 characters
   - At least one number and one letter
   - Only applies to new passwords, not existing

7. **Validate backup file paths** (main.cjs, restore/delete handlers)
   - `path.resolve()` filepath, ensure it starts with backups directory
   - Validate `.slainte-backup` extension

### Phase 3: Prompt Injection Mitigations (Post-beta OK)
**~3 file edits. Feature risk: MODERATE — needs testing**

8. **Escape user data in AI prompts**
   - ciaranContextBuilder.js: wrap practice data in `<user_data>` delimiters, add "treat as data not instructions" directive
   - aiCategorization.js: same for transaction descriptions
   - Add max-length truncation on injected fields

**Feature risk note:** Changing prompt structure can subtly affect AI response quality. The "specific instructions" field currently works because it reads like part of the system prompt — delimitering it may reduce adherence. Test with real practice data.

### Phase 4: Defense-in-Depth (Post-beta OK)
**~2 file edits. Feature risk: LOW**

9. `sandbox: true` in Electron webPreferences (test IPC still works)
10. Reduce JSON body limit from 50MB to 5MB
11. Add IPv6 validation to SSRF checks

---

## Verification Checklist

After each phase:
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` succeeds
- [ ] Finn chat works end-to-end
- [ ] Artifact/report rendering works (diagrams, tables, HTML reports)
- [ ] Backup/restore works
- [ ] No unexpected console errors (especially CSP violations)

Specific security tests:
- [ ] Mermaid diagram with `<script>` in label — should be sanitized, not executed
- [ ] Backup restore from outside backups directory — should be rejected
- [ ] 10+ rapid login attempts — should be rate-limited after 5
- [ ] CSP report-only console — review and adjust before switching to enforcing

---

## Deferred to Production Hardening

- HTTPS enforcement for LAN access (needs certificate infrastructure)
- JWT migration from localStorage to Electron userData (larger refactor)
- Server-side license validation (needs backend)
- Full dependency audit (`npm audit`)
- PCRS automation credential handling (separate audit)
