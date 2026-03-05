# Website Text Update Guide

*Quick reference for the web team — aligning website copy with the latest app build (February 2026)*

The existing website text is well-structured and reads really well. The legal framework on the Privacy Policy and Terms of Service pages is particularly strong — great work on the GDPR sections. The updates below are mostly about syncing a few technical details with how the app actually works today, plus adding some specifics that will strengthen the documents.

Full unified drafts are available in the repo at `docs/` if you want the complete text, but here's what needs attention on each page:

---

## Privacy Policy (`/privacy-policy`)

**Section 3 — "What Data We Collect" table**

The table is a great format. Two updates needed:

1. Replace "Google Cloud (our systems)" with **"Google Workspace (our systems)"** — more accurately describes where the data lives (Google Forms → Google Sheets in your Workspace). "Google Cloud" could be misread as GCP infrastructure.

2. Add a row for **automatic practice registration**. When a user first completes setup, the app sends a randomly generated Practice ID (e.g. SLP-A3X9K2) and their practice name to the Google Form. This is a one-time automatic event the user doesn't trigger manually, so it needs explicit disclosure. Suggested row:

   | Practice registration | Practice ID (random), practice name, OS | Automatically on first setup | Google Workspace (our systems) |

**Section 5 — "Finn AI Advisor and Data Processing"**

The current text says Finn sends "your question and relevant financial context" — which is accurate but quite general. Adding specifics here significantly strengthens transparency and user trust. Consider adding a "What is sent / What is never sent" table:

| Sent securely | Never sent |
|---|---|
| Your questions to Finn | Bank account numbers, sort codes, IBANs |
| Aggregated financial totals & category summaries | Patient data |
| Practice name and staff/GP names | PCRS login credentials |
| GMS payment amounts | Sláinte Key |
| Transaction descriptions (~5% uncategorised items) | Raw bank statement files |
| Complete breakdowns (for detailed reports) | Passwords or API keys |
| Practice website content (if user opts in during setup) | |

**New section to add — "Local Only Mode"**

This is a significant privacy feature that the app supports today but isn't mentioned on the website. Worth adding a short section (even 2-3 sentences) explaining that users can disable all external connections from Settings, and that all core features continue to work without AI. This is a strong selling point for privacy-conscious practices.

**New section to add — "No Tracking or Telemetry"**

The app contains zero analytics, tracking, or telemetry. This is a genuinely distinctive claim worth making explicitly — most competitors can't say this.

**Section 7 — "Data Retention"**

The current text says "We do not store conversation logs" — this is true server-side, but Finn chat history is stored locally on the user's device (and can be cleared from Settings). Worth clarifying: *"We do not store conversation logs on our systems. Finn chat history is stored locally on your device and can be cleared at any time from Settings > Privacy & AI."*

**New section to add — "Third-Party Processors"**

GDPR best practice is to name your data processors. You only have two, which is a strength worth highlighting:

| Processor | Purpose |
|---|---|
| Anthropic (Claude API) | AI features |
| Google Workspace | Feedback & customer support |

---

## Terms of Service (`/terms-of-service`)

The Terms of Service page is solid — the eligibility, acceptable use, beta, fees, indemnification, and general provisions sections are all excellent and more comprehensive than what was in the app. Only a few additions:

**Section 1 — "About the Service"**

Add to the feature list:
- *"Organise figures for personal tax returns (Form 11) using built-in templates"*

(The word "templates" is important — it sets the right expectation that these are organisational aids rather than submission-ready returns.)

**Section 3 — "Your Account"**

Consider adding a bullet about the Sláinte Key:
- *"Keeping your Sláinte Key (licence key) confidential — sharing or redistribution of Sláinte Keys is prohibited"*

And if relevant, a mention of mobile LAN access:
- *"Setting appropriate access passwords if you enable mobile access for practice partners"*

**Section 5 — "Finn AI Advisor"**

This section is well-written. One addition worth considering — a line about AI categorisation:
- *"AI-generated transaction categorisations are suggestions and should be reviewed for accuracy. The Service provides tools to correct and refine categorisations over time."*

And a brief note about tax return templates:
- *"Personal tax return templates are intended as organisational aids. Always have your accountant review and verify any tax return before submission."*

**No other changes needed** — the legal sections (disclaimer, liability, indemnification, governing law, general provisions) are all in great shape.

---

## Security by Design (`/security`)

This page has a really compelling narrative and the "your patient data is on-premises, your finances should be too" framing is excellent. A few claims need tightening to match what the app does today — the spirit is right, the specifics just need updating:

**"Data Never Leaves Your Network"**

This is the headline promise, and it's *almost* true — but the Privacy Policy on the same site describes Finn sending data to Anthropic. Worth adding a qualifier: *"Your financial data is stored locally and never uploaded to external servers. When you use AI features, only summarised data is sent securely to Anthropic — see our Privacy Policy for details. You can disable all external connections with Local Only Mode."*

**"Air-Gapped Installation Option"**

The app's equivalent feature is called **"Local Only Mode"** — a toggle in Settings that disables all external connections. It achieves the same privacy outcome (no data leaves the device) but "air-gapped" implies a network-level isolation that's more than what's happening. Suggest replacing with: *"Local Only Mode — disable all external connections with a single toggle in Settings. When enabled, no data leaves your device under any circumstances."*

**"Granular Access Controls" / "Role-based permissions"**

The app currently supports password-protected mobile LAN access for practice partners, rather than role-based permissions. Suggest updating to: *"Secure Partner Access — practice partners can view the financial dashboard from their phone over your local network, protected by a practice-set access password."* (Role-based permissions could be noted as a planned feature if that's on the roadmap.)

**"End-to-End Encryption" / "encrypted at rest and in transit"**

The app encrypts data in transit (TLS for all API calls) and encrypted backups use AES-256, which is great. Day-to-day data storage uses the device's local storage. Suggest: *"Data is encrypted in transit using TLS, and the built-in backup system uses AES-256 encryption. Your day-to-day financial data is protected by your device's own security — the same way your practice management system stores data locally."*

**"Secure Remote Access" / VPN**

The app supports LAN-mode mobile access on the local practice network, not VPN-based remote access. Suggest replacing with: *"Mobile Access on Your Network — partners can securely access the dashboard from any device on your practice's local network."*

**"Automated HSE and private billing reconciliation"**

The app does PCRS/GMS payment analysis and reconciliation. If "private billing reconciliation" isn't a current feature, consider: *"Automated GMS payment reconciliation and analysis"* — or keep the broader claim if it's planned for launch.

**"Regular updates delivered on your schedule, not ours"**

The app uses standard Electron auto-update. Suggest: *"Regular updates delivered seamlessly through the app, with clear release notes so you always know what's changed."*

**Suggested addition — feature comparison table**

The AI-Powered vs Local Only Mode comparison is a really effective way to show the product's flexibility. Consider adding:

|  | AI-Powered Mode | Local Only Mode |
|--|---|---|
| Dashboard & charts | Yes | Yes |
| Transaction categorisation | AI + rules | Rules only |
| Bank statement import | Yes | Yes |
| GMS Health Check | Yes | Yes |
| Tax return templates | Yes | Yes |
| Encrypted backups | Yes | Yes |
| Mobile partner access | Yes | Yes |
| Finn chat & reports | Yes | No |
| PCRS automated downloads | Yes | No |
| External connections | Anthropic API (encrypted) | None |
| Data stored externally | Never | Never |

---

## Summary of Changes by Priority

| Priority | Page | Change |
|----------|------|--------|
| High | Privacy Policy | Disclose automatic practice registration (GDPR requirement) |
| High | Privacy Policy | Add "sent vs never sent" detail to Finn section |
| High | Security | Update "air-gapped" → "Local Only Mode" |
| High | Security | Update "role-based permissions" → current LAN access model |
| Medium | Privacy Policy | "Google Cloud" → "Google Workspace" |
| Medium | Privacy Policy | Add Local Only Mode section |
| Medium | Privacy Policy | Add No Tracking/Telemetry section |
| Medium | Privacy Policy | Clarify chat history retention (local, clearable) |
| Medium | Security | Qualify "data never leaves your network" re: AI features |
| Medium | Security | Update encryption claims to match actual implementation |
| Low | Terms | Add Sláinte Key and mobile access to account section |
| Low | Terms | Add tax return template disclaimer |
| Low | Security | Add feature comparison table |
| Low | Security | Update remote access and auto-update descriptions |
