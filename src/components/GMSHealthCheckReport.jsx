import React, { useState, useMemo, useEffect } from 'react';
import { Download, TrendingUp, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Save, Users, Clock, Target, Calendar, User, X, Plus, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import COLORS from '../utils/colors';
import { analyzeGMSIncome, generateRecommendations } from '../utils/healthCheckCalculations';
import { getActionItems, createActionItem, addActionItem } from '../storage/practiceProfileStorage';

/**
 * Main GMS Health Check Report Component
 * Displays analysis results, chart, and recommendations
 */
export default function GMSHealthCheckReport({
  paymentAnalysisData,
  practiceProfile,
  healthCheckData,
  onExportPDF,
  onSaveReport,
  onOpenPCRSUpload
}) {
  const [expandedRecommendations, setExpandedRecommendations] = useState({});
  const [isMobile, setIsMobile] = useState(false);
  const [showCapacityGrantDetails, setShowCapacityGrantDetails] = useState(false);
  const [showAge5to8Details, setShowAge5to8Details] = useState(false);
  const [showEntitlementDetails, setShowEntitlementDetails] = useState(false);
  const [showCervicalRecommendations, setShowCervicalRecommendations] = useState(false);
  const [showCervicalTargetDetails, setShowCervicalTargetDetails] = useState(false);
  const [showSTCRecommendations, setShowSTCRecommendations] = useState(false);
  const [showZeroClaimCodes, setShowZeroClaimCodes] = useState(false);
  const [expandedSummaryBox, setExpandedSummaryBox] = useState(null); // 'current', 'unclaimed', 'potential'
  const [actionItems, setActionItems] = useState([]);
  const [taskDialogOpen, setTaskDialogOpen] = useState(null); // { recommendation, action, actionIdx } or null
  const [taskForm, setTaskForm] = useState({ assignedTo: '', dueDate: '' });

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load action items
  useEffect(() => {
    setActionItems(getActionItems());
  }, []);

  // Get combined list of staff and partners for assignment
  const assigneeList = useMemo(() => {
    const list = [];

    // Add partners from practice profile
    if (practiceProfile?.gps?.partners) {
      practiceProfile.gps.partners.forEach(partner => {
        list.push({
          name: partner.name,
          role: 'Partner'
        });
      });
    }

    // Add salaried GPs
    if (practiceProfile?.gps?.salaried) {
      practiceProfile.gps.salaried.forEach(gp => {
        list.push({
          name: gp.name,
          role: 'Salaried GP'
        });
      });
    }

    // Add staff from health check data
    if (healthCheckData?.staffDetails) {
      healthCheckData.staffDetails.forEach(staff => {
        list.push({
          name: `${staff.firstName} ${staff.surname}`.trim(),
          role: staff.staffType === 'nurse' ? 'Nurse' :
                staff.staffType === 'practiceManager' ? 'Practice Manager' :
                staff.staffType === 'secretary' ? 'Secretary' : staff.staffType
        });
      });
    }

    // Add staff from practice profile if not already added from health check
    if (practiceProfile?.staff && !healthCheckData?.staffDetails?.length) {
      practiceProfile.staff.forEach(staff => {
        const name = staff.name || `${staff.firstName || ''} ${staff.surname || ''}`.trim();
        list.push({
          name,
          role: staff.role || 'Staff'
        });
      });
    }

    return list;
  }, [healthCheckData, practiceProfile]);

  // Check if an action is already a task
  const isActionAlreadyTask = (recommendation, actionIdx) => {
    const actionKey = `${recommendation.id}-${actionIdx}`;
    return actionItems.some(item =>
      item.recommendationId === recommendation.id &&
      item.title === recommendation.actions[actionIdx]?.action
    );
  };

  // Handle creating a task from an action
  const handleCreateTask = () => {
    if (!taskDialogOpen) return;

    const { recommendation, action } = taskDialogOpen;
    const newAction = createActionItem(recommendation, action);

    // Apply form values
    newAction.assignedTo = taskForm.assignedTo || null;
    newAction.dueDate = taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : null;

    addActionItem(newAction);
    setActionItems(getActionItems());
    setTaskDialogOpen(null);
    setTaskForm({ assignedTo: '', dueDate: '' });
  };

  // Get the task for a specific action (if it exists)
  const getTaskForAction = (recommendation, actionIdx) => {
    return actionItems.find(item =>
      item.recommendationId === recommendation.id &&
      item.title === recommendation.actions[actionIdx]?.action
    );
  };

  // Run analysis
  const analysisResults = useMemo(() => {
    if (!healthCheckData || !practiceProfile) return null;

    return analyzeGMSIncome(paymentAnalysisData, practiceProfile, healthCheckData);
  }, [paymentAnalysisData, practiceProfile, healthCheckData]);

  // Generate recommendations (now returns { priorityRecommendations, growthOpportunities, all })
  const recommendationsData = useMemo(() => {
    if (!analysisResults) return { priorityRecommendations: [], growthOpportunities: [], all: [] };

    return generateRecommendations(analysisResults, practiceProfile, healthCheckData, paymentAnalysisData);
  }, [analysisResults, practiceProfile, healthCheckData, paymentAnalysisData]);

  // Destructure for easier access
  const { priorityRecommendations, growthOpportunities } = recommendationsData;

  // Prepare individual chart data for each category
  const chartCategories = useMemo(() => {
    if (!analysisResults) return [];

    return [
      {
        id: 'capitation',
        title: 'Capitation Income',
        actual: analysisResults.actualIncome.capitation,
        potential: analysisResults.potentialIncome.capitation,
        potentialUpper: analysisResults.potentialIncome.capitationUpper,
        potentialRange: analysisResults.potentialIncome.capitationRange,
        breakdown: analysisResults.potentialBreakdowns?.capitation || [],
        // NEW: Capitation analysis showing EHR vs PCRS registration gaps
        capitationAnalysis: analysisResults.potentialBreakdowns?.capitationAnalysis,
        description: 'Quarterly payments per GMS patient based on age band'
      },
      {
        id: 'practiceSupport',
        title: 'Practice Support',
        actual: analysisResults.actualIncome.practiceSupport,
        potential: analysisResults.potentialIncome.practiceSupport,
        potentialUpper: analysisResults.potentialIncome.practiceSupportUpper,
        potentialRange: analysisResults.potentialIncome.practiceSupportRange,
        breakdown: analysisResults.potentialBreakdowns?.practiceSupport || [],
        // Subsidy units and entitlement info
        subsidyUnits: analysisResults.potentialBreakdowns?.subsidyUnits,
        weightedPanel: analysisResults.potentialBreakdowns?.weightedPanel,
        numGPs: analysisResults.potentialBreakdowns?.numGPs,
        explanation: analysisResults.potentialBreakdowns?.practiceSupportExplanation,
        // NEW: Comprehensive analysis data
        entitlement: analysisResults.potentialBreakdowns?.entitlement,
        current: analysisResults.potentialBreakdowns?.current,
        employed: analysisResults.potentialBreakdowns?.employed,
        issues: analysisResults.potentialBreakdowns?.issues || [],
        opportunities: analysisResults.potentialBreakdowns?.opportunities || [],
        totalRecoverable: analysisResults.potentialBreakdowns?.totalRecoverable || 0,
        // Legacy staff analysis for backward compatibility
        staffAnalysis: analysisResults.potentialBreakdowns?.practiceSupportAnalysis || null,
        description: 'Staff subsidies and capacity grants'
      },
      {
        id: 'leavePayments',
        title: 'Study and Annual Leave',
        // Use the calculated actual from PCRS leave balance data, not the payment amount
        actual: analysisResults.potentialBreakdowns?.leaveDetails?.actualTotal ||
                (analysisResults.potentialBreakdowns?.leaveDetails?.actualStudyLeave || 0) +
                (analysisResults.potentialBreakdowns?.leaveDetails?.actualAnnualLeave || 0),
        potential: analysisResults.potentialIncome.leavePayments,
        breakdown: analysisResults.potentialBreakdowns?.leavePayments || [],
        leaveDetails: analysisResults.potentialBreakdowns?.leaveDetails,
        description: 'Study leave (10 days) and Annual leave (20 days) per panel per year'
      },
      {
        id: 'diseaseManagement',
        title: 'Chronic Disease Management',
        actual: analysisResults.actualIncome.diseaseManagement + (analysisResults.actualIncome.cdmFromSTC || 0),
        potential: analysisResults.potentialIncome.diseaseManagement,
        breakdown: analysisResults.potentialBreakdowns?.diseaseManagement || [],
        // NEW: CDM analysis from STC section (AQ, AM codes)
        cdmAnalysis: analysisResults.potentialBreakdowns?.cdmAnalysis,
        cdmFromSTC: analysisResults.actualIncome.cdmFromSTC || 0,
        description: 'Asthma/diabetes fees + CDM from PCRS (AQ/AM codes)'
      },
      {
        id: 'cervicalCheck',
        title: 'Cervical Screening',
        actual: analysisResults.actualIncome.cervicalCheck,
        potential: analysisResults.potentialIncome.cervicalCheck,
        potentialUpper: analysisResults.potentialIncome.cervicalCheckUpper,
        potentialRange: analysisResults.potentialIncome.cervicalCheckRange,
        breakdown: analysisResults.potentialBreakdowns?.cervicalCheck || [],
        // NEW: Cervical screening PCRS analysis (zero payments, reasons, recommendations)
        cervicalScreeningAnalysis: analysisResults.potentialBreakdowns?.cervicalScreeningAnalysis,
        description: 'CervicalCheck programme payments'
      },
      {
        id: 'stc',
        title: 'Special Type Consultations',
        actual: analysisResults.actualIncome.stc,
        potential: analysisResults.potentialIncome.stc,
        breakdown: [],
        // NEW: STC analysis (activity by code, opportunities, benchmarks)
        stcAnalysis: analysisResults.potentialBreakdowns?.stcAnalysis,
        description: 'Activity-based payments (ECG, LARC, suturing, etc.)',
        noTarget: true  // STCs don't have a "potential" target - they're activity-based
      }
    ];
  }, [analysisResults]);

  // State for expanded breakdown sections
  const [expandedBreakdowns, setExpandedBreakdowns] = useState({});

  const toggleBreakdown = (categoryId) => {
    setExpandedBreakdowns(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const toggleRecommendation = (id) => {
    setExpandedRecommendations(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  if (!analysisResults) {
    return (
      <div className="p-8 text-center">
        <p style={{ color: COLORS.textSecondary }}>
          Complete the Health Check data collection to see your analysis
        </p>
      </div>
    );
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg" style={{ borderColor: COLORS.borderLight }}>
          <p className="font-semibold mb-1" style={{ color: COLORS.textPrimary }}>
            {payload[0].payload.name}
          </p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6" data-report-content data-tour-id="gms-health-check-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>
            GMS Health Check Report
          </h2>
          <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
            {practiceProfile?.practiceDetails?.practiceName || 'Your Practice'} • {new Date().toLocaleDateString('en-IE', {
              year: 'numeric',
              month: 'long'
            })}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onSaveReport}
            className="no-print px-4 py-2 rounded font-medium border flex items-center gap-2 transition-colors"
            style={{
              borderColor: COLORS.slainteBlue,
              color: COLORS.slainteBlue,
              backgroundColor: 'white'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = `${COLORS.slainteBlue}10`;
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'white';
            }}
          >
            <Save className="h-4 w-4" />
            Save Report
          </button>
          <button
            onClick={onExportPDF}
            className="no-print px-4 py-2 rounded font-medium text-white flex items-center gap-2 transition-colors"
            style={{ backgroundColor: COLORS.slainteBlue }}
            onMouseEnter={(e) => e.target.style.opacity = '0.9'}
            onMouseLeave={(e) => e.target.style.opacity = '1'}
          >
            <Download className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Data Completeness Warning */}
      {analysisResults.dataCompleteness && !analysisResults.dataCompleteness.isComplete && (
        <div
          className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={onOpenPCRSUpload}
          title="Click to upload PCRS PDFs"
        >
          <div className="flex gap-3 items-center">
            <AlertCircle className="h-5 w-5 flex-shrink-0" style={{ color: COLORS.warningDark }} />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: COLORS.warningText }}>
                <strong>Data Incomplete</strong> - {analysisResults.dataCompleteness.actualPDFs} of {analysisResults.dataCompleteness.expectedPDFs} PDFs uploaded
                <span className="text-xs ml-2 opacity-75">
                  ({analysisResults.dataCompleteness.numPanels} panels × 12 months)
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards - Current / Unclaimed / Additional Potential - Interactive */}
      {(() => {
        // Calculate breakdown data for all three boxes
        const currentBreakdown = [
          { label: 'Capitation', value: analysisResults.actualIncome?.capitation || 0 },
          { label: 'Practice Support', value: analysisResults.actualIncome?.practiceSupport || 0 },
          { label: 'Study & Annual Leave', value: analysisResults.potentialBreakdowns?.leaveDetails?.actualTotal ||
              (analysisResults.potentialBreakdowns?.leaveDetails?.actualStudyLeave || 0) +
              (analysisResults.potentialBreakdowns?.leaveDetails?.actualAnnualLeave || 0) },
          { label: 'Chronic Disease Mgmt', value: (analysisResults.actualIncome?.diseaseManagement || 0) + (analysisResults.actualIncome?.cdmFromSTC || 0) },
          { label: 'Cervical Screening', value: analysisResults.actualIncome?.cervicalCheck || 0 },
          { label: 'STC', value: analysisResults.actualIncome?.stc || 0 },
        ].filter(item => item.value > 0);

        // Unclaimed breakdown
        const unclaimedBreakdown = [];

        // Capitation registration gaps
        const capitationAnalysis = analysisResults.potentialBreakdowns?.capitationAnalysis;
        const registrationGapValue = capitationAnalysis?.totalPotentialValue || 0;
        if (registrationGapValue > 0) {
          unclaimedBreakdown.push({ label: 'Capitation Registration Gaps', value: registrationGapValue });
        }

        // Practice Support issues
        const psIssues = analysisResults.potentialBreakdowns?.issues || [];
        const psIssuesValue = psIssues.reduce((sum, i) => sum + (i.annualLoss || i.potentialGain || 0), 0);
        if (psIssuesValue > 0) {
          unclaimedBreakdown.push({ label: 'Practice Support Issues', value: psIssuesValue });
        }

        // Study Leave unclaimed
        const studyLeaveUnclaimed = analysisResults.potentialBreakdowns?.leaveDetails?.studyLeaveUnclaimedValue || 0;
        if (studyLeaveUnclaimed > 0) {
          unclaimedBreakdown.push({ label: 'Study Leave Unclaimed', value: studyLeaveUnclaimed });
        }
        // Annual Leave unclaimed
        const annualLeaveUnclaimed = analysisResults.potentialBreakdowns?.leaveDetails?.annualLeaveUnclaimedValue || 0;
        if (annualLeaveUnclaimed > 0) {
          unclaimedBreakdown.push({ label: 'Annual Leave Unclaimed', value: annualLeaveUnclaimed });
        }

        // Cervical Check zero payments
        const cervicalLost = analysisResults.potentialBreakdowns?.cervicalScreeningAnalysis?.lostIncome || 0;
        if (cervicalLost > 0) {
          unclaimedBreakdown.push({ label: 'Cervical Check Zero Payments', value: cervicalLost });
        }

        // Growth potential breakdown
        const growthBreakdown = [];

        // STC growth
        const stcGrowth = analysisResults.potentialBreakdowns?.stcAnalysis?.totalPotentialValue || 0;
        if (stcGrowth > 0) {
          growthBreakdown.push({ label: 'STC Activity Growth', value: stcGrowth });
        }

        // Capitation panel growth
        const panelGrowth = analysisResults.potentialIncome?.capitationRange?.panelGrowthValue || 0;
        if (panelGrowth > 0) {
          growthBreakdown.push({ label: 'Panel Growth', value: panelGrowth });
        }

        // Practice Support hiring
        const psOpportunities = analysisResults.potentialBreakdowns?.opportunities || [];
        const hiringValue = psOpportunities.reduce((sum, o) => sum + (o.potentialSubsidy || 0), 0);
        if (hiringValue > 0) {
          growthBreakdown.push({ label: 'Staff Hiring Opportunities', value: hiringValue });
        }

        // Cervical activity growth
        const cervicalGrowth = analysisResults.potentialIncome?.cervicalCheckRange?.activityGrowth || 0;
        if (cervicalGrowth > 0) {
          growthBreakdown.push({ label: 'Cervical Screening Activity', value: cervicalGrowth });
        }

        // CDM Growth Potential from disease registers
        const cdmAnalysis = analysisResults.potentialBreakdowns?.cdmAnalysis;
        const cdmGrowth = cdmAnalysis?.growthPotential?.totalValue || 0;
        if (cdmGrowth > 0) {
          growthBreakdown.push({ label: 'CDM Programme Growth', value: cdmGrowth });
        }

        // Disease Management growth (general - if no specific CDM data)
        if (cdmGrowth === 0) {
          const dmGrowth = Math.max(0, (analysisResults.potentialIncome?.diseaseManagement || 0) -
                          (analysisResults.actualIncome?.diseaseManagement || 0) -
                          (analysisResults.actualIncome?.cdmFromSTC || 0));
          if (dmGrowth > 0) {
            growthBreakdown.push({ label: 'Disease Management', value: dmGrowth });
          }
        }

        const totalGrowthPotential = growthBreakdown.reduce((sum, item) => sum + item.value, 0);
        const totalUnclaimed = unclaimedBreakdown.reduce((sum, item) => sum + item.value, 0);

        const SummaryBox = ({ type, title, value, color, icon: Icon, breakdown }) => (
          <div className="summary-card bg-white rounded-lg shadow-sm border overflow-hidden" style={{ borderColor: COLORS.borderLight }}>
            <button
              onClick={() => setExpandedSummaryBox(expandedSummaryBox === type ? null : type)}
              className="w-full p-6 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>
                  {title}
                </p>
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5" style={{ color }} />
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${expandedSummaryBox === type ? 'rotate-180' : ''}`}
                    style={{ color: COLORS.textSecondary }}
                  />
                </div>
              </div>
              <p className="text-3xl font-bold" style={{ color }}>
                {type === 'potential' ? '+' : ''}{formatCurrency(value)}
              </p>
            </button>
            {expandedSummaryBox === type && breakdown.length > 0 && (
              <div className="border-t px-6 py-4" style={{ borderColor: COLORS.borderLight, backgroundColor: COLORS.bgPage }}>
                <div className="space-y-2">
                  {breakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span style={{ color: COLORS.textPrimary }}>{item.label}</span>
                      <span className="font-medium" style={{ color }}>
                        {type === 'potential' ? '+' : ''}{formatCurrency(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

        return (
          <div className="summary-grid grid grid-cols-3 gap-4">
            <SummaryBox
              type="current"
              title="Current Income"
              value={analysisResults.totalActual}
              color={COLORS.slainteBlue}
              icon={CheckCircle}
              breakdown={currentBreakdown}
            />
            <SummaryBox
              type="unclaimed"
              title="Unclaimed Income"
              value={totalUnclaimed > 0 ? totalUnclaimed : analysisResults.totalUnclaimed}
              color={COLORS.error}
              icon={AlertCircle}
              breakdown={unclaimedBreakdown}
            />
            <SummaryBox
              type="potential"
              title="Additional Potential"
              value={totalGrowthPotential}
              color={COLORS.successDark}
              icon={TrendingUp}
              breakdown={growthBreakdown}
            />
          </div>
        );
      })()}

      {/* Individual Income Category Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {chartCategories.map((category) => {
          // For categories with ranges, the gap is based on achievable improvements (not growth)
          let gap = category.potential - category.actual;
          if (category.potentialRange) {
            if (category.id === 'capitation') {
              gap = category.potentialRange.registrationGapValue;
            } else if (category.id === 'practiceSupport') {
              gap = category.potentialRange.issuesRecoverable;
            } else if (category.id === 'cervicalCheck') {
              gap = category.potentialRange.recoverableZeroPayments;
            }
          }
          const percentageAchieved = category.potential > 0
            ? Math.round((category.actual / category.potential) * 100)
            : 100;
          const hasGap = gap > 0 && !category.noTarget;
          const isExpanded = expandedBreakdowns[category.id];

          return (
            <div
              key={category.id}
              data-tour-id={`hc-${category.id}`}
              className="bg-white rounded-lg shadow-sm border overflow-hidden"
              style={{ borderColor: COLORS.borderLight }}
            >
              {/* Category Header */}
              <div className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold" style={{ color: COLORS.textPrimary }}>
                    {category.title}
                  </h3>
                  {hasGap && (
                    <span
                      className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{ backgroundColor: COLORS.errorLight, color: COLORS.error }}
                    >
                      Unclaimed: {formatCurrency(gap)}
                    </span>
                  )}
                </div>
                <p className="text-sm mb-4" style={{ color: COLORS.textSecondary }}>
                  {category.description}
                </p>

                {/* Bar Chart for this category */}
                {(() => {
                  // Calculate potential as actual + growth potential for each category type
                  let chartPotential = category.potential;
                  if (category.id === 'stc' && category.stcAnalysis?.totalPotentialValue > 0) {
                    chartPotential = category.actual + category.stcAnalysis.totalPotentialValue;
                  } else if (category.id === 'cervicalCheck' && category.potentialRange?.activityGrowth > 0) {
                    // For cervical check, show Actual + Growth Potential (not Actual + Unclaimed)
                    chartPotential = category.actual + category.potentialRange.activityGrowth;
                  } else if (category.id === 'capitation' && category.potentialRange?.panelGrowthValue > 0) {
                    // For capitation, show Actual + Growth Potential (panel growth)
                    chartPotential = category.actual + category.potentialRange.panelGrowthValue;
                  } else if (category.id === 'practiceSupport') {
                    // For practice support, show Actual + Growth Potential (hiring opportunities)
                    const opportunities = category.opportunities || [];
                    const hiringGrowth = opportunities.reduce((sum, o) => sum + (o.potentialSubsidy || 0), 0);
                    if (hiringGrowth > 0) {
                      chartPotential = category.actual + hiringGrowth;
                    }
                  }
                  const showPotentialBar = !category.noTarget || (category.id === 'stc' && category.stcAnalysis?.totalPotentialValue > 0);

                  return (
                    <div className="w-full" style={{ maxWidth: '100%' }}>
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart
                          data={[{
                            name: category.title,
                            Actual: category.actual,
                            Potential: showPotentialBar ? chartPotential : category.actual,
                          }]}
                          layout="vertical"
                          margin={{ left: 0, right: 10, bottom: 5, top: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.borderLight} horizontal={false} />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: COLORS.textSecondary }}
                            tickFormatter={(value) => value >= 1000 ? `€${(value / 1000).toFixed(0)}k` : `€${value}`}
                          />
                          <YAxis type="category" dataKey="name" hide />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend
                            wrapperStyle={{ fontSize: '11px' }}
                            iconType="square"
                          />
                          <Bar
                            dataKey="Actual"
                            fill={COLORS.incomeColor}
                            radius={[0, 4, 4, 0]}
                            barSize={30}
                          />
                          {showPotentialBar && (
                            <Bar
                              dataKey="Potential"
                              fill={COLORS.borderLight}
                              radius={[0, 4, 4, 0]}
                              barSize={30}
                            />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}

                {/* Summary Stats - Actual (PCRS) and Growth Potential */}
                {(() => {
                  // Calculate growth potential for each category
                  let growthPotential = 0;
                  if (category.id === 'stc') {
                    growthPotential = category.stcAnalysis?.totalPotentialValue || 0;
                  } else if (category.id === 'capitation') {
                    growthPotential = category.potentialRange?.panelGrowthValue || 0;
                  } else if (category.id === 'practiceSupport') {
                    // Growth = hiring opportunities (not fixes)
                    const opportunities = category.opportunities || [];
                    growthPotential = opportunities.reduce((sum, o) => sum + (o.potentialSubsidy || 0), 0);
                  } else if (category.id === 'cervicalCheck') {
                    growthPotential = category.potentialRange?.activityGrowth || 0;
                  } else if (category.id === 'diseaseManagement') {
                    // CDM growth from disease register data (if available)
                    growthPotential = category.cdmAnalysis?.growthPotential?.totalValue || 0;
                    // Fallback to generic calculation if no disease register data
                    if (growthPotential === 0) {
                      growthPotential = Math.max(0, category.potential - category.actual);
                    }
                  } else if (category.id === 'leavePayments') {
                    // Study & Annual leave - gap is the growth potential (unclaimed days)
                    growthPotential = (category.leaveDetails?.studyLeaveUnclaimedValue || 0) +
                                      (category.leaveDetails?.annualLeaveUnclaimedValue || 0);
                  }

                  return (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="text-center p-3 rounded" style={{ backgroundColor: `${COLORS.incomeColor}10` }}>
                        <p className="text-xs font-medium mb-1" style={{ color: COLORS.textSecondary }}>Actual (PCRS)</p>
                        <p className="text-xl font-bold" style={{ color: COLORS.incomeColor }}>
                          {formatCurrency(category.actual)}
                        </p>
                      </div>
                      <div className="text-center p-3 rounded" style={{ backgroundColor: growthPotential > 0 ? COLORS.successLight : `${COLORS.textSecondary}10` }}>
                        <p className="text-xs font-medium mb-1" style={{ color: COLORS.textSecondary }}>
                          Growth Potential
                        </p>
                        <p className="text-xl font-bold" style={{ color: growthPotential > 0 ? COLORS.successDark : COLORS.textSecondary }}>
                          {growthPotential > 0 ? `+${formatCurrency(growthPotential)}` : '—'}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Breakdown Toggle - Uniform button for all categories */}
                {(category.breakdown && category.breakdown.length > 0) || (category.id === 'stc' && category.stcAnalysis) || (category.id === 'diseaseManagement' && category.cdmAnalysis?.hasData) ? (
                  <button
                    onClick={() => toggleBreakdown(category.id)}
                    className="w-full mt-4 py-2 px-3 text-sm font-medium rounded border flex items-center justify-center gap-2 transition-colors hover:bg-gray-50"
                    style={{ borderColor: COLORS.borderLight, color: COLORS.slainteBlue }}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Hide Detailed Breakdown
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Show Detailed Breakdown
                      </>
                    )}
                  </button>
                ) : null}
              </div>

              {/* STC Analysis - Now inside expanded section (collapsible like others) */}
              {isExpanded && category.id === 'stc' && category.stcAnalysis && (
                <div className="border-t px-4 py-4 md:px-6" style={{ borderColor: COLORS.borderLight, backgroundColor: COLORS.bgPage }}>
                  <div className="space-y-4">
                    {/* 1. TABLE - Current STC Activity BY CODE (detailed breakdown) */}
                    <div className="p-4 rounded-lg border bg-white" style={{ borderColor: COLORS.borderLight }}>
                      <h5 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: COLORS.textPrimary }}>
                        <CheckCircle className="h-4 w-4" />
                        STC Activity by Service Code (PCRS Data)
                      </h5>

                      {category.stcAnalysis.hasData ? (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr style={{ backgroundColor: COLORS.bgPage }}>
                                  <th className="p-2 text-left border" style={{ borderColor: COLORS.borderLight }}>Code</th>
                                  <th className="p-2 text-left border" style={{ borderColor: COLORS.borderLight }}>Service</th>
                                  <th className="p-2 text-center border" style={{ borderColor: COLORS.borderLight }}>Claims</th>
                                  <th className="p-2 text-right border" style={{ borderColor: COLORS.borderLight }}>Fee</th>
                                  <th className="p-2 text-right border" style={{ borderColor: COLORS.borderLight }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {/* Show individual codes from currentActivity - filter out CDM/OCF/PP codes (shown in CDM table), sort by claims */}
                                {Object.values(category.stcAnalysis.currentActivity || {})
                                  .filter(code => code.actualCount > 0 && !['cdm', 'ocf', 'pp'].includes(code.category))
                                  .sort((a, b) => b.actualCount - a.actualCount)
                                  .map((codeData, idx) => (
                                    <tr key={idx}>
                                      <td className="p-2 border font-mono font-semibold" style={{ borderColor: COLORS.borderLight, color: COLORS.slainteBlue }}>
                                        {codeData.code}
                                      </td>
                                      <td className="p-2 border" style={{ borderColor: COLORS.borderLight }}>
                                        <span className="text-sm">{codeData.name}</span>
                                      </td>
                                      <td className="p-2 border text-center font-medium" style={{ borderColor: COLORS.borderLight }}>
                                        {codeData.actualCount}
                                      </td>
                                      <td className="p-2 border text-right" style={{ borderColor: COLORS.borderLight, color: COLORS.textSecondary }}>
                                        {formatCurrency(codeData.fee)}
                                      </td>
                                      <td className="p-2 border text-right font-medium" style={{ borderColor: COLORS.borderLight, color: COLORS.incomeColor }}>
                                        {formatCurrency(codeData.actualTotal)}
                                      </td>
                                    </tr>
                                  ))}
                                {/* Total row - excluding CDM/OCF/PP */}
                                <tr style={{ backgroundColor: COLORS.bgPage }}>
                                  <td colSpan="2" className="p-2 border font-bold" style={{ borderColor: COLORS.borderLight }}>
                                    Total STC
                                  </td>
                                  <td className="p-2 border text-center font-bold" style={{ borderColor: COLORS.borderLight }}>
                                    {Object.values(category.stcAnalysis.currentActivity || {})
                                      .filter(code => code.actualCount > 0 && !['cdm', 'ocf', 'pp'].includes(code.category))
                                      .reduce((sum, code) => sum + code.actualCount, 0)}
                                  </td>
                                  <td className="p-2 border" style={{ borderColor: COLORS.borderLight }}></td>
                                  <td className="p-2 border text-right font-bold" style={{ borderColor: COLORS.borderLight, color: COLORS.incomeColor }}>
                                    {formatCurrency(
                                      Object.values(category.stcAnalysis.currentActivity || {})
                                        .filter(code => code.actualCount > 0 && !['cdm', 'ocf', 'pp'].includes(code.category))
                                        .reduce((sum, code) => sum + code.actualTotal, 0)
                                    )}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Panel Size Reference */}
                          {category.stcAnalysis.panelSize > 0 && (
                            <p className="text-xs mt-2" style={{ color: COLORS.textSecondary }}>
                              Based on panel size of {category.stcAnalysis.panelSize.toLocaleString()} GMS patients
                            </p>
                          )}

                          {/* Note about codes with 0 claims - expandable */}
                          {(() => {
                            const zeroClaimCodes = Object.values(category.stcAnalysis.currentActivity || {})
                              .filter(code => code.actualCount === 0 && !['cdm', 'ocf', 'pp'].includes(code.category))
                              .sort((a, b) => a.code.localeCompare(b.code));
                            if (zeroClaimCodes.length > 0) {
                              return (
                                <div className="mt-3 rounded" style={{ backgroundColor: COLORS.warningLight, borderLeft: `4px solid ${COLORS.warning}` }}>
                                  <button
                                    onClick={() => setShowZeroClaimCodes(!showZeroClaimCodes)}
                                    className="w-full p-3 flex items-center justify-between text-left"
                                  >
                                    <span className="text-xs font-semibold" style={{ color: COLORS.warningText }}>
                                      {zeroClaimCodes.length} STC categories had 0 claims
                                    </span>
                                    <ChevronDown
                                      className={`h-4 w-4 transition-transform ${showZeroClaimCodes ? 'rotate-180' : ''}`}
                                      style={{ color: COLORS.warningText }}
                                    />
                                  </button>
                                  {showZeroClaimCodes && (
                                    <div className="px-3 pb-3 space-y-1">
                                      {zeroClaimCodes.map((code, idx) => (
                                        <p key={idx} className="text-xs" style={{ color: COLORS.warningText }}>
                                          <span className="font-mono font-semibold">{code.code}</span>: {code.name}
                                          <span style={{ color: COLORS.warningText }}> (€{code.fee})</span>
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </>
                      ) : (
                        <div className="text-center py-6 px-4" style={{ color: COLORS.textSecondary }}>
                          {/* Show total STC payment if available (hasTotalOnly) */}
                          {category.stcAnalysis.hasTotalOnly && category.stcAnalysis.totalSTCPayment > 0 && (
                            <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: COLORS.bgPage }}>
                              <p className="text-sm" style={{ color: COLORS.textPrimary }}>
                                Your PCRS data shows <strong style={{ color: COLORS.incomeColor }}>
                                  {formatCurrency(category.stcAnalysis.totalSTCPayment)}
                                </strong> in STC income
                              </p>
                            </div>
                          )}
                          <AlertCircle className="h-8 w-8 mx-auto mb-3" style={{ color: COLORS.warning }} />
                          <p className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>
                            Detailed STC Analysis Requires Re-Upload
                          </p>
                          <p className="text-xs mt-2 max-w-md mx-auto">
                            Your PCRS statements were uploaded before this feature was added.
                            To see detailed STC analysis by service code (CF, CG, AD, K, etc.),
                            please go to <strong>GMS Panel Analysis</strong>, delete your existing
                            statements, and re-upload them.
                          </p>
                          {onOpenPCRSUpload && (
                            <button
                              onClick={onOpenPCRSUpload}
                              className="mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                              style={{
                                backgroundColor: COLORS.slainteBlue,
                                color: 'white',
                                cursor: 'pointer'
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = COLORS.slainte}
                              onMouseLeave={(e) => e.target.style.backgroundColor = COLORS.slainteBlue}
                            >
                              Go to GMS Panel Analysis
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2. OPPORTUNITIES - Codes below benchmark */}
                    {category.stcAnalysis.opportunities && category.stcAnalysis.opportunities.length > 0 && (
                      <div className="p-4 rounded-lg border bg-white" style={{ borderColor: COLORS.borderLight }}>
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setShowSTCRecommendations(!showSTCRecommendations)}
                        >
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" style={{ color: COLORS.successDark }} />
                            <h5 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
                              Growth Opportunities
                            </h5>
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: COLORS.successLight, color: COLORS.successText }}>
                              {category.stcAnalysis.opportunities.length} opportunities
                            </span>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${showSTCRecommendations ? 'rotate-180' : ''}`}
                            style={{ color: COLORS.textSecondary }}
                          />
                        </div>
                        <p className="text-xs mt-2" style={{ color: COLORS.textSecondary }}>
                          Services where your activity is below typical benchmarks for your panel size.
                        </p>
                        {showSTCRecommendations && (
                          <div className="mt-3 space-y-2">
                            {category.stcAnalysis.opportunities.slice(0, 8).map((opp, idx) => (
                              <div key={idx} className="p-3 rounded border" style={{ borderColor: COLORS.successLighter, backgroundColor: COLORS.successLight }}>
                                <div className="flex items-start justify-between mb-1">
                                  <div>
                                    <p className="text-sm font-medium" style={{ color: COLORS.successText }}>
                                      {opp.code}: {opp.name}
                                    </p>
                                    <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                                      Current: {opp.currentClaims} claims • Expected: ~{opp.expectedClaims} claims/year
                                      {opp.performance !== null && ` (${opp.performance}% of benchmark)`}
                                    </p>
                                    {opp.benchmarkBasis && (
                                      <p className="text-xs italic" style={{ color: COLORS.textSecondary }}>
                                        {opp.benchmarkBasis}
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-sm font-bold whitespace-nowrap ml-2" style={{ color: COLORS.successDark }}>
                                    +{formatCurrency(opp.potentialValue)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Total Potential */}
                        {category.stcAnalysis.totalPotentialValue > 0 && (
                          <div className="mt-4 pt-3 border-t flex justify-between items-center" style={{ borderColor: COLORS.borderLight }}>
                            <p className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Total Growth Potential:</p>
                            <p className="text-xl font-bold" style={{ color: COLORS.successDark }}>
                              +{formatCurrency(category.stcAnalysis.totalPotentialValue)}/year
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. RECOMMENDATIONS - Actions to increase STC income */}
                    {category.stcAnalysis.recommendations && category.stcAnalysis.recommendations.length > 0 && (
                      <div className="p-4 rounded-lg border bg-white" style={{ borderColor: COLORS.borderLight }}>
                        <h5 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: COLORS.textPrimary }}>
                          <AlertCircle className="h-4 w-4" style={{ color: COLORS.warning }} />
                          Recommended Actions to Increase STC Income
                        </h5>
                        <div className="space-y-3">
                          {category.stcAnalysis.recommendations.map((rec, idx) => (
                            <div key={idx} className="p-3 rounded border-l-4" style={{ borderLeftColor: COLORS.warning, backgroundColor: COLORS.warningLighter }}>
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-sm font-medium" style={{ color: COLORS.warningText }}>{rec.title}</p>
                                  <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>{rec.description}</p>
                                </div>
                                <span className="text-sm font-bold whitespace-nowrap ml-2" style={{ color: COLORS.successDark }}>
                                  +{formatCurrency(rec.potentialValue)}
                                </span>
                              </div>
                              <ul className="mt-2 text-xs space-y-1" style={{ color: COLORS.textSecondary }}>
                                {rec.actions.map((action, aIdx) => (
                                  <li key={aIdx}>• {action}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SUCCESS MESSAGE - No significant gaps */}
                    {(!category.stcAnalysis.opportunities || category.stcAnalysis.opportunities.length === 0) && category.stcAnalysis.hasData && (
                      <div className="p-4 rounded-lg border-2" style={{ borderColor: COLORS.successDark, backgroundColor: COLORS.successLight }}>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5" style={{ color: COLORS.successDark }} />
                          <p className="text-sm font-medium" style={{ color: COLORS.successText }}>
                            Your STC activity is well-aligned with expected benchmarks for your panel size.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Expanded Breakdown */}
              {isExpanded && ((category.breakdown && category.breakdown.length > 0) || (category.id === 'diseaseManagement' && category.cdmAnalysis?.hasData)) && (
                <div className="border-t px-4 py-4 md:px-6" style={{ borderColor: COLORS.borderLight, backgroundColor: COLORS.bgPage }}>
                  <h4 className="text-sm font-semibold mb-3" style={{ color: COLORS.textPrimary }}>
                    {category.id === 'diseaseManagement' && category.cdmAnalysis?.hasData ? 'CDM Claims Analysis' : 'Calculation Breakdown'}
                  </h4>
                  {/* Show subsidy units and explanation for non-Practice Support categories only */}
                  {category.id !== 'practiceSupport' && category.subsidyUnits !== undefined && (
                    <p className="text-xs mb-3 p-2 rounded" style={{ backgroundColor: `${COLORS.slainteBlue}10`, color: COLORS.slainteBlue }}>
                      Subsidy Entitlement: {category.subsidyUnits.toFixed(2)} units (each unit = 1 full-time secretary + 1 full-time nurse subsidy)
                    </p>
                  )}
                  {category.id !== 'practiceSupport' && category.explanation && (
                    <p className="text-xs mb-3 p-2 rounded" style={{ backgroundColor: `${COLORS.slainteBlue}08`, color: COLORS.textPrimary }}>
                      {category.explanation}
                    </p>
                  )}
                  {/* Special display for leave details - Study Leave */}
                  {category.leaveDetails && category.leaveDetails.studyLeaveUnclaimedDays > 0 && (
                    <div className="mb-3 p-3 rounded border" style={{ backgroundColor: COLORS.warningLight, borderColor: COLORS.warning }}>
                      <p className="text-sm font-medium" style={{ color: COLORS.warningText }}>
                        ⚠️ Study Leave: {category.leaveDetails.studyLeaveUnclaimedDays} days unclaimed = {formatCurrency(category.leaveDetails.studyLeaveUnclaimedValue)} potential income
                      </p>
                      <p className="text-xs mt-1" style={{ color: COLORS.warningText }}>
                        Claim study leave by submitting CME certificates.
                      </p>
                    </div>
                  )}
                  {/* Special display for leave details - Annual Leave */}
                  {category.leaveDetails && category.leaveDetails.annualLeaveUnclaimedDays > 0 && (
                    <div className="mb-3 p-3 rounded border" style={{ backgroundColor: COLORS.infoLighter, borderColor: COLORS.slainteBlue }}>
                      <p className="text-sm font-medium" style={{ color: COLORS.infoText }}>
                        ⚠️ Annual Leave: {category.leaveDetails.annualLeaveUnclaimedDays} days unclaimed = {formatCurrency(category.leaveDetails.annualLeaveUnclaimedValue)} potential income
                      </p>
                      <p className="text-xs mt-1" style={{ color: COLORS.infoText }}>
                        Claim annual leave via PCRS form submission.
                      </p>
                    </div>
                  )}

                  {/* NEW: CDM Analysis - For Disease Management category */}
                  {category.id === 'diseaseManagement' && category.cdmAnalysis && category.cdmAnalysis.hasData && (
                    <div className="mb-4 p-4 rounded-lg border bg-white" style={{ borderColor: COLORS.borderLight }}>
                      <h5 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: COLORS.textPrimary }}>
                        <CheckCircle className="h-4 w-4" style={{ color: COLORS.error }} />
                        CDM Claims from PCRS (AQ/AM Codes)
                      </h5>
                      <p className="text-xs mb-3" style={{ color: COLORS.textSecondary }}>
                        These CDM claims appear in the STC section of PCRS statements but are shown here as they relate to Chronic Disease Management.
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr style={{ backgroundColor: COLORS.bgPage }}>
                              <th className="p-2 text-left border" style={{ borderColor: COLORS.borderLight }}>Code</th>
                              <th className="p-2 text-left border" style={{ borderColor: COLORS.borderLight }}>Service</th>
                              <th className="p-2 text-center border" style={{ borderColor: COLORS.borderLight }}>Claims</th>
                              <th className="p-2 text-right border" style={{ borderColor: COLORS.borderLight }}>Fee</th>
                              <th className="p-2 text-right border" style={{ borderColor: COLORS.borderLight }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {category.cdmAnalysis.claims.map((claim, idx) => (
                              <tr key={idx}>
                                <td className="p-2 border font-mono font-semibold" style={{ borderColor: COLORS.borderLight, color: COLORS.error }}>
                                  {claim.code}
                                </td>
                                <td className="p-2 border" style={{ borderColor: COLORS.borderLight }}>
                                  <div>
                                    <span className="text-sm font-medium">{claim.name}</span>
                                    {claim.description && (
                                      <p className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }}>{claim.description}</p>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2 border text-center font-medium" style={{ borderColor: COLORS.borderLight }}>
                                  {claim.count}
                                </td>
                                <td className="p-2 border text-right" style={{ borderColor: COLORS.borderLight, color: COLORS.textSecondary }}>
                                  {formatCurrency(claim.fee)}
                                </td>
                                <td className="p-2 border text-right font-medium" style={{ borderColor: COLORS.borderLight, color: COLORS.incomeColor }}>
                                  {formatCurrency(claim.total)}
                                </td>
                              </tr>
                            ))}
                            {/* Total row */}
                            <tr style={{ backgroundColor: COLORS.bgPage }}>
                              <td colSpan="2" className="p-2 border font-bold" style={{ borderColor: COLORS.borderLight }}>
                                Total CDM Claims
                              </td>
                              <td className="p-2 border text-center font-bold" style={{ borderColor: COLORS.borderLight }}>
                                {category.cdmAnalysis.totalClaims}
                              </td>
                              <td className="p-2 border" style={{ borderColor: COLORS.borderLight }}></td>
                              <td className="p-2 border text-right font-bold" style={{ borderColor: COLORS.borderLight, color: COLORS.incomeColor }}>
                                {formatCurrency(category.cdmAnalysis.totalAmount)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* CDM Growth Potential - based on disease register data */}
                      {category.cdmAnalysis.growthPotential?.hasData && (
                        <div className="mt-4 p-4 rounded-lg border" style={{ backgroundColor: COLORS.successLight, borderColor: COLORS.success }}>
                          <h6 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: COLORS.successText }}>
                            <TrendingUp className="h-4 w-4" />
                            CDM Growth Potential (Based on Disease Registers)
                          </h6>
                          <p className="text-xs mb-3" style={{ color: COLORS.successText }}>
                            Estimated additional income based on disease register patients with 75% target uptake rate.
                          </p>

                          <div className="space-y-3">
                            {category.cdmAnalysis.growthPotential.breakdown.map((item, idx) => (
                              <div key={idx} className="p-3 bg-white rounded border" style={{ borderColor: COLORS.successLighter }}>
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <span className="font-medium text-sm" style={{ color: COLORS.textPrimary }}>
                                      {item.category}
                                      {item.code && <span className="ml-2 text-xs font-mono" style={{ color: COLORS.textSecondary }}>({item.code})</span>}
                                    </span>
                                    <p className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }}>{item.description}</p>
                                  </div>
                                  <span className="font-bold text-sm" style={{ color: COLORS.success }}>
                                    +{formatCurrency(item.potentialValue)}
                                  </span>
                                </div>

                                <div className="grid grid-cols-4 gap-2 text-xs mt-2">
                                  <div className="p-2 rounded" style={{ backgroundColor: COLORS.bgPage }}>
                                    <span className="block font-medium" style={{ color: COLORS.textSecondary }}>Eligible</span>
                                    <span className="font-semibold" style={{ color: COLORS.textPrimary }}>{item.eligiblePatients}</span>
                                  </div>
                                  <div className="p-2 rounded" style={{ backgroundColor: COLORS.bgPage }}>
                                    <span className="block font-medium" style={{ color: COLORS.textSecondary }}>Expected</span>
                                    <span className="font-semibold" style={{ color: COLORS.textPrimary }}>{item.expectedAnnual}/yr</span>
                                  </div>
                                  <div className="p-2 rounded" style={{ backgroundColor: COLORS.bgPage }}>
                                    <span className="block font-medium" style={{ color: COLORS.textSecondary }}>Actual</span>
                                    <span className="font-semibold" style={{ color: COLORS.textPrimary }}>{item.actualClaims}</span>
                                  </div>
                                  <div className="p-2 rounded" style={{ backgroundColor: COLORS.errorLight }}>
                                    <span className="block font-medium" style={{ color: COLORS.error }}>Gap</span>
                                    <span className="font-semibold" style={{ color: COLORS.error }}>{item.gap}</span>
                                  </div>
                                </div>

                                {/* Show conditions breakdown for CDM Reviews */}
                                {item.conditions && item.conditions.length > 0 && (
                                  <div className="mt-2 pt-2 border-t" style={{ borderColor: COLORS.borderLight }}>
                                    <span className="text-xs font-medium" style={{ color: COLORS.textSecondary }}>Conditions: </span>
                                    <span className="text-xs" style={{ color: COLORS.textPrimary }}>
                                      {item.conditions.map(c => `${c.name} (${c.patients})`).join(', ')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Total Growth Potential */}
                          <div className="mt-3 p-3 rounded-lg flex justify-between items-center" style={{ backgroundColor: COLORS.successText }}>
                            <span className="font-semibold text-white">Total CDM Growth Potential</span>
                            <span className="text-lg font-bold text-white">
                              +{formatCurrency(category.cdmAnalysis.growthPotential.totalValue)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Message when no disease register data */}
                      {!category.cdmAnalysis.growthPotential?.hasData && (
                        <div className="mt-4 p-3 rounded-lg border" style={{ backgroundColor: COLORS.warningLight, borderColor: COLORS.warning }}>
                          <p className="text-sm" style={{ color: COLORS.warningText }}>
                            <strong>💡 Tip:</strong> Enter your disease register counts in the Health Check Data form to calculate CDM growth potential.
                          </p>
                          <p className="text-xs mt-1" style={{ color: COLORS.warningText }}>
                            <strong>CDM Treatment:</strong> Type 2 Diabetes, Asthma, COPD, Heart Failure, AF, IHD, Stroke/TIA
                          </p>
                          <p className="text-xs mt-1" style={{ color: COLORS.warningText }}>
                            <strong>Prevention Programme:</strong> Hypertension (18+), Pre-diabetes (45+), QRISK≥20%, GDM/Pre-eclampsia history
                          </p>
                          <p className="text-xs mt-1" style={{ color: COLORS.warningText }}>
                            <strong>OCF:</strong> Patients 45+ with risk factors (smoker, BMI≥30, dyslipidaemia) not on CDM/PP
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* NEW: Capitation Analysis - Registration Status Checks */}
                  {category.id === 'capitation' && category.capitationAnalysis && (
                    <div className="mb-4 space-y-4">
                      {/* Registration Status Table */}
                      {category.capitationAnalysis.registrationChecks && category.capitationAnalysis.registrationChecks.length > 0 && (
                        <div className="p-4 rounded-lg border bg-white" style={{ borderColor: COLORS.borderLight }}>
                          <h5 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: COLORS.textPrimary }}>
                            <CheckCircle className="h-4 w-4" />
                            Registration Status (EHR vs PCRS)
                          </h5>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr style={{ backgroundColor: COLORS.bgPage }}>
                                  <th className="p-2 text-left border" style={{ borderColor: COLORS.borderLight }}>Category</th>
                                  <th className="p-2 text-center border" style={{ borderColor: COLORS.borderLight }}>EHR Count</th>
                                  <th className="p-2 text-center border" style={{ borderColor: COLORS.borderLight }}>PCRS Registered</th>
                                  <th className="p-2 text-center border" style={{ borderColor: COLORS.borderLight }}>Status</th>
                                  <th className="p-2 text-right border" style={{ borderColor: COLORS.borderLight }}>Potential Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {category.capitationAnalysis.registrationChecks.map((check, idx) => (
                                  <tr key={idx}>
                                    <td className="p-2 border font-medium" style={{ borderColor: COLORS.borderLight }}>{check.category}</td>
                                    <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>{check.ehrCount}</td>
                                    <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>
                                      {check.pcrsCount !== undefined ? check.pcrsCount : '—'}
                                    </td>
                                    <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>
                                      {check.status === 'ok' && (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: COLORS.successLighter, color: COLORS.successText }}>
                                          {check.statusText}
                                        </span>
                                      )}
                                      {check.status === 'gap' && (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: COLORS.errorLight, color: COLORS.errorText }}>
                                          ⚠️ {check.statusText}
                                        </span>
                                      )}
                                      {check.status === 'review' && (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: COLORS.warningLight, color: COLORS.warningText }}>
                                          🔍 {check.statusText}
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2 border text-right font-medium" style={{ borderColor: COLORS.borderLight, color: check.potentialValue > 0 ? COLORS.incomeColor : COLORS.textSecondary }}>
                                      {check.potentialValue > 0 ? formatCurrency(check.potentialValue) : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Action items for gaps */}
                          {category.capitationAnalysis.registrationChecks.some(c => c.status === 'gap' || c.status === 'review') && (
                            <div className="mt-4 space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.textSecondary }}>Action Required:</p>
                              {category.capitationAnalysis.registrationChecks.filter(c => c.status === 'gap' || c.status === 'review').map((check, idx) => (
                                <div key={idx} className="p-3 rounded border-l-4" style={{
                                  borderLeftColor: check.priority === 'high' ? COLORS.error : COLORS.warning,
                                  backgroundColor: check.priority === 'high' ? COLORS.errorLighter : COLORS.warningLighter
                                }}>
                                  <p className="text-sm font-medium" style={{ color: check.priority === 'high' ? COLORS.errorText : COLORS.warningText }}>
                                    {check.category}: {check.action}
                                  </p>
                                  {check.explanation && (
                                    <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>{check.explanation}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Total potential value */}
                          {category.capitationAnalysis.totalPotentialValue > 0 && (
                            <div className="mt-4 pt-3 border-t flex justify-between items-center" style={{ borderColor: COLORS.borderLight }}>
                              <p className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Total Registration Gap Value:</p>
                              <p className="text-xl font-bold" style={{ color: COLORS.incomeColor }}>
                                {formatCurrency(category.capitationAnalysis.totalPotentialValue)}/year
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Ages 5-8 Check (Special - not in PCRS data) - Collapsible */}
                      {category.capitationAnalysis.age5to8Check && category.capitationAnalysis.age5to8Check.estimatedCount > 0 && (
                        <div className="p-4 rounded-lg border bg-white" style={{ borderColor: COLORS.borderLight }}>
                          <div
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => setShowAge5to8Details(!showAge5to8Details)}
                          >
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" style={{ color: COLORS.slainteBlue }} />
                              <h5 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
                                {category.capitationAnalysis.age5to8Check.category}
                              </h5>
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${COLORS.slainteBlue}15`, color: COLORS.slainteBlue }}>
                                ~{category.capitationAnalysis.age5to8Check.estimatedCount} children
                              </span>
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${showAge5to8Details ? 'rotate-180' : ''}`}
                              style={{ color: COLORS.textSecondary }}
                            />
                          </div>
                          <p className="text-xs mt-2" style={{ color: COLORS.textSecondary }}>
                            {category.capitationAnalysis.age5to8Check.explanation}
                          </p>
                          {showAge5to8Details && (
                            <div className="mt-3 p-3 rounded border" style={{ borderColor: COLORS.borderLight, backgroundColor: COLORS.bgPage }}>
                              <p className="text-sm font-medium mb-2" style={{ color: COLORS.textPrimary }}>
                                → {category.capitationAnalysis.age5to8Check.action}
                              </p>
                              <p className="text-xs font-medium mb-1" style={{ color: COLORS.textPrimary }}>How to check in your EHR:</p>
                              <ul className="text-xs space-y-1" style={{ color: COLORS.textSecondary }}>
                                <li><strong>Socrates:</strong> {category.capitationAnalysis.age5to8Check.ehrGuidance.socrates}</li>
                                <li><strong>Helix:</strong> {category.capitationAnalysis.age5to8Check.ehrGuidance.helix}</li>
                                <li><strong>Complete GP:</strong> {category.capitationAnalysis.age5to8Check.ehrGuidance.complete}</li>
                                <li><strong>Other:</strong> {category.capitationAnalysis.age5to8Check.ehrGuidance.general}</li>
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Panel Size Assessment - Growth Opportunity (green highlighted) */}
                      {category.capitationAnalysis.panelAssessment && (
                        <div
                          className="p-4 rounded-lg border-2"
                          style={{
                            borderColor: COLORS.successDark,
                            backgroundColor: COLORS.successLight
                          }}
                        >
                          <h5 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: COLORS.successText }}>
                            <TrendingUp className="h-4 w-4" />
                            {category.capitationAnalysis.panelAssessment.status === 'healthy'
                              ? 'Panel Size Status'
                              : 'Growth Opportunity: Panel Expansion'
                            }
                          </h5>
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="text-center p-2 bg-white rounded border" style={{ borderColor: COLORS.successLighter }}>
                              <p className="text-xs" style={{ color: COLORS.textSecondary }}>Total Panel</p>
                              <p className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>
                                {category.capitationAnalysis.panelAssessment.currentPanelSize?.toLocaleString() || 'N/A'}
                              </p>
                            </div>
                            <div className="text-center p-2 bg-white rounded border" style={{ borderColor: COLORS.successLighter }}>
                              <p className="text-xs" style={{ color: COLORS.textSecondary }}>Per GP</p>
                              <p className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>
                                {category.capitationAnalysis.panelAssessment.patientsPerGP?.toLocaleString() || 'N/A'}
                              </p>
                            </div>
                            <div className="text-center p-2 bg-white rounded border" style={{ borderColor: COLORS.successLighter }}>
                              <p className="text-xs" style={{ color: COLORS.textSecondary }}>GPs</p>
                              <p className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>
                                {category.capitationAnalysis.panelAssessment.numGPs || 'N/A'}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm" style={{ color: COLORS.successText }}>
                            {category.capitationAnalysis.panelAssessment.status === 'healthy'
                              ? '✓ ' + category.capitationAnalysis.panelAssessment.recommendation
                              : '📈 ' + category.capitationAnalysis.panelAssessment.recommendation
                            }
                          </p>
                          {category.capitationAnalysis.panelAssessment.note && (
                            <p className="text-xs mt-2 italic" style={{ color: COLORS.textSecondary }}>
                              Note: {category.capitationAnalysis.panelAssessment.note}
                            </p>
                          )}
                          {category.capitationAnalysis.panelAssessment.status !== 'healthy' &&
                           category.capitationAnalysis.panelAssessment.potentialValue > 0 && (
                            <div className="mt-3 pt-3 border-t flex justify-between items-center" style={{ borderColor: COLORS.successLighter }}>
                              <p className="text-sm" style={{ color: COLORS.successText }}>
                                Additional {category.capitationAnalysis.panelAssessment.shortfall} patients could add:
                              </p>
                              <p className="text-lg font-bold" style={{ color: COLORS.successDark }}>
                                +{formatCurrency(category.capitationAnalysis.panelAssessment.potentialValue)}/year
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* NEW: Comprehensive Practice Support Analysis - Matches Capitation layout */}
                  {category.id === 'practiceSupport' && category.entitlement && (
                    <div className="mb-4 space-y-4">
                      {/* DETAILED STAFF TABLE - Shows each staff member's PCRS payment status */}
                      {category.current && (category.current.receptionists?.staff?.length > 0 || category.current.nurses?.staff?.length > 0 || category.current.practiceManager?.staff?.length > 0) && (
                        <div className="p-4 rounded-lg border bg-white" style={{ borderColor: COLORS.borderLight }}>
                          <h5 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: COLORS.textPrimary }}>
                            <User className="h-4 w-4" />
                            PCRS Payment Status per Staff Member
                          </h5>
                          <p className="text-xs mb-3" style={{ color: COLORS.textSecondary }}>
                            This shows what PCRS is currently paying for each staff member (from your PCRS statements).
                          </p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr style={{ backgroundColor: COLORS.bgPage }}>
                                  <th className="p-2 text-left border" style={{ borderColor: COLORS.borderLight }}>Staff Member</th>
                                  <th className="p-2 text-center border" style={{ borderColor: COLORS.borderLight }}>Role</th>
                                  <th className="p-2 text-center border" style={{ borderColor: COLORS.borderLight }}>PCRS Hours</th>
                                  <th className="p-2 text-center border" style={{ borderColor: COLORS.borderLight }}>Increment Point</th>
                                  <th className="p-2 text-center border" style={{ borderColor: COLORS.borderLight }}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {/* Combine all staff from current (PCRS data) */}
                                {[
                                  ...(category.current?.receptionists?.staff || []).map(s => ({ ...s, roleLabel: 'Receptionist' })),
                                  ...(category.current?.nurses?.staff || []).map(s => ({ ...s, roleLabel: 'Nurse' })),
                                  ...(category.current?.practiceManager?.staff || []).map(s => ({ ...s, roleLabel: 'Practice Manager' })),
                                  ...(category.current?.unknown?.staff || []).map(s => ({ ...s, roleLabel: 'Unknown Role' }))
                                ].map((staff, idx) => {
                                  // Check if this staff member has an issue
                                  const staffIssue = category.issues?.find(i =>
                                    i.type === 'WRONG_INCREMENT' &&
                                    i.staffName === `${staff.firstName} ${staff.surname}`
                                  );
                                  const hasIssue = !!staffIssue;
                                  const hoursOk = (staff.weeklyHours || 0) <= 35;

                                  return (
                                    <tr key={idx}>
                                      <td className="p-2 border font-medium" style={{ borderColor: COLORS.borderLight }}>
                                        {staff.firstName} {staff.surname}
                                      </td>
                                      <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>
                                        {staff.roleLabel}
                                      </td>
                                      <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>
                                        {staff.weeklyHours || 0} hrs/wk
                                        {(staff.weeklyHours || 0) > 35 && (
                                          <span className="ml-1 text-xs" style={{ color: COLORS.error }}>(max 35)</span>
                                        )}
                                      </td>
                                      <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>
                                        Point {staff.incrementPoint || 1}
                                        {staffIssue && (
                                          <span className="ml-1 text-xs" style={{ color: COLORS.error }}>
                                            (should be {staffIssue.correctIncrement})
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>
                                        {!hasIssue && hoursOk ? (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: COLORS.successLighter, color: COLORS.successText }}>
                                            Correct ✓
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: COLORS.errorLight, color: COLORS.errorText }}>
                                            ⚠️ Review
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {/* Note about max PCRS hours */}
                          <p className="text-xs mt-3 p-2 rounded" style={{ backgroundColor: COLORS.bgPage, color: COLORS.textSecondary }}>
                            <strong>Note:</strong> PCRS will subsidise a maximum of 35 hours per week per staff member, even if they work more hours.
                          </p>
                        </div>
                      )}

                      {/* 1. TABLE - Staff Status Comparison (like Capitation registration table) */}
                      {(category.current || category.employed) && (
                        <div className="p-4 rounded-lg border bg-white" style={{ borderColor: COLORS.borderLight }}>
                          <h5 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: COLORS.textPrimary }}>
                            <Users className="h-4 w-4" />
                            Staff Subsidy Summary
                          </h5>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr style={{ backgroundColor: COLORS.bgPage }}>
                                  <th className="p-2 text-left border" style={{ borderColor: COLORS.borderLight }}>Category</th>
                                  <th className="p-2 text-center border" style={{ borderColor: COLORS.borderLight }}>Entitled</th>
                                  <th className="p-2 text-center border" style={{ borderColor: COLORS.borderLight }}>PCRS Paying</th>
                                  <th className="p-2 text-center border" style={{ borderColor: COLORS.borderLight }}>You Employ</th>
                                  <th className="p-2 text-center border" style={{ borderColor: COLORS.borderLight }}>Status</th>
                                  <th className="p-2 text-right border" style={{ borderColor: COLORS.borderLight }}>Potential Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {/* Receptionists row */}
                                {(() => {
                                  const entitled = category.entitlement?.totalHours || 0;
                                  const pcrs = category.current?.receptionists?.hours || 0;
                                  const employed = category.employed?.receptionists?.hours || 0;
                                  const canClaim = pcrs < entitled && employed >= pcrs ? Math.min(employed, entitled) - pcrs : 0;
                                  const hiringGap = employed < entitled ? entitled - employed : 0;
                                  const recIssue = category.issues?.find(i => i.type === 'UNCLAIMED_HOURS' && i.category === 'receptionists');
                                  const potentialValue = recIssue?.potentialGain || 0;

                                  let status = 'ok';
                                  let statusText = 'Maximised ✓';
                                  if (canClaim > 0) { status = 'gap'; statusText = `${canClaim} hrs unclaimed`; }
                                  else if (hiringGap > 0) { status = 'opportunity'; statusText = 'Hiring opportunity'; }

                                  return (
                                    <tr>
                                      <td className="p-2 border font-medium" style={{ borderColor: COLORS.borderLight }}>Receptionists</td>
                                      <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>{entitled} hrs</td>
                                      <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>{pcrs} hrs</td>
                                      <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>{employed} hrs</td>
                                      <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>
                                        {status === 'ok' && (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: COLORS.successLighter, color: COLORS.successText }}>
                                            {statusText}
                                          </span>
                                        )}
                                        {status === 'gap' && (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: COLORS.errorLight, color: COLORS.errorText }}>
                                            ⚠️ {statusText}
                                          </span>
                                        )}
                                        {status === 'opportunity' && (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: COLORS.successLighter, color: COLORS.successText }}>
                                            📈 {statusText}
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-2 border text-right font-medium" style={{ borderColor: COLORS.borderLight, color: potentialValue > 0 ? COLORS.incomeColor : COLORS.textSecondary }}>
                                        {potentialValue > 0 ? formatCurrency(potentialValue) : '—'}
                                      </td>
                                    </tr>
                                  );
                                })()}
                                {/* Nurses/PM row */}
                                {(() => {
                                  const entitled = category.entitlement?.totalHours || 0;
                                  const pcrs = category.current?.totalNursesPMHours || 0;
                                  const employed = category.employed?.totalNursesPMHours || 0;
                                  const canClaim = pcrs < entitled && employed >= pcrs ? Math.min(employed, entitled) - pcrs : 0;
                                  const hiringGap = employed < entitled ? entitled - employed : 0;
                                  const nurseIssue = category.issues?.find(i => i.type === 'UNCLAIMED_HOURS' && i.category === 'nurses/practiceManager');
                                  const potentialValue = nurseIssue?.potentialGain || 0;

                                  let status = 'ok';
                                  let statusText = 'Maximised ✓';
                                  if (canClaim > 0) { status = 'gap'; statusText = `${canClaim} hrs unclaimed`; }
                                  else if (hiringGap > 0) { status = 'opportunity'; statusText = 'Hiring opportunity'; }

                                  return (
                                    <tr>
                                      <td className="p-2 border font-medium" style={{ borderColor: COLORS.borderLight }}>Nurses/PM</td>
                                      <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>{entitled} hrs</td>
                                      <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>{pcrs} hrs</td>
                                      <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>{employed} hrs</td>
                                      <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>
                                        {status === 'ok' && (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: COLORS.successLighter, color: COLORS.successText }}>
                                            {statusText}
                                          </span>
                                        )}
                                        {status === 'gap' && (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: COLORS.errorLight, color: COLORS.errorText }}>
                                            ⚠️ {statusText}
                                          </span>
                                        )}
                                        {status === 'opportunity' && (
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: COLORS.successLighter, color: COLORS.successText }}>
                                            📈 {statusText}
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-2 border text-right font-medium" style={{ borderColor: COLORS.borderLight, color: potentialValue > 0 ? COLORS.incomeColor : COLORS.textSecondary }}>
                                        {potentialValue > 0 ? formatCurrency(potentialValue) : '—'}
                                      </td>
                                    </tr>
                                  );
                                })()}
                              </tbody>
                            </table>
                          </div>

                          {/* Action items for issues (like Capitation "Action Required") */}
                          {category.issues && category.issues.length > 0 && (
                            <div className="mt-4 space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.textSecondary }}>Action Required:</p>
                              {category.issues.map((issue, idx) => (
                                <div key={idx} className="p-3 rounded border-l-4" style={{
                                  borderLeftColor: issue.priority === 1 ? COLORS.error : COLORS.warning,
                                  backgroundColor: issue.priority === 1 ? COLORS.errorLighter : COLORS.warningLighter
                                }}>
                                  <div className="flex items-start justify-between">
                                    <p className="text-sm font-medium" style={{ color: issue.priority === 1 ? COLORS.errorText : COLORS.warningText }}>
                                      {issue.type === 'WRONG_INCREMENT' ? 'Wrong Increment Point: ' : 'Unclaimed Hours: '}
                                      {issue.message}
                                    </p>
                                    <span className="text-sm font-bold whitespace-nowrap ml-2" style={{ color: COLORS.incomeColor }}>
                                      +{formatCurrency(issue.annualLoss || issue.potentialGain || 0)}/yr
                                    </span>
                                  </div>
                                  <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>{issue.action}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Total potential value (like Capitation) */}
                          {category.totalRecoverable > 0 && (
                            <div className="mt-4 pt-3 border-t flex justify-between items-center" style={{ borderColor: COLORS.borderLight }}>
                              <p className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Total Recoverable Value:</p>
                              <p className="text-xl font-bold" style={{ color: COLORS.incomeColor }}>
                                {formatCurrency(category.totalRecoverable)}/year
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 2. COLLAPSIBLE INFO - Entitlement Details (like Ages 5-8 in Capitation) */}
                      <div className="p-4 rounded-lg border bg-white" style={{ borderColor: COLORS.borderLight }}>
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setShowEntitlementDetails(!showEntitlementDetails)}
                        >
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" style={{ color: COLORS.slainteBlue }} />
                            <h5 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
                              Your Entitlement (Based on Panel Size)
                            </h5>
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${COLORS.slainteBlue}15`, color: COLORS.slainteBlue }}>
                              {category.entitlement.subsidyUnits?.toFixed(2)} subsidy units
                            </span>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${showEntitlementDetails ? 'rotate-180' : ''}`}
                            style={{ color: COLORS.textSecondary }}
                          />
                        </div>
                        <p className="text-xs mt-2" style={{ color: COLORS.textSecondary }}>
                          Based on weighted panel of {category.weightedPanel?.toLocaleString()} with {category.numGPs} GPs
                        </p>
                        {showEntitlementDetails && (
                          <div className="mt-3 p-3 rounded border" style={{ borderColor: COLORS.borderLight, backgroundColor: COLORS.bgPage }}>
                            <p className="text-sm mb-3" style={{ color: COLORS.textPrimary }}>
                              {category.entitlement.explanation}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="p-3 bg-white rounded border" style={{ borderColor: COLORS.borderLight }}>
                                <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: COLORS.textSecondary }}>Receptionists</p>
                                <p className="text-lg font-bold" style={{ color: COLORS.slainteBlue }}>{category.entitlement.totalHours} hours/week</p>
                                <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                                  Up to {formatCurrency(category.entitlement.receptionists.maxAnnual)}/year at max rate
                                </p>
                              </div>
                              <div className="p-3 bg-white rounded border" style={{ borderColor: COLORS.borderLight }}>
                                <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: COLORS.textSecondary }}>Nurses / Practice Manager</p>
                                <p className="text-lg font-bold" style={{ color: COLORS.slainteBlue }}>{category.entitlement.totalHours} hours/week</p>
                                <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
                                  Up to {formatCurrency(category.entitlement.nursesOrPM.maxNurseAnnual)}/year at max rate
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 3. GROWTH OPPORTUNITY - Hiring Opportunities (green highlighted) */}
                      {category.opportunities && category.opportunities.length > 0 && (
                        <div className="p-4 rounded-lg border-2" style={{ borderColor: COLORS.successDark, backgroundColor: COLORS.successLight }}>
                          <h5 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: COLORS.successText }}>
                            <TrendingUp className="h-4 w-4" />
                            Growth Opportunities
                          </h5>
                          <div className="space-y-2">
                            {category.opportunities.map((opp, idx) => (
                              <div key={idx} className="p-3 rounded bg-white border" style={{ borderColor: COLORS.successLighter }}>
                                <div className="flex items-start justify-between">
                                  <p className="text-sm font-medium" style={{ color: COLORS.successText }}>
                                    {opp.type === 'HIRING_OPPORTUNITY' ? '📈 ' : '💰 '}{opp.message}
                                  </p>
                                  {opp.potentialValue > 0 && (
                                    <span className="text-sm font-bold whitespace-nowrap ml-2" style={{ color: COLORS.successDark }}>
                                      +{formatCurrency(opp.potentialValue)}/yr
                                    </span>
                                  )}
                                </div>
                                {opp.action && (
                                  <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>{opp.action}</p>
                                )}
                              </div>
                            ))}
                          </div>
                          {/* Capacity Grant */}
                          {category.entitlement?.capacityGrantEligible && (
                            <div className="mt-3 p-3 rounded bg-white border" style={{ borderColor: COLORS.successLighter }}>
                              <div
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => setShowCapacityGrantDetails(!showCapacityGrantDetails)}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium" style={{ color: COLORS.successText }}>
                                    💰 Capacity Grant: {formatCurrency(15000)} per GP available
                                  </span>
                                </div>
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${showCapacityGrantDetails ? 'rotate-180' : ''}`}
                                  style={{ color: COLORS.textSecondary }}
                                />
                              </div>
                              {showCapacityGrantDetails && (
                                <div className="mt-2 p-2 rounded text-xs" style={{ backgroundColor: COLORS.bgPage, color: COLORS.textSecondary }}>
                                  <p className="mb-1">The Capacity Grant (€15,000 per GP) is available for:</p>
                                  <ul className="list-disc ml-4 space-y-1">
                                    <li>Staff hired after July 2023</li>
                                    <li>Additional hours for existing staff after July 2023</li>
                                    <li>Only for practices with weighted panel 500+ per GP</li>
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* SUCCESS MESSAGE - Everything is optimised */}
                      {(!category.issues || category.issues.length === 0) && (!category.opportunities || category.opportunities.length === 0) && (
                        <div className="p-4 rounded-lg border-2" style={{ borderColor: COLORS.successDark, backgroundColor: COLORS.successLight }}>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5" style={{ color: COLORS.successDark }} />
                            <p className="text-sm font-medium" style={{ color: COLORS.successText }}>
                              Your Practice Support subsidies are fully optimised. You are claiming your full entitlement.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fallback for when no entitlement data but staff analysis exists */}
                  {category.id === 'practiceSupport' && !category.entitlement && category.staffAnalysis && (
                    <div className="mb-4">
                      {/* Legacy staff analysis display */}
                      {category.staffAnalysis.weightedPanel > 0 && (
                        <div className="mb-3 p-3 rounded border bg-white" style={{ borderColor: COLORS.borderLight }}>
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4" style={{ color: COLORS.slainteBlue }} />
                            <span className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>
                              Total Weighted Panel Size: {category.staffAnalysis.weightedPanel.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* NEW: Cervical Check Analysis - Consistent layout with Capitation and Practice Support */}
                  {category.id === 'cervicalCheck' && category.cervicalScreeningAnalysis && (
                    <div className="mb-4 space-y-4">
                      {/* 1. TABLE - Smear Payment Status */}
                      <div className="p-4 rounded-lg border bg-white" style={{ borderColor: COLORS.borderLight }}>
                        <h5 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: COLORS.textPrimary }}>
                          <CheckCircle className="h-4 w-4" />
                          Smear Payment Status (PCRS Data)
                        </h5>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr style={{ backgroundColor: COLORS.bgPage }}>
                                <th className="p-2 text-left border" style={{ borderColor: COLORS.borderLight }}>Category</th>
                                <th className="p-2 text-center border" style={{ borderColor: COLORS.borderLight }}>Count</th>
                                <th className="p-2 text-center border" style={{ borderColor: COLORS.borderLight }}>Status</th>
                                <th className="p-2 text-right border" style={{ borderColor: COLORS.borderLight }}>Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="p-2 border font-medium" style={{ borderColor: COLORS.borderLight }}>Smears Performed</td>
                                <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>{category.cervicalScreeningAnalysis.totalSmearsPerformed}</td>
                                <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: `${COLORS.slainteBlue}15`, color: COLORS.slainteBlue }}>
                                    Total Activity
                                  </span>
                                </td>
                                <td className="p-2 border text-right" style={{ borderColor: COLORS.borderLight, color: COLORS.textSecondary }}>—</td>
                              </tr>
                              <tr>
                                <td className="p-2 border font-medium" style={{ borderColor: COLORS.borderLight }}>Smears Paid</td>
                                <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>{category.cervicalScreeningAnalysis.smearsPaid}</td>
                                <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: COLORS.successLighter, color: COLORS.successText }}>
                                    {category.cervicalScreeningAnalysis.paidRate}% Paid ✓
                                  </span>
                                </td>
                                <td className="p-2 border text-right font-medium" style={{ borderColor: COLORS.borderLight, color: COLORS.incomeColor }}>
                                  {formatCurrency(category.cervicalScreeningAnalysis.totalPaidAmount)}
                                </td>
                              </tr>
                              {category.cervicalScreeningAnalysis.smearsZeroPayment > 0 && (
                                <tr>
                                  <td className="p-2 border font-medium" style={{ borderColor: COLORS.borderLight }}>Zero Payment Smears</td>
                                  <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>{category.cervicalScreeningAnalysis.smearsZeroPayment}</td>
                                  <td className="p-2 border text-center" style={{ borderColor: COLORS.borderLight }}>
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: COLORS.errorLight, color: COLORS.errorText }}>
                                      ⚠️ No Payment
                                    </span>
                                  </td>
                                  <td className="p-2 border text-right font-medium" style={{ borderColor: COLORS.borderLight, color: COLORS.error }}>
                                    -{formatCurrency(category.cervicalScreeningAnalysis.lostIncome)}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* 2. ACTION REQUIRED - Zero Payment Reasons */}
                        {category.cervicalScreeningAnalysis.recommendations && category.cervicalScreeningAnalysis.recommendations.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.textSecondary }}>Action Required:</p>
                            {category.cervicalScreeningAnalysis.recommendations
                              .filter(rec => rec.preventable && rec.count > 0)
                              .map((rec, idx) => (
                              <div key={idx} className="p-3 rounded border-l-4" style={{
                                borderLeftColor: COLORS.error,
                                backgroundColor: COLORS.errorLighter
                              }}>
                                <div className="flex items-start justify-between">
                                  <p className="text-sm font-medium" style={{ color: COLORS.errorText }}>
                                    {rec.reason}: {rec.count} smear{rec.count > 1 ? 's' : ''}
                                  </p>
                                  <span className="text-sm font-bold whitespace-nowrap ml-2" style={{ color: COLORS.error }}>
                                    -{formatCurrency(rec.count * 49.10)}
                                  </span>
                                </div>
                                <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>{rec.advice}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 3. TOTAL RECOVERABLE VALUE */}
                        {category.cervicalScreeningAnalysis.lostIncome > 0 && (
                          <div className="mt-4 pt-3 border-t flex justify-between items-center" style={{ borderColor: COLORS.borderLight }}>
                            <p className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>Total Recoverable (Admin Fixes):</p>
                            <p className="text-xl font-bold" style={{ color: COLORS.incomeColor }}>
                              {formatCurrency(category.cervicalScreeningAnalysis.lostIncome)}/year
                            </p>
                          </div>
                        )}
                      </div>

                      {/* 4. COLLAPSIBLE INFO - All Zero Payment Reasons */}
                      {category.cervicalScreeningAnalysis.recommendations && category.cervicalScreeningAnalysis.recommendations.length > 0 && (
                        <div className="p-4 rounded-lg border bg-white" style={{ borderColor: COLORS.borderLight }}>
                          <div
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => setShowCervicalRecommendations(!showCervicalRecommendations)}
                          >
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" style={{ color: COLORS.slainteBlue }} />
                              <h5 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
                                Zero Payment Breakdown
                              </h5>
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${COLORS.slainteBlue}15`, color: COLORS.slainteBlue }}>
                                {category.cervicalScreeningAnalysis.recommendations.length} reasons
                              </span>
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${showCervicalRecommendations ? 'rotate-180' : ''}`}
                              style={{ color: COLORS.textSecondary }}
                            />
                          </div>
                          <p className="text-xs mt-2" style={{ color: COLORS.textSecondary }}>
                            Understanding why smears were not paid helps prevent future lost income.
                          </p>
                          {showCervicalRecommendations && (
                            <div className="mt-3 space-y-2">
                              {category.cervicalScreeningAnalysis.recommendations.map((rec, idx) => (
                                <div key={idx} className="p-3 rounded border" style={{ borderColor: COLORS.borderLight, backgroundColor: COLORS.bgPage }}>
                                  <div className="flex items-start justify-between mb-1">
                                    <p className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>
                                      {rec.preventable ? '🔧 ' : 'ℹ️ '}{rec.reason}
                                    </p>
                                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                                      backgroundColor: rec.preventable ? COLORS.errorLight : `${COLORS.textSecondary}20`,
                                      color: rec.preventable ? COLORS.errorText : COLORS.textSecondary
                                    }}>
                                      {rec.count} smear{rec.count > 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  <p className="text-xs" style={{ color: COLORS.textSecondary }}>{rec.advice}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 5. GROWTH OPPORTUNITY - Combined with Expected Annual Smears (collapsible) */}
                      {(category.cervicalScreeningAnalysis.eligible25to44 > 0 || category.cervicalScreeningAnalysis.eligible45to65 > 0) && (
                        <div className="p-4 rounded-lg border-2" style={{ borderColor: COLORS.successDark, backgroundColor: COLORS.successLight }}>
                          <div
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => setShowCervicalTargetDetails(!showCervicalTargetDetails)}
                          >
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4" style={{ color: COLORS.successText }} />
                              <h5 className="text-sm font-semibold" style={{ color: COLORS.successText }}>
                                Growth Opportunity: Expected Annual Smears
                              </h5>
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: COLORS.successLighter, color: COLORS.successText }}>
                                Target: {category.cervicalScreeningAnalysis.targetSmears || (Math.round((category.cervicalScreeningAnalysis.eligible25to44 || 0) / 3) + Math.round((category.cervicalScreeningAnalysis.eligible45to65 || 0) / 5))} smears/year
                              </span>
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${showCervicalTargetDetails ? 'rotate-180' : ''}`}
                              style={{ color: COLORS.successText }}
                            />
                          </div>
                          <p className="text-xs mt-2" style={{ color: COLORS.successText }}>
                            Based on your eligible patient population, here's how many smears you should aim to perform each year.
                          </p>

                          {showCervicalTargetDetails && (
                            <div className="mt-3 space-y-3">
                              {/* Calculation breakdown */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="p-3 bg-white rounded border" style={{ borderColor: COLORS.successLighter }}>
                                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: COLORS.textSecondary }}>Women 25-44</p>
                                  <p className="text-lg font-bold" style={{ color: COLORS.successDark }}>
                                    {category.cervicalScreeningAnalysis.eligible25to44 || 0}
                                  </p>
                                  <p className="text-xs" style={{ color: COLORS.textSecondary }}>÷ 3 years = <strong>{category.cervicalScreeningAnalysis.smearsFrom25to44 || Math.round((category.cervicalScreeningAnalysis.eligible25to44 || 0) / 3)}</strong> smears/year</p>
                                </div>
                                <div className="p-3 bg-white rounded border" style={{ borderColor: COLORS.successLighter }}>
                                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: COLORS.textSecondary }}>Women 45-65</p>
                                  <p className="text-lg font-bold" style={{ color: COLORS.successDark }}>
                                    {category.cervicalScreeningAnalysis.eligible45to65 || 0}
                                  </p>
                                  <p className="text-xs" style={{ color: COLORS.textSecondary }}>÷ 5 years = <strong>{category.cervicalScreeningAnalysis.smearsFrom45to65 || Math.round((category.cervicalScreeningAnalysis.eligible45to65 || 0) / 5)}</strong> smears/year</p>
                                </div>
                                <div className="p-3 bg-white rounded border" style={{ borderColor: COLORS.successDark }}>
                                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: COLORS.textSecondary }}>Target Smears/Year</p>
                                  <p className="text-2xl font-bold" style={{ color: COLORS.successDark }}>
                                    {category.cervicalScreeningAnalysis.targetSmears || (Math.round((category.cervicalScreeningAnalysis.eligible25to44 || 0) / 3) + Math.round((category.cervicalScreeningAnalysis.eligible45to65 || 0) / 5))}
                                  </p>
                                  <p className="text-xs" style={{ color: COLORS.textSecondary }}>@ €49.10 each</p>
                                </div>
                              </div>

                              {/* Formula explanation */}
                              <div className="p-3 rounded bg-white border" style={{ borderColor: COLORS.successLighter }}>
                                <p className="text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>How this is calculated:</p>
                                <p className="text-xs" style={{ color: COLORS.textSecondary }}>
                                  <strong>Women aged 25-44</strong> are screened every <strong>3 years</strong>, so divide by 3 to get annual target.<br/>
                                  <strong>Women aged 45-65</strong> are screened every <strong>5 years</strong>, so divide by 5 to get annual target.<br/>
                                  <strong>Formula:</strong> (Eligible 25-44 ÷ 3) + (Eligible 45-65 ÷ 5) = Target smears per year
                                </p>
                              </div>

                              {/* Potential income */}
                              <div className="p-3 rounded bg-white border" style={{ borderColor: COLORS.successLighter }}>
                                <div className="flex items-center justify-between">
                                  <p className="text-sm" style={{ color: COLORS.successText }}>
                                    Potential annual income at target:
                                  </p>
                                  <p className="text-lg font-bold" style={{ color: COLORS.successDark }}>
                                    {formatCurrency((category.cervicalScreeningAnalysis.targetSmears || (Math.round((category.cervicalScreeningAnalysis.eligible25to44 || 0) / 3) + Math.round((category.cervicalScreeningAnalysis.eligible45to65 || 0) / 5))) * 49.10)}/year
                                  </p>
                                </div>
                                <p className="text-xs mt-2" style={{ color: COLORS.textSecondary }}>
                                  Consider proactive recall for eligible women, opportunistic screening during consultations, and ensuring all eligible patients are aware of the CervicalCheck programme.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* SUCCESS MESSAGE - Everything is optimised (only show if no eligible population data) */}
                      {category.cervicalScreeningAnalysis.smearsZeroPayment === 0 &&
                       !(category.cervicalScreeningAnalysis.eligible25to44 > 0 || category.cervicalScreeningAnalysis.eligible45to65 > 0) && (
                        <div className="p-4 rounded-lg border-2" style={{ borderColor: COLORS.successDark, backgroundColor: COLORS.successLight }}>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5" style={{ color: COLORS.successDark }} />
                            <p className="text-sm font-medium" style={{ color: COLORS.successText }}>
                              Excellent! All smears are being paid. Your cervical screening claims are fully optimised.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Only show breakdown for categories that don't have custom sections */}
                  {/* Exclude: capitation (has registrationChecks), practiceSupport (has entitlement), cervicalCheck (has cervicalScreeningAnalysis), stc (has stcAnalysis) */}
                  {category.id !== 'practiceSupport' && category.id !== 'cervicalCheck' && category.id !== 'stc' && (
                    <div className="space-y-2">
                      {category.breakdown
                        .filter(item => {
                          // For capitation, exclude items now covered by registration checks
                          if (category.id === 'capitation') {
                            const excludedCategories = ['Under 6', 'Age 6-7', 'Over 70'];
                            return !excludedCategories.includes(item.category);
                          }
                          return true;
                        })
                        .map((item, idx) => (
                        <div key={idx} className={`flex items-center justify-between p-2 rounded text-sm ${item.isNote ? '' : 'bg-white'}`}>
                          <div>
                            <span className="font-medium" style={{ color: COLORS.textPrimary }}>
                              {item.category}
                            </span>
                            {item.calculation && (
                              <p className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }}>
                                {item.calculation}
                              </p>
                            )}
                            {item.note && (
                              <p className="text-xs mt-0.5 italic" style={{ color: COLORS.textSecondary }}>
                                {item.note}
                              </p>
                            )}
                          </div>
                          {!item.isNote && (
                            <span className="font-semibold" style={{ color: item.category.includes('Claimed') ? COLORS.incomeColor : COLORS.slainteBlue }}>
                              {formatCurrency(item.annual)}
                            </span>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center justify-between p-2 border-t font-semibold" style={{ borderColor: COLORS.borderLight }}>
                        <span style={{ color: COLORS.textPrimary }}>Total Potential</span>
                        <span style={{ color: COLORS.slainteBlue }}>{formatCurrency(category.potential)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Priority Recommendations - Action Required */}
      <div className="bg-white rounded-lg shadow-sm border p-6" style={{ borderColor: COLORS.borderLight }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.errorLight }}>
            <AlertCircle className="h-5 w-5" style={{ color: COLORS.error }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: COLORS.textPrimary }}>
              Priority Recommendations
            </h3>
            <p className="text-sm" style={{ color: COLORS.textSecondary }}>
              Administrative actions to recover income • Low effort, immediate impact
            </p>
          </div>
        </div>

        {priorityRecommendations.length === 0 ? (
          <div className="text-center py-6 rounded-lg" style={{ backgroundColor: COLORS.successLight }}>
            <CheckCircle className="h-10 w-10 mx-auto mb-2" style={{ color: COLORS.successDark }} />
            <p className="font-semibold" style={{ color: COLORS.successText }}>
              No immediate actions required
            </p>
            <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
              Your practice registrations and claims are up to date
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {priorityRecommendations.map((rec, index) => (
              <div
                key={rec.id}
                className="border rounded-lg overflow-hidden transition-all"
                style={{ borderColor: COLORS.errorLight }}
              >
                {/* Recommendation Header */}
                <button
                  onClick={() => toggleRecommendation(rec.id)}
                  className="w-full p-4 flex items-start justify-between hover:bg-red-50 transition-colors"
                  style={{ backgroundColor: COLORS.errorLighter }}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: COLORS.error }}
                    >
                      {index + 1}
                    </div>
                    <div className="text-left flex-1">
                      <h4 className="font-semibold" style={{ color: COLORS.textPrimary }}>
                        {rec.title}
                      </h4>
                      <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
                        {rec.category} • {rec.effort} effort
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-bold" style={{ color: COLORS.incomeColor }}>
                        {formatCurrency(rec.potential)}
                      </p>
                      <p className="text-xs" style={{ color: COLORS.textSecondary }}>
                        Recoverable
                      </p>
                    </div>
                    {expandedRecommendations[rec.id] ? (
                      <ChevronUp className="h-5 w-5 flex-shrink-0" style={{ color: COLORS.textSecondary }} />
                    ) : (
                      <ChevronDown className="h-5 w-5 flex-shrink-0" style={{ color: COLORS.textSecondary }} />
                    )}
                  </div>
                </button>

                {/* Recommendation Actions (Expanded) */}
                {expandedRecommendations[rec.id] && (
                  <div className="px-4 pb-4 border-t" style={{ borderColor: COLORS.errorLight, backgroundColor: COLORS.bgPage }}>
                    <div className="pt-4 space-y-3">
                      {rec.summary && (
                        <div className="p-3 rounded-lg border mb-3" style={{ backgroundColor: COLORS.errorLighter, borderColor: COLORS.errorLight }}>
                          <p className="text-sm" style={{ color: COLORS.errorText }}>{rec.summary}</p>
                        </div>
                      )}
                      <h5 className="font-medium text-sm" style={{ color: COLORS.textPrimary }}>
                        Action Items:
                      </h5>
                      {rec.actions.map((action, idx) => {
                        const alreadyTask = isActionAlreadyTask(rec, idx);
                        return (
                          <div
                            key={idx}
                            className="p-3 bg-white rounded border-l-4"
                            style={{ borderLeftColor: COLORS.error }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>
                                  {action.action}
                                </p>
                                {action.detail && (
                                  <p className="text-xs mt-2 p-2 rounded" style={{ backgroundColor: COLORS.bgPage, color: COLORS.textSecondary }}>
                                    {action.detail}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-start gap-3 flex-shrink-0">
                                {action.value > 0 && (
                                  <div className="text-right">
                                    <p className="text-sm font-bold" style={{ color: COLORS.incomeColor }}>
                                      +{formatCurrency(action.value)}/yr
                                    </p>
                                    {action.effort && (
                                      <p className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }}>
                                        {action.effort} effort
                                      </p>
                                    )}
                                  </div>
                                )}
                                {alreadyTask ? (
                                  <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
                                    <CheckCircle className="h-3 w-3" />
                                    Added to Tasks
                                  </span>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTaskDialogOpen({ recommendation: rec, action, actionIdx: idx });
                                      setTaskForm({ assignedTo: '', dueDate: '' });
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors hover:bg-red-50"
                                    style={{ borderColor: COLORS.error, color: COLORS.error }}
                                  >
                                    <Plus className="h-3 w-3" />
                                    Set as Task
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Growth Opportunities */}
      <div className="bg-white rounded-lg shadow-sm border p-6" style={{ borderColor: COLORS.borderLight }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.successLight }}>
            <TrendingUp className="h-5 w-5" style={{ color: COLORS.successDark }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: COLORS.textPrimary }}>
              Growth Opportunities
            </h3>
            <p className="text-sm" style={{ color: COLORS.textSecondary }}>
              Strategic opportunities to increase income • May require additional resources
            </p>
          </div>
        </div>

        {growthOpportunities.length === 0 ? (
          <div className="text-center py-6 rounded-lg" style={{ backgroundColor: COLORS.successLight }}>
            <CheckCircle className="h-10 w-10 mx-auto mb-2" style={{ color: COLORS.successDark }} />
            <p className="font-semibold" style={{ color: COLORS.successText }}>
              No growth opportunities identified
            </p>
            <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
              Your practice is fully optimised for current capacity
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {growthOpportunities.map((rec, index) => (
              <div
                key={rec.id}
                className="border-2 rounded-lg overflow-hidden transition-all"
                style={{ borderColor: COLORS.successLighter }}
              >
                {/* Recommendation Header */}
                <button
                  onClick={() => toggleRecommendation(rec.id)}
                  className="w-full p-4 flex items-start justify-between hover:bg-green-50 transition-colors"
                  style={{ backgroundColor: COLORS.successLight }}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: COLORS.successDark }}
                    >
                      {index + 1}
                    </div>
                    <div className="text-left flex-1">
                      <h4 className="font-semibold" style={{ color: COLORS.textPrimary }}>
                        {rec.title}
                      </h4>
                      <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
                        {rec.category} • {rec.effort} effort
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-bold" style={{ color: COLORS.successDark }}>
                        +{formatCurrency(rec.potential)}
                      </p>
                      <p className="text-xs" style={{ color: COLORS.textSecondary }}>
                        Potential
                      </p>
                    </div>
                    {expandedRecommendations[rec.id] ? (
                      <ChevronUp className="h-5 w-5 flex-shrink-0" style={{ color: COLORS.textSecondary }} />
                    ) : (
                      <ChevronDown className="h-5 w-5 flex-shrink-0" style={{ color: COLORS.textSecondary }} />
                    )}
                  </div>
                </button>

                {/* Recommendation Actions (Expanded) */}
                {expandedRecommendations[rec.id] && (
                  <div className="px-4 pb-4 border-t" style={{ borderColor: COLORS.successLighter, backgroundColor: COLORS.bgPage }}>
                    <div className="pt-4 space-y-3">
                      {rec.summary && (
                        <div className="p-3 rounded-lg border mb-3" style={{ backgroundColor: COLORS.successLight, borderColor: COLORS.successLighter }}>
                          <p className="text-sm" style={{ color: COLORS.successText }}>{rec.summary}</p>
                        </div>
                      )}
                      <h5 className="font-medium text-sm" style={{ color: COLORS.textPrimary }}>
                        Action Items:
                      </h5>
                      {rec.actions.map((action, idx) => {
                        const alreadyTask = isActionAlreadyTask(rec, idx);
                        return (
                          <div
                            key={idx}
                            className="p-3 bg-white rounded border-l-4"
                            style={{ borderLeftColor: COLORS.successDark }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>
                                  {action.action}
                                </p>
                                {action.detail && (
                                  <p className="text-xs mt-2 p-2 rounded" style={{ backgroundColor: COLORS.bgPage, color: COLORS.textSecondary }}>
                                    {action.detail}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-start gap-3 flex-shrink-0">
                                {action.value > 0 && (
                                  <div className="text-right">
                                    <p className="text-sm font-bold" style={{ color: COLORS.successDark }}>
                                      +{formatCurrency(action.value)}/yr
                                    </p>
                                    {action.effort && (
                                      <p className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }}>
                                        {action.effort} effort
                                      </p>
                                    )}
                                  </div>
                                )}
                                {alreadyTask ? (
                                  <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
                                    <CheckCircle className="h-3 w-3" />
                                    Added to Tasks
                                  </span>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTaskDialogOpen({ recommendation: rec, action, actionIdx: idx });
                                      setTaskForm({ assignedTo: '', dueDate: '' });
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors hover:bg-green-50"
                                    style={{ borderColor: COLORS.successDark, color: COLORS.successDark }}
                                  >
                                    <Plus className="h-3 w-3" />
                                    Set as Task
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Assignment Dialog */}
      {taskDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md"
            style={{ border: `1px solid ${COLORS.borderLight}` }}
          >
            {/* Dialog Header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: COLORS.borderLight }}>
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: taskDialogOpen.recommendation.type === 'priority' ? COLORS.errorLight : COLORS.successLight }}
                >
                  <Target
                    className="h-5 w-5"
                    style={{ color: taskDialogOpen.recommendation.type === 'priority' ? COLORS.error : COLORS.successDark }}
                  />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: COLORS.textPrimary }}>
                    Set as Task
                  </h3>
                  <p className="text-xs" style={{ color: COLORS.textSecondary }}>
                    {taskDialogOpen.recommendation.category}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTaskDialogOpen(null)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="h-5 w-5" style={{ color: COLORS.textSecondary }} />
              </button>
            </div>

            {/* Dialog Content */}
            <div className="p-4 space-y-4">
              {/* Task Description */}
              <div className="p-3 rounded-lg" style={{ backgroundColor: COLORS.bgPage }}>
                <p className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>
                  {taskDialogOpen.action.action}
                </p>
                {taskDialogOpen.action.value > 0 && (
                  <p className="text-sm mt-1" style={{ color: COLORS.incomeColor }}>
                    Potential value: {formatCurrency(taskDialogOpen.action.value)}/yr
                  </p>
                )}
              </div>

              {/* Assign To */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color: COLORS.textPrimary }}>
                  <User className="h-4 w-4" />
                  Assign to
                </label>
                <select
                  value={taskForm.assignedTo}
                  onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: COLORS.borderLight }}
                >
                  <option value="">Select team member...</option>
                  {assigneeList.map((person, idx) => (
                    <option key={idx} value={person.name}>
                      {person.name} ({person.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color: COLORS.textPrimary }}>
                  <Calendar className="h-4 w-4" />
                  Review/Completion Date
                </label>
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ borderColor: COLORS.borderLight }}
                />
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t" style={{ borderColor: COLORS.borderLight }}>
              <button
                onClick={() => setTaskDialogOpen(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: COLORS.borderLight, color: COLORS.textSecondary }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: COLORS.slainteBlue }}
              >
                <Plus className="h-4 w-4" />
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
