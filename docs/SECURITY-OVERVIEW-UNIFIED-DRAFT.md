# How Your Data is Protected

Sláinte Finance is a desktop application — your financial data lives on your computer, not in the cloud. You choose how much intelligence the app brings to your practice.

---

## Two Modes, One Promise: Your Data Stays Yours

### AI-Powered Mode *(Default)*

Get the full Sláinte experience with Finn, your dedicated financial assistant, working alongside you.

**What you get:**
- **Finn Financial Assistant** — Ask questions about your finances in plain English. Get instant insights, trend analysis, and detailed reports tailored to your practice.
- **Smart Categorisation** — Finn learns how your practice operates and automatically categorises transactions with over 95% accuracy, improving over time with your corrections.
- **Guided Setup** — Finn analyses your bank statements and suggests how to organise your expenses, saving hours of manual work during onboarding.
- **Practice Website Analysis** — Optionally let Finn read your practice website to auto-populate your profile (name, location, services offered).
- **PCRS Automated Downloads** — Connect directly to the HSE PCRS portal to download your GMS payment statements automatically. Your credentials are stored in encrypted local storage on your device.

**How your data is protected:**
- **Everything stays on your computer.** All financial data is stored locally on your device. Nothing is uploaded to external servers for storage.
- **AI queries use encrypted connections.** When you ask Finn a question, a summary of relevant financial data is sent securely to Anthropic's Claude API (the AI behind Finn) using industry-standard TLS encryption. This is the same level of security used by online banking.
- **Your data is never used to train AI.** Anthropic's API terms explicitly state that data sent via the API is not used for model training. Your financial information is processed to generate a response and is not retained by Anthropic.
- **Sensitive details are never sent.** Bank account numbers, sort codes, IBANs, patient information, PCRS login credentials, and your Sláinte Key never leave your device — under any circumstances.
- **No third-party access.** Your data is never sold, shared, or made available to advertisers, data brokers, or any other third party. Anthropic is our sole data sub-processor, used exclusively for AI features.
- **No tracking or telemetry.** Sláinte Finance contains no analytics, usage tracking, advertising, or telemetry of any kind.
- **You stay in control.** You can switch to Local Only Mode at any time from Settings, and you can clear your Finn chat history with one click.

**What is sent to the AI (and what isn't):**

| Sent securely to AI | Never sent |
|---------------------|------------|
| Your questions to Finn | Bank account numbers, sort codes, or IBANs |
| Aggregated totals (e.g. "total expenses: €X") | Individual patient data |
| Category summaries (e.g. "Medical Supplies: €X") | PCRS login credentials |
| Practice name and staff/GP names | Your Sláinte Key |
| GMS payment amounts | Raw bank statement files |
| Transaction descriptions (for uncategorised items only) | Passwords or API keys |
| Monthly trends and patterns | |
| For detailed reports: complete financial breakdowns | |

---

### Local Only Mode

For practices that prefer no external connections whatsoever, Local Only Mode ensures that nothing leaves your computer — full stop.

**What you get:**
- **Rule-Based Categorisation** — The same identifier-matching engine that handles 95% of transactions in AI-Powered Mode. Remaining items are matched using built-in similarity detection.
- **Full Financial Dashboard** — All charts, calculations, profit/loss analysis, and GMS Health Check insights work identically.
- **Bank Statement Import** — Upload CSV files or bank statement PDFs exactly as in AI-Powered Mode.
- **Complete Reporting** — View, filter, and export all your financial data. Personal tax return templates work as normal.
- **Encrypted Backups** — Create and restore AES-256 encrypted backups of all practice data.
- **Category Management** — Full control over your expense categories and identifier keywords.
- **Mobile Partner Access** — Partners can still view the dashboard from their phone over your practice's local network.

**What is not available:**
- Finn chat and AI-generated reports
- AI-assisted categorisation suggestions (falls back to automatic similarity matching)
- Practice website analysis during setup
- PCRS automated statement downloads (you can still download manually from pcrs.ie and import the PDFs)

**The tradeoff:** Local Only Mode offers complete data isolation at the cost of convenience. Setup takes longer (manual categorisation instead of AI suggestions), and you won't have Finn's conversational insights. All core financial management features remain fully functional.

---

## Switching Between Modes

You can switch between AI-Powered and Local Only Mode at any time from **Settings > Privacy & AI**. The change takes effect immediately:

- **Switching to Local Only** — All external connections stop. Finn's chat shows a clear "Local Only Mode" indicator. Your existing data and categorisations are preserved.
- **Switching to AI-Powered** — Finn becomes available again immediately. No data is lost.

---

## What We Collect About You

While your financial data stays on your device, we do collect a small amount of data to provide support and improve the product:

- **On first setup:** A randomly generated Practice ID and your practice name are sent to our systems (Google Workspace). This is a one-time event that helps us identify your practice if you contact us for support.
- **When you send feedback:** Your Practice ID, practice name, app version, operating system, current page, and transaction/category counts (numbers only) are included alongside your feedback text. You can expand "This information will also be included" in the feedback form to see exactly what will be sent before submitting.
- **No other data is collected.** We do not track how you use the application, which features you access, or how often you open it.

For full details, see our [Privacy Policy](https://slainte.app/privacy-policy).

---

## Feature Comparison

|  | AI-Powered Mode | Local Only Mode |
|--|----------------|-----------------|
| Financial dashboard & charts | Yes | Yes |
| Transaction categorisation | Yes (AI + rules) | Yes (rules only) |
| Bank statement import (CSV & PDF) | Yes | Yes |
| GMS Health Check analysis | Yes | Yes |
| Personal tax return templates | Yes | Yes |
| Encrypted backups | Yes | Yes |
| Mobile partner access (LAN) | Yes | Yes |
| Finn chat & AI reports | Yes | No |
| AI categorisation suggestions | Yes | No |
| Website analysis during setup | Yes | No |
| PCRS automated downloads | Yes | No |
| External connections | Anthropic API (encrypted) | None |
| Data stored on our servers | Never | Never |

---

## Built for Irish General Practice

Sláinte Finance isn't a generic accounting package adapted for healthcare. It's purpose-built for Irish GP practices, understanding the realities of mixed GMS and private billing, HSE payment reconciliation, and the financial rhythms of primary care.

Your patient data systems are on-premises because patient trust demands it. Your financial management should meet the same standard.

*Sláinte Finance is built by GPs, for GPs. We understand the sensitivity of practice financial data and have designed every feature with privacy as a first principle — not an afterthought.*

---

[Sign Up for Limited Beta](https://slainte.app/start-trial) | [Privacy Policy](https://slainte.app/privacy-policy) | [Terms of Service](https://slainte.app/terms-of-service)
