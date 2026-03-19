/**
 * Contact directory for Irish GP practice communications.
 * Used by Finn to populate draft emails/letters with correct contact details.
 */

const CONTACTS = {
  pcrs: {
    name: 'PCRS (Primary Care Reimbursement Service)',
    email: 'PCRS.ReportQueries@hse.ie',
    portal: 'https://secure.sspcrs.ie',
    phone: '(01) 864 7100',
    address: 'PCRS, HSE, Exit 5, M50 Business Park, Ballymount Road Upper, Dublin 12, D12 X0Y6',
    notes: 'For payment queries, panel changes, and staff updates. Reference your GMS panel number in all correspondence.'
  },
  hse: {
    name: 'HSE (Health Service Executive)',
    email: null,
    portal: 'https://www.hse.ie',
    phone: '(01) 635 2500',
    address: 'HSE, Dr Steevens\' Hospital, Steevens\' Lane, Dublin 8, D08 W2A8',
    notes: 'General HSE queries. For PCRS-specific matters, contact PCRS directly.'
  },
  cervicalcheck: {
    name: 'CervicalCheck',
    email: 'info@cervicalcheck.ie',
    portal: 'https://www.cervicalcheck.ie',
    phone: '1800 45 45 55',
    address: null,
    notes: 'For smear test registration, rejection queries, and programme enrolment.'
  },
  revenue: {
    name: 'Revenue Commissioners',
    email: null,
    portal: 'https://www.ros.ie',
    phone: '(01) 738 3660',
    address: 'Office of the Revenue Commissioners, Dublin Castle, Dublin 2',
    notes: 'For tax returns, RCT, PAYE, and withholding tax queries. Use ROS for online submissions.'
  }
};

/**
 * Look up contact info by recipient name.
 * Supports exact key match and fuzzy name matching.
 * @param {string} recipientKey - e.g. "PCRS", "HSE", "revenue"
 * @returns {Object|null} Contact info object or null
 */
export function getContactInfo(recipientKey) {
  if (!recipientKey) return null;
  const key = recipientKey.toLowerCase().replace(/[^a-z]/g, '');

  // Exact key match
  if (CONTACTS[key]) return CONTACTS[key];

  // Fuzzy: check if any key is contained in the input or vice versa
  for (const [k, v] of Object.entries(CONTACTS)) {
    if (key.includes(k) || k.includes(key) || v.name.toLowerCase().includes(recipientKey.toLowerCase())) {
      return v;
    }
  }
  return null;
}

/**
 * Get all available contacts.
 * @returns {Object} All contacts keyed by identifier
 */
export function getAllContacts() {
  return CONTACTS;
}
