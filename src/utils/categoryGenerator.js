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
 * Generate comprehensive identifier variations for a name
 * Handles Irish names (O'Sullivan, Mc, Mac), special characters, and common bank format variations
 *
 * @param {string} name - The name to generate identifiers for
 * @returns {Array<string>} Array of unique identifier variations
 */
function generateNameIdentifiers(name) {
    if (!name || name.trim().length === 0) return [];

    const identifiers = new Set();

    // Clean the name - remove Dr. prefix if present
    const cleanedName = name.replace(/^Dr\.?\s*/i, '').trim();
    if (cleanedName.length === 0) return [];

    // Add the original name (without Dr.)
    identifiers.add(cleanedName);

    // Split into parts
    const nameParts = cleanedName.split(/\s+/);

    // Add individual parts if long enough
    for (const part of nameParts) {
        if (part.length >= 3) {
            identifiers.add(part);
        }
    }

    // Handle Irish prefixes (O', Mc, Mac) - very common in Irish bank transactions
    // Bank often formats as "O SULLIVAN" instead of "O'Sullivan"
    const irishPrefixPattern = /^(O['']?|Mc|Mac)(.+)$/i;
    for (const part of nameParts) {
        const match = part.match(irishPrefixPattern);
        if (match) {
            const prefix = match[1].replace(/['']/, '').toUpperCase(); // "O'" → "O"
            const rest = match[2];

            // Add variations: "O SULLIVAN", "OSULLIVAN", "O'SULLIVAN"
            identifiers.add(`${prefix} ${rest}`);  // "O SULLIVAN"
            identifiers.add(`${prefix}${rest}`);   // "OSULLIVAN"
            identifiers.add(rest);                  // "SULLIVAN" (just the surname part)
        }
    }

    // Add letters-only version (handles any special characters)
    const lettersOnly = cleanedName.replace(/[^A-Za-z\s]/g, '').replace(/\s+/g, ' ').trim();
    if (lettersOnly && lettersOnly !== cleanedName && lettersOnly.length >= 3) {
        identifiers.add(lettersOnly);
        // Also add without spaces
        const noSpaces = lettersOnly.replace(/\s/g, '');
        if (noSpaces.length >= 3) {
            identifiers.add(noSpaces);
        }
    }

    // Add full name without any spaces or special chars (common bank format)
    const compacted = cleanedName.replace(/[^A-Za-z]/g, '');
    if (compacted.length >= 3 && compacted !== cleanedName) {
        identifiers.add(compacted);
    }

    return Array.from(identifiers).filter(id => id.length >= 3);
}

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
            // Generate comprehensive identifier variations for partner name
            // Handles Irish names (O'Sullivan → O SULLIVAN, OSULLIVAN, etc.)
            const identifiers = generateNameIdentifiers(partner.name);

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
            // Generate comprehensive identifier variations for salaried GP name
            const identifiers = generateNameIdentifiers(salariedGP.name);

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

                // Generate comprehensive identifier variations for staff member name
                const identifiers = generateNameIdentifiers(member.name);

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
