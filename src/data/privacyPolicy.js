/**
 * Privacy Policy for Sláinte Finance
 *
 * This file contains the Privacy Policy content displayed in Settings.
 * Content sourced from docs/PRIVACY-POLICY-UNIFIED-DRAFT.md
 */

export const PRIVACY_POLICY_VERSION = '1.0.0';

export const FULL_PRIVACY_POLICY = `
SLÁINTE FINANCE — PRIVACY POLICY

Version ${PRIVACY_POLICY_VERSION}
Effective Date: February 2026

This Privacy Policy explains how Sláinte Finance ("we", "us", or "our") collects, uses, and protects your information when you use our financial management software for GP practices and our website at slainte.app (together, the "Service").

We are committed to protecting your privacy and handling your data in an open and transparent manner.

1. WHO WE ARE

Sláinte Finance is a financial management platform designed specifically for Irish GP practices. We provide tools to help practices understand their financial performance, categorise transactions, and make informed business decisions.

Contact Details:
- Email: slainte.finance@gmail.com
- Website: slainte.app

2. OUR PRIVACY-FIRST APPROACH

Your practice's financial data stays on your computer.

Unlike cloud-based solutions, Sláinte Finance uses a local-first architecture. This means:
- Your financial data (transactions, income, expenses, GMS payments) is stored locally on your practice's computer
- We do not have access to your financial data
- You maintain full control and ownership of your data at all times
- If you uninstall the software, your data remains on your computer

3. WHAT DATA WE COLLECT

We collect minimal data, limited to what is necessary to provide the Service:

Practice registration: Practice ID (randomly generated identifier), practice name, operating system — automatically when you first complete setup — stored on our systems (Google Workspace).

Feedback submissions: Practice ID, practice name, app version, operating system, current page, transaction and category counts (numbers only), your feedback text, and Finn conversation summary if applicable — when you choose to send feedback — stored on our systems and locally on your device.

Website enquiries: Information you provide via our contact form (name, email, message) — when you contact us via the website — stored on our systems.

Financial data: Transactions, income, expenses, GMS payments, category mappings, practice profile details — during normal use — stored on your device only, never on our systems.

AI queries: Your questions to Finn and relevant financial context (see Section 5 for detail) — when you use Finn or other AI-powered features — processed by Anthropic's Claude API (not stored).

PCRS credentials: Your HSE PCRS portal login details and session cookies — when you use the PCRS download feature — stored on your device only, in encrypted local storage.

Note on practice registration: When you first complete setup, a randomly generated Practice ID (e.g. SLP-A3X9K2) and your practice name are automatically sent to our systems. This is a one-time event that allows us to link your anonymous feedback submissions to your practice for support purposes. No financial data is included.

4. HOW WE USE YOUR DATA

Practice registration and feedback data is used to:
- Identify your practice when you submit feedback or support requests
- Diagnose bugs and improve the application
- Communicate with you about the Service (updates, support, important notices)

Website enquiry data is used to:
- Respond to your questions
- Provide customer support
- Send you information about new features (you can opt out at any time)

We do not sell, rent, or share your data with third parties for marketing purposes.

5. FINN AI FEATURES AND DATA PROCESSING

Finn is an AI-powered financial assistant within Sláinte Finance. When you use Finn or other AI features, certain data is sent to Anthropic's Claude API to generate responses.

What is sent to the AI:

Sent securely to Anthropic:
- Your questions to Finn
- Aggregated financial totals (e.g. "total expenses: €X")
- Category summaries (e.g. "Medical Supplies: €X")
- Practice name and staff/GP names
- GMS payment amounts
- Transaction descriptions (for uncategorised items only, approximately 5% of transactions)
- Monthly trends and patterns
- For detailed reports: complete financial breakdowns
- During onboarding: your practice website content (if you choose website analysis)

Never sent under any circumstances:
- Bank account numbers, sort codes, or IBANs
- Individual patient data
- PCRS portal login credentials
- Your Sláinte Key
- Raw bank statement files
- Passwords or API keys

How Anthropic handles your data:
- Anthropic processes your data solely to generate responses to your queries
- Anthropic does not use data sent via the API to train AI models, in accordance with their API data usage policy
- Data is transmitted using industry-standard TLS encryption — the same level of security used by online banking
- For more information, see Anthropic's privacy policy at anthropic.com/privacy

Local Only Mode:
You may enable "Local Only Mode" at any time from Settings > Privacy & AI. When enabled:
- No data is sent externally from the application — no AI queries, no PCRS downloads, no external connections of any kind
- Finn chat, AI-generated reports, AI categorisation suggestions, website analysis, and automated PCRS downloads are disabled
- All other features continue to work, including rule-based transaction categorisation, financial calculations, GMS Health Check analysis, reporting, and encrypted backups
- You can switch back to AI-powered mode at any time

By using Finn or other AI features, you consent to the data processing described above. You can use Sláinte Finance without AI features by enabling Local Only Mode.

6. NO TRACKING OR TELEMETRY

The Sláinte Finance application contains no analytics, usage tracking, advertising, or telemetry of any kind. We do not monitor how you use the application.

The only external connections the application makes are:
- AI queries to Anthropic (when using Finn or AI features, unless Local Only Mode is enabled)
- Feedback submissions to Google Workspace (when you choose to send feedback)
- The one-time practice registration described in Section 3
- PCRS portal connections (when you use the automated download feature)
- Update checks via standard Electron auto-update

7. THIRD-PARTY DATA PROCESSORS

We use the following third-party services to process limited data:

Anthropic (Claude API): AI-powered features (Finn, categorisation, reports) — processes financial summaries and queries as detailed in Section 5.

Google Workspace: Feedback collection and customer support — processes practice registration data, feedback submissions, and website enquiries as detailed in Section 3.

We do not share your data with any other third parties. We do not use data brokers, advertising networks, or analytics services.

8. LEGAL BASIS FOR PROCESSING (GDPR)

Under the General Data Protection Regulation (GDPR), we process your data based on the following legal grounds:
- Contract: Processing your registration data is necessary to provide you with the Service
- Consent: When you use Finn or AI features, you consent to your query data being processed by Anthropic. When you accept the Terms of Service during setup, you consent to the one-time practice registration
- Legitimate Interest: We may contact you about important service updates, security notices, and improvements

9. DATA RETENTION

- Practice registration data: Retained while you are an active user of the Service, and for up to 12 months after you stop using the Service, for administrative and support purposes
- Feedback submissions: Retained indefinitely to inform product development. You may request deletion at any time
- Financial data: Stored locally on your computer — you control retention and deletion entirely. The application provides backup and data management features
- AI queries: Processed in real-time by Anthropic and not stored by Anthropic or by us. Finn chat history is stored locally on your device and can be cleared at any time from Settings > Privacy & AI
- PCRS credentials: Stored in encrypted local storage on your device. Deleted when you remove them from the application or uninstall
- Local feedback backups: Saved as JSON files in the application's local data directory on your device. You can delete these at any time

10. YOUR RIGHTS UNDER GDPR

You have the following rights regarding your personal data:
- Access: Request a copy of the personal data we hold about you
- Rectification: Request correction of inaccurate data
- Erasure: Request deletion of your data ("right to be forgotten")
- Portability: Request your data in a portable format
- Restriction: Request restriction of processing
- Objection: Object to processing based on legitimate interest
- Withdraw Consent: Withdraw consent at any time where processing is based on consent

To exercise any of these rights, please contact us at slainte.finance@gmail.com. We will respond within 30 days.

You also have the right to lodge a complaint with the Irish Data Protection Commission (dataprotection.ie) if you believe your rights have been violated.

11. COOKIES AND LOCAL STORAGE

Website (slainte.app): Our website may use essential cookies to ensure the site functions correctly. We do not use cookies for tracking or advertising purposes.

Desktop application: The application uses your browser's localStorage to store your financial data, preferences, and settings locally on your device. This data never leaves your device (except as described in Sections 3 and 5). No cookies are used for tracking.

12. DATA SECURITY

We take appropriate technical and organisational measures to protect your data:
- All data transmitted to external services (Anthropic API, Google Workspace) uses TLS encryption
- PCRS portal credentials are stored using encrypted local storage on your device
- The application's backup feature uses AES-256 encryption
- Your financial data remains on your local computer, protected by your own device security measures
- We regularly review and update our security practices
- The application contains no tracking, telemetry, or analytics code

13. CHILDREN'S PRIVACY

The Service is designed for use by GP practices and healthcare professionals. It is not intended for use by individuals under the age of 18.

14. CHANGES TO THIS POLICY

We may update this Privacy Policy from time to time. We will notify you of any significant changes by email or through the Service. The "Effective Date" at the top of this policy indicates when it was last revised. Material changes will require re-acceptance within the application.

15. CONTACT US

If you have any questions about this Privacy Policy or our data practices, please contact us:
- Email: slainte.finance@gmail.com
- Website: slainte.app
`;

export default {
  PRIVACY_POLICY_VERSION,
  FULL_PRIVACY_POLICY
};
