/**
 * Category Generator for Unified Practice Profile
 *
 * Generates personalized transaction categories based on the unified practice profile:
 * - Partner drawing categories (90.x)
 * - Salaried GP categories (6.x)
 * - Individual staff categories by role
 * - Filters optional service categories
 */

import { CATEGORY_MAPPING as DEFAULT_CATEGORY_MAPPING } from '../data/categoryMappings';

/**
 * Generate complete category mapping from unified profile
 *
 * @param {Object} profile - Unified practice profile
 * @returns {Array} Complete category mapping
 */
export function generateCategoriesFromProfile(profile) {
    // Start with default categories
    let categories = [...DEFAULT_CATEGORY_MAPPING];

    // Remove default personalized categories (we'll create custom ones)
    categories = categories.filter(c =>
        c.personalization !== "Personalize" &&
        !c.code.startsWith('90.') // Remove default partner categories
    );

    const accountantLine = "Receptionists Salaries and Social Welfare";

    // 1. Generate PARTNER DRAWING categories (90.x)
    if (profile.gps?.partners?.length > 0) {
        profile.gps.partners.forEach((partner, index) => {
            // Remove "Dr." prefix from name for identifiers
            const nameWithoutTitle = partner.name.replace(/^Dr\.?\s*/i, '').trim();
            const identifiers = [];

            // Add name variations for matching (without Dr. prefix)
            const nameParts = nameWithoutTitle.split(/\s+/);
            if (nameParts.length > 1) {
                // Add last name first (most likely to appear in transactions)
                if (nameParts[nameParts.length - 1].length >= 3) {
                    identifiers.push(nameParts[nameParts.length - 1]);
                }
                // Add full name without title
                identifiers.push(nameWithoutTitle);
                // Add first name if reasonable length
                if (nameParts[0].length >= 3) {
                    identifiers.push(nameParts[0]);
                }
            } else {
                // Single name part - just use it
                identifiers.push(nameWithoutTitle);
            }

            const categoryCode = `90.${index + 1}`;

            categories.push({
                code: categoryCode,
                name: `Partner Drawings - ${partner.name}`,
                description: `Individual partner drawings - ${partner.profitShare}% profit share`,
                identifiers: identifiers,
                accountantLine: "NOT ON P&L - Equity Withdrawal",
                type: "non-business",
                personalization: "Personalized",
                role: "90",
                staffMember: partner.name,
                profitShare: partner.profitShare,
                section: "NON-BUSINESS"
            });

            // Update the partner's category code in place (for reference)
            partner.categoryCode = categoryCode;
        });
    }

    // 2. Generate SALARIED GP categories (6.x series, like GP assistants)
    if (profile.gps?.salaried?.length > 0) {
        // Find the next available 6.x code (after GP assistants from staff)
        const existing6xCodes = categories
            .filter(c => c.code.startsWith('6.'))
            .map(c => {
                const parts = c.code.split('.');
                return parts.length > 1 ? parseInt(parts[1]) : 0;
            });

        let nextIndex = existing6xCodes.length > 0 ? Math.max(...existing6xCodes) + 1 : 1;

        profile.gps.salaried.forEach((salariedGP, index) => {
            const identifiers = [salariedGP.name];

            // Add name variations
            const nameParts = salariedGP.name.replace(/^Dr\.?\s*/i, '').split(/\s+/);
            if (nameParts.length > 1) {
                if (nameParts[nameParts.length - 1].length >= 3) {
                    identifiers.push(nameParts[nameParts.length - 1]);
                }
                if (nameParts[0].length >= 3) {
                    identifiers.push(nameParts[0]);
                }
            }

            const categoryCode = `6.${nextIndex + index}`;

            categories.push({
                code: categoryCode,
                name: `Salaried GP - ${salariedGP.name}`,
                description: `Individual salaried GP salary`,
                identifiers: identifiers,
                accountantLine: accountantLine,
                type: "expense",
                personalization: "Personalized",
                role: "6",
                staffMember: salariedGP.name,
                section: "DIRECT STAFF COSTS"
            });

            // Update the salaried GP's category code
            salariedGP.categoryCode = categoryCode;
        });
    }

    // 3. Generate STAFF categories by role
    if (profile.staff?.length > 0) {
        // Group staff by role code
        const staffByRole = {};
        profile.staff.forEach(member => {
            if (!staffByRole[member.roleCode]) {
                staffByRole[member.roleCode] = [];
            }
            staffByRole[member.roleCode].push(member);
        });

        // Generate categories for each role
        Object.entries(staffByRole).forEach(([roleCode, members]) => {
            members.forEach((member, index) => {
                const categoryCode = `${roleCode}.${index + 1}`;

                // Generate identifiers
                const identifiers = [member.name];
                const nameParts = member.name.split(/\s+/);
                if (nameParts.length > 1) {
                    if (nameParts[0].length >= 3) {
                        identifiers.push(nameParts[0]);
                    }
                    if (nameParts[nameParts.length - 1].length >= 3) {
                        identifiers.push(nameParts[nameParts.length - 1]);
                    }
                }

                // Clean name (remove special characters)
                const cleanName = member.name.replace(/[^A-Za-z]/g, '');
                if (cleanName && cleanName !== member.name && cleanName.length >= 3) {
                    identifiers.push(cleanName);
                }

                // Get role name for display
                const roleName = getRoleDisplayName(member.role);

                categories.push({
                    code: categoryCode,
                    name: `${roleName} - ${member.name}`,
                    description: `Individual ${roleName.toLowerCase()} salary`,
                    identifiers: identifiers,
                    accountantLine: accountantLine,
                    type: "expense",
                    personalization: "Personalized",
                    role: roleCode,
                    staffMember: member.name,
                    section: "DIRECT STAFF COSTS"
                });

                // Update member's category code
                member.categoryCode = categoryCode;
            });
        });
    }

    // 4. Filter OPTIONAL SERVICE categories based on profile
    const services = profile.services || {};

    if (!services.dspPayments) {
        categories = categories.filter(c => c.code !== '1.4');
    }
    if (!services.methadoneServices) {
        categories = categories.filter(c => !c.name.toLowerCase().includes('methadone'));
    }
    if (!services.medservFees) {
        categories = categories.filter(c => c.code !== '40.3');
    }
    if (!services.icgpMembership) {
        categories = categories.filter(c => c.code !== '72.1');
    }
    if (!services.medicalCouncil) {
        categories = categories.filter(c => c.code !== '72.2');
    }

    // 5. Sort by code
    categories.sort((a, b) => {
        const aCode = parseFloat(a.code);
        const bCode = parseFloat(b.code);
        return aCode - bCode;
    });

    return categories;
}

/**
 * Get display name for role code
 */
function getRoleDisplayName(role) {
    const roleMap = {
        'reception': 'Reception',
        'nursing': 'Nurse',
        'phlebotomy': 'Phlebotomist',
        'gp_assistant': 'GP Assistant',
        'management': 'Practice Manager',
        'other': 'Staff Member'
    };

    return roleMap[role] || 'Staff Member';
}

/**
 * Get role code for role name
 */
export function getRoleCode(role) {
    const codeMap = {
        'reception': '3',
        'nursing': '4',
        'phlebotomy': '5',
        'gp_assistant': '6',
        'management': '7',
        'other': '7'
    };

    return codeMap[role] || '7';
}

/**
 * Parse staff input (handles comma or newline separated)
 */
export function parseStaffInput(input) {
    if (!input || !input.trim()) return [];

    return input
        .split(/[,\n]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

/**
 * Convert staff list to staff objects
 */
export function createStaffMembers(names, role) {
    const roleCode = getRoleCode(role);

    return names.map(name => ({
        name: name,
        role: role,
        roleCode: roleCode,
        categoryCode: null // Will be assigned during generation
    }));
}

/**
 * Get category statistics from generated categories
 */
export function getCategoryStats(categories) {
    const stats = {
        total: categories.length,
        personalized: 0,
        partners: 0,
        salariedGPs: 0,
        staff: 0,
        bySection: {}
    };

    categories.forEach(cat => {
        if (cat.personalization === 'Personalized') {
            stats.personalized++;

            if (cat.role === '90') {
                stats.partners++;
            } else if (cat.role === '6' && cat.name.includes('Salaried GP')) {
                stats.salariedGPs++;
            } else {
                stats.staff++;
            }
        }

        // Count by section
        if (cat.section) {
            stats.bySection[cat.section] = (stats.bySection[cat.section] || 0) + 1;
        }
    });

    return stats;
}
