/**
 * Finn Context Builder
 *
 * This module builds the system prompt context for Finn based on the
 * practice profile. This context eliminates repetitive corrections and
 * provides Finn with persistent knowledge about the practice.
 */

import {
    calculateEstimatedGMSIncome,
    calculateEstimatedPrivateIncome,
    calculateEstimatedTotalIncome,
    calculateTotalExpenses
} from '../data/practiceProfileSchema';

/**
 * Build the complete system prompt context for Finn
 * @param {Object} profile - The practice profile object
 * @returns {string} The formatted context string for Finn's system prompt
 */
export function buildCiaranContext(profile) {
    if (!profile || !profile.metadata?.setupComplete) {
        return buildDefaultContext();
    }

    const sections = [
        buildPracticeDetailsSection(profile.practiceDetails),
        buildTeamSection(profile.gps, profile.staff),
        buildGMSContractSection(profile.gmsContract),
        buildPrivatePatientsSection(profile.privatePatients),
        buildExpensesSection(profile.expenses),
        buildCategoriesSection(profile.categories),
        buildHealthCheckSection(profile.healthCheckData),
        buildFinancialSummarySection(profile)
    ];

    const context = sections.filter(s => s).join('\n\n');

    return `${buildContextHeader()}\n\n${context}\n\n${buildContextFooter()}`;
}

/**
 * Build context header
 */
function buildContextHeader() {
    return `You are Finn, the AI assistant for this Irish GP practice. Below is the practice profile that has been shared with you. Use this information to provide accurate, context-aware financial advice without requiring the user to repeat this information.`;
}

/**
 * Build context footer with behavioral instructions
 */
function buildContextFooter() {
    return `IMPORTANT BEHAVIORAL RULES:
1. Use this context to understand the practice's structure and financial situation
2. Never ask the user to repeat information that's in this profile
3. When analyzing transactions, apply the custom categories and rules defined above
4. If the user's question conflicts with the profile data, politely ask if they'd like to update their profile
5. Provide advice specific to Irish GP practices (GMS contracts, HSE payments, etc.)
6. Be proactive in identifying financial patterns that may benefit or concern this specific practice`;
}

/**
 * Build default context when no profile exists
 */
function buildDefaultContext() {
    return `You are Finn, the AI assistant for an Irish GP practice. The practice owner has not yet completed their profile setup. Encourage them to complete the setup to receive personalized financial insights.

You can help them set up by asking about:
- Practice name and location
- Number of GPs
- GMS panel size and capitation rates
- Private patient volumes and fees
- Major expense categories
- Custom transaction categories they'd like to track

Once setup is complete, you'll be able to provide much more accurate and personalized financial advice.`;
}

/**
 * Build practice details section
 */
function buildPracticeDetailsSection(details) {
    if (!details) return null;

    const parts = [];
    parts.push('## PRACTICE DETAILS');

    if (details.practiceName) {
        parts.push(`Practice Name: ${details.practiceName}`);
    }
    if (details.location) {
        parts.push(`Location: ${details.location}`);
    }
    if (details.numberOfGPs) {
        parts.push(`Number of GPs: ${details.numberOfGPs}`);
    }
    if (details.practiceType) {
        parts.push(`Practice Type: ${details.practiceType}`);
    }

    return parts.length > 1 ? parts.join('\n') : null;
}

/**
 * Build team section from Cara onboarding data
 * @param {Object} gps - GPs object with partners and salaried arrays
 * @param {Array} staff - Staff array from Cara onboarding
 */
function buildTeamSection(gps, staff) {
    const parts = [];
    parts.push('## PRACTICE TEAM');

    // GP Partners
    if (gps?.partners && gps.partners.length > 0) {
        parts.push('\nGP Partners:');
        gps.partners.forEach((partner, idx) => {
            let partnerInfo = `- ${partner.name || `Partner ${idx + 1}`}`;
            if (partner.profitShare) {
                partnerInfo += ` (${partner.profitShare}% profit share)`;
            }
            parts.push(partnerInfo);
        });
    }

    // Salaried GPs
    if (gps?.salaried && gps.salaried.length > 0) {
        parts.push('\nSalaried GPs:');
        gps.salaried.forEach((gp, idx) => {
            parts.push(`- ${gp.name || `Salaried GP ${idx + 1}`}`);
        });
    }

    // Staff Members
    if (staff && staff.length > 0) {
        parts.push('\nPractice Staff:');

        // Group by role for cleaner display
        const roleGroups = {};
        staff.forEach(s => {
            const role = s.role || 'other';
            if (!roleGroups[role]) roleGroups[role] = [];
            roleGroups[role].push(s.name || 'Unnamed');
        });

        // Map role codes to readable labels
        const roleLabels = {
            'reception': 'Reception/Admin',
            'nursing': 'Nursing',
            'phlebotomy': 'Phlebotomy',
            'gp_assistant': 'GP Assistant',
            'management': 'Management',
            'secretary': 'Secretary',
            'nurse': 'Nurse',
            'practice_manager': 'Practice Manager',
            'other': 'Other'
        };

        Object.entries(roleGroups).forEach(([role, names]) => {
            const label = roleLabels[role] || role.replace(/_/g, ' ');
            parts.push(`- ${label}: ${names.join(', ')}`);
        });
    }

    // Calculate team totals
    const partnerCount = gps?.partners?.length || 0;
    const salariedCount = gps?.salaried?.length || 0;
    const staffCount = staff?.length || 0;
    const totalTeam = partnerCount + salariedCount + staffCount;

    if (totalTeam > 0) {
        parts.push(`\nTeam Total: ${totalTeam} people (${partnerCount + salariedCount} GPs, ${staffCount} staff)`);
    }

    return parts.length > 1 ? parts.join('\n') : null;
}

/**
 * Build GMS contract section
 */
function buildGMSContractSection(gmsContract) {
    if (!gmsContract) return null;

    const parts = [];
    parts.push('## GMS CONTRACT');

    if (gmsContract.panelSize) {
        parts.push(`Panel Size: ${gmsContract.panelSize.toLocaleString()} patients`);
    }
    if (gmsContract.averageCapitationRate) {
        parts.push(`Average Capitation Rate: €${gmsContract.averageCapitationRate.toFixed(2)} per patient per year`);
    }

    const estimatedGMSIncome = calculateEstimatedGMSIncome(gmsContract);
    if (estimatedGMSIncome) {
        parts.push(`Estimated Annual GMS Income: €${estimatedGMSIncome.toLocaleString()}`);
    }

    if (gmsContract.gmsIncomePercentage) {
        parts.push(`GMS Income as % of Total: ${gmsContract.gmsIncomePercentage}%`);
    }

    return parts.length > 1 ? parts.join('\n') : null;
}

/**
 * Build private patients section
 */
function buildPrivatePatientsSection(privatePatients) {
    if (!privatePatients) return null;

    const parts = [];
    parts.push('## PRIVATE PATIENTS');

    if (privatePatients.numberOfPatients) {
        parts.push(`Number of Private Patients: ${privatePatients.numberOfPatients.toLocaleString()}`);
    }
    if (privatePatients.averageConsultationFee) {
        parts.push(`Average Consultation Fee: €${privatePatients.averageConsultationFee.toFixed(2)}`);
    }
    if (privatePatients.averageVisitsPerYear) {
        parts.push(`Average Visits per Patient per Year: ${privatePatients.averageVisitsPerYear.toFixed(1)}`);
    }

    const estimatedPrivateIncome = calculateEstimatedPrivateIncome(privatePatients);
    if (estimatedPrivateIncome) {
        parts.push(`Estimated Annual Private Income: €${estimatedPrivateIncome.toLocaleString()}`);
    }

    if (privatePatients.privateIncomePercentage) {
        parts.push(`Private Income as % of Total: ${privatePatients.privateIncomePercentage}%`);
    }

    return parts.length > 1 ? parts.join('\n') : null;
}

/**
 * Build expenses section
 */
function buildExpensesSection(expenses) {
    if (!expenses) return null;

    const parts = [];
    parts.push('## EXPENSES');

    if (expenses.staffCosts) {
        parts.push(`Staff Costs: €${expenses.staffCosts.toLocaleString()}/year`);
    }
    if (expenses.rentAndUtilities) {
        parts.push(`Rent & Utilities: €${expenses.rentAndUtilities.toLocaleString()}/year`);
    }
    if (expenses.medicalSupplies) {
        parts.push(`Medical Supplies: €${expenses.medicalSupplies.toLocaleString()}/year`);
    }
    if (expenses.insurance) {
        parts.push(`Insurance: €${expenses.insurance.toLocaleString()}/year`);
    }
    if (expenses.otherExpenses) {
        parts.push(`Petty Cash / Other: €${expenses.otherExpenses.toLocaleString()}/year`);
    }

    const totalExpenses = expenses.totalAnnualExpenses || calculateTotalExpenses(expenses);
    if (totalExpenses) {
        parts.push(`Total Annual Expenses: €${totalExpenses.toLocaleString()}`);
    }

    return parts.length > 1 ? parts.join('\n') : null;
}

/**
 * Build categories section
 */
function buildCategoriesSection(categories) {
    if (!categories) return null;

    const parts = [];
    parts.push('## CUSTOM CATEGORIES & RULES');

    // Custom categories
    if (categories.customCategories && categories.customCategories.length > 0) {
        parts.push('\nCustom Categories:');
        categories.customCategories.forEach(cat => {
            parts.push(`- ${cat.name} (${cat.type})`);
        });
    }

    // Excluded descriptions
    if (categories.excludedTransactionDescriptions && categories.excludedTransactionDescriptions.length > 0) {
        parts.push('\nExcluded Transaction Descriptions (ignore these):');
        categories.excludedTransactionDescriptions.forEach(desc => {
            parts.push(`- "${desc}"`);
        });
    }

    // Specific instructions
    if (categories.specificInstructions && categories.specificInstructions.trim().length > 0) {
        parts.push('\nSpecific Instructions from Practice Owner:');
        parts.push(categories.specificInstructions);
    }

    return parts.length > 1 ? parts.join('\n') : null;
}

/**
 * Build GMS Health Check section
 */
function buildHealthCheckSection(healthCheckData) {
    if (!healthCheckData || !healthCheckData.healthCheckComplete) return null;

    const parts = [];
    parts.push('## GMS HEALTH CHECK DATA');

    // Demographics
    if (healthCheckData.demographics) {
        const demo = healthCheckData.demographics;
        const totalPatients = (demo.under6 || 0) + (demo.age6to7 || 0) + (demo.age8to12 || 0) +
                             (demo.age13to69 || 0) + (demo.over70 || 0);

        parts.push('\nPatient Demographics:');
        parts.push(`- Total GMS Patients: ${totalPatients.toLocaleString()}`);
        if (demo.under6) parts.push(`  - Under 6: ${demo.under6.toLocaleString()}`);
        if (demo.age6to7) parts.push(`  - 6-7 years: ${demo.age6to7.toLocaleString()}`);
        if (demo.age8to12) parts.push(`  - 8-12 years: ${demo.age8to12.toLocaleString()}`);
        if (demo.age13to69) parts.push(`  - 13-69 years: ${demo.age13to69.toLocaleString()}`);
        if (demo.over70) parts.push(`  - Over 70: ${demo.over70.toLocaleString()}`);
        if (demo.nursingHomeResidents) parts.push(`  - Nursing Home Residents: ${demo.nursingHomeResidents.toLocaleString()}`);
    }

    // Staff
    if (healthCheckData.staff) {
        const staff = healthCheckData.staff;
        parts.push('\nPractice Staff:');
        if (staff.gpCount) parts.push(`- GPs: ${staff.gpCount}`);
        if (staff.practiceNurses) parts.push(`- Practice Nurses: ${staff.practiceNurses}`);
        if (staff.healthCareAssistants) parts.push(`- Healthcare Assistants: ${staff.healthCareAssistants}`);
        if (staff.receptionists) parts.push(`- Receptionists: ${staff.receptionists}`);
        if (staff.practiceManager) parts.push(`- Practice Manager: ${staff.practiceManager}`);
    }

    // Disease Registers
    if (healthCheckData.diseaseRegisters) {
        const disease = healthCheckData.diseaseRegisters;
        parts.push('\nChronic Disease Management:');
        if (disease.asthmaUnder5) parts.push(`- Asthma (Under 5): ${disease.asthmaUnder5} patients`);
        if (disease.asthmaOver5) parts.push(`- Asthma (5+): ${disease.asthmaOver5} patients`);
        if (disease.type2Diabetes) parts.push(`- Type 2 Diabetes: ${disease.type2Diabetes} patients`);
    }

    // Leave Payments
    if (healthCheckData.leavePayments) {
        const leave = healthCheckData.leavePayments;
        const totalLeave = (leave.annualLeaveDays || 0) + (leave.studyLeaveDays || 0);
        if (totalLeave > 0) {
            parts.push('\nLeave Entitlements:');
            if (leave.annualLeaveDays) parts.push(`- Annual Leave: ${leave.annualLeaveDays} days`);
            if (leave.studyLeaveDays) parts.push(`- Study Leave: ${leave.studyLeaveDays} days`);
        }
    }

    // Cervical Check Activity
    if (healthCheckData.cervicalCheckActivity) {
        const cervical = healthCheckData.cervicalCheckActivity;
        const eligibleTotal = (cervical.eligibleWomen25to44 || 0) + (cervical.eligibleWomen45to65 || 0);
        if (eligibleTotal > 0 || cervical.smearsPerformed) {
            parts.push('\nCervical Screening:');
            if (eligibleTotal > 0) parts.push(`- Eligible Women: ${eligibleTotal.toLocaleString()}`);
            if (cervical.smearsPerformed) parts.push(`- Smears Performed (last year): ${cervical.smearsPerformed}`);
        }
    }

    return parts.length > 1 ? parts.join('\n') : null;
}

/**
 * Build financial summary section
 */
function buildFinancialSummarySection(profile) {
    const { gmsContract, privatePatients, expenses } = profile;

    const totalIncome = calculateEstimatedTotalIncome(gmsContract, privatePatients);
    const totalExpenses = expenses?.totalAnnualExpenses || calculateTotalExpenses(expenses);

    if (!totalIncome && !totalExpenses) return null;

    const parts = [];
    parts.push('## FINANCIAL SUMMARY');

    if (totalIncome) {
        parts.push(`Estimated Total Annual Income: €${totalIncome.toLocaleString()}`);
    }
    if (totalExpenses) {
        parts.push(`Estimated Total Annual Expenses: €${totalExpenses.toLocaleString()}`);
    }
    if (totalIncome && totalExpenses) {
        const profit = totalIncome - totalExpenses;
        const profitMargin = ((profit / totalIncome) * 100).toFixed(1);
        parts.push(`Estimated Net Profit: €${profit.toLocaleString()} (${profitMargin}% margin)`);
    }

    return parts.length > 1 ? parts.join('\n') : null;
}

/**
 * Build a short context summary for UI display
 * @param {Object} profile - The practice profile object
 * @returns {string} Short summary of what Finn knows
 */
export function buildContextSummary(profile) {
    if (!profile || !profile.metadata?.setupComplete) {
        return 'No practice profile configured';
    }

    const items = [];

    if (profile.practiceDetails?.practiceName) {
        items.push(profile.practiceDetails.practiceName);
    }

    // Team summary
    const gpCount = (profile.gps?.partners?.length || 0) + (profile.gps?.salaried?.length || 0);
    const staffCount = profile.staff?.length || 0;
    if (gpCount > 0 || staffCount > 0) {
        items.push(`${gpCount} GPs, ${staffCount} staff`);
    }

    if (profile.gmsContract?.panelSize) {
        items.push(`${profile.gmsContract.panelSize.toLocaleString()} GMS patients`);
    }
    if (profile.privatePatients?.numberOfPatients) {
        items.push(`${profile.privatePatients.numberOfPatients.toLocaleString()} private patients`);
    }
    if (profile.categories?.customCategories?.length > 0) {
        items.push(`${profile.categories.customCategories.length} custom categories`);
    }

    return items.length > 0 ? items.join(' • ') : 'Basic profile configured';
}

/**
 * Check if profile has enough data to be useful
 */
export function hasMinimumContext(profile) {
    if (!profile) return false;

    // Need at least practice name and one financial data point
    const hasBasics = profile.practiceDetails?.practiceName;
    const hasFinancials =
        profile.gmsContract?.panelSize ||
        profile.privatePatients?.numberOfPatients ||
        profile.expenses?.totalAnnualExpenses;

    return hasBasics && hasFinancials;
}
