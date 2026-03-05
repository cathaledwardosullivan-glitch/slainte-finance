/**
 * Socrates Practice Distribution Breakdown CSV Parser
 *
 * Parses the "Practice Distribution Breakdown" report exported from Socrates
 * as CSV and extracts aggregate patient counts for the GMS Health Check.
 *
 * CSV structure (18 columns):
 *   0: Age band label
 *   1-3: GMS Female, Male, Unknown
 *   4: GMS Total
 *   5-7: DVC Female, Male, Unknown
 *   8: DVC Total
 *   9-12: Private Female, Male, Unknown, Unspecified
 *   13: Private Total
 *   14-15: Unknown type columns
 *   16: Unknown Total
 *   17: Grand Total
 */

import Papa from 'papaparse';

// Column indices (0-based) in the CSV data rows
const COL = {
  AGE_BAND: 0,
  GMS_FEMALE: 1,
  GMS_MALE: 2,
  GMS_TOTAL: 4,
  DVC_FEMALE: 5,
  DVC_MALE: 6,
  DVC_TOTAL: 8,
  PRIVATE_FEMALE: 9,
  PRIVATE_MALE: 10,
  PRIVATE_TOTAL: 13,
  GRAND_TOTAL: 17
};

/**
 * Normalize an age band label for matching.
 * Handles inconsistent spacing from Socrates export (e.g., "45-  49", " Under 6")
 */
function normalizeAgeBand(label) {
  if (!label) return '';
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Parse a cell value to integer, treating empty/missing as 0
 */
function parseCell(value) {
  if (value === undefined || value === null || value === '') return 0;
  const num = parseInt(String(value).trim(), 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Check if an age band label matches one of the over-70 bands
 */
function isOver70Band(normalized) {
  return /^(70|75|80|85|90|95)/.test(normalized);
}

/**
 * Check if an age band label matches one of the 25-44 bands
 */
function is25to44Band(normalized) {
  return /^(25|30|35|40)/.test(normalized);
}

/**
 * Check if an age band label matches one of the 45-64 bands (45-65 eligibility)
 */
function is45to64Band(normalized) {
  return /^(45|50|55|60)/.test(normalized);
}

/**
 * Check if an age band label matches 16-34 bands (for Free Contraception Scheme 17-35)
 * Socrates uses "16 - 19" (not "15 - 19"), so match 16 as well as 15 for safety
 */
function is16to34Band(normalized) {
  return /^(1[5-9]|20|25|30)/.test(normalized);
}

/**
 * Check if an age band label matches 35-44 bands (for GMS/DVC contraception extension 36-44)
 */
function is35to44Band(normalized) {
  return /^(35|40)/.test(normalized);
}

/**
 * Parse a Practice Distribution Breakdown CSV from Socrates.
 *
 * @param {string} csvText - Raw CSV text content
 * @returns {Object} Parsed result with success flag, data, and warnings
 */
export function parsePracticeDistributionCSV(csvText) {
  const warnings = [];

  try {
    const parsed = Papa.parse(csvText, {
      skipEmptyLines: true
    });

    if (parsed.errors.length > 0) {
      const criticalErrors = parsed.errors.filter(e => e.type === 'Delimiter');
      if (criticalErrors.length > 0) {
        return {
          success: false,
          error: 'Could not parse CSV file. Please ensure this is a CSV export from the Socrates Practice Distribution Breakdown report.',
          warnings
        };
      }
    }

    const rows = parsed.data;
    if (rows.length < 3) {
      return {
        success: false,
        error: 'CSV file appears to be empty or too short. Expected at least a header row and data rows.',
        warnings
      };
    }

    // Skip the header row (CrossTab1_Row1, CrossTab1_Sum1, ...)
    // Find data rows by checking if the first column looks like an age band
    const dataRows = [];
    let totalRow = null;
    let headerSkipped = false;

    for (const row of rows) {
      const label = normalizeAgeBand(row[COL.AGE_BAND]);

      // Skip the CrossTab header row
      if (label.includes('crosstab') || label.includes('row1')) {
        headerSkipped = true;
        continue;
      }

      // Identify the total row
      if (label === 'total') {
        totalRow = row;
        continue;
      }

      // Skip unknown/empty rows
      if (label === 'unknown' || label === '') {
        continue;
      }

      dataRows.push({ label, row });
    }

    if (dataRows.length === 0) {
      return {
        success: false,
        error: 'No patient data rows found in the CSV. Please check this is the correct report.',
        warnings
      };
    }

    // Validate column count
    const expectedCols = 18;
    const sampleRow = dataRows[0].row;
    if (sampleRow.length < expectedCols) {
      warnings.push(`Expected ${expectedCols} columns but found ${sampleRow.length}. Some data may be missing.`);
    }

    // Extract demographics
    let under6 = 0;
    let age6to9 = 0;
    let over70 = 0;

    // Extract cervical screening (all women)
    let women25to44 = 0;
    let women45to65 = 0;

    // Extract contraception demographics
    let allFemale16to34 = 0; // ALL women 16-34, proxy for Free Contraception Scheme 17-35
    let gmsAndDvcFemale35to44 = 0; // GMS+DVC women 35-44, for GMS/DVC scheme 36-44

    // Build raw bands for reference
    const rawBands = [];

    for (const { label, row } of dataRows) {
      const gmsFemale = parseCell(row[COL.GMS_FEMALE]);
      const gmsMale = parseCell(row[COL.GMS_MALE]);
      const gmsTotal = parseCell(row[COL.GMS_TOTAL]);
      const dvcFemale = parseCell(row[COL.DVC_FEMALE]);
      const dvcMale = parseCell(row[COL.DVC_MALE]);
      const dvcTotal = parseCell(row[COL.DVC_TOTAL]);
      const privateFemale = parseCell(row[COL.PRIVATE_FEMALE]);
      const privateTotal = parseCell(row[COL.PRIVATE_TOTAL]);
      const grandTotal = parseCell(row[COL.GRAND_TOTAL]);

      const allFemale = gmsFemale + dvcFemale + privateFemale;
      const gmsAndDvc = gmsTotal + dvcTotal;

      rawBands.push({
        label: row[COL.AGE_BAND]?.trim() || label,
        gmsTotal,
        dvcTotal,
        privateTotal,
        grandTotal,
        allFemale,
        gmsAndDvc
      });

      // Under 6 — ALL patients: universal GP Visit Card covers all children under 6
      if (label.includes('under 6') || label === 'under6') {
        under6 = grandTotal;
      }

      // Age 6-9 (closest available to 6-7) — ALL patients: GP Visit Card for under 8
      if (label.startsWith('06') || label.startsWith('6 -') || label.startsWith('6-')) {
        age6to9 = grandTotal;
      }

      // Over 70 — ALL patients: universal GP Visit Card covers all adults 70+
      if (isOver70Band(label)) {
        over70 += grandTotal;
      }

      // Women 25-44 (all patient types)
      if (is25to44Band(label)) {
        women25to44 += allFemale;
      }

      // Women 45-64 (for cervical screening 45-65)
      if (is45to64Band(label)) {
        women45to65 += allFemale;
      }

      // All females 16-34 (proxy for Free Contraception Scheme 17-35 — covers ALL women, not just GMS)
      if (is16to34Band(label)) {
        allFemale16to34 += allFemale;
      }

      // GMS+DVC females 35-44 (for GMS/DVC contraception extension 36-44 — covers both GMS and DVC)
      if (is35to44Band(label)) {
        gmsAndDvcFemale35to44 += gmsFemale + dvcFemale;
      }
    }

    // Extract panel totals from the Total row
    let totalGMS = 0;
    let totalDVC = 0;
    let totalPrivate = 0;
    let grandTotal = 0;

    if (totalRow) {
      totalGMS = parseCell(totalRow[COL.GMS_TOTAL]);
      totalDVC = parseCell(totalRow[COL.DVC_TOTAL]);
      totalPrivate = parseCell(totalRow[COL.PRIVATE_TOTAL]);
      grandTotal = parseCell(totalRow[COL.GRAND_TOTAL]);
    }

    // Add helpful warnings
    if (age6to9 > 0) {
      warnings.push('The Socrates report groups ages 6-9 together. The age 6-7 count may be lower than the 06-09 figure shown.');
    }

    warnings.push('Nursing home resident count is not available from this report and must be entered manually.');

    return {
      success: true,
      data: {
        demographics: {
          under6,
          over70,
          age6to9 // broader than 6-7, flagged in warnings
        },
        cervicalScreening: {
          eligibleWomen25to44: women25to44,
          eligibleWomen45to65: women45to65
        },
        contraceptionDemographics: {
          gmsFemale17to35: allFemale16to34, // All women 16-34 as proxy for Free Contraception Scheme 17-35
          gmsFemale36to44: gmsAndDvcFemale35to44  // GMS+DVC women 35-44 as proxy for GMS/DVC scheme 36-44
        },
        panelSummary: {
          totalGMS,
          totalDVC,
          totalPrivate,
          grandTotal
        },
        rawBands
      },
      warnings
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to parse CSV: ${err.message}`,
      warnings
    };
  }
}
