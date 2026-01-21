/**
 * Practice Profile Setup Flow
 *
 * Manages the conversational setup flow for practice profiles.
 * Works with existing practice profile schema.
 */

/**
 * Setup conversation questions in order
 */
export const SETUP_QUESTIONS = [
    {
        id: 'practiceName',
        question: "Hi! Let's set up your practice profile so I can give you better financial insights. This should only take a couple of minutes.\n\nFirst, what's the name of your practice?",
        field: 'practiceDetails.practiceName',
        type: 'text'
    },
    {
        id: 'location',
        question: "Great! Where is your practice located? (e.g., Dublin, Cork, Galway)",
        field: 'practiceDetails.location',
        type: 'text'
    },
    {
        id: 'numberOfGPs',
        question: "How many GPs work at the practice?",
        field: 'practiceDetails.numberOfGPs',
        type: 'number'
    },
    {
        id: 'practiceType',
        question: "What type of practice is this? (urban, rural, semi-rural, or mixed)",
        field: 'practiceDetails.practiceType',
        type: 'choice',
        choices: ['urban', 'rural', 'semi-rural', 'mixed']
    },
    {
        id: 'panelSize',
        question: "Perfect! Now for some financial details.\n\nWhat's your GMS panel size? (approximate number of GMS patients)",
        field: 'gmsContract.panelSize',
        type: 'number'
    },
    {
        id: 'capitationRate',
        question: "What's your average capitation rate per patient per year? (in euros)",
        field: 'gmsContract.averageCapitationRate',
        type: 'number'
    },
    {
        id: 'gmsIncomePercentage',
        question: "What percentage of your total income comes from GMS? (approximate)",
        field: 'gmsContract.gmsIncomePercentage',
        type: 'number'
    },
    {
        id: 'privatePatients',
        question: "How many private patients do you have? (approximate)",
        field: 'privatePatients.numberOfPatients',
        type: 'number'
    },
    {
        id: 'consultationFee',
        question: "What's your average private consultation fee? (in euros)",
        field: 'privatePatients.averageConsultationFee',
        type: 'number'
    },
    {
        id: 'visitsPerYear',
        question: "On average, how many visits per year does a private patient make?",
        field: 'privatePatients.averageVisitsPerYear',
        type: 'number'
    },
    {
        id: 'privateIncomePercentage',
        question: "What percentage of your total income comes from private patients? (approximate)",
        field: 'privatePatients.privateIncomePercentage',
        type: 'number'
    },
    {
        id: 'expenses',
        question: "Now let's capture your major expenses. First, what are your annual staff costs? (approximate in euros)\n\nIf you're not sure, you can say 'skip' or give your best estimate.",
        field: 'expenses.staffCosts',
        type: 'number',
        optional: true
    },
    {
        id: 'rentUtilities',
        question: "What are your annual rent and utilities costs? (approximate in euros)",
        field: 'expenses.rentAndUtilities',
        type: 'number',
        optional: true
    },
    {
        id: 'medicalSupplies',
        question: "What are your annual medical supplies costs? (approximate in euros)",
        field: 'expenses.medicalSupplies',
        type: 'number',
        optional: true
    },
    {
        id: 'insurance',
        question: "What are your annual insurance costs? (approximate in euros)",
        field: 'expenses.insurance',
        type: 'number',
        optional: true
    },
    {
        id: 'otherExpenses',
        question: "What are your other annual expenses? (approximate in euros)",
        field: 'expenses.otherExpenses',
        type: 'number',
        optional: true
    },
    {
        id: 'customInstructions',
        question: "Finally, are there any specific instructions or notes I should know about your practice finances?\n\nFor example:\n- Specific transaction descriptions to ignore (like personal expenses)\n- Custom categories you'd like to track\n- Any special accounting conventions\n\nJust reply 'no' if there's nothing specific.",
        field: 'categories.specificInstructions',
        type: 'text',
        optional: true
    }
];

/**
 * Extract data from user's answer based on question type
 */
export function extractAnswerData(question, userAnswer) {
    const answer = userAnswer.trim();
    const lowerAnswer = answer.toLowerCase();

    // Handle optional fields
    if (question.optional && (lowerAnswer === 'skip' || lowerAnswer === 'no' || lowerAnswer === 'none')) {
        return null;
    }

    switch (question.type) {
        case 'number':
            // Extract first number from answer
            const numberMatch = answer.match(/[\d,]+\.?\d*/);
            if (numberMatch) {
                const cleaned = numberMatch[0].replace(/,/g, '');
                const num = parseFloat(cleaned);
                return isNaN(num) ? null : num;
            }
            return null;

        case 'choice':
            // Find matching choice
            const match = question.choices.find(choice =>
                lowerAnswer.includes(choice.toLowerCase())
            );
            return match || answer;

        case 'text':
        default:
            return answer;
    }
}

/**
 * Build confirmation message from collected data
 */
export function buildConfirmationMessage(collectedData) {
    const lines = [];

    lines.push("Perfect! Let me confirm what I've collected:\n");

    // Practice Details
    if (collectedData.practiceDetails) {
        lines.push("📋 **Practice Details:**");
        if (collectedData.practiceDetails.practiceName) {
            lines.push(`- ${collectedData.practiceDetails.practiceName}`);
        }
        if (collectedData.practiceDetails.location) {
            lines.push(`- Location: ${collectedData.practiceDetails.location}`);
        }
        if (collectedData.practiceDetails.numberOfGPs) {
            lines.push(`- ${collectedData.practiceDetails.numberOfGPs} GP${collectedData.practiceDetails.numberOfGPs > 1 ? 's' : ''}`);
        }
        if (collectedData.practiceDetails.practiceType) {
            lines.push(`- Type: ${collectedData.practiceDetails.practiceType}`);
        }
        lines.push("");
    }

    // GMS Contract
    if (collectedData.gmsContract) {
        lines.push("💰 **GMS Contract:**");
        if (collectedData.gmsContract.panelSize) {
            lines.push(`- Panel size: ${collectedData.gmsContract.panelSize.toLocaleString()} patients`);
        }
        if (collectedData.gmsContract.averageCapitationRate) {
            lines.push(`- Capitation rate: €${collectedData.gmsContract.averageCapitationRate}/patient/year`);
        }
        if (collectedData.gmsContract.gmsIncomePercentage) {
            lines.push(`- GMS income: ${collectedData.gmsContract.gmsIncomePercentage}% of total`);
        }
        lines.push("");
    }

    // Private Patients
    if (collectedData.privatePatients) {
        lines.push("🏥 **Private Patients:**");
        if (collectedData.privatePatients.numberOfPatients) {
            lines.push(`- ${collectedData.privatePatients.numberOfPatients.toLocaleString()} private patients`);
        }
        if (collectedData.privatePatients.averageConsultationFee) {
            lines.push(`- Average fee: €${collectedData.privatePatients.averageConsultationFee}`);
        }
        if (collectedData.privatePatients.averageVisitsPerYear) {
            lines.push(`- Average visits: ${collectedData.privatePatients.averageVisitsPerYear}/year`);
        }
        if (collectedData.privatePatients.privateIncomePercentage) {
            lines.push(`- Private income: ${collectedData.privatePatients.privateIncomePercentage}% of total`);
        }
        lines.push("");
    }

    // Expenses
    if (collectedData.expenses) {
        const hasExpenses = Object.values(collectedData.expenses).some(v => v != null);
        if (hasExpenses) {
            lines.push("💵 **Annual Expenses:**");
            if (collectedData.expenses.staffCosts) {
                lines.push(`- Staff: €${collectedData.expenses.staffCosts.toLocaleString()}`);
            }
            if (collectedData.expenses.rentAndUtilities) {
                lines.push(`- Rent & utilities: €${collectedData.expenses.rentAndUtilities.toLocaleString()}`);
            }
            if (collectedData.expenses.medicalSupplies) {
                lines.push(`- Medical supplies: €${collectedData.expenses.medicalSupplies.toLocaleString()}`);
            }
            if (collectedData.expenses.insurance) {
                lines.push(`- Insurance: €${collectedData.expenses.insurance.toLocaleString()}`);
            }
            if (collectedData.expenses.otherExpenses) {
                lines.push(`- Other: €${collectedData.expenses.otherExpenses.toLocaleString()}`);
            }
            lines.push("");
        }
    }

    // Custom Instructions
    if (collectedData.categories?.specificInstructions) {
        lines.push("📝 **Special Instructions:**");
        lines.push(collectedData.categories.specificInstructions);
        lines.push("");
    }

    lines.push("Does this look correct? Reply 'yes' to save, or tell me what needs to be changed.");

    return lines.join('\n');
}

/**
 * Set nested object property using dot notation
 */
export function setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((o, key) => {
        if (!o[key]) o[key] = {};
        return o[key];
    }, obj);
    target[lastKey] = value;
}

/**
 * Build AI extraction prompt for conversational answers
 */
export function buildExtractionPrompt(conversationHistory) {
    return `You are extracting structured data from a practice setup conversation.

Conversation history:
${JSON.stringify(conversationHistory, null, 2)}

Extract the following information and return ONLY valid JSON with no additional text:

{
  "practiceDetails": {
    "practiceName": "string or null",
    "location": "string or null",
    "numberOfGPs": number or null,
    "practiceType": "urban|rural|semi-rural|mixed or null"
  },
  "gmsContract": {
    "panelSize": number or null,
    "averageCapitationRate": number or null,
    "gmsIncomePercentage": number or null
  },
  "privatePatients": {
    "numberOfPatients": number or null,
    "averageConsultationFee": number or null,
    "averageVisitsPerYear": number or null,
    "privateIncomePercentage": number or null
  },
  "expenses": {
    "staffCosts": number or null,
    "rentAndUtilities": number or null,
    "medicalSupplies": number or null,
    "insurance": number or null,
    "otherExpenses": number or null
  },
  "categories": {
    "specificInstructions": "string or null"
  }
}

Rules:
- Return null for any field not clearly mentioned in conversation
- Extract numbers without currency symbols or commas
- Parse natural language numbers (e.g., "around 3000" → 3000, "about 50%" → 50)
- Be conservative - only extract what you're confident about
- DO NOT output anything except valid JSON`;
}
