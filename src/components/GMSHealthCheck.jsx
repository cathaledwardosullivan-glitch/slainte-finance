import React, { useState, useEffect } from 'react';
import { FileText, AlertCircle, Play } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { usePracticeProfile } from '../hooks/usePracticeProfile';
import { useTour } from './Tour';
import COLORS from '../utils/colors';
import HealthCheckDataForm from './HealthCheckDataForm';
import GMSHealthCheckReport from './GMSHealthCheckReport';
import { analyzeGMSIncome, generateRecommendations } from '../utils/healthCheckCalculations';

/**
 * GMS Health Check Wrapper Component
 * Manages the flow between data collection and report display
 */
export default function GMSHealthCheck({ setCurrentView }) {
  const { transactions, paymentAnalysisData } = useAppContext();
  const { profile, updateProfile, isLoading } = usePracticeProfile();
  const { startGMSHealthCheckTour, getGMSHCTourCompletionDate } = useTour();

  const [showDataForm, setShowDataForm] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [tourForceInitial, setTourForceInitial] = useState(false);

  // Check if health check data is complete
  const hasHealthCheckData = profile?.healthCheckData?.healthCheckComplete === true;

  useEffect(() => {
    // If we have health check data, show the report by default
    if (hasHealthCheckData && !tourForceInitial) {
      setShowReport(true);
    }
  }, [hasHealthCheckData, tourForceInitial]);

  // Watch for tour view state changes - show report view during tour
  useEffect(() => {
    const checkTourViewState = () => {
      const tourState = localStorage.getItem('tour_view_state');
      if (tourState) {
        try {
          const { page, view } = JSON.parse(tourState);
          if (page === 'gms-health-check' && view === 'report') {
            setTourForceInitial(true);
            setShowReport(true);
            setShowDataForm(false);
          }
        } catch (e) {
          // Invalid JSON, ignore
        }
      } else {
        // Tour state cleared - restore normal behavior
        if (tourForceInitial) {
          setTourForceInitial(false);
          if (!hasHealthCheckData) {
            setShowReport(false);
          }
        }
      }
    };

    checkTourViewState();
    const interval = setInterval(checkTourViewState, 200);
    return () => clearInterval(interval);
  }, [hasHealthCheckData, tourForceInitial]);

  const handleCompleteDataForm = (healthCheckData) => {
    // Update practice profile with health check data
    const success = updateProfile({ healthCheckData });

    if (success) {
      setShowDataForm(false);
      setShowReport(true);
    } else {
      alert('Failed to save health check data. Please try again.');
    }
  };

  const handleStartHealthCheck = () => {
    setShowDataForm(true);
  };

  const handleUpdateData = () => {
    setShowReport(false);
    setShowDataForm(true);
  };

  const handleSaveReport = () => {
    // Get the report HTML content
    const reportElement = document.querySelector('[data-report-content]');
    if (!reportElement) {
      alert('Report content not found');
      return;
    }

    const practiceName = profile?.practiceDetails?.practiceName || 'Your Practice';
    const reportDate = new Date().toLocaleDateString('en-IE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Generate full HTML document
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>GMS Health Check Report - ${practiceName}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
          }
          h1, h2, h3, h4 { color: #1e40af; }
          h1 { border-bottom: 3px solid #1e40af; padding-bottom: 10px; }
          h2 { border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-top: 30px; }
          h3 { color: #334155; font-size: 1.125rem; font-weight: 600; margin-top: 20px; }

          /* Summary Cards */
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin: 30px 0;
          }
          .summary-card {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 24px;
            background: #f9fafb;
          }
          .summary-card p {
            margin: 0;
          }
          .summary-card .text-sm {
            font-size: 14px;
            color: #6b7280;
            font-weight: 500;
            margin-bottom: 10px;
          }
          .summary-card .text-3xl {
            font-size: 30px;
            font-weight: bold;
            line-height: 1.2;
          }

          /* Alerts */
          .alert, .bg-amber-50 {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .alert h4, .alert strong {
            color: #92400e;
            margin: 0 0 10px 0;
          }
          .alert p {
            color: #78350f;
            margin: 5px 0;
            font-size: 14px;
          }

          /* Charts and Content */
          .grid { display: grid; gap: 20px; margin: 20px 0; }
          .card, .bg-white {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            background: #ffffff;
          }
          .bg-blue-50 {
            background: #eff6ff;
            border: 1px solid #93c5fd;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
          }

          /* Tables */
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          table th, table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          table th { background-color: #f3f4f6; font-weight: 600; }

          /* Hide interactive elements */
          button { display: none !important; }
          .no-print { display: none !important; }
          svg.lucide { display: inline-block; }

          @media print {
            body { margin: 0; padding: 20px; }
          }
        </style>
      </head>
      <body>
        <h1>GMS Health Check Report</h1>
        <p><strong>Practice:</strong> ${practiceName} | <strong>Report Date:</strong> ${reportDate}</p>
        ${reportElement.innerHTML}
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          <p>Generated by Sláinte Finance</p>
          <p>Report generated on ${reportDate}</p>
        </div>
      </body>
      </html>
    `;

    // Save to localStorage
    const savedReports = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');

    const newReport = {
      id: `gms-health-check-${Date.now()}`,
      title: `GMS Health Check - ${practiceName}`,
      type: 'GMS Health Check',
      generatedDate: new Date().toISOString(),
      year: new Date().getFullYear(),
      htmlContent: htmlContent
    };

    savedReports.push(newReport);

    // Keep only last 20 reports
    if (savedReports.length > 20) {
      savedReports.shift();
    }

    localStorage.setItem('gp_finance_saved_reports', JSON.stringify(savedReports));

    alert('✓ Report saved! You can view it in the Reports section.');
  };

  const handleExportPDF = () => {
    const practiceName = profile?.practiceDetails?.practiceName || 'Your Practice';
    const reportDate = new Date().toLocaleDateString('en-IE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Run analysis to get all the data
    const analysisResults = analyzeGMSIncome(paymentAnalysisData, profile, profile.healthCheckData);
    const recommendations = generateRecommendations(analysisResults, profile, profile.healthCheckData, paymentAnalysisData);
    const healthCheckData = profile.healthCheckData || {};

    // Helper function to format currency
    const formatCurrency = (value) => {
      return new Intl.NumberFormat('en-IE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value || 0);
    };

    // Calculate summary totals (same logic as GMSHealthCheckReport.jsx)
    const registrationGapValue = analysisResults.potentialBreakdowns?.capitationAnalysis?.totalPotentialValue || 0;
    const psIssues = analysisResults.potentialBreakdowns?.issues || [];
    const psIssuesValue = psIssues.reduce((sum, i) => sum + (i.annualLoss || i.potentialGain || 0), 0);
    const studyLeaveUnclaimed = analysisResults.potentialBreakdowns?.leaveDetails?.studyLeaveUnclaimedValue || 0;
    const annualLeaveUnclaimed = analysisResults.potentialBreakdowns?.leaveDetails?.annualLeaveUnclaimedValue || 0;
    const cervicalLost = analysisResults.potentialBreakdowns?.cervicalScreeningAnalysis?.lostIncome || 0;
    const totalUnclaimed = registrationGapValue + psIssuesValue + studyLeaveUnclaimed + annualLeaveUnclaimed + cervicalLost;

    // Growth potential
    const stcGrowth = analysisResults.potentialBreakdowns?.stcAnalysis?.totalPotentialValue || 0;
    const panelGrowth = analysisResults.potentialIncome?.capitationRange?.panelGrowthValue || 0;
    const opportunities = analysisResults.potentialBreakdowns?.opportunities || [];
    const hiringValue = opportunities.reduce((sum, o) => sum + (o.potentialSubsidy || 0), 0);
    const cervicalGrowth = analysisResults.potentialIncome?.cervicalCheckRange?.activityGrowth || 0;
    const cdmGrowth = analysisResults.potentialBreakdowns?.cdmAnalysis?.growthPotential?.totalValue || 0;
    const totalGrowth = stcGrowth + panelGrowth + hiringValue + cervicalGrowth + cdmGrowth;

    // Current income
    const leaveActual = analysisResults.potentialBreakdowns?.leaveDetails?.actualTotal ||
      (analysisResults.potentialBreakdowns?.leaveDetails?.actualStudyLeave || 0) +
      (analysisResults.potentialBreakdowns?.leaveDetails?.actualAnnualLeave || 0);
    const totalCurrent = (analysisResults.actualIncome?.capitation || 0) +
      (analysisResults.actualIncome?.practiceSupport || 0) +
      leaveActual +
      (analysisResults.actualIncome?.diseaseManagement || 0) +
      (analysisResults.actualIncome?.cdmFromSTC || 0) +
      (analysisResults.actualIncome?.cervicalCheck || 0) +
      (analysisResults.actualIncome?.stc || 0);

    // Data completeness
    const dataComplete = analysisResults.dataCompleteness;

    // Helper function to build CSS bar chart
    const buildBarChart = (actual, potential, showPotential = true) => {
      const maxValue = Math.max(actual, potential) || 1;
      const actualPercent = Math.round((actual / maxValue) * 100);
      const potentialPercent = showPotential ? Math.round((potential / maxValue) * 100) : 0;

      return `
        <div class="bar-chart">
          <div class="bar-row">
            <span class="bar-label">Actual</span>
            <div class="bar-container">
              <div class="bar actual-bar" style="width: ${actualPercent}%"></div>
              <span class="bar-value">${formatCurrency(actual)}</span>
            </div>
          </div>
          ${showPotential && potential > actual ? `
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
    };

    // Build category sections with graph first, then table, then explanatory text, then action items
    const buildCategorySection = (id, title, actual, potential, description, tableRows, explanatoryText, actionItems, showPotential = true) => {
      return `
        <div class="category-section">
          <h3>${title}</h3>
          <p class="description">${description}</p>

          <!-- Bar Chart -->
          ${buildBarChart(actual, potential, showPotential)}

          <!-- Data Table -->
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th style="text-align: right;">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Actual (PCRS)</strong></td>
                <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatCurrency(actual)}</td>
              </tr>
              ${tableRows}
            </tbody>
          </table>

          <!-- Explanatory Text -->
          ${explanatoryText ? `<div class="explanatory-text">${explanatoryText}</div>` : ''}

          <!-- Action Items -->
          ${actionItems ? `
            <div class="action-items">
              <p class="action-header">Action Required:</p>
              ${actionItems}
            </div>
          ` : ''}
        </div>
      `;
    };

    // 1. CAPITATION - Build detailed content
    const capAnalysis = analysisResults.potentialBreakdowns?.capitationAnalysis;
    let capitationTableRows = '';
    let capitationExplanatory = '';
    let capitationActions = '';

    // Registration checks table rows
    if (capAnalysis?.registrationChecks) {
      capAnalysis.registrationChecks.forEach(check => {
        const statusBadge = check.status === 'ok'
          ? '<span class="status-ok">✓ OK</span>'
          : check.status === 'gap'
            ? '<span class="status-gap">⚠️ Gap</span>'
            : '<span class="status-review">🔍 Review</span>';
        capitationTableRows += `
          <tr>
            <td>${check.category} (EHR: ${check.ehrCount}, PCRS: ${check.pcrsCount !== undefined ? check.pcrsCount : '—'}) ${statusBadge}</td>
            <td style="text-align: right; font-family: monospace; ${check.potentialValue > 0 ? 'color: #f59e0b;' : ''}">${check.potentialValue > 0 ? formatCurrency(check.potentialValue) : '—'}</td>
          </tr>
        `;
      });
    }

    // Ages 5-8 explanatory text
    if (capAnalysis?.age5to8Check?.estimatedCount > 0) {
      capitationExplanatory += `
        <div class="info-box blue">
          <strong>Ages 5-8 (GP Visit Card):</strong> ~${capAnalysis.age5to8Check.estimatedCount} children in your practice may have GP Visit Cards but aren't counted in PCRS capitation.
          ${capAnalysis.age5to8Check.explanation}
        </div>
      `;
    }

    // Panel assessment
    if (capAnalysis?.panelAssessment) {
      capitationExplanatory += `
        <div class="info-box ${capAnalysis.panelAssessment.status === 'healthy' ? 'green' : 'blue'}">
          <strong>Panel Size:</strong> ${capAnalysis.panelAssessment.currentPanelSize?.toLocaleString() || 'N/A'} total (${capAnalysis.panelAssessment.patientsPerGP?.toLocaleString() || 'N/A'} per GP).
          ${capAnalysis.panelAssessment.recommendation}
          ${panelGrowth > 0 ? ` Growth potential: <strong>${formatCurrency(panelGrowth)}/year</strong>` : ''}
        </div>
      `;
    }

    // Capitation action items
    if (capAnalysis?.registrationChecks) {
      capAnalysis.registrationChecks.filter(c => c.status === 'gap' || c.status === 'review').forEach(check => {
        capitationActions += `
          <div class="action-item ${check.priority === 'high' ? 'high' : 'medium'}">
            <strong>${check.category}:</strong> ${check.action}
            ${check.explanation ? `<br/><span class="action-detail">${check.explanation}</span>` : ''}
            ${check.potentialValue > 0 ? `<span class="action-value">${formatCurrency(check.potentialValue)}/yr</span>` : ''}
          </div>
        `;
      });
    }

    // 2. PRACTICE SUPPORT - Build detailed content
    const psEntitlement = analysisResults.potentialBreakdowns?.entitlement;
    const psCurrent = analysisResults.potentialBreakdowns?.current;
    const psEmployed = analysisResults.potentialBreakdowns?.employed;
    let psTableRows = '';
    let psExplanatory = '';
    let psActions = '';

    if (psEntitlement) {
      psTableRows += `
        <tr>
          <td>Subsidy Units Entitled</td>
          <td style="text-align: right;">${psEntitlement.subsidyUnits?.toFixed(2) || '—'} units</td>
        </tr>
        <tr>
          <td>Receptionists: Entitled / PCRS / Employed</td>
          <td style="text-align: right;">${psEntitlement.totalHours} / ${psCurrent?.receptionists?.hours || 0} / ${psEmployed?.receptionists?.hours || 0} hrs</td>
        </tr>
        <tr>
          <td>Nurses/PM: Entitled / PCRS / Employed</td>
          <td style="text-align: right;">${psEntitlement.totalHours} / ${psCurrent?.totalNursesPMHours || 0} / ${psEmployed?.totalNursesPMHours || 0} hrs</td>
        </tr>
      `;

      psExplanatory = `
        <div class="info-box blue">
          <strong>Entitlement Calculation:</strong> ${psEntitlement.explanation || `Based on weighted panel of ${analysisResults.potentialBreakdowns?.weightedPanel?.toLocaleString() || 0} with ${analysisResults.potentialBreakdowns?.numGPs || 0} GPs.`}
        </div>
      `;
    }

    // Practice Support issues
    if (psIssues.length > 0) {
      psIssues.forEach(issue => {
        psActions += `
          <div class="action-item ${issue.priority === 1 ? 'high' : 'medium'}">
            <strong>${issue.type === 'WRONG_INCREMENT' ? 'Wrong Increment Point' : 'Unclaimed Hours'}:</strong> ${issue.message}
            <br/><span class="action-detail">${issue.action}</span>
            <span class="action-value">${formatCurrency(issue.annualLoss || issue.potentialGain || 0)}/yr</span>
          </div>
        `;
      });
    }

    // Hiring opportunities
    if (opportunities.length > 0) {
      opportunities.forEach(opp => {
        psExplanatory += `
          <div class="info-box green">
            <strong>📈 ${opp.type === 'HIRING_OPPORTUNITY' ? 'Hiring Opportunity' : 'Growth'}:</strong> ${opp.message}
            ${opp.potentialSubsidy > 0 ? ` Potential: <strong>${formatCurrency(opp.potentialSubsidy)}/year</strong>` : ''}
          </div>
        `;
      });
    }

    // 3. LEAVE - Build detailed content
    const leaveDetails = analysisResults.potentialBreakdowns?.leaveDetails;
    let leaveTableRows = '';
    let leaveExplanatory = '';
    let leaveActions = '';

    if (leaveDetails) {
      leaveTableRows = `
        <tr>
          <td>Study Leave Entitlement</td>
          <td style="text-align: right;">${leaveDetails.studyLeaveEntitlement || 0} days (${formatCurrency(leaveDetails.studyLeavePotential || 0)})</td>
        </tr>
        <tr>
          <td>Study Leave Claimed</td>
          <td style="text-align: right; font-family: monospace;">${formatCurrency(leaveDetails.actualStudyLeave || 0)}</td>
        </tr>
        <tr>
          <td>Annual Leave Entitlement</td>
          <td style="text-align: right;">${leaveDetails.annualLeaveEntitlement || 0} days (${formatCurrency(leaveDetails.annualLeavePotential || 0)})</td>
        </tr>
        <tr>
          <td>Annual Leave Claimed</td>
          <td style="text-align: right; font-family: monospace;">${formatCurrency(leaveDetails.actualAnnualLeave || 0)}</td>
        </tr>
      `;

      if (leaveDetails.studyLeaveUnclaimedDays > 0) {
        leaveActions += `
          <div class="action-item high">
            <strong>Study Leave:</strong> ${leaveDetails.studyLeaveUnclaimedDays} days unclaimed
            <br/><span class="action-detail">Claim study leave by submitting CME certificates to PCRS.</span>
            <span class="action-value">${formatCurrency(leaveDetails.studyLeaveUnclaimedValue)}/yr</span>
          </div>
        `;
      }

      if (leaveDetails.annualLeaveUnclaimedDays > 0) {
        leaveActions += `
          <div class="action-item high">
            <strong>Annual Leave:</strong> ${leaveDetails.annualLeaveUnclaimedDays} days unclaimed
            <br/><span class="action-detail">Claim annual leave via PCRS form submission.</span>
            <span class="action-value">${formatCurrency(leaveDetails.annualLeaveUnclaimedValue)}/yr</span>
          </div>
        `;
      }
    }

    // 4. CDM - Build detailed content
    const cdmAnalysis = analysisResults.potentialBreakdowns?.cdmAnalysis;
    let cdmTableRows = '';
    let cdmExplanatory = '';
    let cdmActions = '';
    const cdmActual = (analysisResults.actualIncome?.diseaseManagement || 0) + (analysisResults.actualIncome?.cdmFromSTC || 0);

    if (cdmAnalysis?.claims && cdmAnalysis.claims.length > 0) {
      cdmAnalysis.claims.forEach(claim => {
        cdmTableRows += `
          <tr>
            <td>${claim.code} - ${claim.name}</td>
            <td style="text-align: right; font-family: monospace;">${claim.count} claims (${formatCurrency(claim.total)})</td>
          </tr>
        `;
      });
      cdmTableRows += `
        <tr class="total-row">
          <td><strong>Total CDM Claims</strong></td>
          <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatCurrency(cdmAnalysis.totalAmount)}</td>
        </tr>
      `;
    }

    // CDM growth potential
    if (cdmAnalysis?.growthPotential?.hasData) {
      cdmExplanatory += `<div class="info-box green"><strong>CDM Growth Potential</strong> (Based on Disease Registers - 75% target uptake):</div>`;
      cdmAnalysis.growthPotential.breakdown.forEach(item => {
        cdmExplanatory += `
          <div class="info-box-item">
            <strong>${item.category}</strong> ${item.code ? `(${item.code})` : ''}:
            Eligible: ${item.eligiblePatients}, Expected: ${item.expectedAnnual}/yr, Actual: ${item.actualClaims}, Gap: ${item.gap}
            <span class="growth-value">+${formatCurrency(item.potentialValue)}</span>
          </div>
        `;
      });
    } else {
      cdmExplanatory = `
        <div class="info-box amber">
          <strong>💡 Tip:</strong> Enter your disease register counts in the Health Check Data form to calculate CDM growth potential.
          <br/>CDM Treatment: Type 2 Diabetes, Asthma, COPD, Heart Failure, AF, IHD, Stroke/TIA
          <br/>Prevention Programme: Hypertension (18+), Pre-diabetes (45+), QRISK≥20%, GDM/Pre-eclampsia history
          <br/>OCF: Patients 45+ with risk factors not on CDM/PP
        </div>
      `;
    }

    // 5. CERVICAL SCREENING - Build detailed content
    const cervicalAnalysis = analysisResults.potentialBreakdowns?.cervicalScreeningAnalysis;
    let cervicalTableRows = '';
    let cervicalExplanatory = '';
    let cervicalActions = '';

    if (cervicalAnalysis) {
      cervicalTableRows = `
        <tr>
          <td>Smears Performed</td>
          <td style="text-align: right;">${cervicalAnalysis.totalSmearsPerformed || cervicalAnalysis.totalSmears || 0}</td>
        </tr>
        <tr>
          <td>Smears Paid (${cervicalAnalysis.paidRate || 0}%)</td>
          <td style="text-align: right;">${cervicalAnalysis.smearsPaid || 0} (${formatCurrency(cervicalAnalysis.totalPaidAmount || 0)})</td>
        </tr>
      `;

      if (cervicalAnalysis.smearsZeroPayment > 0) {
        cervicalTableRows += `
          <tr class="highlight">
            <td>⚠️ Zero Payment Smears</td>
            <td style="text-align: right; color: #dc2626;">${cervicalAnalysis.smearsZeroPayment} (-${formatCurrency(cervicalLost)})</td>
          </tr>
        `;
      }

      // Zero payment reasons
      if (cervicalAnalysis.recommendations && cervicalAnalysis.recommendations.length > 0) {
        cervicalExplanatory = `<div class="info-box amber"><strong>Zero Payment Breakdown:</strong></div>`;
        cervicalAnalysis.recommendations.forEach(rec => {
          const icon = rec.preventable ? '🔧' : 'ℹ️';
          cervicalExplanatory += `
            <div class="info-box-item">
              ${icon} <strong>${rec.reason}:</strong> ${rec.count} smear${rec.count > 1 ? 's' : ''}
              <br/><span class="detail">${rec.advice}</span>
            </div>
          `;

          if (rec.preventable && rec.count > 0) {
            cervicalActions += `
              <div class="action-item high">
                <strong>${rec.reason}:</strong> ${rec.count} smear${rec.count > 1 ? 's' : ''}
                <br/><span class="action-detail">${rec.advice}</span>
                <span class="action-value">-${formatCurrency(rec.count * 49.10)}</span>
              </div>
            `;
          }
        });
      }

      // Activity growth
      if (cervicalGrowth > 0) {
        cervicalExplanatory += `
          <div class="info-box green">
            <strong>📈 Growth Opportunity:</strong> Based on your eligible patient population, increasing screening activity could add <strong>${formatCurrency(cervicalGrowth)}/year</strong>.
            Consider proactive recall for eligible women, opportunistic screening during consultations.
          </div>
        `;
      }
    }

    // 6. STC - Build detailed content
    const stcAnalysis = analysisResults.potentialBreakdowns?.stcAnalysis;
    let stcTableRows = '';
    let stcExplanatory = '';
    let stcActions = '';

    if (stcAnalysis?.hasData && stcAnalysis.currentActivity) {
      // Show top STC codes
      const stcCodes = Object.values(stcAnalysis.currentActivity)
        .filter(code => code.actualCount > 0 && !['cdm', 'ocf', 'pp'].includes(code.category))
        .sort((a, b) => b.actualCount - a.actualCount);

      stcCodes.slice(0, 8).forEach(code => {
        stcTableRows += `
          <tr>
            <td><strong>${code.code}</strong> - ${code.name}</td>
            <td style="text-align: right; font-family: monospace;">${code.actualCount} claims (${formatCurrency(code.actualTotal)})</td>
          </tr>
        `;
      });

      if (stcCodes.length > 8) {
        stcTableRows += `<tr><td colspan="2" class="note">... and ${stcCodes.length - 8} more STC categories</td></tr>`;
      }

      // Zero claim codes warning
      const zeroClaimCodes = Object.values(stcAnalysis.currentActivity)
        .filter(code => code.actualCount === 0 && !['cdm', 'ocf', 'pp'].includes(code.category));
      if (zeroClaimCodes.length > 0) {
        stcExplanatory += `
          <div class="info-box amber">
            <strong>${zeroClaimCodes.length} STC categories had 0 claims:</strong>
            ${zeroClaimCodes.slice(0, 5).map(c => `${c.code} (${c.name})`).join(', ')}${zeroClaimCodes.length > 5 ? '...' : ''}
          </div>
        `;
      }
    }

    // STC opportunities
    if (stcAnalysis?.opportunities && stcAnalysis.opportunities.length > 0) {
      stcExplanatory += `<div class="info-box green"><strong>📈 Growth Opportunities</strong> (Services below benchmark):</div>`;
      stcAnalysis.opportunities.slice(0, 6).forEach(opp => {
        stcExplanatory += `
          <div class="info-box-item">
            <strong>${opp.code}: ${opp.name}</strong>
            <br/>Current: ${opp.currentClaims} claims, Expected: ~${opp.expectedClaims}/year ${opp.performance !== null ? `(${opp.performance}% of benchmark)` : ''}
            <span class="growth-value">+${formatCurrency(opp.potentialValue)}</span>
          </div>
        `;
      });
    }

    // STC recommendations
    if (stcAnalysis?.recommendations && stcAnalysis.recommendations.length > 0) {
      stcAnalysis.recommendations.forEach(rec => {
        stcActions += `
          <div class="action-item medium">
            <strong>${rec.title}</strong>
            <br/><span class="action-detail">${rec.description}</span>
            <span class="action-value">+${formatCurrency(rec.potentialValue)}</span>
          </div>
        `;
        if (rec.actions) {
          rec.actions.forEach(action => {
            stcActions += `<div class="action-sub-item">• ${action}</div>`;
          });
        }
      });
    }

    // Build comprehensive Recommendations section
    const priorityRecs = recommendations.priorityRecommendations || [];
    const growthRecs = recommendations.growthOpportunities || [];

    let recommendationsHTML = '';

    if (priorityRecs.length > 0) {
      recommendationsHTML += `
        <div class="recommendations-section priority">
          <h3>Priority Recommendations (Admin Actions)</h3>
          <p class="rec-subtitle">Low effort, immediate impact - Recoverable income</p>
      `;
      priorityRecs.forEach((rec, index) => {
        recommendationsHTML += `
          <div class="recommendation-card priority">
            <div class="rec-header">
              <span class="rec-number">${index + 1}</span>
              <div class="rec-title-block">
                <strong>${rec.title}</strong>
                <span class="rec-meta">${rec.category} • ${rec.effort} effort</span>
              </div>
              <span class="rec-value priority">${formatCurrency(rec.potential)}</span>
            </div>
            ${rec.summary ? `<p class="rec-summary">${rec.summary}</p>` : ''}
            ${rec.actions && rec.actions.length > 0 ? `
              <div class="rec-actions">
                <p class="actions-header">Action Items:</p>
                ${rec.actions.map(action => `
                  <div class="rec-action-item">
                    <span class="action-text">${action.action}</span>
                    ${action.detail ? `<span class="action-detail">${action.detail}</span>` : ''}
                    ${action.value > 0 ? `<span class="action-value">${formatCurrency(action.value)}/yr</span>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;
      });
      recommendationsHTML += '</div>';
    }

    if (growthRecs.length > 0) {
      recommendationsHTML += `
        <div class="recommendations-section growth">
          <h3>Growth Opportunities (Activity Increases)</h3>
          <p class="rec-subtitle">May require additional resources - Strategic potential</p>
      `;
      growthRecs.forEach((rec, index) => {
        recommendationsHTML += `
          <div class="recommendation-card growth">
            <div class="rec-header">
              <span class="rec-number growth">${index + 1}</span>
              <div class="rec-title-block">
                <strong>${rec.title}</strong>
                <span class="rec-meta">${rec.category} • ${rec.effort} effort</span>
              </div>
              <span class="rec-value growth">+${formatCurrency(rec.potential)}</span>
            </div>
            ${rec.summary ? `<p class="rec-summary">${rec.summary}</p>` : ''}
            ${rec.actions && rec.actions.length > 0 ? `
              <div class="rec-actions">
                <p class="actions-header">Action Items:</p>
                ${rec.actions.map(action => `
                  <div class="rec-action-item">
                    <span class="action-text">${action.action}</span>
                    ${action.detail ? `<span class="action-detail">${action.detail}</span>` : ''}
                    ${action.value > 0 ? `<span class="action-value">+${formatCurrency(action.value)}/yr</span>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;
      });
      recommendationsHTML += '</div>';
    }

    // Build Appendix - Health Check Input Data
    let appendixHTML = '';

    // Demographics
    const demographics = healthCheckData.demographics || {};
    appendixHTML += `
      <div class="appendix-section">
        <h4>1. Patient Demographics (from EHR)</h4>
        <table class="appendix-table">
          <tr><td>Under 6 years</td><td>${demographics.under6 || 0}</td></tr>
          <tr><td>Age 6-7 years</td><td>${demographics.age6to7 || 0}</td></tr>
          <tr><td>Over 70 years</td><td>${demographics.over70 || 0}</td></tr>
          <tr><td>Nursing Home Residents</td><td>${demographics.nursingHomeResidents || 0}</td></tr>
        </table>
      </div>
    `;

    // Staff Details
    const staffDetails = healthCheckData.staffDetails || [];
    if (staffDetails.length > 0) {
      appendixHTML += `
        <div class="appendix-section">
          <h4>2. Staff Details</h4>
          <table class="appendix-table">
            <thead>
              <tr><th>Name</th><th>Role</th><th>Incr. Point</th><th>Years Exp.</th><th>Hours/Week</th></tr>
            </thead>
            <tbody>
              ${staffDetails.map(staff => `
                <tr>
                  <td>${staff.firstName || ''} ${staff.surname || ''}</td>
                  <td>${staff.staffType || ''}</td>
                  <td>${staff.incrementPoint || '—'}</td>
                  <td>${staff.yearsExperience || '—'}</td>
                  <td>${staff.actualHoursWorked || staff.weeklyHours || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Disease Registers
    const diseaseRegisters = healthCheckData.diseaseRegisters || {};
    const hasDiseaseData = Object.values(diseaseRegisters).some(v => v > 0);
    if (hasDiseaseData) {
      appendixHTML += `
        <div class="appendix-section">
          <h4>3. Disease Registers (from EHR)</h4>
          <table class="appendix-table">
            <thead><tr><th colspan="2">CDM Treatment Programme</th></tr></thead>
            <tbody>
              <tr><td>Type 2 Diabetes</td><td>${diseaseRegisters.type2Diabetes || 0}</td></tr>
              <tr><td>Asthma</td><td>${diseaseRegisters.asthma || 0}</td></tr>
              <tr><td>COPD</td><td>${diseaseRegisters.copd || 0}</td></tr>
              <tr><td>Heart Failure</td><td>${diseaseRegisters.heartFailure || 0}</td></tr>
              <tr><td>Atrial Fibrillation</td><td>${diseaseRegisters.atrialFibrillation || 0}</td></tr>
              <tr><td>IHD</td><td>${diseaseRegisters.ihd || 0}</td></tr>
              <tr><td>Stroke/TIA</td><td>${diseaseRegisters.stroke || 0}</td></tr>
            </tbody>
            <thead><tr><th colspan="2">Prevention Programme</th></tr></thead>
            <tbody>
              <tr><td>Hypertension (18+)</td><td>${diseaseRegisters.hypertension || 0}</td></tr>
              <tr><td>Pre-Diabetes (45+)</td><td>${diseaseRegisters.preDiabetes || 0}</td></tr>
              <tr><td>High CVD Risk (QRISK≥20%)</td><td>${diseaseRegisters.highCVDRisk || 0}</td></tr>
              <tr><td>Gestational DM History</td><td>${diseaseRegisters.gestationalDMHistory || 0}</td></tr>
              <tr><td>Pre-eclampsia History</td><td>${diseaseRegisters.preEclampsiaHistory || 0}</td></tr>
            </tbody>
            <thead><tr><th colspan="2">Opportunistic Case Finding</th></tr></thead>
            <tbody>
              <tr><td>OCF Eligible (45+ with risk factors)</td><td>${diseaseRegisters.ocfEligible || 0}</td></tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // Cervical Screening
    const cervicalActivity = healthCheckData.cervicalCheckActivity || {};
    appendixHTML += `
      <div class="appendix-section">
        <h4>4. Cervical Screening</h4>
        <table class="appendix-table">
          <tr><td>Eligible Women (25-44)</td><td>${cervicalActivity.eligibleWomen25to44 || 0}</td></tr>
          <tr><td>Eligible Women (45-65)</td><td>${cervicalActivity.eligibleWomen45to65 || 0}</td></tr>
          <tr><td>Smears Performed (from PCRS)</td><td>${cervicalActivity.smearsPerformed || 0}</td></tr>
        </table>
      </div>
    `;

    // Build complete HTML with all enhancements
    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>GMS Health Check Report - ${practiceName}</title>
        <style>
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

          /* Header with Logo */
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
          .summary-card .value {
            font-size: 26px;
            font-weight: bold;
          }
          .summary-card.current .value { color: #10b981; }
          .summary-card.unclaimed .value { color: #f59e0b; }
          .summary-card.growth .value { color: #3b82f6; }

          /* Data Warning */
          .data-warning {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px 15px;
            margin: 20px 0;
            border-radius: 0 4px 4px 0;
          }
          .data-warning strong { color: #92400e; }

          /* Category Sections */
          .category-section {
            margin-bottom: 30px;
            page-break-inside: avoid;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            background: #fff;
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
          .explanatory-text {
            margin: 15px 0;
          }

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
          }
          .action-item.high { background: #fef2f2; border-left-color: #dc2626; }
          .action-item.medium { background: #fffbeb; border-left-color: #f59e0b; }
          .action-detail { display: block; font-size: 12px; color: #6b7280; margin-top: 4px; }
          .action-value { position: absolute; right: 15px; top: 12px; font-weight: 600; color: #059669; }
          .action-sub-item { padding-left: 20px; font-size: 12px; color: #6b7280; margin: 4px 0; }

          /* Recommendations Section */
          .recommendations-section {
            margin: 25px 0;
          }
          .rec-subtitle {
            color: #6b7280;
            font-size: 13px;
            margin-bottom: 15px;
          }
          .recommendation-card {
            border: 2px solid;
            border-radius: 8px;
            margin-bottom: 15px;
            overflow: hidden;
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
          .rec-summary {
            padding: 0 15px 10px;
            font-size: 13px;
            color: #6b7280;
            margin: 0;
          }
          .rec-actions {
            padding: 15px;
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
          }
          .actions-header {
            font-size: 12px;
            font-weight: 600;
            color: #374151;
            margin: 0 0 10px 0;
          }
          .rec-action-item {
            background: white;
            padding: 10px 12px;
            border-radius: 4px;
            margin-bottom: 8px;
            border-left: 3px solid;
            position: relative;
          }
          .recommendation-card.priority .rec-action-item { border-left-color: #dc2626; }
          .recommendation-card.growth .rec-action-item { border-left-color: #059669; }
          .action-text { font-size: 13px; color: #374151; }

          /* Appendix */
          .appendix {
            margin-top: 40px;
            padding-top: 30px;
            border-top: 2px solid #e5e7eb;
          }
          .appendix-section {
            margin-bottom: 25px;
          }
          .appendix-table {
            font-size: 12px;
          }
          .appendix-table td:first-child { width: 60%; }
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
            .category-section { page-break-inside: avoid; }
            .recommendation-card { page-break-inside: avoid; }
            .appendix { page-break-before: always; }
          }
        </style>
      </head>
      <body>
        <!-- Header with Logo -->
        <div class="report-header">
          <div class="logo">
            <span class="sl">sl</span><span class="ai">[Ai]</span><span class="nte">nte</span>
          </div>
          <div class="logo-finance">Finance</div>
          <div class="tagline">Putting Ai at the Heart of Healthcare</div>
        </div>

        <h1>GMS Health Check Report</h1>
        <div class="header-meta">
          <strong>Practice:</strong> ${practiceName} |
          <strong>Report Generated:</strong> ${reportDate}<br/>
          <strong>Analysis Period:</strong> ${dataComplete?.uniqueMonths || 0} months of PCRS data (${dataComplete?.actualPDFs || 0} PDFs uploaded)
        </div>

        ${!dataComplete?.isComplete ? `
          <div class="data-warning">
            <strong>⚠️ Incomplete Data:</strong> This analysis is based on ${dataComplete?.uniqueMonths || 0} of 12 months.
            Upload all PCRS PDFs for a complete annual analysis.
          </div>
        ` : ''}

        <h2>Executive Summary</h2>
        <div class="summary-grid">
          <div class="summary-card current">
            <div class="label">Current Income</div>
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

        <h2>Income Analysis by Category</h2>

        ${buildCategorySection(
          'capitation',
          '1. Capitation Income',
          analysisResults.actualIncome?.capitation || 0,
          (analysisResults.actualIncome?.capitation || 0) + registrationGapValue + panelGrowth,
          'Quarterly payments per GMS patient based on age band',
          capitationTableRows,
          capitationExplanatory,
          capitationActions,
          registrationGapValue > 0 || panelGrowth > 0
        )}

        ${buildCategorySection(
          'practiceSupport',
          '2. Practice Support Subsidies',
          analysisResults.actualIncome?.practiceSupport || 0,
          (analysisResults.actualIncome?.practiceSupport || 0) + psIssuesValue + hiringValue,
          'Staff subsidies (receptionists, nurses, practice manager) and capacity grants',
          psTableRows,
          psExplanatory,
          psActions,
          psIssuesValue > 0 || hiringValue > 0
        )}

        ${buildCategorySection(
          'leave',
          '3. Study and Annual Leave',
          leaveActual,
          analysisResults.potentialIncome?.leavePayments || leaveActual,
          'Study leave (10 days per panel) and Annual leave (varies by panel size) at €197.24/day',
          leaveTableRows,
          '',
          leaveActions,
          studyLeaveUnclaimed > 0 || annualLeaveUnclaimed > 0
        )}

        ${buildCategorySection(
          'cdm',
          '4. Chronic Disease Management',
          cdmActual,
          cdmActual + cdmGrowth,
          'CDM Programme payments (AO, AP, AQ, AR, AS, AT codes) plus legacy disease management fees',
          cdmTableRows,
          cdmExplanatory,
          cdmActions,
          cdmGrowth > 0
        )}

        ${buildCategorySection(
          'cervical',
          '5. Cervical Screening',
          analysisResults.actualIncome?.cervicalCheck || 0,
          (analysisResults.actualIncome?.cervicalCheck || 0) + cervicalGrowth,
          'CervicalCheck programme payments at €49.10 per smear',
          cervicalTableRows,
          cervicalExplanatory,
          cervicalActions,
          cervicalGrowth > 0
        )}

        ${buildCategorySection(
          'stc',
          '6. Special Type Consultations (STC)',
          analysisResults.actualIncome?.stc || 0,
          (analysisResults.actualIncome?.stc || 0) + stcGrowth,
          'Activity-based payments for procedures, LARC, contraception, ECG, suturing, etc.',
          stcTableRows,
          stcExplanatory,
          stcActions,
          stcGrowth > 0
        )}

        <h2>Recommendations</h2>
        ${recommendationsHTML || '<p style="color: #6b7280;">No specific recommendations at this time. Your practice appears to be well-optimised.</p>'}

        <div class="appendix">
          <h2>Appendix: Health Check Input Data</h2>
          <p style="color: #6b7280; font-size: 13px; margin-bottom: 20px;">
            The following data was entered during the Health Check data collection process and used in the analysis above.
          </p>
          ${appendixHTML}
        </div>

        <div class="footer">
          <p><strong>sl[Ai]nte Finance</strong> - Putting Ai at the Heart of Healthcare</p>
          <p>This report provides estimates based on uploaded PCRS data and entered practice information.
          Actual payments may vary. Consult your PCRS statements for official figures.</p>
          <p>Report generated on ${reportDate}</p>
        </div>
      </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(reportHTML);
    printWindow.document.close();

    // Trigger print after content loads
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: COLORS.slainteBlue }} />
      </div>
    );
  }

  // Show data collection form
  if (showDataForm) {
    return (
      <HealthCheckDataForm
        practiceProfile={profile}
        paymentAnalysisData={paymentAnalysisData}
        onComplete={handleCompleteDataForm}
        onCancel={() => {
          setShowDataForm(false);
          if (hasHealthCheckData) {
            setShowReport(true);
          }
        }}
      />
    );
  }

  const handleOpenPCRSUpload = () => {
    if (typeof setCurrentView === 'function') {
      // Navigate to Admin Settings and trigger PCRS file upload
      localStorage.setItem('admin_trigger_upload', 'pcrs');
      setCurrentView('admin');
    }
  };

  // Show report
  if (showReport && hasHealthCheckData) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <GMSHealthCheckReport
          paymentAnalysisData={paymentAnalysisData}
          practiceProfile={profile}
          healthCheckData={profile.healthCheckData}
          onExportPDF={handleExportPDF}
          onSaveReport={handleSaveReport}
          onOpenPCRSUpload={handleOpenPCRSUpload}
        />

        {/* Action Buttons */}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={startGMSHealthCheckTour}
            className="px-4 py-2 rounded border font-medium transition-colors"
            style={{
              borderColor: COLORS.slainteBlue,
              color: COLORS.slainteBlue,
              backgroundColor: `${COLORS.slainteBlue}10`
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = `${COLORS.slainteBlue}20`}
            onMouseLeave={(e) => e.target.style.backgroundColor = `${COLORS.slainteBlue}10`}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Play style={{ width: '1rem', height: '1rem' }} />
              {getGMSHCTourCompletionDate() ? 'Replay Health Check Tour' : 'Take Health Check Tour'}
            </span>
          </button>
          <button
            onClick={handleUpdateData}
            className="px-4 py-2 rounded border font-medium transition-colors hover:bg-gray-50"
            style={{
              borderColor: COLORS.lightGray,
              color: COLORS.mediumGray
            }}
          >
            Update Health Check Data
          </button>
        </div>
      </div>
    );
  }

  // Initial state - prompt to start health check
  return (
    <div className="max-w-4xl mx-auto p-6" data-tour-id="gms-health-check-section">
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center" style={{ borderColor: COLORS.lightGray }}>
        <div
          className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ backgroundColor: `${COLORS.slainteBlue}20` }}
        >
          <FileText className="h-8 w-8" style={{ color: COLORS.slainteBlue }} />
        </div>

        <h2 className="text-2xl font-bold mb-3" style={{ color: COLORS.darkGray }}>
          GMS Health Check
        </h2>

        <p className="text-lg mb-6" style={{ color: COLORS.mediumGray }}>
          Identify unclaimed income opportunities in your GMS contract
        </p>

        <div className="max-w-2xl mx-auto mb-8 space-y-4 text-left">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: COLORS.slainteBlue }}>
              1
            </div>
            <div>
              <p className="font-medium" style={{ color: COLORS.darkGray }}>
                Collect practice data
              </p>
              <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                Simple 3-step form to gather demographics, staff, and activity data from your EHR
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: COLORS.slainteBlue }}>
              2
            </div>
            <div>
              <p className="font-medium" style={{ color: COLORS.darkGray }}>
                Analyze income potential
              </p>
              <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                Compare your actual PCRS payments against what you should be receiving
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: COLORS.slainteBlue }}>
              3
            </div>
            <div>
              <p className="font-medium" style={{ color: COLORS.darkGray }}>
                Get actionable recommendations
              </p>
              <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                Prioritized list of administrative actions to claim missing payments
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
          <p className="text-sm font-medium" style={{ color: '#065F46' }}>
            💰 Typical practices find €20,000 - €80,000 in unclaimed income
          </p>
        </div>

        <button
          onClick={handleStartHealthCheck}
          className="px-8 py-3 rounded-lg font-medium text-white text-lg transition-colors"
          style={{ backgroundColor: COLORS.slainteBlue }}
          onMouseEnter={(e) => e.target.style.opacity = '0.9'}
          onMouseLeave={(e) => e.target.style.opacity = '1'}
        >
          Run Health Check
        </button>

        <p className="text-sm mt-4" style={{ color: COLORS.mediumGray }}>
          Takes approximately 10-15 minutes
        </p>
      </div>
    </div>
  );
}
