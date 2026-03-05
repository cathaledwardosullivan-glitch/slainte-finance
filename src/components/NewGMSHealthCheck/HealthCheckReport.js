/**
 * GMS Health Check — Printable Report Generator
 *
 * Pure JavaScript module that generates a complete HTML document string
 * for the multi-chapter GMS Health Check report. Uses CSS bar charts
 * (no SVG/Recharts) for print reliability.
 *
 * Usage: generateHealthCheckReportHTML(options) → HTML string
 * Then: window.open('', '_blank').document.write(html)
 */

import COLORS from '../../utils/colors';

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0);
}

function formatNumber(value) {
  return (value || 0).toLocaleString('en-IE');
}

function formatDate(date) {
  return new Date(date || Date.now()).toLocaleDateString('en-IE', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── CSS Bar Chart Builder ────────────────────────────────────────────────

function buildBarChart(actual, potential) {
  const maxValue = Math.max(actual, potential) || 1;
  const actualPercent = Math.round((actual / maxValue) * 100);
  const potentialPercent = potential > actual ? Math.round((potential / maxValue) * 100) : 0;

  return `
    <div class="bar-chart">
      <div class="bar-row">
        <span class="bar-label">Actual</span>
        <div class="bar-container">
          <div class="bar actual-bar" style="width: ${actualPercent}%"></div>
          <span class="bar-value">${formatCurrency(actual)}</span>
        </div>
      </div>
      ${potential > actual ? `
      <div class="bar-row">
        <span class="bar-label">Potential</span>
        <div class="bar-container">
          <div class="bar potential-bar" style="width: ${potentialPercent}%"></div>
          <span class="bar-value">${formatCurrency(potential)}</span>
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

function buildTableRow(label, value, highlight = false) {
  const cls = highlight ? ' class="highlight"' : '';
  return `<tr${cls}><td>${label}</td><td style="text-align: right; font-family: monospace;">${value}</td></tr>`;
}

function buildActionItem(title, detail, value, priority = 'medium') {
  return `
    <div class="action-item ${priority}">
      <strong>${escapeHtml(title)}</strong>
      ${detail ? `<br/><span class="action-detail">${escapeHtml(detail)}</span>` : ''}
      ${value ? `<span class="action-value">${formatCurrency(value)}/yr</span>` : ''}
    </div>
  `;
}

function buildInfoBox(content, color = 'blue') {
  return `<div class="info-box ${color}">${content}</div>`;
}

// ─── Chapter Builders ─────────────────────────────────────────────────────

function buildChapterLeave(analysisResults) {
  const leave = analysisResults?.potentialBreakdowns?.leaveDetails;
  if (!leave) {
    return buildEmptyChapter('Study & Annual Leave', 'Upload GMS PDFs to analyze leave entitlements and claims.');
  }

  const actual = leave.actualTotal || (leave.actualStudyLeave || 0) + (leave.actualAnnualLeave || 0);
  const potential = (leave.studyLeavePotential || 0) + (leave.annualLeavePotential || 0);

  let tableRows = '';
  tableRows += buildTableRow('Study Leave Entitlement', `${leave.studyLeaveEntitlement || 0} days (${formatCurrency(leave.studyLeavePotential || 0)})`);
  tableRows += buildTableRow('Study Leave Claimed', formatCurrency(leave.actualStudyLeave || 0));
  if (leave.studyLeaveUnclaimedDays > 0) {
    tableRows += `<tr class="highlight"><td>Study Leave Unclaimed</td><td style="text-align: right; font-family: monospace; color: #dc2626;">${leave.studyLeaveUnclaimedDays} days (${formatCurrency(leave.studyLeaveUnclaimedValue)})</td></tr>`;
  }
  tableRows += buildTableRow('Annual Leave Entitlement', `${leave.annualLeaveEntitlement || 0} days (${formatCurrency(leave.annualLeavePotential || 0)})`);
  tableRows += buildTableRow('Annual Leave Claimed', formatCurrency(leave.actualAnnualLeave || 0));
  if (leave.annualLeaveUnclaimedDays > 0) {
    tableRows += `<tr class="highlight"><td>Annual Leave Unclaimed</td><td style="text-align: right; font-family: monospace; color: #dc2626;">${leave.annualLeaveUnclaimedDays} days (${formatCurrency(leave.annualLeaveUnclaimedValue)})</td></tr>`;
  }

  let actions = '';
  if (leave.studyLeaveUnclaimedDays > 0) {
    actions += buildActionItem(
      `Study Leave: ${leave.studyLeaveUnclaimedDays} days unclaimed`,
      'Claim study leave by submitting CME certificates to PCRS.',
      leave.studyLeaveUnclaimedValue, 'high'
    );
  }
  if (leave.annualLeaveUnclaimedDays > 0) {
    actions += buildActionItem(
      `Annual Leave: ${leave.annualLeaveUnclaimedDays} days unclaimed`,
      'Claim annual leave via PCRS form submission.',
      leave.annualLeaveUnclaimedValue, 'high'
    );
  }

  const explanatory = leave.studyLeaveUnclaimedDays === 0 && leave.annualLeaveUnclaimedDays === 0
    ? buildInfoBox('<strong>All leave entitlements are being claimed.</strong> No action required.', 'green')
    : '';

  return buildChapterSection(
    '1', 'Study & Annual Leave',
    'Study leave (10 days per panel) and Annual leave at \u20AC197.24/day.',
    actual, potential, tableRows, explanatory, actions
  );
}

function buildChapterPracticeSupport(analysisResults, healthCheckData) {
  const breakdowns = analysisResults?.potentialBreakdowns;
  const psEntitlement = breakdowns?.entitlement;
  const psCurrent = breakdowns?.current;
  const psIssues = breakdowns?.issues || [];
  const psOpportunities = breakdowns?.opportunities || [];

  if (!psEntitlement && !psCurrent) {
    return buildEmptyChapter('Practice Support Subsidies', 'Upload GMS PDFs with staff subsidy data to analyze practice support.');
  }

  const actual = analysisResults?.actualIncome?.practiceSupport || 0;
  const psIssuesValue = psIssues.reduce((sum, i) => sum + (i.annualLoss || i.potentialGain || 0), 0);
  const hiringValue = psOpportunities.reduce((sum, o) => sum + (o.potentialSubsidy || 0), 0);
  const potential = actual + psIssuesValue + hiringValue;

  // Staff table
  let tableRows = '';
  if (psEntitlement) {
    tableRows += buildTableRow('Subsidy Units Entitled', `${psEntitlement.subsidyUnits?.toFixed(2) || '\u2014'} units`);
    tableRows += buildTableRow(
      'Receptionists: Entitled / PCRS',
      `${psEntitlement.totalHours || 0} / ${psCurrent?.receptionists?.hours || 0} hrs`
    );
    tableRows += buildTableRow(
      'Nurses/PM: Entitled / PCRS',
      `${psEntitlement.totalHours || 0} / ${psCurrent?.totalNursesPMHours || 0} hrs`
    );
  }

  // Individual staff rows from healthCheckData
  const staffDetails = healthCheckData?.staffDetails || [];
  if (staffDetails.length > 0) {
    tableRows += `<tr><td colspan="2" style="background: #f3f4f6; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Staff Details</td></tr>`;
    staffDetails.forEach(staff => {
      const name = `${staff.firstName || ''} ${staff.surname || ''}`.trim();
      const role = staff.staffType === 'secretary' ? 'Receptionist'
        : staff.staffType === 'practiceManager' ? 'Practice Manager'
          : staff.staffType === 'nurse' ? 'Nurse' : staff.staffType || '';
      const pcrsTag = staff.fromPCRS ? ' (PCRS)' : ' (not on PCRS)';
      const hours = staff.actualHoursWorked || staff.weeklyHours || '\u2014';
      const incPt = staff.incrementPoint || '\u2014';
      tableRows += buildTableRow(
        `${escapeHtml(name)} \u2014 ${role}${pcrsTag}`,
        `Inc: ${incPt} | ${hours} hrs/wk`
      );
    });
  }

  let explanatory = '';
  if (psEntitlement) {
    explanatory += buildInfoBox(
      `<strong>Entitlement Calculation:</strong> ${psEntitlement.explanation || `Based on weighted panel of ${breakdowns?.weightedPanel?.toLocaleString() || 0} with ${breakdowns?.numGPs || 0} GPs.`}`,
      'blue'
    );
  }

  psOpportunities.forEach(opp => {
    explanatory += buildInfoBox(
      `<strong>Hiring Opportunity:</strong> ${escapeHtml(opp.message)}${opp.potentialSubsidy > 0 ? ` Potential: <strong>${formatCurrency(opp.potentialSubsidy)}/year</strong>` : ''}`,
      'green'
    );
  });

  let actions = '';
  psIssues.forEach(issue => {
    actions += buildActionItem(
      issue.type === 'WRONG_INCREMENT' ? `Wrong Increment Point: ${issue.staffName}` : 'Unclaimed Hours',
      issue.message + (issue.action ? ` \u2014 ${issue.action}` : ''),
      issue.annualLoss || issue.potentialGain || 0,
      issue.priority === 1 ? 'high' : 'medium'
    );
  });

  // Unregistered staff from healthCheckData
  const eligibleRoles = ['secretary', 'nurse', 'practiceManager'];
  const unregistered = staffDetails.filter(s => !s.fromPCRS && eligibleRoles.includes(s.staffType) && parseFloat(s.actualHoursWorked) > 0);
  unregistered.forEach(staff => {
    const name = `${staff.firstName || ''} ${staff.surname || ''}`.trim();
    const roleLabel = staff.staffType === 'secretary' ? 'receptionist' : staff.staffType === 'practiceManager' ? 'practice manager' : staff.staffType;
    actions += buildActionItem(
      `Register ${name} with PCRS for ${roleLabel} subsidy`,
      `Currently working ${staff.actualHoursWorked} hrs/week but not receiving PCRS subsidy.`,
      0, 'high'
    );
  });

  return buildChapterSection(
    '2', 'Practice Support Subsidies',
    'Staff subsidies (receptionists, nurses, practice manager) and capacity grants.',
    actual, potential, tableRows, explanatory, actions
  );
}

function buildChapterCapitation(analysisResults, healthCheckData) {
  const breakdowns = analysisResults?.potentialBreakdowns;
  const capAnalysis = breakdowns?.capitationAnalysis;
  const actual = analysisResults?.actualIncome?.capitation || 0;
  const registrationGapValue = capAnalysis?.totalPotentialValue || 0;
  const panelGrowth = analysisResults?.potentialIncome?.capitationRange?.panelGrowthValue || 0;
  const potential = actual + registrationGapValue + panelGrowth;

  if (!capAnalysis) {
    return buildEmptyChapter('Capitation Payments', 'Upload GMS PDFs and enter EHR demographics to analyze capitation.');
  }

  let tableRows = buildTableRow('<strong>PCRS Capitation Income</strong>', `<strong>${formatCurrency(actual)}</strong>`);

  // Registration checks
  if (capAnalysis.registrationChecks) {
    capAnalysis.registrationChecks.forEach(check => {
      const statusBadge = check.status === 'ok'
        ? '<span class="status-ok">OK</span>'
        : check.status === 'gap'
          ? '<span class="status-gap">Gap</span>'
          : '<span class="status-review">Review</span>';
      tableRows += `<tr${check.potentialValue > 0 ? ' class="highlight"' : ''}>
        <td>${escapeHtml(check.category)} (EHR: ${check.ehrCount}, PCRS: ${check.pcrsCount !== undefined ? check.pcrsCount : '\u2014'}) ${statusBadge}</td>
        <td style="text-align: right; font-family: monospace; ${check.potentialValue > 0 ? 'color: #f59e0b;' : ''}">${check.potentialValue > 0 ? formatCurrency(check.potentialValue) : '\u2014'}</td>
      </tr>`;
    });
  }

  let explanatory = '';
  if (capAnalysis.age5to8Check?.estimatedCount > 0) {
    explanatory += buildInfoBox(
      `<strong>Ages 5-8 (GP Visit Card):</strong> ~${capAnalysis.age5to8Check.estimatedCount} children may have GP Visit Cards but aren't counted in PCRS capitation. ${capAnalysis.age5to8Check.explanation || ''}`,
      'blue'
    );
  }
  if (capAnalysis.panelAssessment) {
    const pa = capAnalysis.panelAssessment;
    explanatory += buildInfoBox(
      `<strong>Panel Size:</strong> ${pa.currentPanelSize?.toLocaleString() || 'N/A'} total (${pa.patientsPerGP?.toLocaleString() || 'N/A'} per GP). ${pa.recommendation || ''}${panelGrowth > 0 ? ` Growth potential: <strong>${formatCurrency(panelGrowth)}/year</strong>` : ''}`,
      pa.status === 'healthy' ? 'green' : 'blue'
    );
  }

  let actions = '';
  if (capAnalysis.registrationChecks) {
    capAnalysis.registrationChecks.filter(c => c.status === 'gap' || c.status === 'review').forEach(check => {
      actions += buildActionItem(
        `${check.category}: ${check.action || 'Review registration'}`,
        check.explanation || '',
        check.potentialValue || 0,
        check.priority === 'high' ? 'high' : 'medium'
      );
    });
  }

  return buildChapterSection(
    '3', 'Capitation Payments',
    'Quarterly payments per GMS patient based on age band.',
    actual, potential, tableRows, explanatory, actions
  );
}

function buildChapterCervicalCheck(analysisResults, healthCheckData) {
  const cervical = analysisResults?.potentialBreakdowns?.cervicalScreeningAnalysis;
  const actual = analysisResults?.actualIncome?.cervicalCheck || 0;
  const lostIncome = cervical?.lostIncome || 0;
  const cervicalGrowth = analysisResults?.potentialIncome?.cervicalCheckRange?.activityGrowth || 0;
  const potential = actual + lostIncome + cervicalGrowth;

  if (!cervical) {
    return buildEmptyChapter('Cervical Screening Programme', 'Upload GMS PDFs with cervical screening data to analyze this section.');
  }

  let tableRows = '';
  tableRows += buildTableRow('Smears Performed', `${cervical.totalSmearsPerformed || cervical.totalSmears || 0}`);
  tableRows += buildTableRow(`Smears Paid (${cervical.paidRate || 0}%)`, `${cervical.smearsPaid || 0} (${formatCurrency(cervical.totalPaidAmount || 0)})`);
  if (cervical.smearsZeroPayment > 0) {
    tableRows += `<tr class="highlight"><td>Zero Payment Smears</td><td style="text-align: right; font-family: monospace; color: #dc2626;">${cervical.smearsZeroPayment} (-${formatCurrency(lostIncome)})</td></tr>`;
  }

  // Eligible population from healthCheckData
  const ccData = healthCheckData?.cervicalCheckActivity;
  if (ccData?.eligibleWomen25to44 > 0 || ccData?.eligibleWomen45to65 > 0) {
    tableRows += `<tr><td colspan="2" style="background: #f3f4f6; font-weight: 600; font-size: 12px;">Eligible Population (from EHR)</td></tr>`;
    tableRows += buildTableRow('Women 25-44', formatNumber(ccData.eligibleWomen25to44));
    tableRows += buildTableRow('Women 45-65', formatNumber(ccData.eligibleWomen45to65));
  }

  let explanatory = '';
  if (cervical.recommendations?.length > 0) {
    explanatory += buildInfoBox('<strong>Zero Payment Breakdown:</strong>', 'amber');
    cervical.recommendations.forEach(rec => {
      const icon = rec.preventable ? 'Fixable' : 'Info';
      explanatory += `<div class="info-box-item">${icon}: <strong>${escapeHtml(rec.reason)}</strong> \u2014 ${rec.count} smear${rec.count > 1 ? 's' : ''}<br/><span class="detail">${escapeHtml(rec.advice)}</span></div>`;
    });
  }
  if (cervicalGrowth > 0) {
    explanatory += buildInfoBox(
      `<strong>Growth Opportunity:</strong> Based on your eligible patient population, increasing screening activity could add <strong>${formatCurrency(cervicalGrowth)}/year</strong>. Consider proactive recall for eligible women.`,
      'green'
    );
  }

  let actions = '';
  if (cervical.recommendations) {
    cervical.recommendations.filter(r => r.preventable && r.count > 0).forEach(rec => {
      actions += buildActionItem(
        `${rec.reason}: ${rec.count} smear${rec.count > 1 ? 's' : ''}`,
        rec.advice,
        rec.count * 49.10,
        'high'
      );
    });
  }

  return buildChapterSection(
    '4', 'Cervical Screening Programme',
    'CervicalCheck programme payments at \u20AC49.10 per smear.',
    actual, potential, tableRows, explanatory, actions
  );
}

function buildChapterSTC(analysisResults) {
  const stcAnalysis = analysisResults?.potentialBreakdowns?.stcAnalysis;
  const actual = analysisResults?.actualIncome?.stc || 0;
  const stcGrowth = stcAnalysis?.totalPotentialValue || 0;
  const potential = actual + stcGrowth;

  if (!stcAnalysis?.hasData) {
    return buildEmptyChapter('Special Type Consultations', 'Upload GMS PDFs with STC claim data to analyze this section.');
  }

  let tableRows = buildTableRow('<strong>Total STC Income</strong>', `<strong>${formatCurrency(actual)}</strong>`);

  // Top STC codes
  if (stcAnalysis.currentActivity) {
    const stcCodes = Object.values(stcAnalysis.currentActivity)
      .filter(code => code.actualCount > 0 && !['cdm', 'ocf', 'pp'].includes(code.category))
      .sort((a, b) => b.actualCount - a.actualCount);

    stcCodes.slice(0, 12).forEach(code => {
      tableRows += buildTableRow(
        `<strong>${escapeHtml(code.code)}</strong> \u2014 ${escapeHtml(code.name)}`,
        `${code.actualCount} claims (${formatCurrency(code.actualTotal)})`
      );
    });
    if (stcCodes.length > 12) {
      tableRows += `<tr><td colspan="2" class="note">... and ${stcCodes.length - 12} more STC categories</td></tr>`;
    }
  }

  let explanatory = '';
  // Zero claim codes
  if (stcAnalysis.currentActivity) {
    const zeroCodes = Object.values(stcAnalysis.currentActivity)
      .filter(code => code.actualCount === 0 && !['cdm', 'ocf', 'pp'].includes(code.category));
    if (zeroCodes.length > 0) {
      explanatory += buildInfoBox(
        `<strong>${zeroCodes.length} STC categories had 0 claims:</strong> ${zeroCodes.slice(0, 6).map(c => `${c.code} (${c.name})`).join(', ')}${zeroCodes.length > 6 ? '...' : ''}`,
        'amber'
      );
    }
  }

  // Opportunities
  if (stcAnalysis.opportunities?.length > 0) {
    explanatory += buildInfoBox('<strong>Growth Opportunities</strong> (Services below benchmark):', 'green');
    stcAnalysis.opportunities.slice(0, 8).forEach(opp => {
      explanatory += `<div class="info-box-item">
        <strong>${escapeHtml(opp.code)}: ${escapeHtml(opp.name)}</strong><br/>
        Current: ${opp.currentClaims} claims, Expected: ~${opp.expectedClaims}/year ${opp.performance !== null ? `(${opp.performance}% of benchmark)` : ''}
        <span class="growth-value">+${formatCurrency(opp.potentialValue || opp.value || 0)}</span>
      </div>`;
    });
  }

  let actions = '';
  if (stcAnalysis.recommendations?.length > 0) {
    stcAnalysis.recommendations.forEach(rec => {
      actions += buildActionItem(
        rec.title,
        rec.description + (rec.actions?.length > 0 ? '\n' + rec.actions.map(a => `\u2022 ${a}`).join('\n') : ''),
        rec.potentialValue || 0,
        'medium'
      );
    });
  }

  return buildChapterSection(
    '5', 'Special Type Consultations',
    'Activity-based payments for procedures, LARC, contraception, ECG, suturing, etc.',
    actual, potential, tableRows, explanatory, actions
  );
}

function buildChapterCDM(analysisResults, healthCheckData) {
  const cdmAnalysis = analysisResults?.potentialBreakdowns?.cdmAnalysis;
  const actual = (analysisResults?.actualIncome?.diseaseManagement || 0) + (analysisResults?.actualIncome?.cdmFromSTC || 0);
  const cdmGrowth = cdmAnalysis?.growthPotential?.totalValue || 0;
  const potential = actual + cdmGrowth;

  if (!cdmAnalysis) {
    return buildEmptyChapter('Chronic Disease Management', 'Upload GMS PDFs with STC/CDM claim data to analyze this section.');
  }

  let tableRows = buildTableRow('<strong>Total CDM Income</strong>', `<strong>${formatCurrency(actual)}</strong>`);

  // CDM claims breakdown
  if (cdmAnalysis.claims?.length > 0) {
    cdmAnalysis.claims.forEach(claim => {
      tableRows += buildTableRow(
        `${escapeHtml(claim.code)} \u2014 ${escapeHtml(claim.name)}`,
        `${claim.count} claims (${formatCurrency(claim.total)})`
      );
    });
  }

  let explanatory = '';
  // Growth potential from disease registers
  if (cdmAnalysis.growthPotential?.hasData) {
    explanatory += buildInfoBox('<strong>CDM Growth Potential</strong> (Based on Disease Registers \u2014 75% target uptake):', 'green');
    cdmAnalysis.growthPotential.breakdown.forEach(item => {
      explanatory += `<div class="info-box-item">
        <strong>${escapeHtml(item.category)}</strong> ${item.code ? `(${item.code})` : ''}:
        Eligible: ${item.eligiblePatients}, Expected: ${item.expectedAnnual}/yr, Actual: ${item.actualClaims}, Gap: ${item.gap}
        <span class="growth-value">+${formatCurrency(item.potentialValue)}</span>
      </div>`;
    });
  } else {
    // Show disease register counts if entered but no growth calc
    const regs = healthCheckData?.diseaseRegisters;
    if (regs && Object.values(regs).some(v => v > 0)) {
      explanatory += buildInfoBox(
        '<strong>Disease Registers Entered:</strong> Growth analysis requires both disease register data and STC claim data to identify gaps.',
        'blue'
      );
    } else {
      explanatory += buildInfoBox(
        '<strong>Tip:</strong> Enter your disease register counts from your EHR to calculate CDM growth potential. Conditions: Type 2 Diabetes, Asthma, COPD, Heart Failure, AF, IHD, Stroke/TIA.',
        'amber'
      );
    }
  }

  let actions = '';
  if (cdmAnalysis.growthPotential?.breakdown) {
    cdmAnalysis.growthPotential.breakdown.filter(item => item.potentialValue > 0).forEach(item => {
      actions += buildActionItem(
        `${item.category}: ${item.gap} additional reviews possible`,
        `${item.eligiblePatients} eligible patients, ${item.actualClaims} current claims. Increase to ${item.expectedAnnual} per year.`,
        item.potentialValue,
        'medium'
      );
    });
  }

  return buildChapterSection(
    '6', 'Chronic Disease Management',
    'CDM Programme payments (Treatment, Phone/MCDM, Prevention, OCF) plus legacy disease management fees.',
    actual, potential, tableRows, explanatory, actions
  );
}

// ─── Generic Chapter Template ─────────────────────────────────────────────

function buildChapterSection(number, title, description, actual, potential, tableRows, explanatory, actions) {
  return `
    <div class="chapter">
      <h2>${number}. ${escapeHtml(title)}</h2>
      <p class="description">${escapeHtml(description)}</p>

      ${buildBarChart(actual, potential)}

      <table>
        <thead>
          <tr><th>Category</th><th style="text-align: right;">Value</th></tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      ${explanatory ? `<div class="explanatory-text">${explanatory}</div>` : ''}

      ${actions ? `
        <div class="action-items">
          <p class="action-header">Action Required:</p>
          ${actions}
        </div>
      ` : ''}
    </div>
  `;
}

function buildEmptyChapter(title, message) {
  return `
    <div class="chapter">
      <h2>${escapeHtml(title)}</h2>
      <div class="info-box amber">
        <strong>Insufficient Data</strong><br/>
        ${escapeHtml(message)}
      </div>
    </div>
  `;
}

// ─── Executive Summary ────────────────────────────────────────────────────

function buildExecutiveSummary(analysisResults, readiness, financialSummary, perAreaFinancials) {
  const breakdowns = analysisResults?.potentialBreakdowns || {};
  const leave = breakdowns.leaveDetails;

  // Current income
  const leaveActual = leave?.actualTotal || (leave?.actualStudyLeave || 0) + (leave?.actualAnnualLeave || 0);
  const totalCurrent = (analysisResults?.actualIncome?.capitation || 0) +
    (analysisResults?.actualIncome?.practiceSupport || 0) +
    leaveActual +
    (analysisResults?.actualIncome?.diseaseManagement || 0) +
    (analysisResults?.actualIncome?.cdmFromSTC || 0) +
    (analysisResults?.actualIncome?.cervicalCheck || 0) +
    (analysisResults?.actualIncome?.stc || 0);

  const totalUnclaimed = financialSummary?.unclaimed || 0;
  const totalGrowth = financialSummary?.growth || 0;

  // Data completeness checklist
  const areas = [
    { id: 'leave', label: 'Study & Annual Leave' },
    { id: 'practiceSupport', label: 'Practice Support' },
    { id: 'capitation', label: 'Capitation' },
    { id: 'cervicalCheck', label: 'Cervical Screening' },
    { id: 'stc', label: 'Special Type Consultations' },
    { id: 'cdm', label: 'Chronic Disease Management' }
  ];

  let completenessHTML = '<div class="completeness-grid">';
  areas.forEach(area => {
    const r = readiness?.[area.id];
    const status = r?.status || 'no-data';
    const statusLabel = status === 'ready' ? 'Complete' : status === 'partial' ? 'Partial' : 'No Data';
    const statusClass = status === 'ready' ? 'complete' : status === 'partial' ? 'partial' : 'nodata';
    const fin = perAreaFinancials?.[area.id];
    const areaTotal = (fin?.unclaimed || 0) + (fin?.growth || 0);
    completenessHTML += `
      <div class="completeness-item">
        <span class="completeness-status ${statusClass}">${statusLabel}</span>
        <span class="completeness-label">${area.label}</span>
        ${areaTotal > 0 ? `<span class="completeness-value">${formatCurrency(areaTotal)}</span>` : ''}
      </div>
    `;
  });
  completenessHTML += '</div>';

  // Top findings
  let topFindings = '';
  const allAreaFinancials = Object.entries(perAreaFinancials || {})
    .map(([id, fin]) => ({ id, total: (fin.unclaimed || 0) + (fin.growth || 0), ...fin }))
    .filter(a => a.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  if (allAreaFinancials.length > 0) {
    const areaLabels = { leave: 'Leave', practiceSupport: 'Practice Support', capitation: 'Capitation', cervicalCheck: 'Cervical Screening', stc: 'STC', cdm: 'CDM' };
    topFindings = '<div class="top-findings"><h3>Key Findings</h3>';
    allAreaFinancials.forEach((area, i) => {
      const parts = [];
      if (area.unclaimed > 0) parts.push(`${formatCurrency(area.unclaimed)} unclaimed`);
      if (area.growth > 0) parts.push(`${formatCurrency(area.growth)} growth`);
      topFindings += `<div class="finding-item"><span class="finding-num">${i + 1}</span> <strong>${areaLabels[area.id] || area.id}:</strong> ${parts.join(' + ')} = <strong>${formatCurrency(area.total)}</strong></div>`;
    });
    topFindings += '</div>';
  }

  return `
    <h2>Executive Summary</h2>
    <div class="summary-grid">
      <div class="summary-card current">
        <div class="label">Current GMS Income</div>
        <div class="value">${formatCurrency(totalCurrent)}</div>
      </div>
      <div class="summary-card unclaimed">
        <div class="label">Unclaimed Income</div>
        <div class="value">${formatCurrency(totalUnclaimed)}</div>
      </div>
      <div class="summary-card growth">
        <div class="label">Growth Potential</div>
        <div class="value">${formatCurrency(totalGrowth)}</div>
      </div>
    </div>

    <h3>Data Completeness</h3>
    ${completenessHTML}

    ${topFindings}
  `;
}

// ─── Combined Action Plan ─────────────────────────────────────────────────

function buildCombinedActionPlan(recommendations, tasks) {
  const priority = recommendations?.priorityRecommendations || [];
  const growth = recommendations?.growthOpportunities || [];

  if (priority.length === 0 && growth.length === 0) {
    return `
      <div class="chapter action-plan">
        <h2>Combined Action Plan</h2>
        <p style="color: #6b7280;">No specific recommendations at this time. Your practice appears to be well-optimised.</p>
      </div>
    `;
  }

  // Build task lookup for assignments
  const taskLookup = {};
  if (tasks?.length > 0) {
    tasks.forEach(task => {
      if (task.sourceRecommendation) {
        taskLookup[task.sourceRecommendation] = task;
      }
    });
  }

  let html = '<div class="chapter action-plan"><h2>Combined Action Plan</h2>';

  if (priority.length > 0) {
    html += `
      <div class="recommendations-section priority">
        <h3>Priority Actions (Admin / Low Effort)</h3>
        <p class="rec-subtitle">Recoverable income \u2014 immediate impact</p>
    `;
    priority.forEach((rec, i) => {
      const task = taskLookup[rec.id];
      const assignee = task?.assignee ? ` \u2014 Assigned to: ${escapeHtml(task.assignee)}` : '';
      const dueDate = task?.dueDate ? ` (Due: ${formatDate(task.dueDate)})` : '';

      html += `
        <div class="recommendation-card priority">
          <div class="rec-header">
            <span class="rec-number">${i + 1}</span>
            <div class="rec-title-block">
              <strong>${escapeHtml(rec.title)}</strong>
              <span class="rec-meta">${escapeHtml(rec.category)} \u2022 ${escapeHtml(rec.effort)} effort${assignee}${dueDate}</span>
            </div>
            <span class="rec-value priority">${formatCurrency(rec.potential)}</span>
          </div>
          ${rec.summary ? `<p class="rec-summary">${escapeHtml(rec.summary)}</p>` : ''}
          ${rec.actions?.length > 0 ? `
            <div class="rec-actions">
              <p class="actions-header">Action Items:</p>
              ${rec.actions.map(action => `
                <div class="rec-action-item">
                  <span class="action-text">${escapeHtml(action.action)}</span>
                  ${action.detail ? `<span class="action-detail">${escapeHtml(action.detail)}</span>` : ''}
                  ${action.value > 0 ? `<span class="action-value">${formatCurrency(action.value)}/yr</span>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    });
    html += '</div>';
  }

  if (growth.length > 0) {
    html += `
      <div class="recommendations-section growth">
        <h3>Growth Opportunities (Activity Increases)</h3>
        <p class="rec-subtitle">May require additional resources \u2014 strategic potential</p>
    `;
    growth.forEach((rec, i) => {
      const task = taskLookup[rec.id];
      const assignee = task?.assignee ? ` \u2014 Assigned to: ${escapeHtml(task.assignee)}` : '';
      const dueDate = task?.dueDate ? ` (Due: ${formatDate(task.dueDate)})` : '';

      html += `
        <div class="recommendation-card growth">
          <div class="rec-header">
            <span class="rec-number growth">${i + 1}</span>
            <div class="rec-title-block">
              <strong>${escapeHtml(rec.title)}</strong>
              <span class="rec-meta">${escapeHtml(rec.category)} \u2022 ${escapeHtml(rec.effort)} effort${assignee}${dueDate}</span>
            </div>
            <span class="rec-value growth">+${formatCurrency(rec.potential)}</span>
          </div>
          ${rec.summary ? `<p class="rec-summary">${escapeHtml(rec.summary)}</p>` : ''}
          ${rec.actions?.length > 0 ? `
            <div class="rec-actions">
              <p class="actions-header">Action Items:</p>
              ${rec.actions.map(action => `
                <div class="rec-action-item">
                  <span class="action-text">${escapeHtml(action.action)}</span>
                  ${action.detail ? `<span class="action-detail">${escapeHtml(action.detail)}</span>` : ''}
                  ${action.value > 0 ? `<span class="action-value">+${formatCurrency(action.value)}/yr</span>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    });
    html += '</div>';
  }

  // Total summary bar
  const totalPriority = priority.reduce((sum, r) => sum + (r.potential || 0), 0);
  const totalGrowth = growth.reduce((sum, r) => sum + (r.potential || 0), 0);
  html += `
    <div class="plan-totals">
      <div class="plan-total-row">
        <span>Recoverable Income (Priority Actions)</span>
        <span class="plan-total-value priority">${formatCurrency(totalPriority)}</span>
      </div>
      <div class="plan-total-row">
        <span>Growth Potential (Activity Increases)</span>
        <span class="plan-total-value growth">+${formatCurrency(totalGrowth)}</span>
      </div>
      <div class="plan-total-row total">
        <span><strong>Total Potential Impact</strong></span>
        <span class="plan-total-value"><strong>${formatCurrency(totalPriority + totalGrowth)}</strong></span>
      </div>
    </div>
  `;

  html += '</div>';
  return html;
}

// ─── Appendix ─────────────────────────────────────────────────────────────

function buildAppendix(healthCheckData, readiness) {
  let html = '<div class="appendix"><h2>Appendix: Input Data Reference</h2>';
  html += '<p style="color: #6b7280; font-size: 13px; margin-bottom: 20px;">The following data was entered during the Health Check process and used in the analysis above.</p>';

  // 1. Demographics
  const demographics = healthCheckData?.demographics || {};
  html += `<div class="appendix-section">
    <h4>1. Patient Demographics (from EHR)</h4>
    <table class="appendix-table">
      <tr><td>Under 6 years</td><td>${demographics.under6 || 0}</td></tr>
      <tr><td>Over 70 years</td><td>${demographics.over70 || 0}</td></tr>
      <tr><td>Nursing Home Residents</td><td>${demographics.nursingHomeResidents || 0}</td></tr>
    </table>
  </div>`;

  // 2. Staff Details
  const staffDetails = healthCheckData?.staffDetails || [];
  if (staffDetails.length > 0) {
    html += `<div class="appendix-section">
      <h4>2. Staff Details</h4>
      <table class="appendix-table">
        <thead><tr><th>Name</th><th>Role</th><th>Incr.</th><th>Years</th><th>Hours/Wk</th><th>Source</th></tr></thead>
        <tbody>
          ${staffDetails.map(s => `<tr>
            <td>${escapeHtml((s.firstName || '') + ' ' + (s.surname || ''))}</td>
            <td>${s.staffType === 'secretary' ? 'Receptionist' : s.staffType === 'practiceManager' ? 'Practice Manager' : s.staffType === 'nurse' ? 'Nurse' : s.staffType || ''}</td>
            <td>${s.incrementPoint || '\u2014'}</td>
            <td>${s.yearsExperience || '\u2014'}</td>
            <td>${s.actualHoursWorked || s.weeklyHours || '\u2014'}</td>
            <td>${s.fromPCRS ? 'PCRS' : 'Manual'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }

  // 3. Disease Registers
  const regs = healthCheckData?.diseaseRegisters || {};
  const hasRegs = Object.values(regs).some(v => v > 0);
  if (hasRegs) {
    html += `<div class="appendix-section">
      <h4>3. Disease Registers (from EHR)</h4>
      <table class="appendix-table">
        <thead><tr><th colspan="2">CDM Treatment Programme</th></tr></thead>
        <tbody>
          <tr><td>Type 2 Diabetes</td><td>${regs.type2Diabetes || 0}</td></tr>
          <tr><td>Asthma</td><td>${regs.asthma || 0}</td></tr>
          <tr><td>COPD</td><td>${regs.copd || 0}</td></tr>
          <tr><td>Heart Failure</td><td>${regs.heartFailure || 0}</td></tr>
          <tr><td>Atrial Fibrillation</td><td>${regs.atrialFibrillation || 0}</td></tr>
          <tr><td>IHD</td><td>${regs.ihd || 0}</td></tr>
          <tr><td>Stroke/TIA</td><td>${regs.stroke || 0}</td></tr>
        </tbody>
        <thead><tr><th colspan="2">Prevention Programme</th></tr></thead>
        <tbody>
          <tr><td>Hypertension (18+)</td><td>${regs.hypertension || 0}</td></tr>
          <tr><td>Pre-Diabetes (45+)</td><td>${regs.preDiabetes || 0}</td></tr>
          <tr><td>High CVD Risk (QRISK\u226520%)</td><td>${regs.highCVDRisk || 0}</td></tr>
          <tr><td>Gestational DM History</td><td>${regs.gestationalDMHistory || 0}</td></tr>
          <tr><td>Pre-eclampsia History</td><td>${regs.preEclampsiaHistory || 0}</td></tr>
        </tbody>
        <thead><tr><th colspan="2">Opportunistic Case Finding</th></tr></thead>
        <tbody>
          <tr><td>OCF Eligible (45+ with risk factors)</td><td>${regs.ocfEligible || 0}</td></tr>
        </tbody>
      </table>
    </div>`;
  }

  // 4. Cervical Screening
  const ccData = healthCheckData?.cervicalCheckActivity || {};
  html += `<div class="appendix-section">
    <h4>${hasRegs ? '4' : '3'}. Cervical Screening Demographics</h4>
    <table class="appendix-table">
      <tr><td>Eligible Women (25-44)</td><td>${ccData.eligibleWomen25to44 || 0}</td></tr>
      <tr><td>Eligible Women (45-65)</td><td>${ccData.eligibleWomen45to65 || 0}</td></tr>
    </table>
  </div>`;

  // 5. Data timestamps
  const timestamps = healthCheckData?._timestamps;
  if (timestamps && Object.keys(timestamps).length > 0) {
    const sectionLabels = {
      demographics: 'Demographics',
      cervicalCheckActivity: 'Cervical Screening',
      diseaseRegisters: 'Disease Registers',
      stcServices: 'STC Services',
      stcDemographics: 'STC Demographics',
      staffDetails: 'Staff Details'
    };
    html += `<div class="appendix-section">
      <h4>Data Timestamps</h4>
      <table class="appendix-table">
        ${Object.entries(timestamps).map(([key, ts]) => `<tr><td>${sectionLabels[key] || key}</td><td>${formatDate(ts)}</td></tr>`).join('')}
      </table>
    </div>`;
  }

  html += '</div>';
  return html;
}

// ─── CSS Stylesheet ───────────────────────────────────────────────────────

function getReportCSS() {
  return `
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1000px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.5;
      color: #333;
      font-size: 14px;
    }

    /* Header */
    .report-header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid ${COLORS.slainteBlue};
    }
    .logo {
      font-size: 42px;
      font-weight: 700;
      letter-spacing: -1px;
      margin-bottom: 5px;
    }
    .logo .sl { color: #333; }
    .logo .ai { color: ${COLORS.slainteBlue}; }
    .logo .nte { color: #333; }
    .logo-finance {
      font-size: 18px;
      color: ${COLORS.slainteBlue};
      font-weight: 500;
      margin-bottom: 8px;
    }
    .tagline {
      font-size: 14px;
      color: #6b7280;
      font-style: italic;
    }

    h1 {
      color: ${COLORS.slainteBlue};
      font-size: 28px;
      margin-top: 30px;
      margin-bottom: 10px;
    }
    h2 {
      color: #1e40af;
      margin-top: 35px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 8px;
      font-size: 20px;
      page-break-after: avoid;
    }
    h3 {
      color: #2563eb;
      margin-top: 25px;
      margin-bottom: 10px;
      font-size: 16px;
      page-break-after: avoid;
    }
    h4 {
      color: #374151;
      margin-top: 15px;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .header-meta {
      color: #6b7280;
      margin-bottom: 30px;
      text-align: center;
    }

    /* Summary Grid */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin: 25px 0;
    }
    .summary-card {
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    .summary-card.current { border-color: #10b981; background: #f0fdf4; }
    .summary-card.unclaimed { border-color: #f59e0b; background: #fffbeb; }
    .summary-card.growth { border-color: #3b82f6; background: #eff6ff; }
    .summary-card .label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .summary-card .value { font-size: 26px; font-weight: bold; }
    .summary-card.current .value { color: #10b981; }
    .summary-card.unclaimed .value { color: #f59e0b; }
    .summary-card.growth .value { color: #3b82f6; }

    /* Data Completeness */
    .completeness-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin: 15px 0;
    }
    .completeness-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      font-size: 13px;
    }
    .completeness-status {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 10px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }
    .completeness-status.complete { background: #d1fae5; color: #065f46; }
    .completeness-status.partial { background: #fef3c7; color: #92400e; }
    .completeness-status.nodata { background: #f3f4f6; color: #6b7280; }
    .completeness-label { flex: 1; }
    .completeness-value { font-weight: 600; color: #059669; white-space: nowrap; }

    /* Top Findings */
    .top-findings {
      margin: 20px 0;
      padding: 15px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .top-findings h3 { margin-top: 0; }
    .finding-item {
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
      font-size: 13px;
    }
    .finding-item:last-child { border-bottom: none; }
    .finding-num {
      display: inline-block;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: ${COLORS.slainteBlue};
      color: white;
      text-align: center;
      line-height: 20px;
      font-size: 11px;
      font-weight: bold;
      margin-right: 6px;
    }

    /* Data Warning */
    .data-warning {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px 15px;
      margin: 20px 0;
      border-radius: 0 4px 4px 0;
    }
    .data-warning strong { color: #92400e; }

    /* Chapters */
    .chapter {
      margin-bottom: 30px;
      page-break-inside: avoid;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      background: #fff;
    }
    .chapter h2 {
      margin-top: 0;
    }
    .description {
      color: #6b7280;
      font-size: 13px;
      margin-bottom: 15px;
    }

    /* Bar Charts */
    .bar-chart {
      margin: 15px 0;
      padding: 15px;
      background: #f9fafb;
      border-radius: 6px;
    }
    .bar-row {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
    }
    .bar-row:last-child { margin-bottom: 0; }
    .bar-label {
      width: 70px;
      font-size: 12px;
      color: #6b7280;
      font-weight: 500;
    }
    .bar-container {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .bar {
      height: 24px;
      border-radius: 4px;
      min-width: 4px;
    }
    .actual-bar { background: #10b981; }
    .potential-bar { background: #d1d5db; }
    .bar-value {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      white-space: nowrap;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 13px;
    }
    table th, table td {
      border: 1px solid #d1d5db;
      padding: 10px 12px;
      text-align: left;
    }
    table th {
      background-color: #f3f4f6;
      font-weight: 600;
      color: #374151;
    }
    tr.highlight td { background-color: #fffbeb; }
    tr.growth td { background-color: #f0fdf4; }
    tr.total-row td { background-color: #f3f4f6; font-weight: 600; }
    td.note { font-style: italic; color: #6b7280; text-align: center; }
    .status-ok { color: #065f46; background: #d1fae5; padding: 2px 6px; border-radius: 10px; font-size: 11px; }
    .status-gap { color: #991b1b; background: #fee2e2; padding: 2px 6px; border-radius: 10px; font-size: 11px; }
    .status-review { color: #92400e; background: #fef3c7; padding: 2px 6px; border-radius: 10px; font-size: 11px; }

    /* Info Boxes */
    .info-box {
      padding: 12px 15px;
      border-radius: 6px;
      margin: 10px 0;
      font-size: 13px;
    }
    .info-box.blue { background: #eff6ff; border-left: 4px solid #3b82f6; }
    .info-box.green { background: #f0fdf4; border-left: 4px solid #10b981; }
    .info-box.amber { background: #fffbeb; border-left: 4px solid #f59e0b; }
    .info-box-item {
      padding: 8px 15px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      margin: 5px 0;
      font-size: 12px;
    }
    .growth-value { float: right; color: #059669; font-weight: 600; }
    .detail { color: #6b7280; font-size: 11px; }

    /* Explanatory Text */
    .explanatory-text { margin: 15px 0; }

    /* Action Items */
    .action-items {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
    }
    .action-header {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin-bottom: 10px;
    }
    .action-item {
      padding: 12px 15px;
      border-radius: 4px;
      margin-bottom: 8px;
      border-left: 4px solid;
      position: relative;
      padding-right: 120px;
    }
    .action-item.high { background: #fef2f2; border-left-color: #dc2626; }
    .action-item.medium { background: #fffbeb; border-left-color: #f59e0b; }
    .action-detail { display: block; font-size: 12px; color: #6b7280; margin-top: 4px; white-space: pre-line; }
    .action-value { position: absolute; right: 15px; top: 12px; font-weight: 600; color: #059669; }

    /* Recommendations / Action Plan */
    .recommendations-section { margin: 25px 0; }
    .rec-subtitle { color: #6b7280; font-size: 13px; margin-bottom: 15px; }
    .recommendation-card {
      border: 2px solid;
      border-radius: 8px;
      margin-bottom: 15px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .recommendation-card.priority { border-color: #fca5a5; }
    .recommendation-card.growth { border-color: #a7f3d0; }
    .rec-header {
      display: flex;
      align-items: flex-start;
      padding: 15px;
      gap: 12px;
    }
    .recommendation-card.priority .rec-header { background: #fef2f2; }
    .recommendation-card.growth .rec-header { background: #ecfdf5; }
    .rec-number {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #dc2626;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      flex-shrink: 0;
    }
    .rec-number.growth { background: #059669; }
    .rec-title-block { flex: 1; }
    .rec-title-block strong { display: block; color: #374151; }
    .rec-meta { font-size: 12px; color: #6b7280; }
    .rec-value { font-size: 22px; font-weight: bold; white-space: nowrap; }
    .rec-value.priority { color: #f59e0b; }
    .rec-value.growth { color: #059669; }
    .rec-summary { padding: 0 15px 10px; font-size: 13px; color: #6b7280; margin: 0; }
    .rec-actions {
      padding: 15px;
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }
    .actions-header { font-size: 12px; font-weight: 600; color: #374151; margin: 0 0 10px 0; }
    .rec-action-item {
      background: white;
      padding: 10px 12px;
      border-radius: 4px;
      margin-bottom: 8px;
      border-left: 3px solid;
      position: relative;
      padding-right: 110px;
    }
    .recommendation-card.priority .rec-action-item { border-left-color: #dc2626; }
    .recommendation-card.growth .rec-action-item { border-left-color: #059669; }
    .action-text { font-size: 13px; color: #374151; }

    /* Plan Totals */
    .plan-totals {
      margin-top: 25px;
      padding: 15px;
      background: #f9fafb;
      border-radius: 8px;
      border: 2px solid #e5e7eb;
    }
    .plan-total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    .plan-total-row:last-child { border-bottom: none; }
    .plan-total-row.total { border-top: 2px solid #374151; margin-top: 8px; padding-top: 12px; font-size: 16px; }
    .plan-total-value { font-weight: 600; }
    .plan-total-value.priority { color: #f59e0b; }
    .plan-total-value.growth { color: #059669; }

    /* Appendix */
    .appendix {
      margin-top: 40px;
      padding-top: 30px;
      border-top: 2px solid #e5e7eb;
    }
    .appendix-section { margin-bottom: 25px; }
    .appendix-table { font-size: 12px; }
    .appendix-table td:first-child { width: 55%; }
    .appendix-table td:last-child { text-align: right; font-weight: 500; }

    /* Footer */
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #9ca3af;
      font-size: 12px;
      text-align: center;
    }

    /* Print Styles */
    @media print {
      body { margin: 0; padding: 20px; font-size: 11px; }
      .summary-card .value { font-size: 22px; }
      .logo { font-size: 36px; }
      h1 { font-size: 22px; }
      h2 { font-size: 16px; margin-top: 20px; }
      h3 { font-size: 13px; margin-top: 15px; }
      table { font-size: 10px; }
      table th, table td { padding: 6px 8px; }
      .chapter { page-break-inside: avoid; }
      .recommendation-card { page-break-inside: avoid; }
      .appendix { page-break-before: always; }
      .action-plan { page-break-before: always; }
      .rec-value { font-size: 18px; }
      .action-item { padding-right: 100px; }
      .rec-action-item { padding-right: 90px; }
    }
  `;
}

// ─── Main Export ──────────────────────────────────────────────────────────

/**
 * Generate the complete HTML for the GMS Health Check printable report.
 *
 * @param {Object} options
 * @param {Object} options.analysisResults - From analyzeGMSIncome()
 * @param {Object} options.recommendations - From generateRecommendations()
 * @param {Object} options.healthCheckData - profile.healthCheckData
 * @param {Object} options.practiceProfile - Full practice profile
 * @param {Array}  options.paymentAnalysisData - Raw PCRS data array
 * @param {Object} options.perAreaFinancials - Per-area { unclaimed, growth }
 * @param {Object} options.financialSummary - { unclaimed, growth }
 * @param {Object} options.readiness - From useAreaReadiness
 * @param {Array}  [options.tasks] - Tasks from TasksContext (optional)
 * @returns {string} Complete HTML document
 */
export function generateHealthCheckReportHTML(options) {
  const {
    analysisResults,
    recommendations,
    healthCheckData = {},
    practiceProfile,
    paymentAnalysisData = [],
    perAreaFinancials = {},
    financialSummary = {},
    readiness = {},
    tasks = []
  } = options;

  const practiceName = practiceProfile?.practiceDetails?.practiceName || 'Your Practice';
  const reportDate = formatDate(new Date());
  const dataComplete = analysisResults?.dataCompleteness;

  // Count months of data
  const months = new Set();
  paymentAnalysisData.forEach(pdf => {
    if (pdf.month && pdf.year) months.add(`${pdf.year}-${pdf.month}`);
  });
  const uniqueMonths = months.size;

  return `<!DOCTYPE html>
<html>
<head>
  <title>GMS Health Check Report - ${escapeHtml(practiceName)}</title>
  <style>${getReportCSS()}</style>
</head>
<body>
  <!-- Header -->
  <div class="report-header">
    <div class="logo">
      <span class="sl">sl</span><span class="ai">[Ai]</span><span class="nte">nte</span>
    </div>
    <div class="logo-finance">Finance</div>
    <div class="tagline">Putting Ai at the Heart of Healthcare</div>
  </div>

  <h1>GMS Health Check Report</h1>
  <div class="header-meta">
    <strong>Practice:</strong> ${escapeHtml(practiceName)} |
    <strong>Report Generated:</strong> ${reportDate}<br/>
    <strong>Analysis Period:</strong> ${uniqueMonths} months of PCRS data (${paymentAnalysisData.length} PDFs uploaded)
  </div>

  ${uniqueMonths < 12 ? `
    <div class="data-warning">
      <strong>Incomplete Data:</strong> This analysis is based on ${uniqueMonths} of 12 months.
      Upload all PCRS PDFs for a complete annual analysis.
    </div>
  ` : ''}

  <!-- Executive Summary -->
  ${buildExecutiveSummary(analysisResults, readiness, financialSummary, perAreaFinancials)}

  <!-- Chapter 1: Leave -->
  ${buildChapterLeave(analysisResults)}

  <!-- Chapter 2: Practice Support -->
  ${buildChapterPracticeSupport(analysisResults, healthCheckData)}

  <!-- Chapter 3: Capitation -->
  ${buildChapterCapitation(analysisResults, healthCheckData)}

  <!-- Chapter 4: Cervical Screening -->
  ${buildChapterCervicalCheck(analysisResults, healthCheckData)}

  <!-- Chapter 5: STC -->
  ${buildChapterSTC(analysisResults)}

  <!-- Chapter 6: CDM -->
  ${buildChapterCDM(analysisResults, healthCheckData)}

  <!-- Combined Action Plan -->
  ${buildCombinedActionPlan(recommendations, tasks)}

  <!-- Appendix -->
  ${buildAppendix(healthCheckData, readiness)}

  <!-- Footer -->
  <div class="footer">
    <p><strong>sl[Ai]nte Finance</strong> \u2014 Putting Ai at the Heart of Healthcare</p>
    <p>This report provides estimates based on uploaded PCRS data and entered practice information.
    Actual payments may vary. Consult your PCRS statements for official figures.</p>
    <p>Report generated on ${reportDate}</p>
  </div>
</body>
</html>`;
}
