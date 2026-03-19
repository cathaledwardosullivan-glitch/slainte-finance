/**
 * Guided Data Entry Prompts — per-area question sequences for conversational data collection.
 * Each area defines the fields Finn should ask about, the order, and how to map responses.
 *
 * Only areas that require user input are included here.
 * Leave and STC (partially) are auto-populated from PCRS data.
 */

const GUIDED_PROMPTS = {
  practiceSupport: {
    intro: "I'll help you enter your staff details for Practice Support analysis. I need to know about each staff member who works in the practice — their role, hours, and experience. Let's go through them one at a time.",
    fields: [
      {
        id: 'staffCount',
        question: "How many staff members do you have in total? Include secretaries, nurses, and practice managers — but not GPs.",
        parseHint: 'Extract a number. E.g., "3 staff" → 3, "we have a nurse and two secretaries" → 3',
        section: '_meta',
        field: 'staffCount'
      },
      {
        id: 'staffDetails',
        question: "For each staff member, I need: their name, role (secretary, nurse, or practice manager), how many hours per week they work, and roughly how many years of experience they have in that role. You can tell me about all of them at once or one at a time.",
        parseHint: 'Extract an array of staff objects: { firstName, surname, staffType (secretary|nurse|practiceManager), actualHoursWorked (number), yearsExperience (number) }. Accept natural descriptions like "Mary works 30 hours as a nurse, 5 years experience".',
        section: 'staffDetails',
        field: '_array',
        isComplex: true
      }
    ]
  },

  capitation: {
    intro: "I'll help you enter your patient demographics so we can check for capitation gaps. I need the counts from your EHR system — how many patients you have in each age group.",
    fields: [
      {
        id: 'under6',
        question: "How many patients under 6 years old are in your EHR system? You can find this by running an age search for patients aged 0–5.",
        parseHint: 'Extract a number.',
        section: 'demographics',
        field: 'under6'
      },
      {
        id: 'over70',
        question: "How many patients over 70 are in your EHR?",
        parseHint: 'Extract a number.',
        section: 'demographics',
        field: 'over70'
      },
      {
        id: 'nursingHome',
        question: "Do you have any nursing home residents on your panel? If so, how many?",
        parseHint: 'Extract a number. "no" or "none" → 0.',
        section: 'demographics',
        field: 'nursingHomeResidents'
      }
    ]
  },

  cervicalCheck: {
    intro: "I'll help you enter your eligible female patient counts for cervical screening analysis. These should include ALL women in the age groups — GMS, DVC, and private patients — since CervicalCheck is open to everyone.",
    fields: [
      {
        id: 'women25to44',
        question: "How many female patients aged 25–44 are registered with your practice? Include GMS, DVC, and private patients.",
        parseHint: 'Extract a number.',
        section: 'cervicalCheckActivity',
        field: 'eligibleWomen25to44'
      },
      {
        id: 'women45to65',
        question: "And how many female patients aged 45–65?",
        parseHint: 'Extract a number.',
        section: 'cervicalCheckActivity',
        field: 'eligibleWomen45to65'
      }
    ]
  },

  cdm: {
    intro: "I'll help you enter your disease register counts for CDM analysis. For each condition, I need the number of diagnosed patients on your register — this tells us how many could be enrolled in the CDM programme.",
    fields: [
      {
        id: 'type2Diabetes',
        question: "How many patients on your Type 2 Diabetes register? (ICPC-2 code T90)",
        parseHint: 'Extract a number.',
        section: 'diseaseRegisters',
        field: 'type2Diabetes'
      },
      {
        id: 'asthma',
        question: "How many on your Asthma register? (R96)",
        parseHint: 'Extract a number.',
        section: 'diseaseRegisters',
        field: 'asthma'
      },
      {
        id: 'copd',
        question: "COPD? (R95)",
        parseHint: 'Extract a number.',
        section: 'diseaseRegisters',
        field: 'copd'
      },
      {
        id: 'heartFailure',
        question: "Heart Failure? (K77)",
        parseHint: 'Extract a number.',
        section: 'diseaseRegisters',
        field: 'heartFailure'
      },
      {
        id: 'atrialFibrillation',
        question: "Atrial Fibrillation? (K78)",
        parseHint: 'Extract a number.',
        section: 'diseaseRegisters',
        field: 'atrialFibrillation'
      },
      {
        id: 'ihd',
        question: "IHD — Ischaemic Heart Disease? (K74/K76)",
        parseHint: 'Extract a number.',
        section: 'diseaseRegisters',
        field: 'ihd'
      },
      {
        id: 'strokeTIA',
        question: "Stroke or TIA? (K90)",
        parseHint: 'Extract a number.',
        section: 'diseaseRegisters',
        field: 'strokeTIA'
      },
      {
        id: 'hypertension',
        question: "Finally, Hypertension? (K86/K87) — this is for the CDM Prevention strand.",
        parseHint: 'Extract a number.',
        section: 'diseaseRegisters',
        field: 'hypertension'
      }
    ]
  }
};

/**
 * Areas that support guided entry (have user-entered data)
 */
export const GUIDED_AREAS = Object.keys(GUIDED_PROMPTS);

/**
 * Check if an area has any data already entered
 */
export function hasExistingData(areaId, healthCheckData) {
  if (!healthCheckData) return false;

  switch (areaId) {
    case 'practiceSupport':
      return healthCheckData.staffDetails?.length > 0 &&
        healthCheckData.staffDetails.some(s => s.yearsExperience > 0 || s.actualHoursWorked > 0);
    case 'capitation':
      return (healthCheckData.demographics?.under6 > 0 || healthCheckData.demographics?.over70 > 0);
    case 'cervicalCheck':
      return (healthCheckData.cervicalCheckActivity?.eligibleWomen25to44 > 0 ||
        healthCheckData.cervicalCheckActivity?.eligibleWomen45to65 > 0);
    case 'cdm':
      return healthCheckData.diseaseRegisters &&
        Object.values(healthCheckData.diseaseRegisters).some(v => v > 0);
    default:
      return false;
  }
}

export default GUIDED_PROMPTS;
