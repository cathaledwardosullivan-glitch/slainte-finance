// Payment categories from PCRS statements - based on your Excel structure
export const PCRS_PAYMENT_CATEGORIES = [
    "Special Type/OOH/SS/H1N1",
    "Doctor Vaccinations",
    "Doctor Outbreak Vaccinations",
    "Covid-19 Vaccine Admin Fee",
    "Incentivised payments under Covid Vaccine",
    "Incentivised payments under QIV vaccine",
    "Incentivised payments under LAIV vaccine",
    "Capitation Payment/Supplementary Allowance",
    "Locum Expenses For Leave",
    "Practice Support Subsidy",
    "Enhanced Capitation for Asthma",
    "Enhanced Capitation for Diabetes",
    "National Cervical Screening Programme",
    "Maternity and Infant Care Scheme",
    "Winter Plan Support Grant",
    "Asylum Seeker/ Non EU Registration fee",
    "Asthma registration fee",
    "Diabetes registration fee",
    "Ukrainian Patient Registration"
];

export const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

// Default partners structure - matches your Excel setup
export const DEFAULT_PARTNERS = {
    'KAPAY': {
        name: 'Karen Aylward',
        doctorNumber: '60265',
        initials: 'KA'
    },
    'RSPAY': {
        name: 'Partner 2',
        doctorNumber: '',
        initials: 'RS'
    },
    'COSPAY': {
        name: 'Partner 3',
        doctorNumber: '',
        initials: 'COS'
    },
    'SMPAY': {
        name: 'Partner 4',
        doctorNumber: '',
        initials: 'SM'
    }
};

// Deduction categories
export const DEDUCTION_CATEGORIES = [
    "Less Superannuation",
    "Less CDM/PP Superannuation",
    "Less withholding Tax"
];