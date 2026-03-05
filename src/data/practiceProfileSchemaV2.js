/**
 * Practice Profile Schema V2 - Unified Onboarding
 *
 * This is the new unified schema that consolidates:
 * - Practice onboarding data (staff, categories)
 * - Practice profile data (operational details)
 * - All data collected through the AI-powered onboarding
 */

/**
 * Generate a unique Practice ID for feedback tracking
 * Format: SLP-XXXXXX (prefix + 6 uppercase alphanumeric chars)
 */
export function generatePracticeId() {
    return 'SLP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Create empty unified practice profile
 */
export function createUnifiedProfile() {
    return {
        // Basic practice information
        practiceDetails: {
            practiceName: '',
            locations: [], // Array of address strings
            website: '',
            accountant: '',
            yearEndDate: '', // Format: "MM-DD" e.g., "12-31"
            superannuationAllocation: '', // Free-text description
            ehrSystem: '' // 'socrates' | 'healthone' | 'practicemanager' | 'completegp' | 'other' | ''
        },

        // GP Structure - NEW!
        gps: {
            partners: [
                // {
                //   name: "Dr. Sarah Murphy",
                //   profitShare: 33.33, // Percentage
                //   categoryCode: "90.1" // Generated during category creation
                // }
            ],
            salaried: [
                // {
                //   name: "Dr. Sinead McGuire",
                //   categoryCode: "6.1" // Treated as expense like GP assistants
                // }
            ]
        },

        // Staff members (for individual tracking)
        staff: [
            // {
            //   name: "RobynM",
            //   role: "reception", // reception, nursing, phlebotomy, gp_assistant, management, other
            //   roleCode: "3", // Maps to category code prefix
            //   categoryCode: "3.1" // Generated during category creation
            // }
        ],

        // Optional services
        services: {
            dspPayments: true,
            methadoneServices: false,
            medservFees: true,
            icgpMembership: true,
            medicalCouncil: true
        },

        // Category visibility preferences
        categoryPreferences: {
            mode: 'all', // 'all', 'common', or 'custom'
            hiddenCategories: [] // Array of category codes if mode is 'custom'
        },

        // Metadata
        metadata: {
            setupComplete: false,
            createdAt: new Date(),
            lastUpdated: new Date(),
            setupCompletedAt: null,
            practiceId: generatePracticeId(),
            practiceIdRegistered: false,
            onboardingVersion: '2.0',
            websiteAnalyzed: false,
            websiteAnalyzedAt: null,
            // Terms of Service acceptance tracking
            termsAccepted: null, // { version: '1.0.0', acceptedAt: ISO date, scrolledToEnd: boolean }
            // Local Only Mode - when true, no external connections are made
            localOnlyMode: false,
            localOnlyModeSetAt: null
        }
    };
}

/**
 * Validation functions for new fields
 */
export const validators = {
    practiceName: (value) => {
        if (!value || value.trim().length === 0) {
            return 'Practice name is required';
        }
        if (value.length > 100) {
            return 'Practice name must be less than 100 characters';
        }
        return null;
    },

    location: (value) => {
        if (!value || value.trim().length === 0) {
            return 'At least one location is required';
        }
        return null;
    },

    profitShare: (value) => {
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > 100) {
            return 'Profit share must be between 0 and 100%';
        }
        return null;
    },

    yearEndDate: (value) => {
        // Validate MM-DD format
        const pattern = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
        if (!pattern.test(value)) {
            return 'Year-end date must be in MM-DD format (e.g., 12-31)';
        }
        return null;
    }
};

/**
 * Validate profit shares add up to ~100%
 */
export function validateProfitShares(partners) {
    if (!partners || partners.length === 0) return { valid: true };

    const total = partners.reduce((sum, p) => sum + (p.profitShare || 0), 0);
    const difference = Math.abs(100 - total);

    if (difference > 0.5) { // Allow 0.5% rounding error
        return {
            valid: false,
            error: `Profit shares must add up to 100% (currently ${total.toFixed(2)}%)`
        };
    }

    return { valid: true };
}

/**
 * Calculate total number of GPs
 */
export function getTotalGPs(profile) {
    if (!profile || !profile.gps) return 0;
    const partners = profile.gps.partners?.length || 0;
    const salaried = profile.gps.salaried?.length || 0;
    return partners + salaried;
}

/**
 * Get all GP names (partners + salaried)
 */
export function getAllGPNames(profile) {
    if (!profile || !profile.gps) return [];
    const partnerNames = profile.gps.partners?.map(p => p.name) || [];
    const salariedNames = profile.gps.salaried?.map(s => s.name) || [];
    return [...partnerNames, ...salariedNames];
}

/**
 * Get staff count by role
 */
export function getStaffCountByRole(profile) {
    if (!profile || !profile.staff) return {};

    const counts = {};
    profile.staff.forEach(member => {
        counts[member.role] = (counts[member.role] || 0) + 1;
    });

    return counts;
}

/**
 * Check if required setup fields are complete
 */
export function isSetupComplete(profile) {
    if (!profile) return false;

    const required = [
        profile.practiceDetails?.practiceName,
        profile.practiceDetails?.locations?.length > 0,
        profile.gps?.partners?.length > 0,
        profile.metadata?.setupComplete === true
    ];

    return required.every(field => {
        if (typeof field === 'boolean') return field === true;
        if (typeof field === 'number') return field > 0;
        if (typeof field === 'string') return field.trim().length > 0;
        return field;
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
    if (!profile.practiceDetails?.locations?.length) {
        missing.push('At least one location');
    }
    if (!profile.gps?.partners?.length) {
        missing.push('At least one GP partner');
    }
    if (!profile.metadata?.setupComplete) {
        missing.push('Setup completion');
    }

    return missing;
}

/**
 * Get profile summary for display
 */
export function getProfileSummary(profile) {
    if (!profile) return 'No profile data';

    const parts = [];

    if (profile.practiceDetails?.practiceName) {
        parts.push(profile.practiceDetails.practiceName);
    }

    const totalGPs = getTotalGPs(profile);
    if (totalGPs > 0) {
        const partners = profile.gps?.partners?.length || 0;
        const salaried = profile.gps?.salaried?.length || 0;
        parts.push(`${partners} partner${partners !== 1 ? 's' : ''}, ${salaried} salaried GP${salaried !== 1 ? 's' : ''}`);
    }

    const staffCounts = getStaffCountByRole(profile);
    const staffSummary = Object.entries(staffCounts)
        .map(([role, count]) => `${count} ${role}`)
        .join(', ');
    if (staffSummary) {
        parts.push(staffSummary);
    }

    if (profile.practiceDetails?.locations?.length > 0) {
        parts.push(profile.practiceDetails.locations[0]);
    }

    return parts.join(' • ') || 'Profile incomplete';
}

/**
 * Get completeness percentage
 */
export function getProfileCompleteness(profile) {
    if (!profile) return 0;

    let totalFields = 0;
    let filledFields = 0;

    // Required fields (weight more)
    const requiredFields = [
        profile.practiceDetails?.practiceName,
        profile.practiceDetails?.locations?.length > 0,
        profile.gps?.partners?.length > 0
    ];
    totalFields += requiredFields.length * 3; // Weight x3
    filledFields += requiredFields.filter(f => {
        if (typeof f === 'boolean') return f === true;
        if (typeof f === 'number') return f > 0;
        if (typeof f === 'string') return f.trim().length > 0;
        return f;
    }).length * 3;

    // Optional but important fields
    const optionalFields = [
        profile.practiceDetails?.website,
        profile.practiceDetails?.accountant,
        profile.practiceDetails?.yearEndDate,
        profile.practiceDetails?.superannuationAllocation,
        profile.gps?.salaried?.length > 0,
        profile.staff?.length > 0
    ];
    totalFields += optionalFields.length;
    filledFields += optionalFields.filter(f => {
        if (typeof f === 'boolean') return f === true;
        if (typeof f === 'number') return f > 0;
        if (typeof f === 'string') return f.trim().length > 0;
        return f;
    }).length;

    return Math.round((filledFields / totalFields) * 100);
}
