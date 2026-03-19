/**
 * GMS Health Check Context Builder
 * Builds comprehensive context for AI analysis and Finn follow-up questions
 */
import { formatAreaReference } from '../data/gmsReferenceData';
import { generateRecommendations } from './healthCheckCalculations';

/**
 * Build a comprehensive context string from health check analysis results
 * Used for both AI summary generation and Finn chat context
 *
 * @param {Object} analysisResults - Results from analyzeGMSIncome()
 * @param {Object} formData - Health check form data (demographics, staff, etc.)
 * @param {Object} practiceProfile - Practice profile data
 * @param {Object} recommendations - Results from generateRecommendations()
 * @param {string} aiSummary - Optional AI summary if already generated
 * @returns {string} Comprehensive context string for AI consumption
 */
export function buildInteractiveGMSContext(analysisResults, formData, practiceProfile, recommendations, aiSummary = null) {
  if (!analysisResults) {
    return 'No GMS Health Check analysis data available.';
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const sections = [];

  // === PRACTICE OVERVIEW ===
  sections.push('=== PRACTICE OVERVIEW ===');

  const practiceName = practiceProfile?.practiceDetails?.practiceName || 'Unknown Practice';
  const numGPs = analysisResults.potentialBreakdowns?.numGPs || practiceProfile?.gps?.partners?.length || 1;
  const weightedPanel = analysisResults.potentialBreakdowns?.weightedPanel || 0;
  const panelSize = analysisResults.potentialBreakdowns?.capitationAnalysis?.panelAssessment?.currentPanelSize || 0;

  sections.push(`Practice: ${practiceName}`);
  sections.push(`Number of GPs/Panels: ${numGPs}`);
  sections.push(`Total Panel Size: ${panelSize.toLocaleString()} patients`);
  sections.push(`Weighted Panel: ${weightedPanel.toLocaleString()}`);
  sections.push(`Patients per GP: ${panelSize > 0 && numGPs > 0 ? Math.round(panelSize / numGPs).toLocaleString() : 'N/A'}`);

  // === DATA COMPLETENESS ===
  sections.push('\n=== DATA COMPLETENESS ===');
  const dataComplete = analysisResults.dataCompleteness;
  if (dataComplete) {
    sections.push(`PCRS PDFs Uploaded: ${dataComplete.actualPDFs} of ${dataComplete.expectedPDFs} expected`);
    sections.push(`Months of Data: ${dataComplete.uniqueMonths} months`);
    sections.push(`Data Complete: ${dataComplete.isComplete ? 'Yes' : 'No - analysis based on partial data'}`);
  }

  // === CURRENT INCOME SUMMARY ===
  sections.push('\n=== CURRENT ANNUAL INCOME (from PCRS) ===');
  const actual = analysisResults.actualIncome || {};
  const leaveActual = analysisResults.potentialBreakdowns?.leaveDetails?.actualTotal ||
    (analysisResults.potentialBreakdowns?.leaveDetails?.actualStudyLeave || 0) +
    (analysisResults.potentialBreakdowns?.leaveDetails?.actualAnnualLeave || 0);

  sections.push(`Capitation: ${formatCurrency(actual.capitation)}`);
  sections.push(`Practice Support: ${formatCurrency(actual.practiceSupport)}`);
  sections.push(`Study & Annual Leave: ${formatCurrency(leaveActual)}`);
  sections.push(`Chronic Disease Management: ${formatCurrency((actual.diseaseManagement || 0) + (actual.cdmFromSTC || 0))}`);
  sections.push(`Cervical Screening: ${formatCurrency(actual.cervicalCheck)}`);
  sections.push(`Special Type Consultations (STC): ${formatCurrency(actual.stc)}`);

  const totalCurrent = (actual.capitation || 0) + (actual.practiceSupport || 0) + leaveActual +
    (actual.diseaseManagement || 0) + (actual.cdmFromSTC || 0) + (actual.cervicalCheck || 0) + (actual.stc || 0);
  sections.push(`TOTAL CURRENT INCOME: ${formatCurrency(totalCurrent)}`);

  // === UNCLAIMED INCOME ===
  sections.push('\n=== UNCLAIMED INCOME (Administrative Issues) ===');

  // Capitation registration gaps
  const capAnalysis = analysisResults.potentialBreakdowns?.capitationAnalysis;
  if (capAnalysis?.registrationChecks) {
    const gaps = capAnalysis.registrationChecks.filter(c => c.status === 'gap' || c.status === 'review');
    if (gaps.length > 0) {
      sections.push('Capitation Registration Gaps:');
      gaps.forEach(gap => {
        sections.push(`  - ${gap.category}: EHR shows ${gap.ehrCount}, PCRS shows ${gap.pcrsCount !== undefined ? gap.pcrsCount : 'N/A'}. Potential: ${formatCurrency(gap.potentialValue)}`);
        if (gap.explanation) sections.push(`    Explanation: ${gap.explanation}`);
      });
    }
  }

  // Practice Support issues
  const psIssues = analysisResults.potentialBreakdowns?.issues || [];
  if (psIssues.length > 0) {
    sections.push('Practice Support Issues:');
    psIssues.forEach(issue => {
      sections.push(`  - ${issue.type}: ${issue.message}`);
      sections.push(`    Action: ${issue.action}`);
      sections.push(`    Potential Recovery: ${formatCurrency(issue.annualLoss || issue.potentialGain)}`);
    });
  }

  // Leave unclaimed
  const leaveDetails = analysisResults.potentialBreakdowns?.leaveDetails;
  if (leaveDetails) {
    if (leaveDetails.studyLeaveUnclaimedDays > 0) {
      sections.push(`Study Leave Unclaimed: ${leaveDetails.studyLeaveUnclaimedDays} days (${formatCurrency(leaveDetails.studyLeaveUnclaimedValue)})`);
    }
    if (leaveDetails.annualLeaveUnclaimedDays > 0) {
      sections.push(`Annual Leave Unclaimed: ${leaveDetails.annualLeaveUnclaimedDays} days (${formatCurrency(leaveDetails.annualLeaveUnclaimedValue)})`);
    }
  }

  // Cervical screening zero payments
  const cervicalAnalysis = analysisResults.potentialBreakdowns?.cervicalScreeningAnalysis;
  if (cervicalAnalysis?.smearsZeroPayment > 0) {
    sections.push(`Cervical Screening Zero Payments: ${cervicalAnalysis.smearsZeroPayment} smears (${formatCurrency(cervicalAnalysis.lostIncome)})`);
    if (cervicalAnalysis.recommendations) {
      cervicalAnalysis.recommendations.forEach(rec => {
        sections.push(`  - ${rec.reason}: ${rec.count} smears. ${rec.advice}`);
      });
    }
  }

  // Calculate total unclaimed
  const totalUnclaimed = (capAnalysis?.totalPotentialValue || 0) +
    psIssues.reduce((sum, i) => sum + (i.annualLoss || i.potentialGain || 0), 0) +
    (leaveDetails?.studyLeaveUnclaimedValue || 0) +
    (leaveDetails?.annualLeaveUnclaimedValue || 0) +
    (cervicalAnalysis?.lostIncome || 0);
  sections.push(`TOTAL UNCLAIMED INCOME: ${formatCurrency(totalUnclaimed)}`);

  // === GROWTH OPPORTUNITIES ===
  sections.push('\n=== GROWTH OPPORTUNITIES (Require Additional Activity) ===');

  // STC growth
  const stcAnalysis = analysisResults.potentialBreakdowns?.stcAnalysis;
  if (stcAnalysis?.opportunities?.length > 0) {
    sections.push('STC Activity Growth Opportunities:');
    stcAnalysis.opportunities.slice(0, 5).forEach(opp => {
      sections.push(`  - ${opp.code} (${opp.name}): Current ${opp.currentClaims} claims, Expected ~${opp.expectedClaims}. Potential: ${formatCurrency(opp.potentialValue)}`);
    });
    sections.push(`  Total STC Growth Potential: ${formatCurrency(stcAnalysis.totalPotentialValue)}`);
  }

  // Panel growth
  const panelGrowth = analysisResults.potentialIncome?.capitationRange?.panelGrowthValue || 0;
  if (panelGrowth > 0) {
    const panelAssessment = capAnalysis?.panelAssessment;
    sections.push(`Panel Growth Potential: ${formatCurrency(panelGrowth)}`);
    if (panelAssessment?.recommendation) {
      sections.push(`  ${panelAssessment.recommendation}`);
    }
  }

  // Hiring opportunities
  const opportunities = analysisResults.potentialBreakdowns?.opportunities || [];
  if (opportunities.length > 0) {
    sections.push('Staff Hiring Opportunities:');
    opportunities.forEach(opp => {
      sections.push(`  - ${opp.message}`);
      if (opp.potentialSubsidy > 0) {
        sections.push(`    Potential Subsidy: ${formatCurrency(opp.potentialSubsidy)}`);
      }
    });
  }

  // CDM growth
  const cdmAnalysis = analysisResults.potentialBreakdowns?.cdmAnalysis;
  if (cdmAnalysis?.growthPotential?.hasData) {
    sections.push('CDM Programme Growth Potential:');
    cdmAnalysis.growthPotential.breakdown.forEach(item => {
      sections.push(`  - ${item.category}: Eligible ${item.eligiblePatients}, Current claims ${item.actualClaims}, Gap ${item.gap}. Potential: ${formatCurrency(item.potentialValue)}`);
    });
    sections.push(`  Total CDM Growth: ${formatCurrency(cdmAnalysis.growthPotential.totalValue)}`);
  }

  // Cervical activity growth
  const cervicalGrowth = analysisResults.potentialIncome?.cervicalCheckRange?.activityGrowth || 0;
  if (cervicalGrowth > 0) {
    sections.push(`Cervical Screening Activity Growth: ${formatCurrency(cervicalGrowth)}`);
  }

  // Calculate total growth
  const totalGrowth = (stcAnalysis?.totalPotentialValue || 0) + panelGrowth +
    opportunities.reduce((sum, o) => sum + (o.potentialSubsidy || 0), 0) +
    (cdmAnalysis?.growthPotential?.totalValue || 0) + cervicalGrowth;
  sections.push(`TOTAL GROWTH POTENTIAL: ${formatCurrency(totalGrowth)}`);

  // === RECOMMENDATIONS SUMMARY ===
  if (recommendations) {
    sections.push('\n=== GENERATED RECOMMENDATIONS ===');

    if (recommendations.priorityRecommendations?.length > 0) {
      sections.push('Priority Recommendations (Low Effort, Admin Tasks):');
      recommendations.priorityRecommendations.forEach((rec, i) => {
        sections.push(`${i + 1}. ${rec.title} - ${formatCurrency(rec.potential)} (${rec.effort} effort)`);
        if (rec.summary) sections.push(`   ${rec.summary}`);
        if (rec.actions?.length > 0) {
          rec.actions.forEach(action => {
            sections.push(`   - ${action.action}${action.value > 0 ? ` (${formatCurrency(action.value)})` : ''}`);
          });
        }
      });
    }

    if (recommendations.growthOpportunities?.length > 0) {
      sections.push('\nGrowth Opportunities (May Require Resources):');
      recommendations.growthOpportunities.forEach((rec, i) => {
        sections.push(`${i + 1}. ${rec.title} - ${formatCurrency(rec.potential)} (${rec.effort} effort)`);
        if (rec.summary) sections.push(`   ${rec.summary}`);
      });
    }
  }

  // === STAFF DETAILS ===
  if (formData?.staffDetails?.length > 0) {
    sections.push('\n=== STAFF DETAILS (from Health Check Form) ===');
    formData.staffDetails.forEach(staff => {
      const name = `${staff.firstName || ''} ${staff.surname || ''}`.trim();
      sections.push(`- ${name}: ${staff.staffType}, ${staff.actualHoursWorked || staff.weeklyHours} hrs/week, Increment Point ${staff.incrementPoint || 'N/A'}`);
    });
  }

  // === DISEASE REGISTERS ===
  if (formData?.diseaseRegisters) {
    const dr = formData.diseaseRegisters;
    const hasDiseaseData = Object.values(dr).some(v => v > 0);
    if (hasDiseaseData) {
      sections.push('\n=== DISEASE REGISTERS (from EHR) ===');
      sections.push('CDM Treatment Programme:');
      if (dr.type2Diabetes) sections.push(`  Type 2 Diabetes: ${dr.type2Diabetes}`);
      if (dr.asthma) sections.push(`  Asthma: ${dr.asthma}`);
      if (dr.copd) sections.push(`  COPD: ${dr.copd}`);
      if (dr.heartFailure) sections.push(`  Heart Failure: ${dr.heartFailure}`);
      if (dr.atrialFibrillation) sections.push(`  Atrial Fibrillation: ${dr.atrialFibrillation}`);
      if (dr.ihd) sections.push(`  IHD: ${dr.ihd}`);
      if (dr.stroke) sections.push(`  Stroke/TIA: ${dr.stroke}`);

      sections.push('Prevention Programme:');
      if (dr.hypertension) sections.push(`  Hypertension: ${dr.hypertension}`);
      if (dr.preDiabetes) sections.push(`  Pre-Diabetes: ${dr.preDiabetes}`);
      if (dr.highCVDRisk) sections.push(`  High CVD Risk (QRISK>=20%): ${dr.highCVDRisk}`);
    }
  }

  // === AI SUMMARY (if available) ===
  if (aiSummary) {
    sections.push('\n=== AI ANALYSIS SUMMARY (Previously Generated) ===');
    sections.push(aiSummary);
  }

  return sections.join('\n');
}

/**
 * Build context specifically for Finn follow-up questions
 * Includes instruction for how to respond
 *
 * @param {Object} analysisResults - Results from analyzeGMSIncome()
 * @param {Object} formData - Health check form data
 * @param {Object} practiceProfile - Practice profile data
 * @param {Object} recommendations - Results from generateRecommendations()
 * @param {string} aiSummary - The AI summary that was generated
 * @returns {string} Context string for Finn with instructions
 */
export function buildFinnFollowUpContext(analysisResults, formData, practiceProfile, recommendations, aiSummary) {
  const baseContext = buildInteractiveGMSContext(analysisResults, formData, practiceProfile, recommendations, aiSummary);

  const instructions = `
The user has just completed an Interactive GMS Health Check and received an AI-generated summary of their findings. They may now ask follow-up questions about:
- Specific recommendations and how to implement them
- Prioritization of actions
- Clarification on any calculations or figures
- Practical advice for their specific situation
- Details about PCRS processes or GMS contract rules

You have access to all the underlying data from the health check. When answering:
- Be specific and reference the actual figures from their analysis
- Provide practical, actionable advice
- Be pragmatic about what's achievable given their practice size and resources
- Maintain a positive but realistic tone
- If they ask about something not covered in the data, let them know what additional information would help

`;

  return instructions + '\n' + baseContext;
}

/**
 * Build a condensed summary for AI prompt (to minimize token usage)
 *
 * @param {Object} analysisResults - Results from analyzeGMSIncome()
 * @param {Object} practiceProfile - Practice profile data
 * @param {Object} recommendations - Results from generateRecommendations()
 * @returns {Object} Condensed summary object
 */
export function buildCondensedSummary(analysisResults, practiceProfile, recommendations) {
  if (!analysisResults) return null;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const actual = analysisResults.actualIncome || {};
  const leaveActual = analysisResults.potentialBreakdowns?.leaveDetails?.actualTotal ||
    (analysisResults.potentialBreakdowns?.leaveDetails?.actualStudyLeave || 0) +
    (analysisResults.potentialBreakdowns?.leaveDetails?.actualAnnualLeave || 0);

  // Calculate totals
  const totalCurrent = (actual.capitation || 0) + (actual.practiceSupport || 0) + leaveActual +
    (actual.diseaseManagement || 0) + (actual.cdmFromSTC || 0) + (actual.cervicalCheck || 0) + (actual.stc || 0);

  const capAnalysis = analysisResults.potentialBreakdowns?.capitationAnalysis;
  const psIssues = analysisResults.potentialBreakdowns?.issues || [];
  const leaveDetails = analysisResults.potentialBreakdowns?.leaveDetails;
  const cervicalAnalysis = analysisResults.potentialBreakdowns?.cervicalScreeningAnalysis;
  const stcAnalysis = analysisResults.potentialBreakdowns?.stcAnalysis;
  const cdmAnalysis = analysisResults.potentialBreakdowns?.cdmAnalysis;
  const opportunities = analysisResults.potentialBreakdowns?.opportunities || [];

  const totalUnclaimed = (capAnalysis?.totalPotentialValue || 0) +
    psIssues.reduce((sum, i) => sum + (i.annualLoss || i.potentialGain || 0), 0) +
    (leaveDetails?.studyLeaveUnclaimedValue || 0) +
    (leaveDetails?.annualLeaveUnclaimedValue || 0) +
    (cervicalAnalysis?.lostIncome || 0);

  const panelGrowth = analysisResults.potentialIncome?.capitationRange?.panelGrowthValue || 0;
  const cervicalGrowth = analysisResults.potentialIncome?.cervicalCheckRange?.activityGrowth || 0;

  const totalGrowth = (stcAnalysis?.totalPotentialValue || 0) + panelGrowth +
    opportunities.reduce((sum, o) => sum + (o.potentialSubsidy || 0), 0) +
    (cdmAnalysis?.growthPotential?.totalValue || 0) + cervicalGrowth;

  return {
    practice: {
      name: practiceProfile?.practiceDetails?.practiceName || 'Unknown',
      numGPs: analysisResults.potentialBreakdowns?.numGPs || 1,
      panelSize: capAnalysis?.panelAssessment?.currentPanelSize || 0,
      patientsPerGP: capAnalysis?.panelAssessment?.patientsPerGP || 0
    },
    totals: {
      current: formatCurrency(totalCurrent),
      unclaimed: formatCurrency(totalUnclaimed),
      growth: formatCurrency(totalGrowth)
    },
    priorityRecommendations: recommendations?.priorityRecommendations?.map(r => ({
      title: r.title,
      potential: formatCurrency(r.potential),
      effort: r.effort,
      category: r.category
    })) || [],
    growthOpportunities: recommendations?.growthOpportunities?.map(r => ({
      title: r.title,
      potential: formatCurrency(r.potential),
      effort: r.effort,
      category: r.category
    })) || []
  };
}

/**
 * Build area-specific context for Finn Q&A within a single GMS area.
 * Includes the area's reference data (rates, rules, calculation method)
 * plus the actual analysis results for that area.
 *
 * @param {string} areaId - The area ID (leave, practiceSupport, etc.)
 * @param {Object} analysis - Per-area analysis { actual, potential, findings, breakdown }
 * @param {Object} readiness - Per-area readiness { status, canAnalyze, missingData }
 * @param {Object} recommendations - Per-area recommendations array
 * @returns {string} Context string for Finn Q&A
 */
export function buildAreaSpecificContext(areaId, analysis, readiness, recommendations) {
  const sections = [];

  // Reference data for this area (rates, rules, calculation methods)
  const reference = formatAreaReference(areaId);
  if (reference) {
    sections.push('=== REFERENCE: GMS RULES & RATES ===');
    sections.push(reference);
  }

  // Area analysis results
  sections.push('\n=== ANALYSIS RESULTS FOR THIS AREA ===');

  if (!analysis) {
    sections.push('No analysis available yet.');
    if (readiness?.missingData?.length > 0) {
      sections.push('Missing data:');
      readiness.missingData.forEach(m => sections.push(`  - ${m}`));
    }
    return sections.join('\n');
  }

  const formatCurrency = (v) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

  sections.push(`Data confidence: ${readiness?.status === 'ready' ? 'High (actual data)' : readiness?.status === 'partial' ? 'Medium (estimated)' : 'Low (no data)'}`);
  sections.push(`Current income: ${formatCurrency(analysis.actual)}`);
  sections.push(`Potential income: ${formatCurrency(analysis.potential)}`);
  sections.push(`Opportunity gap: ${formatCurrency(Math.max(0, (analysis.potential || 0) - (analysis.actual || 0)))}`);

  // Findings
  if (analysis.findings?.length > 0) {
    sections.push('\nFindings:');
    analysis.findings.forEach(f => {
      const prefix = f.type === 'issue' ? '[ISSUE]' : f.type === 'opportunity' ? '[OPPORTUNITY]' : '[OK]';
      sections.push(`  ${prefix} ${f.message}${f.value > 0 ? ` (${formatCurrency(f.value)})` : ''}`);
    });
  }

  // Recommendations
  if (recommendations?.length > 0) {
    sections.push('\nRecommendations:');
    recommendations.forEach((rec, i) => {
      sections.push(`${i + 1}. ${rec.title} — ${formatCurrency(rec.potential)} (${rec.effort || 'N/A'} effort)`);
      if (rec.summary) sections.push(`   ${rec.summary}`);
      if (rec.actions?.length > 0) {
        rec.actions.forEach(a => {
          sections.push(`   - ${a.action}${a.value > 0 ? ` (${formatCurrency(a.value)})` : ''}`);
        });
      }
    });
  }

  if (readiness?.missingData?.length > 0) {
    sections.push('\nMissing data for full analysis:');
    readiness.missingData.forEach(m => sections.push(`  - ${m}`));
  }

  return sections.join('\n');
}

/**
 * Build a metrics summary for the lookup_gms_metrics tool.
 * Returns a text block suitable for tool output.
 *
 * @param {string} areaId - 'summary' for all areas, or a specific area ID
 * @param {Object} analysisResults - Results from analyzeGMSIncome()
 * @param {string} detailLevel - 'headline' or 'detailed'
 * @param {Object} practiceProfile - Practice profile data
 * @param {Object} healthCheckData - Health check form data
 * @returns {string} Formatted text for tool response
 */
export function buildAreaMetricsSummary(areaId, analysisResults, detailLevel, practiceProfile, healthCheckData) {
  if (!analysisResults) {
    return 'No GMS Health Check data available. The user needs to upload PCRS monthly payment PDFs first.';
  }

  const fmt = (v) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

  const actual = analysisResults.actualIncome || {};
  const potential = analysisResults.potentialIncome || {};
  const breakdowns = analysisResults.potentialBreakdowns || {};

  const leaveActual = breakdowns.leaveDetails?.actualTotal ||
    (breakdowns.leaveDetails?.actualStudyLeave || 0) + (breakdowns.leaveDetails?.actualAnnualLeave || 0);

  const AREA_KEYS = {
    leave: { actualKey: null, potentialKey: 'leavePayments', label: 'Leave Payments', customActual: leaveActual },
    practiceSupport: { actualKey: 'practiceSupport', potentialKey: 'practiceSupport', label: 'Practice Support' },
    capitation: { actualKey: 'capitation', potentialKey: 'capitation', label: 'Capitation' },
    cervicalCheck: { actualKey: 'cervicalCheck', potentialKey: 'cervicalCheck', label: 'Cervical Screening' },
    stc: { actualKey: 'stc', potentialKey: 'stc', label: 'Special Type Consultations' },
    cdm: { actualKey: null, potentialKey: 'cdm', label: 'Chronic Disease Management', customActual: (actual.diseaseManagement || 0) + (actual.cdmFromSTC || 0) }
  };

  if (areaId === 'summary') {
    const lines = ['=== GMS HEALTH CHECK SUMMARY ==='];
    let totalActual = 0;
    let totalPotential = 0;

    for (const [id, cfg] of Object.entries(AREA_KEYS)) {
      const a = cfg.customActual !== undefined ? cfg.customActual : (actual[cfg.actualKey] || 0);
      const p = potential[cfg.potentialKey] || 0;
      const opp = Math.max(0, p - a);
      totalActual += a;
      totalPotential += p;
      lines.push(`${cfg.label}: actual ${fmt(a)}, potential ${fmt(p)}, opportunity ${fmt(opp)}`);
    }

    lines.push('');
    lines.push(`TOTAL: actual ${fmt(totalActual)}, potential ${fmt(totalPotential)}, opportunity ${fmt(totalPotential - totalActual)}`);

    if (detailLevel === 'detailed') {
      // Add recommendations summary
      try {
        const recs = generateRecommendations(analysisResults, practiceProfile, healthCheckData);
        if (recs.priorityRecommendations?.length > 0) {
          lines.push('', 'PRIORITY RECOMMENDATIONS:');
          recs.priorityRecommendations.forEach((r, i) => {
            lines.push(`${i + 1}. ${r.title} — ${fmt(r.potential)} (${r.effort} effort)`);
          });
        }
        if (recs.growthOpportunities?.length > 0) {
          lines.push('', 'GROWTH OPPORTUNITIES:');
          recs.growthOpportunities.forEach((r, i) => {
            lines.push(`${i + 1}. ${r.title} — ${fmt(r.potential)} (${r.effort} effort)`);
          });
        }
      } catch { /* ignore */ }
    }

    return lines.join('\n');
  }

  // Single area
  const cfg = AREA_KEYS[areaId];
  if (!cfg) return `Unknown area: ${areaId}`;

  const a = cfg.customActual !== undefined ? cfg.customActual : (actual[cfg.actualKey] || 0);
  const p = potential[cfg.potentialKey] || 0;
  const opp = Math.max(0, p - a);

  const lines = [
    `=== ${cfg.label.toUpperCase()} ===`,
    `Current income: ${fmt(a)}`,
    `Potential income: ${fmt(p)}`,
    `Opportunity gap: ${fmt(opp)}`
  ];

  if (detailLevel === 'detailed') {
    // Add area-specific details
    if (areaId === 'leave' && breakdowns.leaveDetails) {
      const ld = breakdowns.leaveDetails;
      lines.push('', 'Details:');
      if (ld.studyLeaveUnclaimedDays > 0) lines.push(`  Study leave: ${ld.studyLeaveUnclaimedDays} days unclaimed (${fmt(ld.studyLeaveUnclaimedValue)})`);
      if (ld.annualLeaveUnclaimedDays > 0) lines.push(`  Annual leave: ${ld.annualLeaveUnclaimedDays} days unclaimed (${fmt(ld.annualLeaveUnclaimedValue)})`);
    }

    if (areaId === 'practiceSupport' && breakdowns.issues?.length > 0) {
      lines.push('', 'Issues found:');
      breakdowns.issues.forEach(i => lines.push(`  - ${i.message} (${fmt(i.annualLoss || i.potentialGain)})`));
    }

    if (areaId === 'capitation' && breakdowns.capitationAnalysis?.registrationChecks) {
      const gaps = breakdowns.capitationAnalysis.registrationChecks.filter(c => c.gap > 0);
      if (gaps.length > 0) {
        lines.push('', 'Registration gaps:');
        gaps.forEach(g => lines.push(`  - ${g.ageGroup}: ${g.gap} unregistered patients (${fmt(g.gapValue)})`));
      }
    }

    if (areaId === 'cervicalCheck' && breakdowns.cervicalScreeningAnalysis) {
      const ca = breakdowns.cervicalScreeningAnalysis;
      if (ca.smearsZeroPayment > 0) lines.push(``, `Zero-payment smears: ${ca.smearsZeroPayment} (${fmt(ca.lostIncome)})`);
    }

    if (areaId === 'stc' && breakdowns.stcAnalysis?.opportunities?.length > 0) {
      lines.push('', 'Top STC opportunities:');
      breakdowns.stcAnalysis.opportunities.slice(0, 5).forEach(o =>
        lines.push(`  - ${o.code} (${o.name}): current ${o.currentClaims}, expected ~${o.expectedClaims} (${fmt(o.potentialValue)})`)
      );
    }

    if (areaId === 'cdm' && breakdowns.cdmAnalysis?.growthPotential?.breakdown) {
      lines.push('', 'CDM enrolment gaps:');
      breakdowns.cdmAnalysis.growthPotential.breakdown.forEach(item =>
        lines.push(`  - ${item.category}: ${item.gap} unenrolled patients (${fmt(item.potentialValue)})`)
      );
    }

    // Add reference data
    const ref = formatAreaReference(areaId);
    if (ref) {
      lines.push('', ref);
    }
  }

  return lines.join('\n');
}

export default {
  buildInteractiveGMSContext,
  buildFinnFollowUpContext,
  buildCondensedSummary,
  buildAreaSpecificContext,
  buildAreaMetricsSummary
};
