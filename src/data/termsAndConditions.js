/**
 * Terms of Service for Sláinte Finance
 *
 * This file contains the ToS content displayed during onboarding.
 * Update CURRENT_VERSION when terms change to require re-acceptance.
 */

export const CURRENT_VERSION = '3.0.0';

export const TERMS_SUMMARY = [
  {
    title: 'Your Data Stays on Your Device',
    description: 'All financial data is stored locally on your computer. Nothing is uploaded to external servers for storage.'
  },
  {
    title: 'AI Features Send Data Securely',
    description: 'When you use Finn or AI features, financial summaries, practice details, and your questions are sent to Anthropic\'s Claude API over encrypted connections. Your data is not used to train AI models.'
  },
  {
    title: 'What is Never Sent',
    description: 'Bank account numbers, patient data, and PCRS credentials never leave your device under any circumstances.'
  },
  {
    title: 'Finn is Not a Financial Advisor',
    description: 'AI can make mistakes. Always consult your accountant for major financial decisions. Finn provides insights, not professional financial advice.'
  },
  {
    title: 'You\'re in Control',
    description: 'You can enable "Local Only Mode" in Settings to prevent any data leaving your device. Most features work without AI.'
  },
  {
    title: 'Backup Responsibility',
    description: 'You are responsible for maintaining backups of your data. AES-256 encrypted backups are built in. We recommend regular backups before app updates.'
  },
  {
    title: 'Software Licence',
    description: 'This software is licensed for use by the registered practice. Redistribution or sharing of Sláinte Keys is prohibited.'
  }
];

export const FULL_TERMS = `
SLÁINTE FINANCE — TERMS OF SERVICE

Version ${CURRENT_VERSION}
Effective Date: February 2026

Welcome to Sláinte Finance. These Terms of Service ("Terms") govern your use of the Sláinte Finance software application and website at slainte.app (together, the "Service"). By using the Service, you agree to these Terms.

Please read these Terms carefully. If you do not agree with these Terms, you should not use the Service.

1. ABOUT THE SERVICE

Sláinte Finance is a financial management tool designed for Irish GP practices. The Service helps you:
- Import and categorise bank transactions
- Track income and expenses
- Reconcile GMS and other HSE payments
- Generate financial reports
- Ask financial questions using Finn, our AI advisor

The Service is provided by Sláinte Finance, contactable at slainte.finance@gmail.com.

2. ELIGIBILITY

The Service is intended for use by GP practices and healthcare professionals in Ireland. By registering, you confirm that:
- You are authorised to act on behalf of the GP practice
- You are at least 18 years of age
- The information you provide during registration is accurate and complete

3. YOUR ACCOUNT AND SLÁINTE KEY

You are responsible for:
- Maintaining the confidentiality of your account credentials
- Maintaining the confidentiality of your Sláinte Key (licence key)
- All activities that occur under your account or using your Sláinte Key
- Setting appropriate access passwords if you enable mobile LAN access for practice partners
- Notifying us immediately if you suspect unauthorised access to your account

Your Sláinte Key is licensed for use by the registered practice. Sharing, redistribution, or transfer of Sláinte Keys is prohibited.

4. YOUR DATA

You own your data. Sláinte Finance uses a local-first architecture, which means:
- Your financial data is stored on your own computer, not on our servers
- You retain full ownership and control of your financial data at all times
- We only process the limited data described in our Privacy Policy
- You are responsible for backing up your local data

The application provides built-in backup functionality with AES-256 encryption. We recommend creating regular backups, particularly before application updates.

For full details on how we handle your data, please see our Privacy Policy.

5. FINN AI ADVISOR — IMPORTANT LIMITATIONS

Finn is an AI-powered feature that provides financial insights based on your practice's data. Please understand the following:
- Finn is not a qualified financial advisor. Finn provides information and insights, not regulated financial advice.
- Finn is not a substitute for professional advice. For significant financial decisions, you should consult a qualified accountant or financial advisor.
- Finn may make mistakes. AI technology, while powerful, can produce errors or incomplete analysis. Always verify important information.
- Your queries are processed externally. When you use Finn, your question and relevant financial context is sent to Anthropic's Claude API. See our Privacy Policy for details.
- You are responsible for your decisions. Sláinte Finance is not liable for any decisions you make based on Finn's responses.
- AI categorisations are suggestions. Automated transaction categorisations should be reviewed for accuracy. The Service provides tools to correct and refine categorisations.

Tax Return Templates
The Service includes personal tax return templates (e.g. Form 11 preparation tools) to help organise your financial figures. These templates are intended as organisational aids and are not a substitute for professional tax preparation. Always have your accountant review and verify any tax return before submission.

Local Only Mode
You may disable all AI features and external connections at any time by enabling "Local Only Mode" in Settings. See our Privacy Policy for details.

6. ACCEPTABLE USE

You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to:
- Use the Service for any illegal purpose or in violation of any laws
- Attempt to gain unauthorised access to our systems or other users' accounts
- Reverse engineer, decompile, or attempt to extract the source code of the software
- Use the Service to transmit malware or other harmful code
- Resell, sublicense, or redistribute the Service without our permission
- Share your Sláinte Key with third parties outside your registered practice

7. BETA SERVICE

The Service is currently in beta. This means:
- The Service may contain bugs or errors. We are actively developing and improving the software.
- Features may change. We may add, modify, or remove features during the beta period.
- Your feedback is valuable. We welcome your suggestions and bug reports to help improve the Service. You can submit feedback directly from within the application.
- No uptime guarantees. During beta, we do not guarantee specific uptime or availability.

8. FEES AND PAYMENT

Beta Period: During the beta period, the Service is provided free of charge to participating practices.

Post-Beta Pricing: Following the beta period, the Service will be offered on a subscription basis. We will notify you of pricing at least 30 days before the beta period ends. You will have the option to subscribe or discontinue use of the Service.

Founding Partner Discount: Beta participants who provide feedback and continue as subscribers will receive a 25% lifetime discount on subscription fees, as detailed in any separate Founding Partner Agreement.

9. INTELLECTUAL PROPERTY

The Service, including its design, features, and underlying technology, is owned by Sláinte Finance and protected by intellectual property laws. You are granted a limited, non-exclusive, non-transferable licence to use the Service in accordance with these Terms.

Your data remains yours. We claim no ownership of the financial data you input into the Service.

10. DISCLAIMER OF WARRANTIES

The Service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.

We do not warrant that:
- The Service will meet your specific requirements
- The Service will be uninterrupted, timely, secure, or error-free
- The results obtained from using the Service will be accurate or reliable
- Any errors in the software will be corrected
- AI-generated categorisations, insights, or reports will be free from error

11. LIMITATION OF LIABILITY

To the maximum extent permitted by Irish law:
- Sláinte Finance shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, revenue, data, or business interruption
- Our total liability for any claims arising from your use of the Service shall not exceed the amount you paid us in the 12 months preceding the claim (or €100 if you have not paid anything)
- We are not liable for any loss of data stored locally on your computer
- We are not liable for any financial losses resulting from reliance on AI-generated insights, categorisations, or reports

Nothing in these Terms excludes or limits our liability for death or personal injury caused by our negligence, fraud, or any other liability that cannot be excluded by law.

12. INDEMNIFICATION

You agree to indemnify and hold harmless Sláinte Finance from any claims, damages, or expenses (including reasonable legal fees) arising from your use of the Service or violation of these Terms.

13. TERMINATION

By You: You may stop using the Service at any time. Simply uninstall the application. Your financial data remains on your computer.

By Us: We may suspend or terminate your access to the Service if you breach these Terms, or if we discontinue the Service. We will provide reasonable notice where possible.

Effect of Termination: Upon termination, your licence to use the Service ends. Your locally stored financial data remains yours and is not affected.

14. CHANGES TO THESE TERMS

We may update these Terms from time to time. We will notify you of significant changes by email or through the Service at least 14 days before they take effect. Material changes will require re-acceptance within the application. Your continued use of the Service after changes take effect constitutes acceptance of the new Terms.

15. GOVERNING LAW AND DISPUTES

These Terms are governed by the laws of Ireland. Any disputes arising from these Terms or your use of the Service shall be subject to the exclusive jurisdiction of the courts of Ireland.

16. GENERAL PROVISIONS

- Entire Agreement: These Terms, together with our Privacy Policy, constitute the entire agreement between you and Sláinte Finance.
- Severability: If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in effect.
- No Waiver: Our failure to enforce any right or provision of these Terms does not constitute a waiver of that right.
- Assignment: You may not assign your rights under these Terms without our consent. We may assign our rights to any successor or affiliate.

17. CONTACT US

If you have any questions about these Terms, please contact us:
- Email: slainte.finance@gmail.com
- Website: slainte.app

© 2026 Sláinte Finance. All rights reserved.

---

By clicking "Accept & Continue" within the application, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service and our Privacy Policy.
`;

export default {
  CURRENT_VERSION,
  TERMS_SUMMARY,
  FULL_TERMS
};
