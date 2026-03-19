// GMS Health Check Calculation Engine
import gmsRates, {
  calculateWeightedPanel,
  calculatePanelFactor,
  getCapitationRate,
  getPracticeSupportRate,
  getCorrectIncrementPoint,
  calculatePanelFactorWithIncrements,
  calculateStaffSubsidy,
  detectPracticeSupportIssues,
  getCervicalCheckRate
} from '../data/gmsRates';
import COLORS from '../utils/colors';

/**
 * Count unique doctors/panels from PCRS payment analysis data
 * This is the authoritative source for the number of partners/panels
 *
 * Uses Doctor Number (PCRS identifier) as the primary method since it's
 * the official unique identifier. Falls back to normalized doctor names
 * only if no doctor numbers are available.
 *
 * @param {Array} paymentAnalysisData - Parsed PCRS PDF data
 * @returns {number} Number of unique doctors/panels detected
 */
export function getUniquePanelCount(paymentAnalysisData) {
  if (!paymentAnalysisData || paymentAnalysisData.length === 0) {
    console.warn('⚠️ No payment analysis data available for panel count - defaulting to 1');
    return 1; // Default to 1 if no data
  }

  // Primary method: Count unique doctor numbers (most reliable - official PCRS identifier)
  const uniqueDoctorNumbers = new Set();
  paymentAnalysisData.forEach(entry => {
    if (entry.doctorNumber && entry.doctorNumber.trim() && entry.doctorNumber !== '00000') {
      uniqueDoctorNumbers.add(entry.doctorNumber.trim());
    }
  });

  if (uniqueDoctorNumbers.size > 0) {
    console.log(`📊 Detected ${uniqueDoctorNumbers.size} unique panel(s) from Doctor Numbers:`, Array.from(uniqueDoctorNumbers));
    return uniqueDoctorNumbers.size;
  }

  // Fallback method: Count unique normalized doctor names
  // Normalize to handle variations like "DR. JOHN SMITH" vs "DR JOHN SMITH"
  const uniqueDoctorNames = new Set();
  paymentAnalysisData.forEach(entry => {
    if (entry.doctor && entry.doctor.trim()) {
      // Normalize: uppercase, remove "DR." or "DR ", trim extra spaces
      const normalized = entry.doctor
        .toUpperCase()
        .replace(/^DR\.?\s*/i, '')  // Remove DR. or DR prefix
        .replace(/\s+/g, ' ')       // Normalize whitespace
        .trim();

      if (normalized.length > 2) {  // Avoid empty or very short strings
        uniqueDoctorNames.add(normalized);
      }
    }
  });

  const panelCount = uniqueDoctorNames.size || 1;
  console.log(`📊 Detected ${panelCount} unique panel(s) from Doctor Names (fallback):`, Array.from(uniqueDoctorNames));
  return panelCount;
}

/**
 * Aggregate PCRS payments from payment analysis data
 * Reads from parsed PCRS PDF data instead of bank transactions
 * @param {Array} paymentAnalysisData - Parsed PCRS PDF data
 * @param {Object} practiceProfile - Optional practice profile to get actual number of partners
 */
export function aggregateGMSPayments(paymentAnalysisData, practiceProfile = null) {
  const aggregated = {
    capitation: 0,
    practiceSupport: 0,
    leavePayments: 0,
    diseaseManagement: 0,
    cervicalCheck: 0,
    stc: 0,
    other: 0,
    totalPCRS: 0,
    // NEW: Cervical screening detailed data aggregated from PCRS PDFs
    cervicalScreeningData: {
      totalSmears: 0,
      smearsPaid: 0,
      smearsZeroPayment: 0,
      totalPaidAmount: 0,
      zeroPaymentReasons: [],  // Aggregated reasons with counts
      reasonBreakdown: {}      // { reason: count }
    },
    // NEW: Demographics aggregated from PCRS PDFs (for comparison with EHR data)
    pcrsDemographics: {
      // Under 6 (0-5 years)
      totalUnder6: 0,
      under6Male: 0,
      under6Female: 0,
      // Over 70
      total70Plus: 0,
      nursingHome70Plus: 0,
      stateMed70Plus: 0,
      total70PlusAllCategories: 0,
      // Panel info
      panelSize: 0,
      panelSizeByDoctor: {}  // { doctorNumber: panelSize }
    },
    // NEW: STC Details aggregated from PCRS PDFs
    stcDetails: {
      claims: [],              // All individual claims
      byCode: {},              // Aggregated by code: { CF: { count: 5, total: 275.00 }, ... }
      totalAmount: 0,          // Total STC payments from details
      totalClaims: 0           // Total number of STC claims
    }
  };

  console.log('🔍 Analyzing PCRS payment data:', paymentAnalysisData?.length || 0, 'months of data');

  if (!paymentAnalysisData || paymentAnalysisData.length === 0) {
    console.warn('⚠️ No payment analysis data available');
    return aggregated;
  }

  // Log sample data structure
  if (paymentAnalysisData.length > 0) {
    console.log('📋 Sample payment data:', {
      month: paymentAnalysisData[0].month,
      year: paymentAnalysisData[0].year,
      doctor: paymentAnalysisData[0].doctor,
      paymentsKeys: Object.keys(paymentAnalysisData[0].payments || {})
    });
  }

  // Track unique month-year combinations and doctors to check data completeness
  const processedMonths = new Set();
  const doctorMonths = new Map(); // Track which months each doctor has
  let uniqueMonths = 0;

  // Track processed doctor-month combinations to avoid duplicate entries
  const processedDoctorMonths = new Set();

  // Helper to get consistent panel key (same logic as getUniquePanelCount)
  const getPanelKey = (entry) => {
    if (entry.doctorNumber && entry.doctorNumber.trim() && entry.doctorNumber !== '00000') {
      return entry.doctorNumber.trim();
    } else if (entry.doctor && entry.doctor.trim()) {
      return entry.doctor.toUpperCase().replace(/^DR\.?\s*/i, '').replace(/\s+/g, ' ').trim();
    }
    return 'Unknown';
  };

  // Sum payments across all doctors and months
  // IMPORTANT: Each doctor has their own capitation payments, so we sum ALL entries
  paymentAnalysisData.forEach(monthData => {
    if (!monthData.payments) return;

    const monthKey = `${monthData.year}-${monthData.month}`;
    // Use consistent panel identification (doctorNumber first, then normalized name)
    const doctor = getPanelKey(monthData);
    const doctorMonthKey = `${doctor}-${monthKey}`;

    // Track doctor-month combinations
    if (!doctorMonths.has(doctor)) {
      doctorMonths.set(doctor, new Set());
    }
    doctorMonths.get(doctor).add(monthKey);

    // Track unique months (for reporting)
    if (!processedMonths.has(monthKey)) {
      processedMonths.add(monthKey);
      uniqueMonths++;
    }

    // Check if this exact doctor-month combination was already processed
    // This prevents duplicate entries if same PDF is uploaded twice
    if (processedDoctorMonths.has(doctorMonthKey)) {
      console.log(`⊗ Skipping duplicate entry: ${doctorMonthKey}`);
      return;
    }
    processedDoctorMonths.add(doctorMonthKey);

    // Sum ALL doctors' payments (each doctor has their own capitation, etc.)
    // Capitation - paid per doctor/panel
    aggregated.capitation += parseFloat(monthData.payments["Capitation Payment/Supplementary Allowance"] || 0);

    // Practice Support - paid per practice but may appear on each doctor's statement
    aggregated.practiceSupport += parseFloat(monthData.payments["Practice Support Subsidy"] || 0);

    // Leave payments - per doctor
    aggregated.leavePayments += parseFloat(monthData.payments["Locum Expenses For Leave"] || 0);

    // Disease management - per doctor
    aggregated.diseaseManagement +=
      parseFloat(monthData.payments["Enhanced Capitation for Asthma"] || 0) +
      parseFloat(monthData.payments["Asthma registration fee"] || 0) +
      parseFloat(monthData.payments["Enhanced Capitation for Diabetes"] || 0) +
      parseFloat(monthData.payments["Diabetes registration fee"] || 0);

    // Cervical check - per doctor
    aggregated.cervicalCheck += parseFloat(monthData.payments["National Cervical Screening Programme"] || 0);

    // NEW: Aggregate cervical screening detailed data from PCRS PDFs
    if (monthData.cervicalScreening) {
      const cs = monthData.cervicalScreening;
      aggregated.cervicalScreeningData.totalSmears += cs.totalSmears || 0;
      aggregated.cervicalScreeningData.smearsPaid += cs.smearsPaid || 0;
      aggregated.cervicalScreeningData.smearsZeroPayment += cs.smearsZeroPayment || 0;
      aggregated.cervicalScreeningData.totalPaidAmount += cs.totalPaid || 0;
      // Track the applicable rate for this period's zero-payment calculations
      const periodDate = `${monthData.year}-${String(monthData.month).padStart(2, '0')}-15`;
      const periodRate = getCervicalCheckRate(periodDate);
      aggregated.cervicalScreeningData.zeroPaymentLostByRate =
        (aggregated.cervicalScreeningData.zeroPaymentLostByRate || 0) +
        ((cs.smearsZeroPayment || 0) * periodRate);

      // Aggregate zero payment reasons
      if (cs.zeroPaymentReasons && cs.zeroPaymentReasons.length > 0) {
        cs.zeroPaymentReasons.forEach(entry => {
          aggregated.cervicalScreeningData.zeroPaymentReasons.push(entry);
          // Count by reason type
          const reason = entry.reason || 'Unknown';
          aggregated.cervicalScreeningData.reasonBreakdown[reason] =
            (aggregated.cervicalScreeningData.reasonBreakdown[reason] || 0) + 1;
        });
      }
    }

    // STCs - per doctor
    aggregated.stc += parseFloat(monthData.payments["Special Type/OOH/SS/H1N1"] || 0);

    // NEW: Aggregate STC detailed data from PCRS PDFs
    if (monthData.stcDetails && monthData.stcDetails.totalClaims > 0) {
      const stc = monthData.stcDetails;

      // Add all individual claims
      if (stc.claims && stc.claims.length > 0) {
        aggregated.stcDetails.claims.push(...stc.claims);
      }

      // Aggregate by code
      if (stc.byCode) {
        Object.entries(stc.byCode).forEach(([code, data]) => {
          if (!aggregated.stcDetails.byCode[code]) {
            aggregated.stcDetails.byCode[code] = { count: 0, total: 0 };
          }
          aggregated.stcDetails.byCode[code].count += data.count || 0;
          aggregated.stcDetails.byCode[code].total += data.total || 0;
        });
      }

      aggregated.stcDetails.totalAmount += stc.totalAmount || 0;
      aggregated.stcDetails.totalClaims += stc.totalClaims || 0;
    }

    // Calculate total
    Object.values(monthData.payments).forEach(amount => {
      aggregated.totalPCRS += parseFloat(amount || 0);
    });

    console.log(`✓ Added payments for ${doctor} - ${monthKey}: Capitation €${monthData.payments["Capitation Payment/Supplementary Allowance"] || 0}`);
  });

  // Aggregate PCRS demographics (use latest data per doctor)
  // We want the most recent demographic data for each panel
  const latestDemographicsByDoctor = new Map();

  paymentAnalysisData.forEach(monthData => {
    if (!monthData.demographics) return;

    const doctor = getPanelKey(monthData);
    const monthKey = `${monthData.year}-${monthData.month}`;

    // Keep track of the latest data for each doctor
    if (!latestDemographicsByDoctor.has(doctor)) {
      latestDemographicsByDoctor.set(doctor, { monthKey, data: monthData });
    } else {
      // Compare dates to keep the latest
      const existing = latestDemographicsByDoctor.get(doctor);
      if (monthKey > existing.monthKey) {
        latestDemographicsByDoctor.set(doctor, { monthKey, data: monthData });
      }
    }
  });

  // Sum demographics from each doctor's latest data
  latestDemographicsByDoctor.forEach(({ data, monthKey }, doctorKey) => {
    console.log(`📊 Demographics for ${doctorKey} (${monthKey}):`, {
      totalUnder6: data.demographics?.totalUnder6,
      under6Male: data.demographics?.under6Male,
      under6Female: data.demographics?.under6Female,
      total70Plus: data.demographics?.total70Plus
    });
    if (data.demographics) {
      // Under 6 demographics
      aggregated.pcrsDemographics.totalUnder6 += data.demographics.totalUnder6 || 0;
      aggregated.pcrsDemographics.under6Male += data.demographics.under6Male || 0;
      aggregated.pcrsDemographics.under6Female += data.demographics.under6Female || 0;
      // Over 70 demographics
      aggregated.pcrsDemographics.total70Plus += data.demographics.total70Plus || 0;
      aggregated.pcrsDemographics.nursingHome70Plus += data.demographics.nursingHome70Plus || 0;
      aggregated.pcrsDemographics.stateMed70Plus += data.demographics.stateMed70Plus || 0;
      aggregated.pcrsDemographics.total70PlusAllCategories += data.demographics.total70PlusAllCategories || 0;
    }
    if (data.panelSize) {
      aggregated.pcrsDemographics.panelSize += data.panelSize;
      aggregated.pcrsDemographics.panelSizeByDoctor[doctorKey] = data.panelSize;
    }
  });

  console.log('👥 PCRS Demographics aggregated:', aggregated.pcrsDemographics);

  console.log(`📅 Processed ${uniqueMonths} unique months from ${paymentAnalysisData.length} data entries`);

  // Calculate data completeness
  // Count unique panels from PCRS data itself (authoritative source)
  const numPanels = doctorMonths.size || 1;

  // Expected PDFs = number of partners/panels × 12 months
  const expectedPDFs = numPanels * 12;
  const actualPDFs = paymentAnalysisData.length;
  const isDataComplete = actualPDFs >= expectedPDFs;

  console.log(`📊 Data completeness: ${actualPDFs}/${expectedPDFs} PDFs (${numPanels} panels detected from PCRS data × 12 months)`);

  console.log('✅ Aggregated PCRS payments from', uniqueMonths, 'unique months');
  console.log('💰 Payment breakdown:', {
    capitation: aggregated.capitation,
    practiceSupport: aggregated.practiceSupport,
    leavePayments: aggregated.leavePayments,
    diseaseManagement: aggregated.diseaseManagement,
    cervicalCheck: aggregated.cervicalCheck,
    stc: aggregated.stc,
    totalPCRS: aggregated.totalPCRS
  });

  // Log cervical screening summary if data was found
  if (aggregated.cervicalScreeningData.totalSmears > 0) {
    console.log('🔬 Cervical screening summary:', {
      totalSmears: aggregated.cervicalScreeningData.totalSmears,
      smearsPaid: aggregated.cervicalScreeningData.smearsPaid,
      smearsZeroPayment: aggregated.cervicalScreeningData.smearsZeroPayment,
      reasonBreakdown: aggregated.cervicalScreeningData.reasonBreakdown
    });
  }

  // Log STC details summary if data was found
  if (aggregated.stcDetails.totalClaims > 0) {
    console.log('📋 STC details summary:', {
      totalClaims: aggregated.stcDetails.totalClaims,
      totalAmount: aggregated.stcDetails.totalAmount,
      uniqueCodes: Object.keys(aggregated.stcDetails.byCode).length,
      byCode: aggregated.stcDetails.byCode
    });
  }

  return {
    ...aggregated,
    uniqueMonths,
    numPanels,
    expectedPDFs,
    actualPDFs,
    isDataComplete
  };
}

/**
 * Aggregate Practice Subsidy data from PCRS PDFs
 * Extracts weighted panel, staff details, and calculates potential issues
 * @param {Array} paymentAnalysisData - Parsed PCRS PDF data
 * @returns {Object} Aggregated practice subsidy data
 */
export function aggregatePracticeSubsidyData(paymentAnalysisData) {
  console.log('🔍 Aggregating Practice Subsidy data...');

  const result = {
    weightedPanel: 0,
    staff: [],              // Aggregated staff from all panels
    staffByPanel: new Map(), // Staff grouped by panel
    issues: [],             // Detected issues
    panelFactor: 0,
    potentialSubsidy: 0,
    actualSubsidy: 0,
    unclaimedSubsidy: 0
  };

  if (!paymentAnalysisData || paymentAnalysisData.length === 0) {
    console.warn('⚠️ No payment analysis data available for Practice Subsidy aggregation');
    return result;
  }

  // Get the number of panels/GPs
  const numGPs = getUniquePanelCount(paymentAnalysisData);

  // Group by panel and get the latest data for each
  const latestByPanel = new Map();

  paymentAnalysisData.forEach(entry => {
    if (!entry.practiceSubsidy) return;

    // Use doctorNumber first (official PCRS identifier), fall back to doctor name
    let panelKey = 'default';
    if (entry.doctorNumber && entry.doctorNumber.trim() && entry.doctorNumber !== '00000') {
      panelKey = entry.doctorNumber.trim();
    } else if (entry.doctor && entry.doctor.trim()) {
      panelKey = entry.doctor.toUpperCase().replace(/^DR\.?\s*/i, '').replace(/\s+/g, ' ').trim();
    }

    const entryDate = new Date(`${entry.year}-${getMonthNumber(entry.month)}-01`);

    if (!latestByPanel.has(panelKey) || entryDate > latestByPanel.get(panelKey).date) {
      latestByPanel.set(panelKey, {
        date: entryDate,
        practiceSubsidy: entry.practiceSubsidy,
        panelKey: panelKey
      });
    }
  });

  // Aggregate data from all panels
  let totalWeightedPanel = 0;
  const allStaff = [];
  const staffSeen = new Set(); // Track staff to avoid duplicates
  const panelWeights = []; // Track individual panel weights for logging

  latestByPanel.forEach((data, panelKey) => {
    const subsidy = data.practiceSubsidy;

    // Sum weighted panel across all panels (each GP panel has its own weighted panel size)
    if (subsidy.weightedPanel > 0) {
      totalWeightedPanel += subsidy.weightedPanel;
      panelWeights.push({ panel: panelKey, weight: subsidy.weightedPanel });
    }

    // Collect staff from each panel (avoiding duplicates)
    if (subsidy.staff && subsidy.staff.length > 0) {
      subsidy.staff.forEach(staffMember => {
        const staffKey = `${staffMember.surname}-${staffMember.firstName}`;
        if (!staffSeen.has(staffKey)) {
          staffSeen.add(staffKey);
          allStaff.push({
            ...staffMember,
            sourcePanel: panelKey
          });
        }
      });
      result.staffByPanel.set(panelKey, subsidy.staff);
    }
  });

  result.weightedPanel = totalWeightedPanel;
  result.staff = allStaff;
  result.panelWeights = panelWeights; // Store individual panel weights for display

  console.log(`📊 Practice Subsidy aggregation: Total Weighted Panel = ${totalWeightedPanel} (sum of ${panelWeights.length} panels)`);
  if (panelWeights.length > 0) {
    console.log(`   Individual panels:`, panelWeights.map(p => `${p.panel}: ${p.weight}`).join(', '));
  }

  // Calculate panel factor for subsidies
  if (totalWeightedPanel > 0 && numGPs > 0) {
    const panelCalc = calculatePanelFactorWithIncrements(totalWeightedPanel, numGPs);
    result.panelFactor = panelCalc.factor;
    result.panelFactorExplanation = panelCalc.explanation;

    console.log(`📊 Panel factor: ${(panelCalc.factor * 100).toFixed(0)}% (${panelCalc.explanation})`);
  }

  // Calculate potential subsidies for each staff member
  let totalPotentialSubsidy = 0;

  result.staff.forEach(staff => {
    if (staff.staffType && staff.staffType !== 'unknown') {
      const potentialAmount = calculateStaffSubsidy(
        staff.staffType,
        staff.incrementPoint,
        staff.weeklyHours,
        result.panelFactor
      );
      staff.potentialSubsidy = potentialAmount;
      totalPotentialSubsidy += potentialAmount;
    }
  });

  result.potentialSubsidy = totalPotentialSubsidy;

  // Compare to actual Practice Support payments from aggregated data
  const actualSubsidy = paymentAnalysisData.reduce((sum, entry) => {
    return sum + parseFloat(entry.payments?.["Practice Support Subsidy"] || 0);
  }, 0);

  result.actualSubsidy = actualSubsidy;
  result.unclaimedSubsidy = Math.max(0, totalPotentialSubsidy - actualSubsidy);

  console.log(`💰 Practice Subsidy: Potential = €${totalPotentialSubsidy}, Actual = €${actualSubsidy}, Unclaimed = €${result.unclaimedSubsidy}`);

  return result;
}

/**
 * Analyze Practice Support and detect issues with staff subsidies
 * @param {Array} paymentAnalysisData - Parsed PCRS PDF data
 * @param {Object} healthCheckData - User-provided health check data (includes staff experience)
 * @returns {Object} Analysis results with issues and recommendations
 */
export function analyzePracticeSupport(paymentAnalysisData, healthCheckData = {}) {
  console.log('🔍 Analyzing Practice Support...');

  const subsidyData = aggregatePracticeSubsidyData(paymentAnalysisData);
  const userStaffData = healthCheckData.staffDetails || []; // User-provided staff details with years experience

  const result = {
    ...subsidyData,
    staffAnalysis: [],
    issues: [],
    recommendations: []
  };

  // Analyze each staff member
  result.staff.forEach(pdfStaff => {
    const analysis = {
      ...pdfStaff,
      issues: [],
      potentialGain: 0
    };

    // Try to find matching user-provided data for this staff member
    const userStaff = userStaffData.find(u =>
      u.firstName?.toLowerCase() === pdfStaff.firstName?.toLowerCase() &&
      u.surname?.toLowerCase() === pdfStaff.surname?.toLowerCase()
    );

    // If we have user data with years of experience, check increment point
    if (userStaff && userStaff.yearsExperience !== undefined) {
      const staffMemberForCheck = {
        staffType: pdfStaff.staffType || userStaff.staffType,
        incrementPoint: pdfStaff.incrementPoint,
        weeklyHours: pdfStaff.weeklyHours,
        yearsExperience: userStaff.yearsExperience,
        hoursClaimed: pdfStaff.weeklyHours, // From PDF
        actualPayment: 0 // Would need to calculate
      };

      const staffIssues = detectPracticeSupportIssues(staffMemberForCheck, result.panelFactor);
      analysis.issues = staffIssues;

      // Sum potential gains from issues
      staffIssues.forEach(issue => {
        if (issue.potentialGain) {
          analysis.potentialGain += issue.potentialGain;
        }
      });

      // Add staff type if we got it from user
      if (!analysis.staffType || analysis.staffType === 'unknown') {
        analysis.staffType = userStaff.staffType;
      }
    }

    // Check if hours worked > hours claimed (if user provided actual hours)
    if (userStaff && userStaff.actualHoursWorked && userStaff.actualHoursWorked > pdfStaff.weeklyHours) {
      const rate = getPracticeSupportRate(pdfStaff.staffType, pdfStaff.incrementPoint);
      const fullTimeHours = gmsRates.practiceSupport[pdfStaff.staffType]?.fullTimeHoursPerWeek || 39;
      const currentHoursFactor = pdfStaff.weeklyHours / fullTimeHours;
      const potentialHoursFactor = Math.min(userStaff.actualHoursWorked / fullTimeHours, 1);
      const potentialGain = Math.round(rate * (potentialHoursFactor - currentHoursFactor) * result.panelFactor);

      if (potentialGain > 100) {
        analysis.issues.push({
          type: 'UNDER_CLAIMED_HOURS',
          severity: 'medium',
          message: `Working ${userStaff.actualHoursWorked} hours but only claiming ${pdfStaff.weeklyHours} hours`,
          hoursClaimed: pdfStaff.weeklyHours,
          hoursWorked: userStaff.actualHoursWorked,
          potentialGain,
          recommendation: `Update PCRS to claim ${Math.min(userStaff.actualHoursWorked, fullTimeHours)} hours for additional €${potentialGain.toLocaleString()}/year`
        });
        analysis.potentialGain += potentialGain;
      }
    }

    result.staffAnalysis.push(analysis);

    // Collect all issues into main issues array
    analysis.issues.forEach(issue => {
      result.issues.push({
        ...issue,
        staffName: `${analysis.firstName} ${analysis.surname}`,
        staffType: analysis.staffType
      });
    });
  });

  // Generate summary recommendations
  if (result.issues.length > 0) {
    const totalPotentialGain = result.issues.reduce((sum, issue) => sum + (issue.potentialGain || 0), 0);

    const wrongIncrementIssues = result.issues.filter(i => i.type === 'WRONG_INCREMENT');
    const underClaimedHoursIssues = result.issues.filter(i => i.type === 'UNDER_CLAIMED_HOURS');

    if (wrongIncrementIssues.length > 0) {
      result.recommendations.push({
        type: 'INCREMENT_UPDATE',
        title: 'Update Staff Increment Points',
        description: `${wrongIncrementIssues.length} staff member(s) may be on incorrect increment points based on their years of experience`,
        potentialGain: wrongIncrementIssues.reduce((sum, i) => sum + (i.potentialGain || 0), 0),
        action: 'Contact PCRS to update increment points for affected staff'
      });
    }

    if (underClaimedHoursIssues.length > 0) {
      result.recommendations.push({
        type: 'HOURS_UPDATE',
        title: 'Claim Additional Working Hours',
        description: `${underClaimedHoursIssues.length} staff member(s) are working more hours than claimed`,
        potentialGain: underClaimedHoursIssues.reduce((sum, i) => sum + (i.potentialGain || 0), 0),
        action: 'Update PCRS with actual working hours for affected staff'
      });
    }

    result.totalPotentialGain = totalPotentialGain;
  }

  console.log('✅ Practice Support analysis complete:', {
    staffAnalyzed: result.staffAnalysis.length,
    issuesFound: result.issues.length,
    totalPotentialGain: result.totalPotentialGain || 0
  });

  return result;
}

/**
 * Calculate potential capitation income based on practice demographics
 * Returns both total and detailed breakdown
 */
export function calculateCapitationPotential(healthCheckData, returnBreakdown = false) {
  const { demographics } = healthCheckData;

  if (!demographics) {
    return returnBreakdown ? { total: 0, breakdown: [] } : 0;
  }

  // Calculate annual capitation for each age band (quarterly rate × 4)
  const breakdown = [
    {
      category: 'Under 6',
      count: demographics.under6 || 0,
      quarterlyRate: getCapitationRate('under6'),
      annual: Math.round((demographics.under6 || 0) * getCapitationRate('under6') * 4)
    },
    {
      category: 'Age 6-7',
      count: demographics.age6to7 || 0,
      quarterlyRate: getCapitationRate('age6to7'),
      annual: Math.round((demographics.age6to7 || 0) * getCapitationRate('age6to7') * 4)
    },
    {
      category: 'Age 8-12',
      count: demographics.age8to12 || 0,
      quarterlyRate: getCapitationRate('age8to12'),
      annual: Math.round((demographics.age8to12 || 0) * getCapitationRate('age8to12') * 4)
    },
    {
      category: 'Age 13-69',
      count: demographics.age13to69 || 0,
      quarterlyRate: getCapitationRate('age13to69'),
      annual: Math.round((demographics.age13to69 || 0) * getCapitationRate('age13to69') * 4)
    },
    {
      category: 'Over 70',
      count: demographics.over70 || 0,
      quarterlyRate: getCapitationRate('over70'),
      annual: Math.round((demographics.over70 || 0) * getCapitationRate('over70') * 4)
    },
    {
      category: 'Nursing Home',
      count: demographics.nursingHomeResidents || 0,
      quarterlyRate: gmsRates.capitation.nursingHome / 4, // Convert annual to quarterly for display
      annual: Math.round((demographics.nursingHomeResidents || 0) * gmsRates.capitation.nursingHome)
    }
  ];

  const total = breakdown.reduce((sum, item) => sum + item.annual, 0);

  if (returnBreakdown) {
    return { total, breakdown: breakdown.filter(b => b.count > 0) };
  }

  return total;
}

/**
 * Analyze Capitation Opportunities by comparing EHR data with PCRS data
 *
 * This function identifies discrepancies that may represent missed income:
 * 1. Nursing home patients: EHR shows more than PCRS (Form 903 may not be submitted)
 * 2. Under 6s: EHR shows more than PCRS (children may not be registered for GMS/DVC)
 * 3. Over 70s: EHR shows more than PCRS (patients may not have applied for GMS/DVC)
 * 4. Panel size assessment: Is the practice under-sized for its location/capacity?
 *
 * @param {Object} healthCheckData - EHR demographics from Health Check form
 * @param {Object} pcrsDemographics - Aggregated demographics from PCRS PDFs
 * @param {Object} practiceProfile - Practice profile including location, number of GPs
 * @param {number} numGPs - Number of GPs/panels detected from PCRS
 * @returns {Object} Analysis results with opportunities and recommendations
 */
export function analyzeCapitationOpportunities(healthCheckData, pcrsDemographics, practiceProfile, numGPs) {
  const { demographics } = healthCheckData;
  const registrationChecks = [];
  const opportunities = [];
  let totalPotentialValue = 0;

  if (!demographics) {
    return { registrationChecks, opportunities, totalPotentialValue, panelAssessment: null };
  }

  // ========================================
  // REGISTRATION STATUS CHECKS (Core Categories)
  // ========================================

  // 1. UNDER 6 REGISTRATION CHECK
  // PCRS capitation listing shows 0-5 age band with patient counts
  const ehrUnder6 = demographics.under6 || 0;
  const pcrsUnder6 = pcrsDemographics?.totalUnder6 || 0;
  const unregisteredUnder6 = Math.max(0, ehrUnder6 - pcrsUnder6);

  if (ehrUnder6 > 0 || pcrsUnder6 > 0) {
    if (unregisteredUnder6 > 0) {
      const potentialValue = unregisteredUnder6 * getCapitationRate('under6') * 4; // Quarterly rate x 4
      totalPotentialValue += potentialValue;

      registrationChecks.push({
        id: 'under6',
        category: 'Under 6',
        ehrCount: ehrUnder6,
        pcrsCount: pcrsUnder6,
        gap: unregisteredUnder6,
        status: 'gap',
        priority: 'high',
        statusText: `${unregisteredUnder6} unregistered`,
        potentialValue: Math.round(potentialValue),
        explanation: 'All children under 6 are entitled to free GP care via GP Visit Card.',
        action: `Register ${unregisteredUnder6} child${unregisteredUnder6 !== 1 ? 'ren' : ''} under 6 with PCRS. New babies should be registered promptly after birth.`
      });
    } else {
      registrationChecks.push({
        id: 'under6',
        category: 'Under 6',
        ehrCount: ehrUnder6,
        pcrsCount: pcrsUnder6,
        status: 'ok',
        priority: 'low',
        statusText: 'All registered ✓'
      });
    }
  } else {
    registrationChecks.push({
      id: 'under6',
      category: 'Under 6',
      ehrCount: 0,
      pcrsCount: 0,
      status: 'ok',
      priority: 'low',
      statusText: 'No patients in this category'
    });
  }

  // 2. OVER 70 REGISTRATION CHECK
  const ehrOver70 = demographics.over70 || 0;
  const pcrsOver70Total = pcrsDemographics?.total70PlusAllCategories || pcrsDemographics?.total70Plus || 0;
  const unregisteredOver70 = Math.max(0, ehrOver70 - pcrsOver70Total);

  if (ehrOver70 > 0) {
    if (unregisteredOver70 > 0) {
      const potentialValue = unregisteredOver70 * getCapitationRate('over70') * 4;
      totalPotentialValue += potentialValue;

      registrationChecks.push({
        id: 'over70',
        category: 'Over 70',
        ehrCount: ehrOver70,
        pcrsCount: pcrsOver70Total,
        gap: unregisteredOver70,
        status: 'gap',
        priority: 'high',
        statusText: `${unregisteredOver70} unregistered`,
        potentialValue: Math.round(potentialValue),
        explanation: 'All over-70s are entitled to GMS or GP Visit Card. Unregistered patients represent missed capitation.',
        action: `Help ${unregisteredOver70} patient${unregisteredOver70 !== 1 ? 's' : ''} over 70 apply for their GMS/GP Visit Card.`
      });
    } else {
      registrationChecks.push({
        id: 'over70',
        category: 'Over 70',
        ehrCount: ehrOver70,
        pcrsCount: pcrsOver70Total,
        status: 'ok',
        priority: 'low',
        statusText: 'All registered ✓'
      });
    }
  } else {
    registrationChecks.push({
      id: 'over70',
      category: 'Over 70',
      ehrCount: 0,
      status: 'ok',
      priority: 'low',
      statusText: 'No patients in this category'
    });
  }

  // 3. NURSING HOME REGISTRATION CHECK
  const ehrNursingHome = demographics.nursingHomeResidents || 0;
  const pcrsNursingHome = pcrsDemographics?.nursingHome70Plus || 0;
  const unregisteredNursingHome = Math.max(0, ehrNursingHome - pcrsNursingHome);

  if (ehrNursingHome > 0 || pcrsNursingHome > 0) {
    // Either EHR or PCRS has nursing home patients
    if (unregisteredNursingHome > 0) {
      const potentialValue = unregisteredNursingHome * gmsRates.capitation.nursingHome;
      totalPotentialValue += potentialValue;

      registrationChecks.push({
        id: 'nursingHome',
        category: 'Nursing Home',
        ehrCount: ehrNursingHome,
        pcrsCount: pcrsNursingHome,
        gap: unregisteredNursingHome,
        status: 'gap',
        priority: 'high',
        statusText: `${unregisteredNursingHome} missing Form 903`,
        potentialValue: Math.round(potentialValue),
        explanation: 'Nursing home patients registered via Form 903 receive €927/year enhanced capitation.',
        action: `Submit Form 903 for ${unregisteredNursingHome} nursing home patient${unregisteredNursingHome !== 1 ? 's' : ''}.`
      });
    } else {
      registrationChecks.push({
        id: 'nursingHome',
        category: 'Nursing Home',
        ehrCount: ehrNursingHome,
        pcrsCount: pcrsNursingHome,
        status: 'ok',
        priority: 'low',
        statusText: 'All registered ✓'
      });
    }
  } else {
    registrationChecks.push({
      id: 'nursingHome',
      category: 'Nursing Home',
      ehrCount: 0,
      pcrsCount: 0,
      status: 'ok',
      priority: 'low',
      statusText: 'No patients in this category'
    });
  }

  // ========================================
  // SPECIAL CHECK: Ages 5-8 (GP Visit Card eligible but not tracked in PCRS demographics)
  // ========================================
  const ehrAge6to7 = demographics.age6to7 || 0;
  const ehrAge8to12 = demographics.age8to12 || 0;
  // Estimate kids aged 8 (roughly 1/5 of the 8-12 band if evenly distributed)
  const estimatedAge8 = Math.round(ehrAge8to12 / 5);
  const kidsAge5to8 = ehrUnder6 + ehrAge6to7 + estimatedAge8; // Rough estimate

  const age5to8Check = {
    id: 'age5to8',
    category: 'Ages 5-8 (GP Visit Card)',
    estimatedCount: ehrAge6to7 + estimatedAge8, // 6-7 + estimated 8-year-olds
    status: 'manual_check',
    priority: 'medium',
    statusText: 'Manual EHR check recommended',
    explanation: 'Children aged 5-8 are entitled to a GP Visit Card but PCRS payment data does not break down this age group separately.',
    action: 'Run a report in your EHR to identify children aged 5-8 without valid GMS/DVC registration.',
    ehrGuidance: {
      socrates: 'Reports → Patient Lists → Age Range 5-8 → Filter by "No GMS/DVC"',
      helix: 'Query Builder → Demographics → Age 5-8 → Check GMS Status column',
      complete: 'Patient Search → Advanced → DOB range for ages 5-8 → Review card status',
      general: 'Search for patients born between 5-8 years ago and check their GMS/GP Visit Card status'
    }
  };

  // ========================================
  // OPPORTUNITIES (issues that need action)
  // ========================================

  // Add any registration gaps as opportunities
  registrationChecks.forEach(check => {
    if (check.status === 'gap' && check.potentialValue > 0) {
      opportunities.push({
        id: check.id,
        type: `${check.id.toUpperCase()}_REGISTRATION`,
        title: `${check.category} Registration Gap`,
        severity: check.priority,
        ehrCount: check.ehrCount,
        pcrsCount: check.pcrsCount,
        gap: check.gap,
        potentialValue: check.potentialValue,
        action: check.action,
        explanation: check.explanation
      });
    }
  });

  // ========================================
  // PANEL SIZE ASSESSMENT
  // ========================================
  const totalPanelSize = pcrsDemographics?.panelSize || practiceProfile?.panelSize || 0;
  const effectiveGPs = numGPs || practiceProfile?.numPartners || 1;

  const patientsPerGP = totalPanelSize / effectiveGPs;
  const maxPanelPerGP = 2000; // GMS contract maximum

  // Compute blended average annual capitation per patient from practice's actual panel mix
  // (falls back to a weighted estimate if demographics aren't available)
  let avgAnnualCapitationPerPatient;
  const panelUnder6 = pcrsDemographics?.totalUnder6 || 0;
  const panelOver70 = pcrsDemographics?.total70Plus || 0;
  if (totalPanelSize > 0 && (panelUnder6 > 0 || panelOver70 > 0)) {
    // Use the practice's own demographics to compute a blended rate
    const middleAge = Math.max(0, totalPanelSize - panelUnder6 - panelOver70);
    const totalAnnualCapitation =
      panelUnder6 * getCapitationRate('under6') * 4 +
      middleAge * getCapitationRate('age13to69') * 4 +
      panelOver70 * getCapitationRate('over70') * 4;
    avgAnnualCapitationPerPatient = totalAnnualCapitation / totalPanelSize;
  } else {
    // Fallback: blended estimate assuming ~12% under-6, 20% over-70, 68% middle
    avgAnnualCapitationPerPatient =
      0.12 * getCapitationRate('under6') * 4 +
      0.68 * getCapitationRate('age13to69') * 4 +
      0.20 * getCapitationRate('over70') * 4;
  }
  const valuePer100Patients = Math.round(100 * avgAnnualCapitationPerPatient);

  let panelAssessment = null;

  if (totalPanelSize > 0) {
    // Calculate weighted panel (over-70s count double) for subsidy context
    // Use PCRS demographics since we have them at this point
    const weightedPanel = totalPanelSize + panelOver70; // panel already includes over70 once; add again for double-counting
    const weightedPerGP = Math.round(weightedPanel / effectiveGPs);
    const fullSubsidyTarget = 1200; // weighted panel per GP for full practice support subsidy

    // Determine growth context based on weighted panel vs subsidy threshold
    const targetWeightedTotal = fullSubsidyTarget * effectiveGPs;
    const subsidyShortfall = Math.max(0, targetWeightedTotal - weightedPanel);
    const atSubsidyMax = weightedPerGP >= fullSubsidyTarget;
    const atContractMax = patientsPerGP >= maxPanelPerGP;

    // Estimate actual panel size needed to reach the weighted target
    // over70 ratio tells us how much each real patient contributes to weighted panel
    const over70Ratio = totalPanelSize > 0 ? panelOver70 / totalPanelSize : 0;
    const weightingFactor = 1 + over70Ratio; // each patient adds this much to weighted panel on average
    const targetPanelSize = Math.round(targetWeightedTotal / weightingFactor);
    const panelSizeShortfall = Math.max(0, targetPanelSize - totalPanelSize);

    let recommendation, note;
    if (atContractMax) {
      recommendation = 'Panel is at or near GMS contract capacity.';
      note = null;
    } else if (atSubsidyMax) {
      recommendation = 'Weighted panel is above the 1,200 per GP threshold for full practice support subsidies. Additional patients would still increase capitation income.';
      note = `GMS contract maximum is ${maxPanelPerGP.toLocaleString()} patients per GP.`;
    } else {
      recommendation = `Weighted panel is ${weightedPerGP.toLocaleString()} per GP \u2014 below the 1,200 threshold for full practice support subsidies. Growing the panel would increase both capitation income and subsidy entitlement.`;
      note = `An estimated ${panelSizeShortfall.toLocaleString()} additional patients would bring the weighted panel to the full subsidy threshold.`;
    }

    panelAssessment = {
      currentPanelSize: totalPanelSize,
      patientsPerGP: Math.round(patientsPerGP),
      numGPs: effectiveGPs,
      maxPanelPerGP,
      weightedPanel,
      weightedPerGP,
      fullSubsidyTarget,
      targetWeightedTotal,
      targetPanelSize,
      panelSizeShortfall,
      atSubsidyMax,
      status: atContractMax ? 'healthy' : 'growth_room',
      recommendation,
      note,
      valuePer100: valuePer100Patients,
      potentialValue: atContractMax ? 0 : valuePer100Patients
    };
  }

  return {
    registrationChecks,
    age5to8Check,
    opportunities,
    totalPotentialValue: Math.round(totalPotentialValue),
    panelAssessment
  };
}

/**
 * Calculate comprehensive practice support subsidies analysis
 *
 * This function provides:
 * 1. ENTITLEMENT: Maximum subsidy based on panel size (what you COULD receive)
 * 2. CURRENT: What PCRS is currently paying (from parsed PCRS data)
 * 3. EMPLOYED: What staff hours you actually employ (from Health Check form)
 * 4. ISSUES: Increment point mismatches, underclaimed hours, hiring opportunities
 *
 * Key rules from HSE GMS Contract:
 * - A GP with weighted panel of 1,200+ gets FULL subsidy (39 hrs secretary + 39 hrs nurse)
 * - Panels < 1,200 get pro-rata subsidy in 12 increments (100-1200)
 * - Each subsidy unit = 35 hours of receptionist time AND 35 hours of nurse/PM time (PCRS max)
 * - Weighted panel = regular patients + (over 70s × 2)
 *
 * Example: 4 GPs with weighted panel of 2,941
 * - First 1,200 → 1 full subsidy unit (100%)
 * - Second 1,200 → 1 full subsidy unit (100%)
 * - Remaining 541 → 500 increment = 0.42 subsidy unit
 * - Total: 2.42 subsidy units = 94 hrs receptionists + 94 hrs nurses/PM entitlement
 */
export function calculatePracticeSupportPotential(healthCheckData, practiceProfile, paymentAnalysisData = [], returnBreakdown = false) {
  const { staff, demographics, staffDetails } = healthCheckData;
  const fullTimeHours = 35; // PCRS maximum subsidised hours per week

  // Get number of GPs from PCRS data (authoritative source)
  const numGPs = getUniquePanelCount(paymentAnalysisData);

  if (!numGPs) {
    return returnBreakdown ? {
      total: 0,
      breakdown: [],
      subsidyUnits: 0,
      weightedPanel: 0,
      numGPs: 0,
      entitlement: null,
      current: null,
      issues: [],
      opportunities: []
    } : 0;
  }

  // Calculate weighted panel: use PCRS total panel + over70 (over 70s counted double)
  // The health check form only collects under6, age6to7, over70, nursingHome — NOT age8to12 or age13to69,
  // so calculateWeightedPanel(demographics) would miss most of the panel. Instead, use the
  // authoritative PCRS total panel size and add over70 again for double-counting.
  let weightedPanel;
  const pcrsDemographics = aggregateGMSPayments(paymentAnalysisData)?.pcrsDemographics;
  const totalPanelSize = pcrsDemographics?.panelSize || 0;
  const over70Count = demographics?.over70
    || pcrsDemographics?.total70PlusAllCategories
    || pcrsDemographics?.total70Plus
    || 0;

  if (totalPanelSize > 0 && over70Count > 0) {
    // Panel already includes over70 once; add again so they count double
    weightedPanel = totalPanelSize + over70Count;
  } else if (totalPanelSize > 0) {
    weightedPanel = totalPanelSize;
  } else {
    // Fall back to the PCRS-extracted weighted panel (Total Average Weighted Panel from PDF)
    const psAggregated = aggregatePracticeSubsidyData(paymentAnalysisData);
    weightedPanel = psAggregated?.weightedPanel || 0;
    console.log(`📋 No panel size available — using PDF-extracted weighted panel: ${weightedPanel}`);
  }

  if (weightedPanel < 100) {
    return returnBreakdown ? {
      total: 0,
      breakdown: [],
      subsidyUnits: 0,
      weightedPanel,
      numGPs,
      entitlement: null,
      current: null,
      issues: [],
      opportunities: []
    } : 0;
  }

  // Calculate subsidy units available based on weighted panel and number of GPs
  const subsidyUnits = calculatePanelFactor(weightedPanel, numGPs);
  const entitledHours = Math.round(subsidyUnits * fullTimeHours);

  // =====================================================
  // 1. ENTITLEMENT: Maximum based on panel size
  // =====================================================
  const maxSecretaryRate = gmsRates.practiceSupport.secretary.rates[gmsRates.practiceSupport.secretary.maxIncrementPoint];
  const maxNurseRate = gmsRates.practiceSupport.nurse.rates[gmsRates.practiceSupport.nurse.maxIncrementPoint];
  const pmRate = gmsRates.practiceSupport.practiceManager.rate;

  const entitlement = {
    subsidyUnits,
    totalHours: entitledHours,
    receptionists: {
      hours: entitledHours,
      maxRate: maxSecretaryRate,
      maxAnnual: Math.round(subsidyUnits * maxSecretaryRate)
    },
    nursesOrPM: {
      hours: entitledHours,
      maxNurseRate: maxNurseRate,
      maxNurseAnnual: Math.round(subsidyUnits * maxNurseRate),
      pmRate: pmRate,
      pmAnnual: Math.round(subsidyUnits * pmRate)
    },
    explanation: `Based on weighted panel of ${weightedPanel.toLocaleString()} with ${numGPs} GPs, you are entitled to ${subsidyUnits.toFixed(2)} subsidy units (${entitledHours} hours each for receptionists AND nurses/practice managers).`
  };

  // =====================================================
  // 2. CURRENT: What PCRS is paying (from PCRS PDFs)
  // =====================================================
  // Step 1: Extract raw staff data from PCRS PDFs (names, increment points, weekly hours)
  // Step 2: Get role assignments from Health Check staffDetails
  // Step 3: Merge by name to determine role for each PCRS-paid staff member

  // Extract unique staff from PCRS PDFs
  const rawPCRSStaff = [];
  paymentAnalysisData.forEach(entry => {
    if (entry.practiceSubsidy?.staff) {
      entry.practiceSubsidy.staff.forEach(s => {
        // Avoid duplicates (same person across multiple months)
        const exists = rawPCRSStaff.find(ps =>
          ps.firstName?.toLowerCase() === s.firstName?.toLowerCase() &&
          ps.surname?.toLowerCase() === s.surname?.toLowerCase()
        );
        if (!exists) {
          rawPCRSStaff.push({
            firstName: s.firstName,
            surname: s.surname,
            incrementPoint: s.incrementPoint || 1,
            weeklyHours: s.weeklyHours || 0,
            staffType: s.staffType || 'unknown' // May be 'unknown' from PDF
          });
        }
      });
    }
  });

  console.log('📋 Raw PCRS staff from PDFs:', rawPCRSStaff.length, 'staff members');

  // FALLBACK: If no staff found in PCRS PDFs, use Health Check staffDetails with fromPCRS=true
  // This handles cases where PDF parsing didn't extract staff, but user has already merged data
  if (rawPCRSStaff.length === 0 && staffDetails && staffDetails.length > 0) {
    const pcrsStaffFromHealthCheck = staffDetails.filter(s => s.fromPCRS === true);
    if (pcrsStaffFromHealthCheck.length > 0) {
      console.log('📋 Using fallback: PCRS staff from Health Check (fromPCRS=true):', pcrsStaffFromHealthCheck.length);
      pcrsStaffFromHealthCheck.forEach(s => {
        rawPCRSStaff.push({
          firstName: s.firstName,
          surname: s.surname,
          incrementPoint: s.incrementPoint || 1,
          weeklyHours: s.weeklyHours || 0,
          staffType: s.staffType || 'unknown'
        });
      });
    }
  }

  // Get role assignments from Health Check staffDetails
  const healthCheckStaff = staffDetails || [];

  // Merge: For each PCRS staff member, find their role from Health Check
  const pcrsStaffWithRoles = rawPCRSStaff.map(pcrsStaff => {
    // Find matching staff in Health Check by name
    const healthCheckMatch = healthCheckStaff.find(hc =>
      hc.firstName?.toLowerCase() === pcrsStaff.firstName?.toLowerCase() &&
      hc.surname?.toLowerCase() === pcrsStaff.surname?.toLowerCase()
    );

    if (healthCheckMatch) {
      // Use role from Health Check, but hours/increment from PCRS
      return {
        ...pcrsStaff,
        staffType: healthCheckMatch.staffType || pcrsStaff.staffType,
        yearsExperience: healthCheckMatch.yearsExperience,
        actualHoursWorked: healthCheckMatch.actualHoursWorked
      };
    }
    return pcrsStaff;
  });

  console.log('📋 PCRS staff with roles merged:', pcrsStaffWithRoles.map(s => ({
    name: `${s.firstName} ${s.surname}`,
    role: s.staffType,
    pcrsHours: s.weeklyHours,
    increment: s.incrementPoint
  })));

  // Now categorize by role
  const pcrsSecretaries = pcrsStaffWithRoles.filter(s => s.staffType === 'secretary');
  const pcrsNurses = pcrsStaffWithRoles.filter(s => s.staffType === 'nurse');
  const pcrsPM = pcrsStaffWithRoles.filter(s => s.staffType === 'practiceManager' || s.staffType === 'manager');
  const pcrsUnknown = pcrsStaffWithRoles.filter(s => s.staffType === 'unknown' || !s.staffType);

  const pcrsSecretaryHours = pcrsSecretaries.reduce((sum, s) => sum + (s.weeklyHours || 0), 0);
  const pcrsNurseHours = pcrsNurses.reduce((sum, s) => sum + (s.weeklyHours || 0), 0);
  const pcrsPMHours = pcrsPM.reduce((sum, s) => sum + (s.weeklyHours || 0), 0);
  const pcrsUnknownHours = pcrsUnknown.reduce((sum, s) => sum + (s.weeklyHours || 0), 0);

  console.log('📋 PCRS hours by role:', {
    secretaries: `${pcrsSecretaries.length} staff, ${pcrsSecretaryHours} hrs`,
    nurses: `${pcrsNurses.length} staff, ${pcrsNurseHours} hrs`,
    practiceManagers: `${pcrsPM.length} staff, ${pcrsPMHours} hrs`,
    unknown: `${pcrsUnknown.length} staff, ${pcrsUnknownHours} hrs`
  });

  const current = {
    receptionists: {
      count: pcrsSecretaries.length,
      hours: pcrsSecretaryHours,
      staff: pcrsSecretaries
    },
    nurses: {
      count: pcrsNurses.length,
      hours: pcrsNurseHours,
      staff: pcrsNurses
    },
    practiceManager: {
      count: pcrsPM.length,
      hours: pcrsPMHours,
      staff: pcrsPM
    },
    unknown: {
      count: pcrsUnknown.length,
      hours: pcrsUnknownHours,
      staff: pcrsUnknown
    },
    totalNursesPMHours: pcrsNurseHours + pcrsPMHours,
    totalAllHours: pcrsSecretaryHours + pcrsNurseHours + pcrsPMHours + pcrsUnknownHours
  };

  // =====================================================
  // 3. EMPLOYED: What you actually employ (from Health Check)
  // =====================================================
  // This is the total hours you employ, regardless of PCRS status
  const employedSecretaries = healthCheckStaff.filter(s => s.staffType === 'secretary');
  const employedNurses = healthCheckStaff.filter(s => s.staffType === 'nurse');
  const employedPM = healthCheckStaff.filter(s => s.staffType === 'practiceManager');

  const employedSecretaryHours = employedSecretaries.reduce((sum, s) => sum + (parseFloat(s.actualHoursWorked) || parseFloat(s.weeklyHours) || 0), 0);
  const employedNurseHours = employedNurses.reduce((sum, s) => sum + (parseFloat(s.actualHoursWorked) || parseFloat(s.weeklyHours) || 0), 0);
  const employedPMHours = employedPM.reduce((sum, s) => sum + (parseFloat(s.actualHoursWorked) || parseFloat(s.weeklyHours) || 0), 0);

  const employed = {
    receptionists: {
      count: employedSecretaries.length,
      hours: employedSecretaryHours,
      staff: employedSecretaries
    },
    nurses: {
      count: employedNurses.length,
      hours: employedNurseHours,
      staff: employedNurses
    },
    practiceManager: {
      count: employedPM.length,
      hours: employedPMHours,
      staff: employedPM
    },
    totalNursesPMHours: employedNurseHours + employedPMHours
  };

  // =====================================================
  // 4. ISSUES: Identify problems (prioritized)
  // =====================================================
  const issues = [];

  // Priority 1: WRONG INCREMENT POINT (underpayment per staff member)
  // Compare PCRS increment point vs years of experience from Health Check
  // Use pcrsStaffWithRoles which has merged PCRS data with Health Check roles
  pcrsStaffWithRoles.forEach(pcrsStaff => {
    // Find matching staff in Health Check to get years of experience
    const healthCheckMatch = healthCheckStaff.find(hc =>
      hc.firstName?.toLowerCase() === pcrsStaff.firstName?.toLowerCase() &&
      hc.surname?.toLowerCase() === pcrsStaff.surname?.toLowerCase()
    );

    const yearsExperience = healthCheckMatch?.yearsExperience || pcrsStaff.yearsExperience;
    const staffType = pcrsStaff.staffType;

    if (yearsExperience !== undefined && yearsExperience > 0 && staffType && staffType !== 'unknown') {
      const correctIncrement = getCorrectIncrementPoint(staffType, yearsExperience);
      const pcrsIncrement = pcrsStaff.incrementPoint || 1;

      if (pcrsIncrement < correctIncrement) {
        const currentRate = getPracticeSupportRate(staffType, pcrsIncrement);
        const correctRate = getPracticeSupportRate(staffType, correctIncrement);
        const hoursFactor = Math.min((pcrsStaff.weeklyHours || 0) / fullTimeHours, 1);
        const annualLoss = Math.round((correctRate - currentRate) * hoursFactor);

        const roleLabel = staffType === 'secretary' ? 'receptionist' : staffType === 'practiceManager' ? 'practice manager' : staffType;

        issues.push({
          type: 'WRONG_INCREMENT',
          priority: 1,
          severity: 'critical',
          staffName: `${pcrsStaff.firstName} ${pcrsStaff.surname}`,
          staffType: staffType,
          currentIncrement: pcrsIncrement,
          correctIncrement: correctIncrement,
          yearsExperience: yearsExperience,
          annualLoss: annualLoss,
          message: `${pcrsStaff.firstName} ${pcrsStaff.surname} (${roleLabel}) is on increment point ${pcrsIncrement} but should be on point ${correctIncrement} based on ${yearsExperience} years experience.`,
          action: `Contact PCRS to update increment point from ${pcrsIncrement} to ${correctIncrement}. Potential gain: €${annualLoss.toLocaleString()}/year.`
        });
      }
    }
  });

  // Priority 2: STAFF UNDERPAID (per-staff: actual hours worked > PCRS hours, valued at their increment rate)
  // This matches the per-staff granular calculation in CategoryBreakdowns.jsx
  const employedNursesPMHours = employedNurseHours + employedPMHours;
  const pcrsNursesPMHours = pcrsNurseHours + pcrsPMHours;

  const computePerStaffUnderpaid = (pcrsStaffList) => {
    let totalUnderpaidValue = 0;
    let totalUnderpaidHours = 0;
    pcrsStaffList.forEach(staff => {
      const staffName = `${staff.firstName} ${staff.surname}`;
      const matchedDetail = healthCheckStaff.find(sd => {
        const detailName = `${sd.firstName || ''} ${sd.surname || ''}`.trim();
        return detailName.toLowerCase() === staffName.toLowerCase();
      });
      const pcrsHrs = staff.weeklyHours || 0;
      const actualHrs = matchedDetail ? (parseFloat(matchedDetail.actualHoursWorked) || 0) : 0;
      const claimable = Math.min(actualHrs, fullTimeHours);
      const gap = claimable > pcrsHrs ? claimable - pcrsHrs : 0;
      if (gap > 0) {
        totalUnderpaidHours += gap;
        const point = Math.min(staff.incrementPoint || 1, gmsRates.practiceSupport[staff.staffType]?.maxIncrementPoint || 1);
        const rate = getPracticeSupportRate(staff.staffType, point);
        totalUnderpaidValue += Math.round((gap / fullTimeHours) * rate);
      }
    });
    return { totalUnderpaidValue, totalUnderpaidHours };
  };

  const recUnderpaid = computePerStaffUnderpaid(pcrsSecretaries);
  if (recUnderpaid.totalUnderpaidValue > 0) {
    issues.push({
      type: 'UNCLAIMED_HOURS',
      priority: 2,
      severity: 'high',
      category: 'receptionists',
      employedHours: employedSecretaryHours,
      claimedHours: pcrsSecretaryHours,
      entitledHours: entitledHours,
      unclaimedHours: recUnderpaid.totalUnderpaidHours,
      potentialGain: recUnderpaid.totalUnderpaidValue,
      message: `PCRS is paying for ${pcrsSecretaryHours} receptionist hours, but you employ ${employedSecretaryHours} hours and are entitled to claim ${entitledHours} hours.`,
      action: `Update PCRS to claim ${recUnderpaid.totalUnderpaidHours} additional hours (up to your ${entitledHours} hr entitlement). Potential gain: €${recUnderpaid.totalUnderpaidValue.toLocaleString()}/year.`
    });
  }

  const nursePMUnderpaid = computePerStaffUnderpaid([...pcrsNurses, ...pcrsPM]);
  if (nursePMUnderpaid.totalUnderpaidValue > 0) {
    issues.push({
      type: 'UNCLAIMED_HOURS',
      priority: 2,
      severity: 'high',
      category: 'nurses/practiceManager',
      employedHours: employedNursesPMHours,
      claimedHours: pcrsNursesPMHours,
      entitledHours: entitledHours,
      unclaimedHours: nursePMUnderpaid.totalUnderpaidHours,
      potentialGain: nursePMUnderpaid.totalUnderpaidValue,
      message: `PCRS is paying for ${pcrsNursesPMHours} nurse/PM hours, but you employ ${employedNursesPMHours} hours and are entitled to claim ${entitledHours} hours.`,
      action: `Update PCRS to claim ${nursePMUnderpaid.totalUnderpaidHours} additional hours (up to your ${entitledHours} hr entitlement). Potential gain: €${nursePMUnderpaid.totalUnderpaidValue.toLocaleString()}/year.`
    });
  }

  // Priority 3: UNRECOGNISED STAFF (in Health Check but not on PCRS, capped by remaining entitlement)
  const eligibleRoles = ['secretary', 'nurse', 'practiceManager'];
  const unregisteredStaff = healthCheckStaff.filter(s =>
    !s.fromPCRS && eligibleRoles.includes(s.staffType) && parseFloat(s.actualHoursWorked) > 0
  );

  if (unregisteredStaff.length > 0) {
    const computeUnrecognised = (staffList, pcrsHrs, underpaidHrs) => {
      const afterFix = pcrsHrs + underpaidHrs;
      let remainingEntitlement = Math.max(0, entitledHours - afterFix);
      let totalValue = 0;
      let count = 0;
      staffList.forEach(s => {
        const hours = Math.min(parseFloat(s.actualHoursWorked) || 0, fullTimeHours);
        const claimableHrs = Math.min(hours, remainingEntitlement);
        if (claimableHrs > 0) {
          count++;
          remainingEntitlement -= claimableHrs;
          const correctPt = getCorrectIncrementPoint(s.staffType, s.yearsExperience || 1);
          const rate = getPracticeSupportRate(s.staffType, correctPt);
          totalValue += Math.round((claimableHrs / fullTimeHours) * rate);
        }
      });
      return { totalValue, count };
    };

    const unregRec = unregisteredStaff.filter(s => s.staffType === 'secretary');
    const unregNurse = unregisteredStaff.filter(s => s.staffType === 'nurse' || s.staffType === 'practiceManager');

    const recUnreg = computeUnrecognised(unregRec, pcrsSecretaryHours, recUnderpaid.totalUnderpaidHours);
    const nurseUnreg = computeUnrecognised(unregNurse, pcrsNursesPMHours, nursePMUnderpaid.totalUnderpaidHours);

    if (recUnreg.totalValue > 0) {
      issues.push({
        type: 'UNRECOGNISED_STAFF',
        priority: 3,
        severity: 'high',
        category: 'receptionists',
        count: recUnreg.count,
        potentialGain: recUnreg.totalValue,
        message: `${recUnreg.count} receptionist(s) employed but not registered with PCRS.`,
        action: `Register these staff with PCRS to claim subsidy. Potential gain: €${recUnreg.totalValue.toLocaleString()}/year.`
      });
    }
    if (nurseUnreg.totalValue > 0) {
      issues.push({
        type: 'UNRECOGNISED_STAFF',
        priority: 3,
        severity: 'high',
        category: 'nurses/practiceManager',
        count: nurseUnreg.count,
        potentialGain: nurseUnreg.totalValue,
        message: `${nurseUnreg.count} nurse/PM(s) employed but not registered with PCRS.`,
        action: `Register these staff with PCRS to claim subsidy. Potential gain: €${nurseUnreg.totalValue.toLocaleString()}/year.`
      });
    }
  }

  // =====================================================
  // 5. OPPORTUNITIES: Hiring potential (lowest priority)
  // =====================================================
  const opportunities = [];

  // Receptionist hiring opportunity
  const maxClaimableSecHours = Math.min(employedSecretaryHours, entitledHours);
  const unusedSecretaryEntitlement = entitledHours - maxClaimableSecHours;
  if (unusedSecretaryEntitlement > 0 && employedSecretaryHours < entitledHours) {
    const avgRate = gmsRates.practiceSupport.secretary.default;
    const potentialSubsidy = Math.round((unusedSecretaryEntitlement / fullTimeHours) * avgRate);

    opportunities.push({
      type: 'HIRING_OPPORTUNITY',
      category: 'receptionists',
      currentEmployedHours: employedSecretaryHours,
      entitledHours: entitledHours,
      additionalHoursAvailable: unusedSecretaryEntitlement,
      potentialSubsidy: potentialSubsidy,
      message: `You are entitled to ${entitledHours} receptionist hours but only employ ${employedSecretaryHours} hours.`,
      action: `Hiring an additional ${unusedSecretaryEntitlement} hours of receptionist time would be subsidised by approximately €${potentialSubsidy.toLocaleString()}/year.`
    });
  }

  // Nurse/PM hiring opportunity
  const maxClaimableNursePMHours = Math.min(employedNursesPMHours, entitledHours);
  const unusedNursePMEntitlement = entitledHours - maxClaimableNursePMHours;
  if (unusedNursePMEntitlement > 0 && employedNursesPMHours < entitledHours) {
    const avgRate = gmsRates.practiceSupport.nurse.default;
    const potentialSubsidy = Math.round((unusedNursePMEntitlement / fullTimeHours) * avgRate);

    opportunities.push({
      type: 'HIRING_OPPORTUNITY',
      category: 'nurses/practiceManager',
      currentEmployedHours: employedNursesPMHours,
      entitledHours: entitledHours,
      additionalHoursAvailable: unusedNursePMEntitlement,
      potentialSubsidy: potentialSubsidy,
      message: `You are entitled to ${entitledHours} nurse/PM hours but only employ ${employedNursesPMHours} hours.`,
      action: `Hiring an additional ${unusedNursePMEntitlement} hours of nursing/PM time would be subsidised by approximately €${potentialSubsidy.toLocaleString()}/year.`
    });
  }

  // =====================================================
  // 6. Calculate breakdown for display (potential based on entitlement)
  // =====================================================
  const breakdown = [];

  // Secretary subsidy - show POTENTIAL based on entitlement at max rate
  breakdown.push({
    category: 'Receptionist Subsidy (Entitlement)',
    entitledHours: entitledHours,
    currentHours: pcrsSecretaryHours,
    employedHours: employedSecretaryHours,
    rate: maxSecretaryRate,
    annual: entitlement.receptionists.maxAnnual,
    calculation: `${subsidyUnits.toFixed(2)} units × €${maxSecretaryRate.toLocaleString()} (max rate)`,
    note: 'Based on maximum increment point'
  });

  // Nurse subsidy - show POTENTIAL based on entitlement at max rate
  breakdown.push({
    category: 'Nurse/PM Subsidy (Entitlement)',
    entitledHours: entitledHours,
    currentHours: pcrsNurseHours + pcrsPMHours,
    employedHours: employedNursesPMHours,
    rate: maxNurseRate,
    annual: entitlement.nursesOrPM.maxNurseAnnual,
    calculation: `${subsidyUnits.toFixed(2)} units × €${maxNurseRate.toLocaleString()} (max nurse rate)`,
    note: 'Based on maximum increment point for nurses'
  });

  // Capacity Grant
  const eligibleGPsForGrant = Math.min(Math.floor(weightedPanel / 500), numGPs);
  if (eligibleGPsForGrant > 0) {
    const grantAmount = gmsRates.practiceSupport.capacityGrant.amount;
    const amount = eligibleGPsForGrant * grantAmount;
    breakdown.push({
      category: 'Capacity Grant',
      count: eligibleGPsForGrant,
      rate: grantAmount,
      annual: amount,
      calculation: `${eligibleGPsForGrant} eligible GPs × €${grantAmount.toLocaleString()}`
    });
    entitlement.capacityGrantEligible = true;
    entitlement.eligibleGPsForGrant = eligibleGPsForGrant;
  }

  // Total potential (at max rates)
  const totalPotential = breakdown.reduce((sum, item) => sum + item.annual, 0);

  // Sort issues by priority
  issues.sort((a, b) => a.priority - b.priority);

  // Calculate total recoverable from issues
  const totalRecoverable = issues.reduce((sum, i) => sum + (i.annualLoss || i.potentialGain || 0), 0);

  if (returnBreakdown) {
    return {
      total: totalPotential,
      breakdown,
      subsidyUnits,
      weightedPanel,
      numGPs,
      entitlement,
      current,
      employed,
      issues,
      opportunities,
      totalRecoverable,
      explanation: `Based on weighted panel of ${weightedPanel.toLocaleString()} with ${numGPs} GPs = ${subsidyUnits.toFixed(2)} subsidy units (${entitledHours} hours each for receptionists AND nurses/PM)`
    };
  }

  return totalPotential;
}

/**
 * Calculate potential and actual leave payments based on PCRS panel data
 *
 * Study Leave Calculation:
 * - Potential: numPanels × 10 days × daily rate
 * - Actual: (10 - unclaimed days) × daily rate × numPanels
 * - Unclaimed days come from latest PCRS PDF's studyLeaveBalance
 *
 * Returns both total and detailed breakdown
 */
export function calculateLeavePotential(healthCheckData, practiceProfile, paymentAnalysisData = [], returnBreakdown = false) {
  // Get number of panels from PCRS data (authoritative source)
  const numPanels = getUniquePanelCount(paymentAnalysisData);

  console.log(`📋 Leave calculation: Using ${numPanels} panels (detected from PCRS data)`);
  const dailyRate = gmsRates.leave.perDay;

  // Default entitlements (used only if PCRS data not available)
  // Study leave is flat 10 days for panels over 100
  // Annual leave varies by panel size (extracted from PCRS)
  const defaultStudyLeaveDays = gmsRates.leave.studyLeaveDays; // 10 days

  // Get leave data from PCRS PDFs - this contains actual entitlements per panel
  // The PCRS PDF shows: Entitlement | Leave Taken | Balance for both Annual and Study leave
  let totalStudyEntitlement = 0;
  let totalStudyTaken = 0;
  let totalStudyBalance = 0;
  let totalAnnualEntitlement = 0;
  let totalAnnualTaken = 0;
  let totalAnnualBalance = 0;
  let panelsWithData = 0;

  if (paymentAnalysisData && paymentAnalysisData.length > 0) {
    // Group by doctor/panel and get the latest entry for each
    // Use doctorNumber as primary key (consistent with getUniquePanelCount)
    const latestByPanel = new Map();

    paymentAnalysisData.forEach(entry => {
      // Use doctorNumber first (official PCRS identifier), fall back to doctor name
      let panelKey = 'default';
      if (entry.doctorNumber && entry.doctorNumber.trim() && entry.doctorNumber !== '00000') {
        panelKey = entry.doctorNumber.trim();
      } else if (entry.doctor && entry.doctor.trim()) {
        // Normalize name to match getUniquePanelCount
        panelKey = entry.doctor.toUpperCase().replace(/^DR\.?\s*/i, '').replace(/\s+/g, ' ').trim();
      }

      const entryDate = new Date(`${entry.year}-${getMonthNumber(entry.month)}-01`);

      if (!latestByPanel.has(panelKey) || entryDate > latestByPanel.get(panelKey).date) {
        latestByPanel.set(panelKey, {
          date: entryDate,
          // Study leave data from PCRS PDF
          studyLeaveEntitlement: entry.leaveData?.studyLeaveEntitlement || 0,
          studyLeaveTaken: entry.leaveData?.studyLeaveTaken || 0,
          studyLeaveBalance: entry.leaveData?.studyLeaveBalance || 0,
          // Annual leave data from PCRS PDF (entitlement varies by panel size)
          annualLeaveEntitlement: entry.leaveData?.annualLeaveEntitlement || 0,
          annualLeaveTaken: entry.leaveData?.annualLeaveTaken || 0,
          annualLeaveBalance: entry.leaveData?.annualLeaveBalance || 0,
          panelKey: panelKey
        });
      }
    });

    console.log(`📋 Leave calculation: Found ${latestByPanel.size} panels with leave data`);

    // Sum leave data from latest entry for each panel
    latestByPanel.forEach((data, key) => {
      console.log(`  Panel ${key}:`);
      console.log(`    Study Leave: Entitlement=${data.studyLeaveEntitlement}, Taken=${data.studyLeaveTaken}, Balance=${data.studyLeaveBalance}`);
      console.log(`    Annual Leave: Entitlement=${data.annualLeaveEntitlement}, Taken=${data.annualLeaveTaken}, Balance=${data.annualLeaveBalance}`);

      totalStudyEntitlement += data.studyLeaveEntitlement;
      totalStudyTaken += data.studyLeaveTaken;
      totalStudyBalance += data.studyLeaveBalance;
      totalAnnualEntitlement += data.annualLeaveEntitlement;
      totalAnnualTaken += data.annualLeaveTaken;
      totalAnnualBalance += data.annualLeaveBalance;
      panelsWithData++;
    });

    console.log(`📋 Study Leave totals: Entitlement=${totalStudyEntitlement}, Taken=${totalStudyTaken}, Balance=${totalStudyBalance}`);
    console.log(`📋 Annual Leave totals: Entitlement=${totalAnnualEntitlement}, Taken=${totalAnnualTaken}, Balance=${totalAnnualBalance}`);
  }

  // If we don't have PCRS data, use defaults
  // Study leave: 10 days per panel (flat rate)
  // Annual leave: Cannot estimate without PCRS data (varies by panel size)
  if (panelsWithData === 0) {
    totalStudyEntitlement = numPanels * defaultStudyLeaveDays;
    totalStudyBalance = totalStudyEntitlement; // Assume all unclaimed
    totalStudyTaken = 0;
    // For annual leave, we can't know the entitlement without PCRS data
    // Leave at 0 to avoid incorrect estimates
    totalAnnualEntitlement = 0;
    totalAnnualBalance = 0;
    totalAnnualTaken = 0;
  }

  // Calculate STUDY leave amounts using PCRS entitlement data
  const potentialStudyLeave = totalStudyEntitlement * dailyRate;
  const actualStudyLeave = totalStudyTaken * dailyRate;
  const unclaimedStudyLeaveValue = totalStudyBalance * dailyRate;

  // Calculate ANNUAL leave amounts using PCRS entitlement data
  const potentialAnnualLeave = totalAnnualEntitlement * dailyRate;
  const actualAnnualLeave = totalAnnualTaken * dailyRate;
  const unclaimedAnnualLeaveValue = totalAnnualBalance * dailyRate;

  // Combined totals
  const totalPotential = potentialStudyLeave + potentialAnnualLeave;
  const totalActual = actualStudyLeave + actualAnnualLeave;
  const totalUnclaimedDays = totalStudyBalance + totalAnnualBalance;
  const totalUnclaimedValue = unclaimedStudyLeaveValue + unclaimedAnnualLeaveValue;

  const breakdown = [
    {
      category: 'Study Leave (Entitlement)',
      leaveType: 'study',
      count: numPanels,
      days: totalStudyEntitlement,
      rate: dailyRate,
      annual: Math.round(potentialStudyLeave),
      calculation: `${totalStudyEntitlement} days entitlement × €${dailyRate.toFixed(2)}`
    },
    {
      category: 'Study Leave (Claimed)',
      leaveType: 'study',
      count: numPanels,
      daysTaken: totalStudyTaken,
      daysUnclaimed: totalStudyBalance,
      rate: dailyRate,
      annual: Math.round(actualStudyLeave),
      calculation: `${totalStudyTaken} days taken × €${dailyRate.toFixed(2)} (${totalStudyBalance} days unclaimed)`
    },
    {
      category: 'Annual Leave (Entitlement)',
      leaveType: 'annual',
      count: numPanels,
      days: totalAnnualEntitlement,
      rate: dailyRate,
      annual: Math.round(potentialAnnualLeave),
      calculation: `${totalAnnualEntitlement} days entitlement × €${dailyRate.toFixed(2)}`
    },
    {
      category: 'Annual Leave (Claimed)',
      leaveType: 'annual',
      count: numPanels,
      daysTaken: totalAnnualTaken,
      daysUnclaimed: totalAnnualBalance,
      rate: dailyRate,
      annual: Math.round(actualAnnualLeave),
      calculation: `${totalAnnualTaken} days taken × €${dailyRate.toFixed(2)} (${totalAnnualBalance} days unclaimed)`
    }
  ];

  // Add note about data source
  if (panelsWithData > 0) {
    breakdown.push({
      category: 'Data Source',
      note: `Leave entitlements from latest PCRS data (${panelsWithData} panel${panelsWithData > 1 ? 's' : ''})`,
      annual: 0,
      isNote: true
    });
  } else {
    breakdown.push({
      category: 'Data Source',
      note: 'No PCRS leave data available - using default study leave estimate only',
      annual: 0,
      isNote: true
    });
  }

  if (returnBreakdown) {
    return {
      // Combined totals (for overall display)
      total: Math.round(totalPotential),
      actualTotal: Math.round(totalActual),
      unclaimedDays: totalUnclaimedDays,
      unclaimedValue: Math.round(totalUnclaimedValue),
      // Study Leave specific
      studyLeaveEntitlement: totalStudyEntitlement,
      studyLeavePotential: Math.round(potentialStudyLeave),
      actualStudyLeave: Math.round(actualStudyLeave),
      studyLeaveUnclaimedDays: totalStudyBalance,
      studyLeaveUnclaimedValue: Math.round(unclaimedStudyLeaveValue),
      // Annual Leave specific
      annualLeaveEntitlement: totalAnnualEntitlement,
      annualLeavePotential: Math.round(potentialAnnualLeave),
      actualAnnualLeave: Math.round(actualAnnualLeave),
      annualLeaveUnclaimedDays: totalAnnualBalance,
      annualLeaveUnclaimedValue: Math.round(unclaimedAnnualLeaveValue),
      // Breakdown
      breakdown
    };
  }

  return Math.round(totalPotential);
}

// Helper to convert month name to number
function getMonthNumber(monthName) {
  const months = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };
  return months[monthName?.toLowerCase()?.substring(0, 3)] || '01';
}

/**
 * Calculate potential disease management income
 * Returns both total and detailed breakdown
 */
export function calculateDiseaseManagementPotential(healthCheckData, returnBreakdown = false) {
  const { diseaseRegisters } = healthCheckData;

  if (!diseaseRegisters) {
    return returnBreakdown ? { total: 0, breakdown: [] } : 0;
  }

  const breakdown = [];

  // Asthma under 8
  if (diseaseRegisters.asthmaUnder8 && diseaseRegisters.asthmaUnder8 > 0) {
    const totalPerPatient = gmsRates.diseaseManagement.asthmaUnder8.registration + gmsRates.diseaseManagement.asthmaUnder8.review;
    const amount = diseaseRegisters.asthmaUnder8 * totalPerPatient;
    breakdown.push({
      category: 'Asthma (Under 8)',
      count: diseaseRegisters.asthmaUnder8,
      registrationFee: gmsRates.diseaseManagement.asthmaUnder8.registration,
      reviewFee: gmsRates.diseaseManagement.asthmaUnder8.review,
      annual: Math.round(amount),
      calculation: `${diseaseRegisters.asthmaUnder8} patients × (€${gmsRates.diseaseManagement.asthmaUnder8.registration} + €${gmsRates.diseaseManagement.asthmaUnder8.review})`
    });
  }

  // Type 2 Diabetes
  if (diseaseRegisters.type2Diabetes && diseaseRegisters.type2Diabetes > 0) {
    const totalPerPatient = gmsRates.diseaseManagement.type2Diabetes.registration + gmsRates.diseaseManagement.type2Diabetes.review;
    const amount = diseaseRegisters.type2Diabetes * totalPerPatient;
    breakdown.push({
      category: 'Type 2 Diabetes',
      count: diseaseRegisters.type2Diabetes,
      registrationFee: gmsRates.diseaseManagement.type2Diabetes.registration,
      reviewFee: gmsRates.diseaseManagement.type2Diabetes.review,
      annual: Math.round(amount),
      calculation: `${diseaseRegisters.type2Diabetes} patients × (€${gmsRates.diseaseManagement.type2Diabetes.registration} + €${gmsRates.diseaseManagement.type2Diabetes.review})`
    });
  }

  const total = breakdown.reduce((sum, item) => sum + item.annual, 0);

  if (returnBreakdown) {
    return { total, breakdown };
  }

  return total;
}

/**
 * Calculate potential cervical check income
 * Returns both total and detailed breakdown
 *
 * CervicalCheck screening intervals:
 * - Women aged 25-44: screened every 3 years
 * - Women aged 45-65: screened every 5 years
 *
 * Annual potential = (eligible 25-44 / 3) + (eligible 45-65 / 5)
 *
 * Also analyzes PCRS data to identify:
 * - Actual smears performed vs paid
 * - Zero payment reasons and how to prevent them
 */
export function calculateCervicalCheckPotential(healthCheckData, paymentAnalysisData = null, returnBreakdown = false) {
  const { cervicalCheckActivity } = healthCheckData;

  // Get PCRS cervical screening data if available
  let pcrsData = null;
  if (paymentAnalysisData && paymentAnalysisData.cervicalScreeningData) {
    pcrsData = paymentAnalysisData.cervicalScreeningData;
  }

  if (!cervicalCheckActivity && !pcrsData) {
    return returnBreakdown ? { total: 0, breakdown: [], pcrsAnalysis: null } : 0;
  }

  // Get eligible women in each age band (from health check data)
  const eligible25to44 = cervicalCheckActivity?.eligibleWomen25to44 || 0;
  const eligible45to65 = cervicalCheckActivity?.eligibleWomen45to65 || 0;
  const totalEligible = eligible25to44 + eligible45to65;

  // Calculate annual smears based on CervicalCheck screening intervals
  // Women 25-44: every 3 years = 1/3 per year
  // Women 45-65: every 5 years = 1/5 per year
  const smearsFrom25to44 = eligible25to44 / 3;
  const smearsFrom45to65 = eligible45to65 / 5;
  const targetSmears = Math.round(smearsFrom25to44 + smearsFrom45to65);

  // Use current rate for future potential calculations
  const ratePerSmear = gmsRates.cervicalCheck.perSmear;
  const potential = targetSmears * ratePerSmear;

  const breakdown = [];

  // Only add eligibility breakdown if we have health check data
  if (totalEligible > 0) {
    breakdown.push({
      category: 'Cervical Screening Potential',
      eligibleWomen: totalEligible,
      eligible25to44: eligible25to44,
      eligible45to65: eligible45to65,
      smearsFrom25to44: Math.round(smearsFrom25to44),
      smearsFrom45to65: Math.round(smearsFrom45to65),
      targetSmears: targetSmears,
      ratePerSmear: ratePerSmear,
      annual: Math.round(potential),
      calculation: `(${eligible25to44} aged 25-44 ÷ 3yrs) + (${eligible45to65} aged 45-65 ÷ 5yrs) = ${targetSmears} smears × €${ratePerSmear}`
    });
  }

  // Build PCRS analysis data if available
  let pcrsAnalysis = null;
  if (pcrsData && pcrsData.totalSmears > 0) {
    const paidRate = pcrsData.smearsPaid / pcrsData.totalSmears * 100;
    // Use period-accurate lost income if available, otherwise use current rate
    const lostIncome = pcrsData.zeroPaymentLostByRate
      ? Math.round(pcrsData.zeroPaymentLostByRate)
      : pcrsData.smearsZeroPayment * ratePerSmear;

    pcrsAnalysis = {
      totalSmearsPerformed: pcrsData.totalSmears,
      smearsPaid: pcrsData.smearsPaid,
      smearsZeroPayment: pcrsData.smearsZeroPayment,
      paidRate: Math.round(paidRate),
      totalPaidAmount: pcrsData.totalPaidAmount,
      lostIncome: Math.round(lostIncome),
      reasonBreakdown: pcrsData.reasonBreakdown || {},
      recommendations: []
    };

    // Generate recommendations based on zero payment reasons
    const reasons = pcrsData.reasonBreakdown || {};

    if (reasons['Client has completed screening'] > 0) {
      pcrsAnalysis.recommendations.push({
        reason: 'Client has completed screening',
        count: reasons['Client has completed screening'],
        advice: 'Check patient\'s CervicalCheck screening history before performing smear. These patients may have recently had a smear elsewhere.',
        preventable: true
      });
    }

    if (reasons['Too early for repeat screening'] > 0) {
      pcrsAnalysis.recommendations.push({
        reason: 'Too early for repeat screening',
        count: reasons['Too early for repeat screening'],
        advice: 'Verify patient\'s last smear date before proceeding. 25-44: every 3 years, 45-65: every 5 years.',
        preventable: true
      });
    }

    if (reasons['Client not registered'] > 0) {
      pcrsAnalysis.recommendations.push({
        reason: 'Client not registered',
        count: reasons['Client not registered'],
        advice: 'Ensure patient is registered with CervicalCheck before performing smear. Check registration status in advance.',
        preventable: true
      });
    }

    if (reasons['Duplicate submission'] > 0) {
      pcrsAnalysis.recommendations.push({
        reason: 'Duplicate submission',
        count: reasons['Duplicate submission'],
        advice: 'Check submission records to avoid duplicate claims. This may be an administrative issue.',
        preventable: true
      });
    }

    if (reasons['Client outside eligible age range'] > 0) {
      pcrsAnalysis.recommendations.push({
        reason: 'Client outside eligible age range',
        count: reasons['Client outside eligible age range'],
        advice: 'CervicalCheck covers women aged 25-65. Verify patient age before performing smear under the scheme.',
        preventable: true
      });
    }

    // Add any other unknown reasons
    Object.entries(reasons).forEach(([reason, count]) => {
      if (!pcrsAnalysis.recommendations.find(r => r.reason === reason)) {
        pcrsAnalysis.recommendations.push({
          reason: reason,
          count: count,
          advice: 'Review PCRS rejection reason and contact CervicalCheck if clarification needed.',
          preventable: false
        });
      }
    });

    // Add PCRS summary to breakdown
    breakdown.push({
      category: 'PCRS Smears Analysis',
      isAnalysis: true,
      totalPerformed: pcrsData.totalSmears,
      paid: pcrsData.smearsPaid,
      unpaid: pcrsData.smearsZeroPayment,
      paidRate: `${Math.round(paidRate)}%`,
      lostIncome: Math.round(lostIncome),
      annual: Math.round(pcrsData.totalPaidAmount), // Amount actually paid
      calculation: `${pcrsData.totalSmears} smears performed: ${pcrsData.smearsPaid} paid, ${pcrsData.smearsZeroPayment} zero payment (€${Math.round(lostIncome)} potential lost)`
    });
  }

  if (returnBreakdown) {
    return {
      total: Math.round(potential),
      breakdown,
      pcrsAnalysis
    };
  }

  return Math.round(potential);
}

/**
 * Analyze STC (Special Type Consultations) opportunities
 * Compares actual STC claims against benchmarks to identify growth opportunities
 *
 * @param {Object} actualIncome - Aggregated income data including stcDetails
 * @param {number} panelSize - Total GMS panel size
 * @param {Object} healthCheckData - Optional health check data including stcServices
 * @returns {Object} STC analysis with current activity, benchmarks, and opportunities
 */
export function analyzeSTCOpportunities(actualIncome, panelSize, healthCheckData) {
  const stcDetails = actualIncome?.stcDetails || { byCode: {}, totalAmount: 0, totalClaims: 0 };
  const stcServices = healthCheckData?.stcServices || {};

  // Build a mapping from STC code -> service id (for checking if practice offers this service)
  // This mirrors the STC_SERVICE_GROUPS structure in AreaDataCollector
  const CODE_TO_SERVICE = {
    F: 'ecg', AD: 'abpm',
    A: 'skinExcision', B: 'suturing', L: 'catheterisation', K: 'nebuliser', AL: 'phlebotomy',
    CF: 'contraceptionConsult', CL: 'contraceptionConsult',
    CG: 'larcImplantFitting', CO: 'larcImplantFitting',
    CH: 'larcCoilFitting', CM: 'larcCoilFitting',
    CI: 'larcRemoval', CJ: 'larcRemoval', CN: 'larcRemoval', CQ: 'larcRemoval', AC: 'larcRemoval',
    CK: 'larcFollowUp',
    X: 'paediatricForeignBody', Y: 'paediatricSuturing', Z: 'paediatricAbscess'
  };
  const hasServiceData = Object.keys(stcServices).length > 0;
  const stcCodes = gmsRates.stc?.codes || {};
  const benchmarks = gmsRates.stc?.benchmarks || {};
  const categories = gmsRates.stc?.categories || {};

  // Contraception benchmarks derived from collected demographic data
  // These use specific eligible populations rather than whole-panel flat rates
  //
  // LARC rates based on UK OHID data (2022/23): 44.1 insertions per 1,000 women/year
  //   - Coil (IUD/IUS): ~67.5% of LARC fittings → 30 per 1,000 (3.0%)
  //   - Implant: ~32.5% of LARC fittings → 14 per 1,000 (1.4%)
  // Age factor: over-25s skew ~75/25 toward coils; under-25s favour implants
  // Ireland's Free Contraception Scheme (17-35) is driving uptake to match/exceed UK baseline
  // CF consultation uptake: ~20% annual (covers all contraception consultations, not just LARC)
  const stcDemo = healthCheckData?.stcDemographics || {};
  const gmsFemale17to35 = parseInt(stcDemo.gmsFemale17to35) || 0;
  const gmsFemale36to44 = parseInt(stcDemo.gmsFemale36to44) || 0;
  const contraceptionBenchmarks = {};
  if (gmsFemale17to35 > 0) {
    contraceptionBenchmarks['CF'] = { expected: gmsFemale17to35 * 0.20, basis: `${gmsFemale17to35} women 17-35 × 20% consultation uptake` };
    contraceptionBenchmarks['CG'] = { expected: gmsFemale17to35 * 0.014, basis: `${gmsFemale17to35} women 17-35 × 1.4% implant rate (UK OHID 2022/23)` };
    contraceptionBenchmarks['CH'] = { expected: gmsFemale17to35 * 0.030, basis: `${gmsFemale17to35} women 17-35 × 3.0% coil rate (UK OHID 2022/23)` };
  }
  if (gmsFemale36to44 > 0) {
    contraceptionBenchmarks['CL'] = { expected: gmsFemale36to44 * 0.10, basis: `${gmsFemale36to44} GMS women 36-44 × 10% consultation uptake` };
    contraceptionBenchmarks['CO'] = { expected: gmsFemale36to44 * 0.011, basis: `${gmsFemale36to44} GMS women 36-44 × 1.1% implant rate (age-adjusted, UK OHID)` };
    contraceptionBenchmarks['CM'] = { expected: gmsFemale36to44 * 0.033, basis: `${gmsFemale36to44} GMS women 36-44 × 3.3% coil rate (age-adjusted, UK OHID)` };
  }

  // Check if we have detailed STC data (breakdown by code)
  const hasDetailedData = stcDetails.totalClaims > 0;

  // Check if we have at least the total STC payment (even without breakdown)
  // This happens when PDFs were parsed before the STC extraction feature was added
  const totalSTCPayment = actualIncome?.stc || 0;
  const hasTotalOnly = !hasDetailedData && totalSTCPayment > 0;

  // If no panel size, can't calculate benchmarks
  if (!panelSize || panelSize === 0) {
    return {
      hasData: hasDetailedData,
      hasTotalOnly,
      totalSTCPayment: Math.round(totalSTCPayment),
      currentActivity: stcDetails.byCode,
      totalClaims: stcDetails.totalClaims,
      totalAmount: stcDetails.totalAmount,
      opportunities: [],
      byCategory: {},
      panelSize: 0,
      message: 'Panel size not available - cannot calculate benchmarks'
    };
  }

  const analysis = {
    hasData: hasDetailedData,
    hasTotalOnly,
    totalSTCPayment: Math.round(totalSTCPayment),
    panelSize,
    totalClaims: stcDetails.totalClaims,
    totalAmount: Math.round(stcDetails.totalAmount),
    currentActivity: {},
    opportunities: [],
    byCategory: {},
    topPerformers: [],
    underperformers: []
  };

  // Group actual claims by category
  const categoryTotals = {};

  // Analyze each STC code
  Object.entries(stcCodes).forEach(([code, codeInfo]) => {
    const actual = stcDetails.byCode[code] || { count: 0, total: 0 };
    const benchmark = benchmarks[code];
    const contraception = contraceptionBenchmarks[code];

    // Contraception codes use demographic-derived targets when available,
    // all other codes use national flat-rate benchmarks (PCRS 2018 data)
    const expectedAnnual = contraception
      ? Math.round(contraception.expected)
      : benchmark ? Math.round((benchmark.ratePerThousand / 1000) * panelSize) : null;

    // Determine if practice has indicated they offer this service
    const serviceId = CODE_TO_SERVICE[code];
    const serviceOffered = hasServiceData ? (serviceId ? !!stcServices[serviceId] : null) : null;

    const codeAnalysis = {
      code,
      name: codeInfo.name,
      fee: codeInfo.fee,
      category: codeInfo.category,
      categoryName: categories[codeInfo.category]?.name || codeInfo.category,
      categoryColor: categories[codeInfo.category]?.color || COLORS.textMuted,
      actualCount: actual.count,
      actualTotal: Math.round(actual.total),
      expectedAnnual,
      benchmark: benchmark?.ratePerThousand || null,
      benchmarkBasis: contraception?.basis || benchmark?.basis || null,
      performance: null,
      gap: null,
      potentialValue: 0,
      serviceOffered // true = practice offers it, false = doesn't, null = not specified
    };

    // Calculate performance if we have a benchmark
    if (expectedAnnual && expectedAnnual > 0) {
      codeAnalysis.performance = Math.round((actual.count / expectedAnnual) * 100);
      codeAnalysis.gap = expectedAnnual - actual.count;

      if (codeAnalysis.gap > 0) {
        codeAnalysis.potentialValue = Math.round(codeAnalysis.gap * codeInfo.fee);
      }
    }

    analysis.currentActivity[code] = codeAnalysis;

    // Aggregate by category
    const catKey = codeInfo.category;
    if (!categoryTotals[catKey]) {
      categoryTotals[catKey] = {
        category: catKey,
        name: categories[catKey]?.name || catKey,
        color: categories[catKey]?.color || COLORS.textMuted,
        totalClaims: 0,
        totalAmount: 0,
        codes: []
      };
    }
    if (actual.count > 0) {
      categoryTotals[catKey].totalClaims += actual.count;
      categoryTotals[catKey].totalAmount += actual.total;
      categoryTotals[catKey].codes.push(code);
    }
  });

  analysis.byCategory = categoryTotals;

  // Identify opportunities (codes with gaps) - sorted by potential value
  Object.values(analysis.currentActivity)
    .filter(c => c.gap && c.gap > 0 && c.potentialValue > 100) // Minimum €100 opportunity
    .sort((a, b) => b.potentialValue - a.potentialValue)
    .forEach(opportunity => {
      analysis.opportunities.push({
        code: opportunity.code,
        name: opportunity.name,
        category: opportunity.categoryName,
        categoryColor: opportunity.categoryColor,
        currentClaims: opportunity.actualCount,
        expectedClaims: opportunity.expectedAnnual,
        gap: opportunity.gap,
        fee: opportunity.fee,
        potentialValue: opportunity.potentialValue,
        benchmark: opportunity.benchmark,
        benchmarkBasis: opportunity.benchmarkBasis,
        performance: opportunity.performance,
        serviceOffered: opportunity.serviceOffered
      });
    });

  // Identify top performers (codes where actual exceeds benchmark)
  Object.values(analysis.currentActivity)
    .filter(c => c.performance && c.performance > 100)
    .sort((a, b) => b.performance - a.performance)
    .slice(0, 5)
    .forEach(performer => {
      analysis.topPerformers.push({
        code: performer.code,
        name: performer.name,
        performance: performer.performance,
        claims: performer.actualCount,
        amount: performer.actualTotal
      });
    });

  // Identify underperformers (codes with significant gaps)
  Object.values(analysis.currentActivity)
    .filter(c => c.performance !== null && c.performance < 50 && c.expectedAnnual > 2)
    .sort((a, b) => a.performance - b.performance)
    .slice(0, 5)
    .forEach(underperformer => {
      analysis.underperformers.push({
        code: underperformer.code,
        name: underperformer.name,
        performance: underperformer.performance,
        currentClaims: underperformer.actualCount,
        expectedClaims: underperformer.expectedAnnual,
        potentialValue: underperformer.potentialValue
      });
    });

  // Calculate total potential from all opportunities
  analysis.totalPotentialValue = analysis.opportunities.reduce((sum, o) => sum + o.potentialValue, 0);

  // Generate summary recommendations - tailored based on whether practice offers the service
  analysis.recommendations = [];

  // Helper: split opportunities into offered vs not-offered for targeted recommendations
  const splitByOffered = (opps) => {
    if (!hasServiceData) return { offered: opps, notOffered: [] };
    return {
      offered: opps.filter(o => o.serviceOffered !== false),
      notOffered: opps.filter(o => o.serviceOffered === false)
    };
  };

  // Contraception opportunities
  const contraceptionOpps = analysis.opportunities.filter(o =>
    ['CF', 'CG', 'CH', 'CI', 'CJ', 'CK', 'CL', 'CM', 'CN', 'CO', 'CQ', 'AB', 'AC'].includes(o.code)
  );
  if (contraceptionOpps.length > 0) {
    const { offered, notOffered } = splitByOffered(contraceptionOpps);
    const totalContraceptionPotential = contraceptionOpps.reduce((sum, o) => sum + o.potentialValue, 0);
    const actions = [];
    if (offered.length > 0) {
      actions.push('Ensure all eligible women (17\u201344) are offered contraception consultations');
      if (offered.some(o => ['CG', 'CH', 'CO', 'CM'].includes(o.code))) {
        actions.push('Review LARC fitting volumes \u2014 your practice offers this but claims are below benchmark');
      }
    }
    if (notOffered.length > 0) {
      const notOfferedNames = [...new Set(notOffered.map(o => {
        if (['CG', 'CO'].includes(o.code)) return 'implant fitting';
        if (['CH', 'CM'].includes(o.code)) return 'coil fitting';
        if (['CI', 'CJ', 'CN', 'CQ', 'AC'].includes(o.code)) return 'LARC removal';
        return null;
      }).filter(Boolean))];
      if (notOfferedNames.length > 0) {
        actions.push(`Consider training/accreditation for: ${notOfferedNames.join(', ')}`);
      }
    }
    if (actions.length === 0) {
      actions.push('Promote LARC options (implants and coils) as highly effective contraception');
    }
    analysis.recommendations.push({
      type: 'contraception',
      title: 'Contraception Services',
      description: notOffered.length > 0 && offered.length === 0
        ? 'Your practice does not currently offer these services \u2014 consider adding them'
        : 'Increase LARC and contraception consultations',
      actions,
      potentialValue: totalContraceptionPotential,
      codes: contraceptionOpps.map(o => o.code)
    });
  }

  // Diagnostics opportunities
  const diagnosticOpps = analysis.opportunities.filter(o =>
    ['F', 'AD', 'AL', 'AM'].includes(o.code)
  );
  if (diagnosticOpps.length > 0) {
    const { offered, notOffered } = splitByOffered(diagnosticOpps);
    const totalDiagnosticPotential = diagnosticOpps.reduce((sum, o) => sum + o.potentialValue, 0);
    const actions = [];
    if (offered.some(o => o.code === 'F')) {
      actions.push('Your practice performs ECGs but claims are below benchmark \u2014 ensure all GMS ECGs are being claimed');
    } else if (notOffered.some(o => o.code === 'F')) {
      actions.push('Consider acquiring an ECG machine \u2014 routine ECGs for CVD screening in over 70s are a consistent income source');
    } else {
      actions.push('Routine ECGs for cardiovascular risk assessment in patients 70+');
    }
    if (offered.some(o => o.code === 'AD')) {
      actions.push('Your practice offers ABPM but claims are below benchmark \u2014 use for white coat hypertension and borderline readings');
    } else if (notOffered.some(o => o.code === 'AD')) {
      actions.push('Consider acquiring a 24hr ABPM monitor \u2014 white coat hypertension assessment is common and pays \u20AC60 per use');
    } else {
      actions.push('24hr ABPM for white coat hypertension and borderline readings');
    }
    analysis.recommendations.push({
      type: 'diagnostics',
      title: 'Diagnostic Procedures',
      description: notOffered.length > 0 && offered.length === 0
        ? 'Your practice does not currently offer these diagnostics \u2014 consider investing in equipment'
        : 'Increase diagnostic procedure claims',
      actions,
      potentialValue: totalDiagnosticPotential,
      codes: diagnosticOpps.map(o => o.code)
    });
  }

  // Procedures opportunities
  const procedureOpps = analysis.opportunities.filter(o =>
    ['A', 'B', 'C', 'D', 'H', 'J', 'K', 'L', 'M'].includes(o.code)
  );
  if (procedureOpps.length > 0) {
    const { offered, notOffered } = splitByOffered(procedureOpps);
    const totalProcedurePotential = procedureOpps.reduce((sum, o) => sum + o.potentialValue, 0);
    const actions = [];
    if (offered.length > 0) {
      actions.push(`Review claiming for procedures you already perform: ${offered.map(o => o.name).slice(0, 3).join(', ')}`);
    }
    if (notOffered.length > 0) {
      actions.push(`Consider adding: ${notOffered.map(o => o.name).slice(0, 3).join(', ')}`);
    }
    if (actions.length === 0) {
      actions.push('Minor surgery: skin lesions, suturing, foreign body removal');
      actions.push('Ensure adequate equipment and supplies');
    }
    analysis.recommendations.push({
      type: 'procedures',
      title: 'Clinical Procedures',
      description: notOffered.length > 0 && offered.length === 0
        ? 'Your practice does not currently perform these procedures \u2014 consider training'
        : 'Increase minor procedure claims',
      actions,
      potentialValue: totalProcedurePotential,
      codes: procedureOpps.map(o => o.code)
    });
  }

  return analysis;
}

/**
 * Analyze CDM (Chronic Disease Management) claims from STC details
 * CDM codes appear in the same PCRS section as STC but should be reported separately
 *
 * CDM Programme structure (updated 2023/24):
 *
 * 1. CDM TREATMENT PROGRAMME (Established Disease) - GMS/DVC 18+
 *    - In-surgery reviews: AO (1 condition €165), AP (2 conditions €185), AQ (3+ conditions €205)
 *    - Phone reviews (MCDM): AR (1 cond €50), AS (2 cond €55), AT (3+ cond €60)
 *    - Eligible conditions: Type 2 Diabetes, Asthma (all ages), COPD, Heart Failure, AF, IHD, Stroke/TIA
 *    - Frequency: 2 structured reviews per year
 *
 * 2. PREVENTION PROGRAMME (High Risk / Pre-Disease) - BB code €82
 *    - Hypertension: Any GMS/DVC patient 18+ with diagnosis (since Phase 3, Nov 2023)
 *    - Pre-diabetes: GMS/DVC 45+ with HbA1c 42-47 mmol/mol
 *    - High CVD Risk: GMS/DVC 45+ with QRISK3 ≥20%
 *    - Women's Health: GMS/DVC 18+ with history of Gestational DM or Pre-eclampsia
 *    - Frequency: 1 review per year
 *
 * 3. OCF (Opportunistic Case Finding) - BC code €60
 *    - GMS/DVC patients 45+ (lowered from 65+ in 2022/23)
 *    - Must have one or more risk factors: BMI≥30, Smoker, Dyslipidaemia, Family history
 *    - NOT already on CDM or Prevention Programme register
 *    - Frequency: One-off assessment
 *
 * @param {Object} actualIncome - Aggregated income data including stcDetails
 * @param {Object} healthCheckData - Health check data including disease registers
 * @returns {Object} CDM analysis with claims breakdown and growth potential
 */
export function analyzeCDMFromSTCDetails(actualIncome, healthCheckData = null) {
  const stcDetails = actualIncome?.stcDetails || { byCode: {}, totalAmount: 0, totalClaims: 0 };
  const stcCodes = gmsRates.stc?.codes || {};
  const categories = gmsRates.stc?.categories || {};

  // CDM/PP/OCF codes that appear in the STC section of PCRS statements
  // These are part of the Structured Chronic Disease Prevention & Management Programme
  // CDM: AO (1 condition), AP (2 conditions), AQ (3+ conditions)
  // MCDM: AR (1 cond phone), AS (2 cond phone), AT (3+ cond phone)
  // OCF: BC (Opportunistic Case Finding)
  // PP: BB (Prevention Programme)
  // AM: Virtual Clinics (Heart Failure)
  const CDM_CODES = ['AM', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'BB', 'BC'];

  // CDM fees for growth potential calculation
  const CDM_FEES = {
    // In-surgery review fees (weighted average based on typical distribution)
    avgInSurgeryFee: 185, // Average of AO(€165), AP(€185), AQ(€205) - weighted toward 2 conditions
    avgPhoneFee: 55,      // Average of AR(€50), AS(€55), AT(€60)
    ocfFee: 60,           // BC - OCF Assessment
    ppFee: 82,            // BB - Prevention Programme
    // Individual fees for detailed breakdown
    AO: 165, AP: 185, AQ: 205,
    AR: 50, AS: 55, AT: 60,
    BB: 82, BC: 60
  };

  const cdmAnalysis = {
    hasData: false,
    totalClaims: 0,
    totalAmount: 0,
    claims: [],  // Individual CDM code breakdowns
    byCode: {},  // { code: { count, total, name, fee, description } }
    // Growth potential based on disease registers
    growthPotential: {
      hasData: false,
      totalValue: 0,
      cdmPotential: 0,
      ocfPotential: 0,
      ppPotential: 0,
      breakdown: []
    }
  };

  // Extract CDM codes from stcDetails
  CDM_CODES.forEach(code => {
    const codeData = stcDetails.byCode[code];
    const codeInfo = stcCodes[code];

    if (codeData && codeData.count > 0) {
      cdmAnalysis.hasData = true;
      cdmAnalysis.totalClaims += codeData.count;
      cdmAnalysis.totalAmount += codeData.total;

      cdmAnalysis.byCode[code] = {
        code,
        count: codeData.count,
        total: codeData.total,
        name: codeInfo?.name || code,
        fee: codeInfo?.fee || 0,
        description: codeInfo?.description || '',
        category: codeInfo?.category || 'cdm',
        categoryName: categories[codeInfo?.category]?.name || 'Chronic Disease Management',
        categoryColor: categories[codeInfo?.category]?.color || COLORS.error
      };

      cdmAnalysis.claims.push(cdmAnalysis.byCode[code]);
    }
  });

  // Calculate growth potential from disease register data
  const diseaseRegisters = healthCheckData?.diseaseRegisters || {};
  const TARGET_UPTAKE = 0.75; // 75% target uptake rate
  const REVIEWS_PER_YEAR = 2; // Each patient should have 2 CDM reviews per year

  // Calculate actual CDM reviews (in-surgery + phone)
  const actualInSurgeryReviews = (cdmAnalysis.byCode['AO']?.count || 0) +
                                  (cdmAnalysis.byCode['AP']?.count || 0) +
                                  (cdmAnalysis.byCode['AQ']?.count || 0);
  const actualPhoneReviews = (cdmAnalysis.byCode['AR']?.count || 0) +
                              (cdmAnalysis.byCode['AS']?.count || 0) +
                              (cdmAnalysis.byCode['AT']?.count || 0);
  const actualTotalCDMReviews = actualInSurgeryReviews + actualPhoneReviews;

  const actualOCFClaims = cdmAnalysis.byCode['BC']?.count || 0;
  const actualPPClaims = cdmAnalysis.byCode['BB']?.count || 0;

  // CDM Treatment Programme - Established chronic disease (18+)
  // 7 eligible conditions: Type 2 Diabetes, Asthma, COPD, Heart Failure, AF, IHD, Stroke/TIA
  const cdmConditions = [
    { key: 'type2Diabetes', name: 'Type 2 Diabetes', patients: parseInt(diseaseRegisters.type2Diabetes) || 0 },
    { key: 'asthma', name: 'Asthma', patients: parseInt(diseaseRegisters.asthma) || parseInt(diseaseRegisters.asthmaUnder8) || 0 }, // Support both old and new field names
    { key: 'copd', name: 'COPD', patients: parseInt(diseaseRegisters.copd) || 0 },
    { key: 'heartFailure', name: 'Heart Failure', patients: parseInt(diseaseRegisters.heartFailure) || 0 },
    { key: 'atrialFibrillation', name: 'Atrial Fibrillation', patients: parseInt(diseaseRegisters.atrialFibrillation) || 0 },
    { key: 'ihd', name: 'Ischaemic Heart Disease', patients: parseInt(diseaseRegisters.ihd) || 0 },
    { key: 'stroke', name: 'Stroke/TIA', patients: parseInt(diseaseRegisters.stroke) || 0 }
  ];

  // Calculate total CDM-eligible patients (note: some patients may have multiple conditions)
  // For conservative estimate, we use the sum but recognize overlap
  const totalCDMPatients = cdmConditions.reduce((sum, c) => sum + c.patients, 0);
  const hasDiseaseData = totalCDMPatients > 0;

  // Prevention Programme eligible patients (multiple pathways since Nov 2023)
  // - Hypertension (18+) - any GMS/DVC patient with diagnosis
  // - Pre-diabetes (45+) - high risk
  // - High CVD Risk QRISK ≥20% (45+)
  // - Gestational DM history (women 18+)
  // - Pre-eclampsia history (women 18+)
  const ppConditions = [
    { key: 'hypertension', name: 'Hypertension', patients: parseInt(diseaseRegisters.hypertension) || 0 },
    { key: 'preDiabetes', name: 'Pre-Diabetes', patients: parseInt(diseaseRegisters.preDiabetes) || 0 },
    { key: 'highCVDRisk', name: 'High CVD Risk (QRISK ≥20%)', patients: parseInt(diseaseRegisters.highCVDRisk) || parseInt(diseaseRegisters.cvdRisk) || 0 }, // Support old field name
    { key: 'gestationalDMHistory', name: 'Gestational DM History', patients: parseInt(diseaseRegisters.gestationalDMHistory) || 0 },
    { key: 'preEclampsiaHistory', name: 'Pre-eclampsia History', patients: parseInt(diseaseRegisters.preEclampsiaHistory) || 0 }
  ];
  const ppEligiblePatients = ppConditions.reduce((sum, c) => sum + c.patients, 0);

  // OCF-eligible patients (45+ with risk factors, NOT on CDM/PP)
  // One-off assessment to identify undiagnosed patients at risk
  const ocfEligiblePatients = parseInt(diseaseRegisters.ocfEligible) || parseInt(diseaseRegisters.over65NoCDM) || 0; // Support old field name

  if (hasDiseaseData || ocfEligiblePatients > 0 || ppEligiblePatients > 0) {
    cdmAnalysis.growthPotential.hasData = true;

    // Expected CDM reviews = patients × 2 reviews/year × 75% uptake
    // We use a blend of in-surgery (80%) and phone (20%) for fee calculation
    const IN_SURGERY_RATIO = 0.8;
    const PHONE_RATIO = 0.2;
    const blendedFee = (CDM_FEES.avgInSurgeryFee * IN_SURGERY_RATIO) + (CDM_FEES.avgPhoneFee * PHONE_RATIO);

    // CDM Growth Potential
    if (totalCDMPatients > 0) {
      const expectedCDMReviews = Math.round(totalCDMPatients * REVIEWS_PER_YEAR * TARGET_UPTAKE);
      const cdmReviewGap = Math.max(0, expectedCDMReviews - actualTotalCDMReviews);
      const cdmGrowthValue = Math.round(cdmReviewGap * blendedFee);

      cdmAnalysis.growthPotential.cdmPotential = cdmGrowthValue;
      cdmAnalysis.growthPotential.breakdown.push({
        category: 'CDM Reviews',
        description: 'Chronic Disease Management reviews for registered patients',
        eligiblePatients: totalCDMPatients,
        expectedAnnual: expectedCDMReviews,
        actualClaims: actualTotalCDMReviews,
        gap: cdmReviewGap,
        avgFee: Math.round(blendedFee),
        potentialValue: cdmGrowthValue,
        conditions: cdmConditions.filter(c => c.patients > 0)
      });
    }

    // Prevention Programme Growth Potential (multiple eligibility pathways)
    if (ppEligiblePatients > 0) {
      // PP is once per patient per year
      const expectedPPClaims = Math.round(ppEligiblePatients * TARGET_UPTAKE);
      const ppGap = Math.max(0, expectedPPClaims - actualPPClaims);
      const ppGrowthValue = Math.round(ppGap * CDM_FEES.ppFee);

      cdmAnalysis.growthPotential.ppPotential = ppGrowthValue;
      cdmAnalysis.growthPotential.breakdown.push({
        category: 'Prevention Programme',
        code: 'BB',
        description: 'Annual review for high-risk patients (Hypertension 18+, Pre-diabetes 45+, QRISK≥20%, GDM/Pre-eclampsia history)',
        eligiblePatients: ppEligiblePatients,
        expectedAnnual: expectedPPClaims,
        actualClaims: actualPPClaims,
        gap: ppGap,
        fee: CDM_FEES.ppFee,
        potentialValue: ppGrowthValue,
        conditions: ppConditions.filter(c => c.patients > 0)
      });
    }

    // OCF Growth Potential (45+ with risk factors, NOT on CDM/PP)
    if (ocfEligiblePatients > 0) {
      // OCF is a one-off assessment per patient
      const expectedOCFClaims = Math.round(ocfEligiblePatients * TARGET_UPTAKE);
      const ocfGap = Math.max(0, expectedOCFClaims - actualOCFClaims);
      const ocfGrowthValue = Math.round(ocfGap * CDM_FEES.ocfFee);

      cdmAnalysis.growthPotential.ocfPotential = ocfGrowthValue;
      cdmAnalysis.growthPotential.breakdown.push({
        category: 'OCF Assessment',
        code: 'BC',
        description: 'One-off CVD/Diabetes screening for patients 45+ with risk factors (smoker, BMI≥30, dyslipidaemia, family history)',
        eligiblePatients: ocfEligiblePatients,
        expectedAnnual: expectedOCFClaims,
        actualClaims: actualOCFClaims,
        gap: ocfGap,
        fee: CDM_FEES.ocfFee,
        potentialValue: ocfGrowthValue
      });
    }

    // Total growth potential
    cdmAnalysis.growthPotential.totalValue =
      cdmAnalysis.growthPotential.cdmPotential +
      cdmAnalysis.growthPotential.ocfPotential +
      cdmAnalysis.growthPotential.ppPotential;
  }

  return cdmAnalysis;
}

/**
 * Calculate STC amount excluding CDM claims
 * @param {Object} actualIncome - Aggregated income data
 * @param {Object} cdmAnalysis - CDM analysis from analyzeCDMFromSTCDetails
 * @returns {number} STC amount without CDM
 */
export function calculateSTCExcludingCDM(actualIncome, cdmAnalysis) {
  // Start with the total STC payment from PCRS
  const totalSTC = actualIncome?.stc || 0;

  // Subtract CDM amount (if we have detailed breakdown)
  const cdmAmount = cdmAnalysis?.totalAmount || 0;

  // If we have detailed STC data, use the detailed calculation
  const stcDetails = actualIncome?.stcDetails || { byCode: {}, totalAmount: 0 };
  const stcCodes = gmsRates.stc?.codes || {};
  // CDM/PP/OCF codes - these are excluded from STC totals as they're reported separately
  const CDM_CODES = ['AM', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'BB', 'BC'];

  if (stcDetails.totalClaims > 0) {
    // Calculate STC total excluding CDM codes from detailed breakdown
    let stcOnlyAmount = 0;
    Object.entries(stcDetails.byCode).forEach(([code, data]) => {
      if (!CDM_CODES.includes(code)) {
        stcOnlyAmount += data.total || 0;
      }
    });
    return Math.round(stcOnlyAmount);
  }

  // Fallback: if no detailed data, return total minus estimated CDM
  return Math.round(Math.max(0, totalSTC - cdmAmount));
}

/**
 * Main analysis function - calculates all income categories
 */
export function analyzeGMSIncome(paymentAnalysisData, practiceProfile, healthCheckData) {
  // 1. Aggregate actual income from PCRS payment analysis data
  // Pass practiceProfile so we use correct number of partners for PDF expectations
  const actualIncome = aggregateGMSPayments(paymentAnalysisData, practiceProfile);

  // 2. Calculate potential income WITH BREAKDOWNS (ANNUAL figures)
  const capitationCalc = calculateCapitationPotential(healthCheckData, true);
  // Pass paymentAnalysisData so we can get panel count from PCRS data
  const practiceSupportCalc = calculatePracticeSupportPotential(healthCheckData, practiceProfile, paymentAnalysisData, true);
  // Pass paymentAnalysisData so leave calculation can get panel count and unclaimed days from PCRS data
  const leaveCalc = calculateLeavePotential(healthCheckData, practiceProfile, paymentAnalysisData, true);
  const diseaseManagementCalc = calculateDiseaseManagementPotential(healthCheckData, true);
  // Pass aggregated actualIncome which includes cervicalScreeningData from PCRS PDFs
  const cervicalCheckCalc = calculateCervicalCheckPotential(healthCheckData, actualIncome, true);

  // NEW: Analyze Practice Support with detailed staff breakdown and issue detection
  const practiceSupportAnalysis = analyzePracticeSupport(paymentAnalysisData, healthCheckData);

  // NEW: Analyze STC opportunities (comparing actual claims to benchmarks)
  // panelSize is stored in pcrsDemographics.panelSize (sum of all doctors' panels)
  const panelSize = actualIncome.pcrsDemographics?.panelSize || actualIncome.panelSize || 0;
  const stcAnalysis = analyzeSTCOpportunities(actualIncome, panelSize, healthCheckData);

  // NEW: Analyze CDM claims from STC details (CDM codes appear in STC section)
  // Pass healthCheckData to enable growth potential calculation from disease registers
  const cdmAnalysis = analyzeCDMFromSTCDetails(actualIncome, healthCheckData);

  // Calculate STC amount excluding CDM
  const stcExcludingCDM = calculateSTCExcludingCDM(actualIncome, cdmAnalysis);

  // NEW: Analyze Capitation opportunities (EHR vs PCRS comparison)
  const numGPs = getUniquePanelCount(paymentAnalysisData);
  const capitationAnalysis = analyzeCapitationOpportunities(
    healthCheckData,
    actualIncome.pcrsDemographics,
    practiceProfile,
    numGPs
  );

  // Calculate capitation potential as a RANGE:
  // - Lower bound: Actual + Unregistered patients value (achievable with admin work)
  // - Upper bound: Lower + Growth opportunities (requires panel growth)
  const registrationGapValue = capitationAnalysis.totalPotentialValue || 0;
  const panelGrowthValue = capitationAnalysis.panelAssessment?.potentialValue || 0;

  const capitationPotentialLower = actualIncome.capitation + registrationGapValue;
  const capitationPotentialUpper = capitationPotentialLower + panelGrowthValue;

  const potentialIncome = {
    capitation: capitationPotentialLower, // Use lower bound as the main "potential" figure
    capitationUpper: capitationPotentialUpper, // Upper bound including growth
    capitationRange: {
      lower: capitationPotentialLower,
      upper: capitationPotentialUpper,
      registrationGapValue,
      panelGrowthValue
    },
    // Practice Support potential as a RANGE:
    // - Lower: Actual + Issues recoverable (wrong increments, unclaimed hours)
    // - Upper: Lower + Hiring opportunities
    practiceSupport: actualIncome.practiceSupport + (practiceSupportCalc.totalRecoverable || 0),
    practiceSupportUpper: actualIncome.practiceSupport + (practiceSupportCalc.totalRecoverable || 0) +
      (practiceSupportCalc.opportunities || []).reduce((sum, o) => sum + (o.potentialSubsidy || 0), 0),
    practiceSupportRange: {
      lower: actualIncome.practiceSupport + (practiceSupportCalc.totalRecoverable || 0),
      upper: actualIncome.practiceSupport + (practiceSupportCalc.totalRecoverable || 0) +
        (practiceSupportCalc.opportunities || []).reduce((sum, o) => sum + (o.potentialSubsidy || 0), 0),
      issuesRecoverable: practiceSupportCalc.totalRecoverable || 0,
      hiringOpportunities: (practiceSupportCalc.opportunities || []).reduce((sum, o) => sum + (o.potentialSubsidy || 0), 0)
    },
    leavePayments: leaveCalc.total,
    diseaseManagement: diseaseManagementCalc.total,
    // Cervical Check potential as a RANGE:
    // - Lower: Actual + Recoverable zero payments (admin fixes)
    // - Upper: Lower + Activity growth (doing more smears)
    cervicalCheck: actualIncome.cervicalCheck + (cervicalCheckCalc.pcrsAnalysis?.lostIncome || 0),
    cervicalCheckUpper: cervicalCheckCalc.total,
    cervicalCheckRange: {
      lower: actualIncome.cervicalCheck + (cervicalCheckCalc.pcrsAnalysis?.lostIncome || 0),
      upper: cervicalCheckCalc.total,
      recoverableZeroPayments: cervicalCheckCalc.pcrsAnalysis?.lostIncome || 0,
      activityGrowth: Math.max(0, cervicalCheckCalc.total - actualIncome.cervicalCheck - (cervicalCheckCalc.pcrsAnalysis?.lostIncome || 0))
    },
    stc: stcExcludingCDM,  // STCs are activity-based, no "potential" - now excluding CDM
    // Store both values for reference
    stcIncludingCDM: actualIncome.stc,  // Original total from PCRS
    cdmFromSTC: cdmAnalysis.totalAmount,  // CDM amount extracted from STC
    // CDM potential = actual CDM income + growth potential from disease registers
    cdm: cdmAnalysis.totalAmount + (cdmAnalysis.growthPotential?.totalValue || 0)
  };

  // For leave payments, we now have actual vs potential from PCRS data
  // actualTotal includes both Study Leave and Annual Leave claimed
  const actualLeaveFromPCRS = leaveCalc.actualTotal || 0;

  // Store breakdowns for display
  const potentialBreakdowns = {
    capitation: capitationCalc.breakdown,
    // NEW: Capitation analysis (EHR vs PCRS comparison for registration gaps)
    capitationAnalysis: capitationAnalysis,
    practiceSupport: practiceSupportCalc.breakdown,
    leavePayments: leaveCalc.breakdown,
    leaveDetails: {
      // Combined totals
      unclaimedDays: leaveCalc.unclaimedDays,
      unclaimedValue: leaveCalc.unclaimedValue,
      actualTotal: leaveCalc.actualTotal,
      // Study Leave specific
      studyLeaveEntitlement: leaveCalc.studyLeaveEntitlement,
      studyLeavePotential: leaveCalc.studyLeavePotential,
      actualStudyLeave: leaveCalc.actualStudyLeave,
      studyLeaveUnclaimedDays: leaveCalc.studyLeaveUnclaimedDays,
      studyLeaveUnclaimedValue: leaveCalc.studyLeaveUnclaimedValue,
      // Annual Leave specific
      annualLeaveEntitlement: leaveCalc.annualLeaveEntitlement,
      annualLeavePotential: leaveCalc.annualLeavePotential,
      actualAnnualLeave: leaveCalc.actualAnnualLeave,
      annualLeaveUnclaimedDays: leaveCalc.annualLeaveUnclaimedDays,
      annualLeaveUnclaimedValue: leaveCalc.annualLeaveUnclaimedValue
    },
    diseaseManagement: diseaseManagementCalc.breakdown,
    cervicalCheck: cervicalCheckCalc.breakdown,
    // NEW: Cervical screening PCRS analysis (zero payments, reasons, recommendations)
    // Also includes eligible population data for calculation display
    cervicalScreeningAnalysis: {
      ...(cervicalCheckCalc.pcrsAnalysis || {}),
      // Add eligible population data from breakdown (for calculation display)
      eligible25to44: cervicalCheckCalc.breakdown?.[0]?.eligible25to44 || 0,
      eligible45to65: cervicalCheckCalc.breakdown?.[0]?.eligible45to65 || 0,
      smearsFrom25to44: cervicalCheckCalc.breakdown?.[0]?.smearsFrom25to44 || 0,
      smearsFrom45to65: cervicalCheckCalc.breakdown?.[0]?.smearsFrom45to65 || 0,
      targetSmears: cervicalCheckCalc.breakdown?.[0]?.targetSmears || 0,
    },
    // Practice Support with subsidy units
    subsidyUnits: practiceSupportCalc.subsidyUnits,
    weightedPanel: practiceSupportCalc.weightedPanel,
    numGPs: practiceSupportCalc.numGPs,
    practiceSupportExplanation: practiceSupportCalc.explanation,
    // NEW: Comprehensive Practice Support analysis from calculatePracticeSupportPotential
    entitlement: practiceSupportCalc.entitlement,
    current: practiceSupportCalc.current,
    employed: practiceSupportCalc.employed,
    issues: practiceSupportCalc.issues || [],
    opportunities: practiceSupportCalc.opportunities || [],
    totalRecoverable: practiceSupportCalc.totalRecoverable || 0,
    // Legacy practice support analysis (for backward compatibility)
    practiceSupportAnalysis: {
      weightedPanel: practiceSupportCalc.weightedPanel, // Use same source for consistency
      panelWeights: practiceSupportAnalysis.panelWeights,
      panelFactor: practiceSupportAnalysis.panelFactor,
      panelFactorExplanation: practiceSupportAnalysis.panelFactorExplanation,
      staff: practiceSupportAnalysis.staffAnalysis,
      issues: practiceSupportAnalysis.issues,
      recommendations: practiceSupportAnalysis.recommendations,
      totalPotentialGain: practiceSupportAnalysis.totalPotentialGain || 0
    },
    // NEW: STC analysis (activity by code, opportunities, recommendations)
    stcAnalysis: stcAnalysis,
    // NEW: CDM analysis (CDM claims extracted from STC section)
    cdmAnalysis: cdmAnalysis
  };

  // 3. Calculate gaps (unclaimed income)
  const unclaimed = {};
  Object.keys(potentialIncome).forEach(category => {
    const gap = potentialIncome[category] - (actualIncome[category] || 0);
    unclaimed[category] = Math.max(0, gap);  // Never negative
  });

  // 4. Calculate totals - ONLY sum actual income fields, not metadata or range objects
  const incomeFields = ['capitation', 'practiceSupport', 'leavePayments', 'diseaseManagement', 'cervicalCheck', 'stc', 'other'];
  const totalActual = incomeFields.reduce((sum, field) => sum + (actualIncome[field] || 0), 0);
  // For potential, use only the lower bound values (achievable through admin work)
  const totalPotential = incomeFields.reduce((sum, field) => sum + (potentialIncome[field] || 0), 0);
  const totalUnclaimed = incomeFields.reduce((sum, field) => sum + (unclaimed[field] || 0), 0);

  // Warn about incomplete data
  if (!actualIncome.isDataComplete) {
    console.warn(`⚠️ INCOMPLETE DATA: You have uploaded ${actualIncome.actualPDFs} PDFs but need ${actualIncome.expectedPDFs} PDFs (${actualIncome.numPanels} panels × 12 months)`);
    console.warn(`⚠️ The analysis will compare partial year actual income (${actualIncome.uniqueMonths} months) to full year potential income`);
    console.warn(`⚠️ Please upload all PCRS PDFs for the full year for accurate analysis`);
  }

  console.log(`✅ Analysis complete:`, {
    totalActual,
    totalPotential,
    totalUnclaimed,
    dataCompleteness: `${actualIncome.uniqueMonths}/12 months`,
    pdfsUploaded: `${actualIncome.actualPDFs}/${actualIncome.expectedPDFs}`
  });

  // Update actualIncome.stc to exclude CDM (store original for reference)
  actualIncome.stcIncludingCDM = actualIncome.stc;
  actualIncome.stc = stcExcludingCDM;
  actualIncome.cdmFromSTC = cdmAnalysis.totalAmount;
  // Set CDM as its own income field (actual from PCRS claims)
  actualIncome.cdm = cdmAnalysis.totalAmount;

  return {
    actualIncome,
    potentialIncome,
    potentialBreakdowns,  // NEW: Include calculation breakdowns for transparency
    unclaimed,
    totalActual,
    totalPotential,
    totalUnclaimed,
    dataCompleteness: {
      uniqueMonths: actualIncome.uniqueMonths,
      numPanels: actualIncome.numPanels,
      actualPDFs: actualIncome.actualPDFs,
      expectedPDFs: actualIncome.expectedPDFs,
      isComplete: actualIncome.isDataComplete
    },
    analysisDate: new Date().toISOString()
  };
}

/**
 * Generate recommendations based on analysis results
 * Returns { priorityRecommendations, growthOpportunities } - both sorted by potential value
 */
export function generateRecommendations(analysisResults, practiceProfile, healthCheckData, paymentAnalysisData = []) {
  const { unclaimed } = analysisResults;

  // Get number of partners from PCRS data (authoritative source)
  const numPartners = getUniquePanelCount(paymentAnalysisData);
  const priorityRecommendations = [];  // Admin fixes, registration, etc.
  const growthOpportunities = [];       // Panel growth, hiring, activity increases

  // Threshold for generating recommendations (€500 - lowered to capture more)
  const threshold = 500;

  // RECOMMENDATION 1: Capitation Registration Gaps (TOP PRIORITY)
  // Use actual data from capitation analysis (EHR vs PCRS comparison)
  const capitationAnalysis = analysisResults.potentialBreakdowns?.capitationAnalysis;
  const registrationChecks = capitationAnalysis?.registrationChecks || [];
  const registrationGaps = registrationChecks.filter(check => check.status === 'gap' && check.potentialValue > 0);

  if (registrationGaps.length > 0) {
    const actions = [];
    let totalRegistrationValue = 0;

    // Sort by potential value (highest first)
    registrationGaps.sort((a, b) => (b.potentialValue || 0) - (a.potentialValue || 0));

    registrationGaps.forEach(gap => {
      totalRegistrationValue += gap.potentialValue || 0;
      actions.push({
        action: gap.action,
        value: gap.potentialValue || 0,
        effort: 'High',
        priority: 1,
        detail: gap.explanation
      });
    });

    priorityRecommendations.push({
      id: 'capitation-registration',
      title: 'Register Unregistered GMS Patients',
      category: 'Capitation',
      potential: totalRegistrationValue,
      actions,
      type: 'priority', // Priority recommendation - admin work
      effort: 'High',
      impact: 'High',
      summary: `${registrationGaps.length} patient group${registrationGaps.length !== 1 ? 's' : ''} identified with registration gaps. These are patients already in your EHR who are not registered with PCRS.`
    });
  }

  // GROWTH: Panel Growth Opportunity
  const panelAssessment = capitationAnalysis?.panelAssessment;
  if (panelAssessment && panelAssessment.status !== 'healthy' && panelAssessment.potentialValue > threshold) {
    growthOpportunities.push({
      id: 'capitation-growth',
      title: 'Panel Growth Opportunity',
      category: 'Capitation',
      potential: panelAssessment.potentialValue,
      actions: [{
        action: panelAssessment.recommendation,
        value: panelAssessment.potentialValue,
        effort: 'Low',
        detail: panelAssessment.note || `Current panel: ${panelAssessment.patientsPerGP} patients per GP.`
      }],
      type: 'growth', // Growth opportunity - longer-term
      effort: 'Low',
      impact: 'Medium'
    });
  }

  // PRACTICE SUPPORT - Split into priority issues and growth opportunities
  const practiceBreakdowns = analysisResults.potentialBreakdowns || {};
  const psIssues = practiceBreakdowns.issues || [];
  const psOpportunities = practiceBreakdowns.opportunities || [];
  const psEntitlement = practiceBreakdowns.entitlement;

  // PRIORITY: Wrong increment points and unclaimed hours (admin fixes)
  const priorityPSActions = [];
  let priorityPSValue = 0;

  // Priority 1: Wrong increment points (immediate money being lost)
  const wrongIncrementIssues = psIssues.filter(i => i.type === 'WRONG_INCREMENT');
  wrongIncrementIssues.forEach(issue => {
    const value = issue.annualLoss || 0;
    priorityPSValue += value;
    priorityPSActions.push({
      action: `Update ${issue.staffName}'s increment point: Contact PCRS to change from point ${issue.currentIncrement} to point ${issue.correctIncrement} (based on ${issue.yearsExperience} years experience)`,
      value,
      effort: 'Low',
      detail: `This staff member is being underpaid. The PCRS system shows increment point ${issue.currentIncrement} but they should be on point ${issue.correctIncrement}.`
    });
  });

  // Priority 2: Unclaimed hours (staff working but not claiming full subsidy)
  const unclaimedHoursIssues = psIssues.filter(i => i.type === 'UNCLAIMED_HOURS');
  unclaimedHoursIssues.forEach(issue => {
    const categoryLabel = issue.category === 'receptionists' ? 'receptionist' : 'nurse/practice manager';
    const value = issue.potentialGain || 0;
    priorityPSValue += value;
    priorityPSActions.push({
      action: `Claim additional ${issue.unclaimedHours} ${categoryLabel} hours: You employ ${issue.employedHours} hours but PCRS only pays for ${issue.claimedHours} hours`,
      value,
      effort: 'Low',
      detail: `Contact PCRS to update the weekly hours claimed. You are entitled to claim up to ${issue.entitledHours} hours based on your panel size.`
    });
  });

  // Priority 3: Unrecognised staff (employed but not registered with PCRS)
  const unrecognisedStaffIssues = psIssues.filter(i => i.type === 'UNRECOGNISED_STAFF');
  unrecognisedStaffIssues.forEach(issue => {
    const categoryLabel = issue.category === 'receptionists' ? 'receptionist' : 'nurse/practice manager';
    const value = issue.potentialGain || 0;
    priorityPSValue += value;
    priorityPSActions.push({
      action: `Register ${issue.count} ${categoryLabel} staff with PCRS: These staff are employed but not receiving any subsidy`,
      value,
      effort: 'Low',
      detail: issue.action
    });
  });

  if (priorityPSActions.length > 0) {
    priorityRecommendations.push({
      id: 'practice-support-issues',
      title: 'Practice Support Subsidies - Action Required',
      category: 'Practice Support',
      potential: priorityPSValue,
      actions: priorityPSActions,
      type: 'priority',
      effort: 'Low',
      impact: 'High',
      summary: psEntitlement
        ? `Based on your panel size, you are entitled to ${psEntitlement.totalHours} hours/week each for receptionists AND nurses/PM.`
        : null
    });
  }

  // GROWTH: Hiring opportunities
  if (psOpportunities.length > 0) {
    const growthPSActions = [];
    let growthPSValue = 0;

    psOpportunities.forEach(opp => {
      const categoryLabel = opp.category === 'receptionists' ? 'receptionist' : 'nurse/practice manager';
      const value = opp.potentialSubsidy || 0;
      growthPSValue += value;
      growthPSActions.push({
        action: `Hiring opportunity: You could employ ${opp.additionalHoursAvailable} more ${categoryLabel} hours with HSE subsidy support`,
        value,
        effort: 'High',
        detail: `You are entitled to ${opp.entitledHours} hours but currently employ ${opp.currentEmployedHours} hours. Additional staff would be partially subsidised.`
      });
    });

    // Include Capacity Grant in the hiring opportunities total if eligible
    const capacityGrantAmount = psEntitlement?.capacityGrantEligible
      ? (psEntitlement.eligibleGPsForGrant || 0) * 15000
      : 0;

    growthOpportunities.push({
      id: 'practice-support-growth',
      title: 'Practice Support - Growth Opportunities',
      category: 'Practice Support',
      potential: growthPSValue + capacityGrantAmount,
      actions: growthPSActions,
      type: 'growth',
      effort: 'High',
      impact: 'Medium',
      summary: psEntitlement
        ? `You have capacity to hire additional staff with HSE subsidy support (up to €${Math.round(psEntitlement.receptionists.maxAnnual + psEntitlement.nursesOrPM.maxNurseAnnual).toLocaleString()}/year at max rates).`
        : null
    });
  }

  // PRIORITY: Study & Annual Leave (always include if there's unclaimed leave from PCRS data)
  const leaveDetails = analysisResults.potentialBreakdowns?.leaveDetails;
  const studyUnclaimedDays = leaveDetails?.studyLeaveUnclaimedDays || 0;
  const studyUnclaimedValue = leaveDetails?.studyLeaveUnclaimedValue || 0;
  const annualUnclaimedDays = leaveDetails?.annualLeaveUnclaimedDays || 0;
  const annualUnclaimedValue = leaveDetails?.annualLeaveUnclaimedValue || 0;
  const totalUnclaimedDays = studyUnclaimedDays + annualUnclaimedDays;
  const totalUnclaimedValue = studyUnclaimedValue + annualUnclaimedValue;

  // Use PCRS data if available, otherwise fall back to calculation
  const leaveValue = totalUnclaimedValue > 0 ? totalUnclaimedValue : unclaimed.leavePayments;

  if (leaveValue > 0) {
    const actions = [];

    // Add Study Leave action if unclaimed
    if (studyUnclaimedDays > 0) {
      actions.push({
        action: `Claim ${studyUnclaimedDays} unclaimed study leave day${studyUnclaimedDays !== 1 ? 's' : ''} (€${gmsRates.leave.perDay.toFixed(2)} per day)`,
        value: Math.round(studyUnclaimedValue),
        effort: 'Low',
        detail: 'Submit CME certificates and Forum MCQ records to PCRS to claim these days.'
      });
    }

    // Add Annual Leave action if unclaimed
    if (annualUnclaimedDays > 0) {
      actions.push({
        action: `Claim ${annualUnclaimedDays} unclaimed annual leave day${annualUnclaimedDays !== 1 ? 's' : ''} (€${gmsRates.leave.perDay.toFixed(2)} per day)`,
        value: Math.round(annualUnclaimedValue),
        effort: 'Low',
        detail: 'Submit annual leave claims to PCRS via the appropriate form.'
      });
    }

    // Fallback if no PCRS data
    if (studyUnclaimedDays === 0 && annualUnclaimedDays === 0) {
      actions.push({
        action: `Claim full study leave entitlement (${numPartners} panel${numPartners !== 1 ? 's' : ''} × €${gmsRates.leave.studyLeaveTotal.toLocaleString()})`,
        value: Math.round(leaveValue),
        effort: 'Low',
        detail: 'Each panel is entitled to 10 study leave days per year (€1,972).'
      });
    }

    actions.push({
      action: 'Implement monthly system for tracking and claiming leave entitlements',
      value: 0,
      effort: 'Low',
      detail: 'Proactive tracking ensures study and annual leave is claimed promptly.'
    });

    // Build summary based on what's unclaimed
    let summary = '';
    if (totalUnclaimedDays > 0) {
      const parts = [];
      if (studyUnclaimedDays > 0) {
        parts.push(`${studyUnclaimedDays} study leave day${studyUnclaimedDays !== 1 ? 's' : ''}`);
      }
      if (annualUnclaimedDays > 0) {
        parts.push(`${annualUnclaimedDays} annual leave day${annualUnclaimedDays !== 1 ? 's' : ''}`);
      }
      summary = `Based on PCRS data, you have ${parts.join(' and ')} unclaimed, worth €${Math.round(totalUnclaimedValue).toLocaleString()}.`;
    } else {
      summary = `Each panel is entitled to study leave (10 days/year) and annual leave (varies by panel size).`;
    }

    priorityRecommendations.push({
      id: 'leave-payments',
      title: 'Claim Study & Annual Leave Entitlements',
      category: 'Study & Annual Leave',
      potential: Math.round(leaveValue),
      actions,
      type: 'priority',
      effort: 'Low',
      impact: 'Medium',
      summary
    });
  }

  // GROWTH: Disease Management (requires clinical activity increase)
  // Skip this crude estimate when CDM analysis from PCRS data is available — it provides
  // a more accurate breakdown and adding both would double-count the same opportunity.
  const hasCDMGrowthData = analysisResults.potentialBreakdowns?.cdmAnalysis?.growthPotential?.hasData;
  if (!hasCDMGrowthData && unclaimed.diseaseManagement > threshold) {
    const actions = [];
    const { diseaseRegisters } = healthCheckData;

    if (diseaseRegisters?.type2Diabetes) {
      actions.push({
        action: `Ensure all ${diseaseRegisters.type2Diabetes} Type 2 Diabetes patients are registered and reviewed`,
        value: Math.round(unclaimed.diseaseManagement * 0.7),
        effort: 'Medium',
        detail: 'Registration fee: €120, Annual review: €60 per patient.'
      });
    }

    if (diseaseRegisters?.asthmaUnder8) {
      actions.push({
        action: `Register ${diseaseRegisters.asthmaUnder8} Asthma under-8 patients`,
        value: Math.round(unclaimed.diseaseManagement * 0.3),
        effort: 'Low',
        detail: 'Registration fee: €125, Annual review: €75 per patient.'
      });
    }

    growthOpportunities.push({
      id: 'disease-management',
      title: 'Maximize Disease Management Payments',
      category: 'Disease Management',
      potential: unclaimed.diseaseManagement,
      actions,
      type: 'growth',
      effort: 'Medium',
      impact: 'Medium',
      summary: 'Increase disease management income by ensuring all eligible patients are registered and reviewed.'
    });
  }

  // CERVICAL CHECK - Split into priority (zero payments) and growth (activity increase)
  const cervicalAnalysis = analysisResults.potentialBreakdowns?.cervicalScreeningAnalysis;
  const cervicalRange = analysisResults.potentialIncome?.cervicalCheckRange;

  // PRIORITY: Zero payment smears (admin issue - check before performing smear)
  if (cervicalAnalysis && cervicalAnalysis.lostIncome > 0) {
    const zeroPayments = cervicalAnalysis.smearsZeroPayment || 0;
    const actions = [];

    actions.push({
      action: `Address ${zeroPayments} smear${zeroPayments !== 1 ? 's' : ''} with zero payment`,
      value: cervicalAnalysis.lostIncome,
      effort: 'Low',
      detail: 'Review CervicalCheck registration status before performing smears to prevent future zero payments.'
    });

    // Add specific recommendations if available
    if (cervicalAnalysis.recommendations && cervicalAnalysis.recommendations.length > 0) {
      cervicalAnalysis.recommendations
        .filter(rec => rec.preventable && rec.count > 0)
        .slice(0, 3) // Top 3 reasons
        .forEach(rec => {
          actions.push({
            action: `${rec.reason}: ${rec.count} smear${rec.count !== 1 ? 's' : ''} affected`,
            value: Math.round(rec.count * gmsRates.cervicalCheck.perSmear),
            effort: 'Low',
            detail: rec.advice
          });
        });
    }

    priorityRecommendations.push({
      id: 'cervical-check-issues',
      title: 'Cervical Check - Zero Payment Issues',
      category: 'Cervical Check',
      potential: cervicalAnalysis.lostIncome,
      actions,
      type: 'priority',
      effort: 'Low',
      impact: 'Medium',
      summary: `${zeroPayments} smear${zeroPayments !== 1 ? 's' : ''} were not paid. Review CervicalCheck status before performing smears.`
    });
  }

  // GROWTH: Increase cervical screening activity
  const activityGrowthValue = cervicalRange?.activityGrowth || 0;
  if (activityGrowthValue > threshold) {
    const { cervicalCheckActivity } = healthCheckData;
    const eligible25to44 = cervicalCheckActivity?.eligibleWomen25to44 || 0;
    const eligible45to65 = cervicalCheckActivity?.eligibleWomen45to65 || 0;
    const targetSmears = Math.round((eligible25to44 / 3) + (eligible45to65 / 5));

    const aggregated = aggregateGMSPayments(paymentAnalysisData);
    const pcrsSmears = aggregated.cervicalScreeningData?.totalSmears || 0;
    const actualSmears = pcrsSmears > 0 ? pcrsSmears : (cervicalCheckActivity?.smearsPerformed || 0);

    const actions = [];

    if (actualSmears < targetSmears) {
      actions.push({
        action: `Increase smear activity from ${actualSmears} towards target of ${targetSmears} per year`,
        value: activityGrowthValue,
        effort: 'High',
        detail: 'Based on your eligible patient population.'
      });
    }

    actions.push({
      action: 'Allocate dedicated nurse time for cervical screening',
      value: 0,
      effort: 'Medium',
      detail: 'Proactive recall for eligible women and opportunistic screening during consultations.'
    });

    growthOpportunities.push({
      id: 'cervical-check-growth',
      title: 'Increase Cervical Screening Activity',
      category: 'Cervical Check',
      potential: activityGrowthValue,
      actions,
      type: 'growth',
      effort: 'High',
      impact: 'Medium',
      summary: 'Increase cervical screening activity to capture more eligible women in your patient population.'
    });
  }

  // GROWTH: STC Opportunities (activity-based, requires clinical effort)
  const stcAnalysis = analysisResults.potentialBreakdowns?.stcAnalysis;
  if (stcAnalysis && stcAnalysis.totalPotentialValue > threshold) {
    const actions = [];

    // Add top 3 STC opportunities
    const topOpportunities = (stcAnalysis.opportunities || []).slice(0, 3);
    topOpportunities.forEach(opp => {
      actions.push({
        action: `Increase ${opp.code} (${opp.name}): Currently ${opp.currentClaims} claims, benchmark suggests ~${opp.expectedClaims} for your panel`,
        value: opp.potentialValue,
        effort: 'Medium',
        detail: opp.benchmarkBasis || `Fee: €${opp.fee} per claim`
      });
    });

    if (actions.length > 0) {
      growthOpportunities.push({
        id: 'stc-opportunities',
        title: 'STC Activity Growth Opportunities',
        category: 'Special Type Consultations',
        potential: stcAnalysis.totalPotentialValue,
        actions,
        type: 'growth',
        effort: 'Medium',
        impact: 'Medium',
        summary: `${stcAnalysis.opportunities?.length || 0} STC codes below benchmark. Focus on services where you have capacity to increase activity.`
      });
    }
  }

  // GROWTH: CDM Opportunities - reuse the growth potential already calculated in cdmAnalysis
  const cdmAnalysis = analysisResults.potentialBreakdowns?.cdmAnalysis;
  if (cdmAnalysis?.growthPotential?.hasData && cdmAnalysis.growthPotential.totalValue > threshold) {
    const gp = cdmAnalysis.growthPotential;
    const actions = gp.breakdown
      .filter(item => item.gap > 0)
      .map(item => ({
        action: `${item.category}: ${item.gap} additional claims at ${item.avgFee || item.fee ? `~\u20AC${item.avgFee || item.fee}` : 'blended rate'} each`,
        value: item.potentialValue,
        effort: 'Medium',
        detail: `Eligible: ${item.eligiblePatients}, Expected: ${item.expectedAnnual}/yr, Actual: ${item.actualClaims}, Gap: ${item.gap}`
      }));

    if (actions.length > 0) {
      growthOpportunities.push({
        id: 'cdm-growth',
        title: 'CDM Programme Expansion',
        category: 'Chronic Disease Management',
        potential: gp.totalValue,
        actions,
        type: 'growth',
        effort: 'Medium',
        impact: 'High',
        summary: `Expand CDM coverage to capture more eligible patients. Current: ${cdmAnalysis.totalClaims} reviews from ${Object.keys(cdmAnalysis.byCode || {}).length} code types.`
      });
    }
  }

  // Sort both lists by potential value (highest first)
  priorityRecommendations.sort((a, b) => b.potential - a.potential);
  growthOpportunities.sort((a, b) => b.potential - a.potential);

  // Return combined structure
  return {
    priorityRecommendations,
    growthOpportunities,
    // For backward compatibility, also return combined list
    all: [...priorityRecommendations, ...growthOpportunities].sort((a, b) => b.potential - a.potential)
  };
}


// ============================================
// IMPACT TRACKING — Metric Mapping & Snapshot Extraction
// ============================================

/**
 * Maps recommendation IDs to the specific metric they target and their area.
 * Used for (a) tagging projected savings with the right metric, and
 * (b) verifying improvements in the comparison engine.
 */
export const RECOMMENDATION_METRIC_MAP = {
  'capitation-registration': { metric: 'registrationGap', areaId: 'capitation' },
  'capitation-growth':       { metric: 'panelGrowth', areaId: 'capitation' },
  'practice-support-issues': { metric: 'psIssues', areaId: 'practiceSupport' },
  'practice-support-growth': { metric: 'psHiring', areaId: 'practiceSupport' },
  'leave-payments':          { metric: 'unclaimedDays', areaId: 'leave' },
  'cervical-check-issues':   { metric: 'zeroPaymentSmears', areaId: 'cervicalCheck' },
  'cervical-check-growth':   { metric: 'smearActivity', areaId: 'cervicalCheck' },
  'stc-opportunities':       { metric: 'stcClaims', areaId: 'stc' },
  'cdm-growth':              { metric: 'cdmRegistration', areaId: 'cdm' },
  'disease-management':      { metric: 'cdmRegistration', areaId: 'cdm' },
};

/**
 * Extract per-sector snapshot metrics from analyzeGMSIncome() results.
 * Pure mapping function — no side effects. The returned object is stored
 * as `sectorMetrics` inside a snapshot when a cycle is started.
 *
 * @param {Object} analysisResults - Return value of analyzeGMSIncome()
 * @returns {Object} sectorMetrics keyed by areaId
 */
export function extractSnapshotMetrics(analysisResults) {
  if (!analysisResults) return {};

  const { actualIncome = {}, potentialBreakdowns = {}, unclaimed = {} } = analysisResults;

  // --- Leave ---
  const leaveDetails = potentialBreakdowns.leaveDetails || {};
  const leave = {
    unclaimedDays: leaveDetails.unclaimedDays || 0,
    studyLeaveUnclaimedDays: leaveDetails.studyLeaveUnclaimedDays || 0,
    annualLeaveUnclaimedDays: leaveDetails.annualLeaveUnclaimedDays || 0,
    unclaimedValue: leaveDetails.unclaimedValue || 0,
    actualTotal: leaveDetails.actualTotal || 0,
  };

  // --- Practice Support ---
  const practiceSupport = {
    totalRecoverable: potentialBreakdowns.totalRecoverable || 0,
    issueCount: (potentialBreakdowns.issues || []).length,
    issues: (potentialBreakdowns.issues || []).map(i => ({ type: i.type, staffName: i.staffName, annualLoss: i.annualLoss || i.potentialGain || 0 })),
    actualIncome: actualIncome.practiceSupport || 0,
  };

  // --- Capitation ---
  const capitationAnalysis = potentialBreakdowns.capitationAnalysis || {};
  const capitation = {
    registrationGapValue: capitationAnalysis.totalPotentialValue || 0,
    registrationChecks: (capitationAnalysis.registrationChecks || [])
      .filter(c => c.status === 'gap')
      .map(c => ({ group: c.group, gap: c.gap, value: c.potentialValue || 0 })),
    actualIncome: actualIncome.capitation || 0,
    panelSize: actualIncome.pcrsDemographics?.panelSize || 0,
  };

  // --- Cervical Check ---
  const cervicalAnalysis = potentialBreakdowns.cervicalScreeningAnalysis || {};
  const cervicalCheck = {
    totalSmears: cervicalAnalysis.totalSmears || 0,
    smearsZeroPayment: cervicalAnalysis.smearsZeroPayment || 0,
    lostIncome: cervicalAnalysis.lostIncome || 0,
    actualIncome: actualIncome.cervicalCheck || 0,
  };

  // --- STC ---
  const stcAnalysis = potentialBreakdowns.stcAnalysis || {};
  const stcByCode = {};
  if (stcAnalysis.activityByCode) {
    Object.entries(stcAnalysis.activityByCode).forEach(([code, data]) => {
      stcByCode[code] = { count: data.count || 0, total: data.total || 0 };
    });
  }
  const stc = {
    byCode: stcByCode,
    totalClaims: stcAnalysis.totalClaims || 0,
    totalAmount: actualIncome.stc || 0,
  };

  // --- CDM ---
  const cdmAnalysis = potentialBreakdowns.cdmAnalysis || {};
  const cdm = {
    totalAmount: cdmAnalysis.totalAmount || 0,
    growthPotentialValue: cdmAnalysis.growthPotential?.totalValue || 0,
    claimsByType: {},
  };
  if (cdmAnalysis.byCode) {
    Object.entries(cdmAnalysis.byCode).forEach(([code, data]) => {
      cdm.claimsByType[code] = data.count || 0;
    });
  }

  return { leave, practiceSupport, capitation, cervicalCheck, stc, cdm };
}

/**
 * Calculate a summary of projected and verified savings from the ledger.
 * @param {Array} savingsLedger - Array of savings entries
 * @returns {Object} { totalProjected, totalVerified, totalCombined, bySector, timeline }
 */
export function calculateImpactSummary(savingsLedger) {
  const AREA_IDS = ['leave', 'practiceSupport', 'capitation', 'cervicalCheck', 'stc', 'cdm'];

  const bySector = {};
  AREA_IDS.forEach(id => {
    bySector[id] = { projected: 0, verified: 0 };
  });

  let totalProjected = 0;
  let totalVerified = 0;

  (savingsLedger || []).forEach(entry => {
    const amount = entry.amount || 0;
    if (entry.type === 'projected') {
      totalProjected += amount;
      if (bySector[entry.areaId]) bySector[entry.areaId].projected += amount;
    } else if (entry.type === 'verified') {
      totalVerified += amount;
      if (bySector[entry.areaId]) bySector[entry.areaId].verified += amount;
    }
  });

  // Timeline: entries sorted chronologically
  const timeline = [...(savingsLedger || [])].sort(
    (a, b) => new Date(a.createdDate) - new Date(b.createdDate)
  );

  return {
    totalProjected: Math.round(totalProjected),
    totalVerified: Math.round(totalVerified),
    totalCombined: Math.round(totalProjected + totalVerified),
    bySector,
    timeline,
  };
}

/**
 * getHealthCheckSectionStatus — inspects profile and paymentAnalysisData to
 * determine which of the 6 GMS Health Check analysis areas have usable data.
 * Used by the GMS Optimisation Summary report to show partial-completion state.
 */
export function getHealthCheckSectionStatus(profile, paymentAnalysisData) {
  const hc = profile?.healthCheckData || {};
  const demographics = hc.demographics || {};
  const staffDetails = hc.staffDetails || [];
  const staff = hc.staff || {};
  const leave = hc.leaveClaimed || {};
  const disease = hc.diseaseRegisters || {};
  const cervical = hc.cervicalCheckActivity || {};

  const hasAnyValue = (obj) => Object.values(obj).some(v => v != null && v !== '' && v !== false && v !== 0);

  // 1. PCRS payment data (uploaded PDFs)
  const pcrsCount = paymentAnalysisData?.length || 0;
  const pcrsYears = pcrsCount > 0
    ? [...new Set(paymentAnalysisData.map(p => p.year))].sort()
    : [];

  // 2. Patient demographics (from Health Check form step 1)
  const demoValues = [demographics.under6, demographics.age6to7, demographics.age8to12, demographics.age13to69, demographics.over70];
  const demoFilledCount = demoValues.filter(v => v != null && v > 0).length;
  const totalPanel = demoValues.reduce((sum, v) => sum + (Number(v) || 0), 0);

  // 3. Practice support staff (from Health Check form step 2)
  const hasStaffDetails = staffDetails.length > 0;
  const hasLegacyStaff = hasAnyValue(staff.secretaries || {}) || hasAnyValue(staff.nurses || {}) || staff.practiceManager?.employed;

  // 4. Leave entitlements — form data OR PCRS data (PCRS statements contain leave payments,
  //    so calculateLeavePotential can derive unclaimed days from PCRS alone)
  const leaveValues = [leave.studyLeave, leave.annualLeave, leave.sickLeave, leave.maternityLeave];
  const leaveFilledCount = leaveValues.filter(v => v != null).length;

  // 5. Disease registers (from Health Check form step 3)
  const diseaseValues = [disease.asthmaUnder8, disease.type2Diabetes, disease.cvdRisk];
  const diseaseFilledCount = diseaseValues.filter(v => v != null && v > 0).length;

  // 6. Cervical screening activity
  const cervicalValues = [cervical.eligibleWomen25to44, cervical.eligibleWomen45to65, cervical.smearsPerformed];
  const cervicalFilledCount = cervicalValues.filter(v => v != null && v > 0).length;

  const sections = {
    pcrsData: {
      available: pcrsCount > 0,
      detail: pcrsCount > 0 ? `${pcrsCount} statements (${pcrsYears.join(', ')})` : null
    },
    demographics: {
      available: demoFilledCount >= 2,
      detail: demoFilledCount >= 2 ? `${totalPanel.toLocaleString()} patients across ${demoFilledCount} age bands` : null
    },
    practiceSupport: {
      available: hasStaffDetails || hasLegacyStaff,
      detail: hasStaffDetails ? `${staffDetails.length} staff members registered` : (hasLegacyStaff ? 'Staff data available' : null)
    },
    leaveEntitlements: {
      available: leaveFilledCount >= 1 || pcrsCount > 0,
      detail: leaveFilledCount >= 1
        ? `${leaveFilledCount} leave categories recorded`
        : (pcrsCount > 0 ? 'Derived from PCRS statements' : null)
    },
    diseaseRegisters: {
      available: diseaseFilledCount >= 1,
      detail: diseaseFilledCount >= 1
        ? [disease.type2Diabetes && `${disease.type2Diabetes} diabetes`, disease.asthmaUnder8 && `${disease.asthmaUnder8} asthma`, disease.cvdRisk && `${disease.cvdRisk} CVD`].filter(Boolean).join(', ')
        : null
    },
    cervicalScreening: {
      available: cervicalFilledCount >= 1,
      detail: cervicalFilledCount >= 1
        ? (cervical.smearsPerformed ? `${cervical.smearsPerformed} smears performed` : 'Eligible population recorded')
        : null
    }
  };

  const sectionKeys = Object.keys(sections);
  const sectionsComplete = sectionKeys.filter(k => sections[k].available).length;

  return {
    ...sections,
    sectionsComplete,
    sectionsTotal: sectionKeys.length,
    // Minimum: PCRS data + at least 1 health check section
    meetsMinimum: sections.pcrsData.available && sectionsComplete >= 2
  };
}
