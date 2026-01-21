/**
 * Practice Profile Schema and Validation
 *
 * This module defines the structure and validation rules for practice profiles.
 * It also provides helper functions for calculating derived values.
 */

/**
 * Validation functions
 */
export const validators = {
    /**
     * Validate practice name
     */
    practiceName: (value) => {
        if (!value || value.trim().length === 0) {
            return 'Practice name is required';
        }
        if (value.length > 100) {
            return 'Practice name must be less than 100 characters';
        }
        return null;
    },

    /**
     * Validate location
     */
    location: (value) => {
        if (!value || value.trim().length === 0) {
            return 'Location is required';
        }
        if (value.length > 100) {
            return 'Location must be less than 100 characters';
        }
        return null;
    },

    /**
     * Validate number of GPs
     */
    numberOfGPs: (value) => {
        const num = Number(value);
        if (isNaN(num) || num < 1 || num > 100) {
            return 'Number of GPs must be between 1 and 100';
        }
        return null;
    },

    /**
     * Validate practice type
     */
    practiceType: (value) => {
        const validTypes = ['urban', 'rural', 'semi-rural', 'mixed'];
        if (!validTypes.includes(value)) {
            return 'Practice type must be urban, rural, semi-rural, or mixed';
        }
        return null;
    },

    /**
     * Validate panel size
     */
    panelSize: (value) => {
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > 50000) {
            return 'Panel size must be between 0 and 50,000';
        }
        return null;
    },

    /**
     * Validate capitation rate
     */
    averageCapitationRate: (value) => {
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > 1000) {
            return 'Capitation rate must be between €0 and €1,000';
        }
        return null;
    },

    /**
     * Validate percentage
     */
    percentage: (value) => {
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > 100) {
            return 'Percentage must be between 0 and 100';
        }
        return null;
    },

    /**
     * Validate currency amount
     */
    currencyAmount: (value) => {
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > 10000000) {
            return 'Amount must be between €0 and €10,000,000';
        }
        return null;
    },

    /**
     * Validate number of patients
     */
    numberOfPatients: (value) => {
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > 50000) {
            return 'Number of patients must be between 0 and 50,000';
        }
        return null;
    },

    /**
     * Validate consultation fee
     */
    consultationFee: (value) => {
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > 500) {
            return 'Consultation fee must be between €0 and €500';
        }
        return null;
    },

    /**
     * Validate visits per year
     */
    visitsPerYear: (value) => {
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > 100) {
            return 'Visits per year must be between 0 and 100';
        }
        return null;
    }
};

/**
 * Calculate total annual expenses from expense breakdown
 */
export function calculateTotalExpenses(expenses) {
    if (!expenses) return 0;

    const {
        staffCosts = 0,
        rentAndUtilities = 0,
        medicalSupplies = 0,
        insurance = 0,
        otherExpenses = 0
    } = expenses;

    return staffCosts + rentAndUtilities + medicalSupplies + insurance + otherExpenses;
}

/**
 * Calculate estimated GMS income
 */
export function calculateEstimatedGMSIncome(gmsContract) {
    if (!gmsContract) return null;
    const { panelSize, averageCapitationRate } = gmsContract;
    if (!panelSize || !averageCapitationRate) return null;
    return panelSize * averageCapitationRate;
}

/**
 * Calculate estimated private income
 */
export function calculateEstimatedPrivateIncome(privatePatients) {
    if (!privatePatients) return null;
    const { numberOfPatients, averageConsultationFee, averageVisitsPerYear } = privatePatients;
    if (!numberOfPatients || !averageConsultationFee || !averageVisitsPerYear) return null;
    return numberOfPatients * averageConsultationFee * averageVisitsPerYear;
}

/**
 * Calculate estimated total income
 */
export function calculateEstimatedTotalIncome(gmsContract, privatePatients) {
    const gmsIncome = calculateEstimatedGMSIncome(gmsContract) || 0;
    const privateIncome = calculateEstimatedPrivateIncome(privatePatients) || 0;
    return gmsIncome + privateIncome;
}

/**
 * Calculate estimated profit/net income
 */
export function calculateEstimatedProfit(gmsContract, privatePatients, expenses) {
    const totalIncome = calculateEstimatedTotalIncome(gmsContract, privatePatients);
    const totalExpenses = expenses.totalAnnualExpenses || calculateTotalExpenses(expenses);
    return totalIncome - totalExpenses;
}

/**
 * Get completeness percentage of profile
 * @param {Object} profile - Practice profile object
 * @returns {number} Percentage complete (0-100)
 */
export function getProfileCompleteness(profile) {
    if (!profile) return 0;

    const fields = [
        // Practice details (4 fields)
        profile.practiceDetails?.practiceName,
        profile.practiceDetails?.location,
        profile.practiceDetails?.numberOfGPs,
        profile.practiceDetails?.practiceType,

        // GMS contract (3 fields)
        profile.gmsContract?.panelSize,
        profile.gmsContract?.averageCapitationRate,
        profile.gmsContract?.gmsIncomePercentage,

        // Private patients (4 fields)
        profile.privatePatients?.numberOfPatients,
        profile.privatePatients?.averageConsultationFee,
        profile.privatePatients?.averageVisitsPerYear,
        profile.privatePatients?.privateIncomePercentage,

        // Expenses (6 fields)
        profile.expenses?.staffCosts,
        profile.expenses?.rentAndUtilities,
        profile.expenses?.medicalSupplies,
        profile.expenses?.insurance,
        profile.expenses?.otherExpenses,
        profile.expenses?.totalAnnualExpenses,
    ];

    const filledFields = fields.filter(field => {
        if (typeof field === 'number') return field >= 0;
        if (typeof field === 'string') return field.trim().length > 0;
        return false;
    }).length;

    return Math.round((filledFields / fields.length) * 100);
}

/**
 * Get human-readable summary of profile
 */
export function getProfileSummary(profile) {
    if (!profile) return 'No profile data';

    const { practiceDetails, gmsContract, privatePatients, expenses } = profile;

    const parts = [];

    // Practice basics
    if (practiceDetails?.practiceName) {
        parts.push(practiceDetails.practiceName);
    }
    if (practiceDetails?.numberOfGPs) {
        parts.push(`${practiceDetails.numberOfGPs} GP${practiceDetails.numberOfGPs > 1 ? 's' : ''}`);
    }

    // Patient counts
    const patientCounts = [];
    if (gmsContract?.panelSize) {
        patientCounts.push(`${gmsContract.panelSize.toLocaleString()} GMS patients`);
    }
    if (privatePatients?.numberOfPatients) {
        patientCounts.push(`${privatePatients.numberOfPatients.toLocaleString()} private patients`);
    }
    if (patientCounts.length > 0) {
        parts.push(patientCounts.join(', '));
    }

    // Financial summary
    const totalIncome = calculateEstimatedTotalIncome(gmsContract, privatePatients);
    const totalExpenses = expenses?.totalAnnualExpenses || calculateTotalExpenses(expenses);
    if (totalIncome) {
        parts.push(`~€${totalIncome.toLocaleString()}/year income`);
    }
    if (totalExpenses) {
        parts.push(`~€${totalExpenses.toLocaleString()}/year expenses`);
    }

    return parts.join(' • ') || 'Profile incomplete';
}

/**
 * Check if required setup fields are complete
 */
export function isSetupComplete(profile) {
    if (!profile) return false;

    const required = [
        profile.practiceDetails?.practiceName,
        profile.practiceDetails?.numberOfGPs,
        profile.metadata?.setupComplete === true
    ];

    return required.every(field => {
        if (typeof field === 'boolean') return field === true;
        if (typeof field === 'number') return field > 0;
        if (typeof field === 'string') return field.trim().length > 0;
        return false;
    });
}

/**
 * Get missing required fields
 */
export function getMissingRequiredFields(profile) {
    if (!profile) return ['Complete profile'];

    const missing = [];

    if (!profile.practiceDetails?.practiceName) {
        missing.push('Practice name');
    }
    if (!profile.practiceDetails?.numberOfGPs) {
        missing.push('Number of GPs');
    }
    if (!profile.metadata?.setupComplete) {
        missing.push('Setup completion');
    }

    return missing;
}
