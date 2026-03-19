import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, Calculator, PiggyBank, Users, Trash2, Eye, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import COLORS from '../../utils/colors';
import ExportReports from '../ExportReports';
import PersonalTaxReturnForm from '../PersonalTaxReturnForm';
import PartnerCapitalAccounts from '../PartnerCapitalAccounts';
import CategoryRefinementWizard from '../CategoryRefinementWizard';
import ReportModal from '../UnifiedFinnWidget/ReportModal';
import { useAppContext } from '../../context/AppContext';
import { shouldRecommendRefinement, getRefinementCategoryCounts } from '../../utils/categoryRefinementUtils';

/**
 * ReportsSection - Simplified reports view
 * Shows report type cards directly with saved reports inline below
 */
const ReportsSection = ({ setCurrentView }) => {
  const { transactions } = useAppContext();
  const [view, setView] = useState('home');
  const [savedReports, setSavedReports] = useState([]);
  const [showRefinementWizard, setShowRefinementWizard] = useState(false);
  const [proceedToPLAfterRefinement, setProceedToPLAfterRefinement] = useState(false);
  const [selectedAIReport, setSelectedAIReport] = useState(null);
  const [savedReportsExpanded, setSavedReportsExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const REPORTS_PER_PAGE = 5;

  // Load saved reports
  useEffect(() => {
    const loadSavedReports = () => {
      const saved = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');
      setSavedReports(saved);
    };
    loadSavedReports();
  }, [view]);

  // Check if refinement is needed
  const refinementCheck = shouldRecommendRefinement(transactions);
  const refinementCounts = getRefinementCategoryCounts(transactions);

  // Check for pending navigation
  const hasCheckedPendingNav = useRef(false);
  useEffect(() => {
    if (hasCheckedPendingNav.current) return;
    hasCheckedPendingNav.current = true;

    const pendingView = localStorage.getItem('reports_pending_view');
    if (pendingView) {
      localStorage.removeItem('reports_pending_view');
      setView(pendingView);
    }
  }, []);

  // Handle P&L Report generation
  const handlePLReportClick = () => {
    if (refinementCheck.shouldShow && refinementCounts.essential > 0) {
      setShowRefinementWizard(true);
      setProceedToPLAfterRefinement(true);
    } else {
      setView('pl-report');
    }
  };

  // Handle refinement wizard close
  const handleRefinementClose = () => {
    setShowRefinementWizard(false);
    if (proceedToPLAfterRefinement) {
      setProceedToPLAfterRefinement(false);
      setView('pl-report');
    }
  };

  // Handle viewing a saved report
  const handleViewReport = (report) => {
    if (report.type === 'AI Report' || report.metadata?.generatedBy === 'Finn AI' || (!report.htmlContent && report.content)) {
      setSelectedAIReport(report);
    } else if (report.htmlContent) {
      const newWindow = window.open('', '_blank');
      newWindow.document.write(report.htmlContent);
      newWindow.document.close();
    } else {
      console.error('Report has no viewable content');
    }
  };

  // Handle downloading a saved report
  const handleDownloadReport = (report) => {
    const blob = new Blob([report.htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle deleting a saved report
  const handleDeleteReport = (reportId) => {
    if (window.confirm('Are you sure you want to delete this report? This cannot be undone.')) {
      const updatedReports = savedReports.filter(r => r.id !== reportId);
      setSavedReports(updatedReports);
      localStorage.setItem('gp_finance_saved_reports', JSON.stringify(updatedReports));
    }
  };

  // Format date for display
  const formatReportDate = (isoDate) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-IE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderView = () => {
    // Home screen - Report types + Saved reports inline
    if (view === 'home') {
      return (
        <>
          {/* Reports Card with Report Type Selection */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.textPrimary }}>
              Reports
            </h2>
            <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem', color: COLORS.textSecondary }}>
              Generate reports for your accountant
            </p>

            {/* Report Type Grid - 4 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
              {/* P&L Report */}
              <button
                onClick={handlePLReportClick}
                style={{
                  padding: '1.5rem',
                  border: `2px solid ${COLORS.borderLight}`,
                  borderRadius: '0.5rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  backgroundColor: 'white',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.slainteBlue}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.borderLight}
              >
                <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'inline-block', backgroundColor: COLORS.slainteBlue }}>
                  <FileText size={28} color="white" />
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.textPrimary }}>
                  Profit & Loss Report
                </h3>
                <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>
                  Professional accountant format P&L for your practice
                </p>
                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', display: 'inline-block', backgroundColor: COLORS.highlightYellow, color: COLORS.textPrimary }}>
                  Step 1
                </div>
              </button>

              {/* Partner's Capital Accounts */}
              <button
                onClick={() => setView('partner-capital')}
                style={{
                  padding: '1.5rem',
                  border: `2px solid ${COLORS.borderLight}`,
                  borderRadius: '0.5rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  backgroundColor: 'white',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.accentPurple}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.borderLight}
              >
                <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'inline-block', backgroundColor: COLORS.accentPurple }}>
                  <Users size={28} color="white" />
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.textPrimary }}>
                  Partner's Capital Accounts
                </h3>
                <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>
                  Allocate profit to partners and track capital balances
                </p>
                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', display: 'inline-block', backgroundColor: COLORS.accentPurpleLight, color: COLORS.accentPurple }}>
                  Step 2
                </div>
              </button>

              {/* Personal Tax Return */}
              <button
                onClick={() => setView('tax-return')}
                style={{
                  padding: '1.5rem',
                  border: `2px solid ${COLORS.borderLight}`,
                  borderRadius: '0.5rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  backgroundColor: 'white',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.incomeColor}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.borderLight}
              >
                <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'inline-block', backgroundColor: COLORS.incomeColor }}>
                  <Calculator size={28} color="white" />
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.textPrimary }}>
                  Personal Tax Return Form
                </h3>
                <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>
                  Comprehensive tax information checklist for self-employed GPs
                </p>
                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', display: 'inline-block', backgroundColor: COLORS.successLight, color: COLORS.incomeColor }}>
                  Step 3
                </div>
              </button>

              {/* AVC Calculator - Coming Soon */}
              <div
                style={{
                  padding: '1.5rem',
                  border: `2px solid ${COLORS.borderLight}`,
                  borderRadius: '0.5rem',
                  textAlign: 'left',
                  opacity: 0.5
                }}
              >
                <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'inline-block', backgroundColor: COLORS.textSecondary }}>
                  <PiggyBank size={28} color="white" />
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.textPrimary }}>
                  AVC Calculator
                </h3>
                <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>
                  Calculate maximum Additional Voluntary Contributions
                </p>
                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', display: 'inline-block', backgroundColor: COLORS.bgPage, color: COLORS.textSecondary }}>
                  Coming Soon
                </div>
              </div>
            </div>
          </div>

          {/* Saved Reports Section - Collapsible with Pagination */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginTop: '1.5rem', overflow: 'hidden' }}>
            {/* Collapsible Header */}
            <button
              onClick={() => setSavedReportsExpanded(!savedReportsExpanded)}
              style={{
                width: '100%',
                padding: '1rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderBottom: savedReportsExpanded ? `1px solid ${COLORS.borderLight}` : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: COLORS.textPrimary }}>
                  Saved Reports
                </h3>
                {savedReports.length > 0 && (
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '0.125rem 0.5rem',
                    borderRadius: '0.25rem',
                    backgroundColor: COLORS.bgPage,
                    color: COLORS.textSecondary
                  }}>
                    {savedReports.length}
                  </span>
                )}
              </div>
              {savedReportsExpanded ? (
                <ChevronUp size={20} color={COLORS.textSecondary} />
              ) : (
                <ChevronDown size={20} color={COLORS.textSecondary} />
              )}
            </button>

            {/* Collapsible Content */}
            {savedReportsExpanded && (
              <div style={{ padding: '1.5rem' }}>
                {savedReports.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <FileText size={48} style={{ margin: '0 auto 1rem', color: COLORS.borderLight }} />
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.textPrimary }}>
                      No Saved Reports
                    </h4>
                    <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>
                      Generate your first report to see it here
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {savedReports
                        .slice((currentPage - 1) * REPORTS_PER_PAGE, currentPage * REPORTS_PER_PAGE)
                        .map((report) => (
                        <div
                          key={report.id}
                          style={{
                            padding: '1rem',
                            border: `1px solid ${COLORS.borderLight}`,
                            borderRadius: '0.5rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <FileText size={24} color={COLORS.slainteBlue} />
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                  <h4 style={{ fontWeight: 600, color: COLORS.textPrimary }}>
                                    {report.title}
                                  </h4>
                                  {report.type && (
                                    <span
                                      style={{
                                        fontSize: '0.75rem',
                                        padding: '0.125rem 0.5rem',
                                        borderRadius: '0.25rem',
                                        fontWeight: 500,
                                        backgroundColor: report.type === 'AI Report' ? `${COLORS.slainteBlue}20` :
                                                        report.type === 'GMS Health Check' ? `${COLORS.success}20` :
                                                        `${COLORS.warning}20`,
                                        color: report.type === 'AI Report' ? COLORS.slainteBlue :
                                              report.type === 'GMS Health Check' ? COLORS.success :
                                              COLORS.warning
                                      }}
                                    >
                                      {report.type}
                                    </span>
                                  )}
                                </div>
                                <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>
                                  Generated {formatReportDate(report.generatedDate)}
                                </p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <button
                                onClick={() => handleViewReport(report)}
                                style={{ padding: '0.5rem', borderRadius: '0.25rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
                                title="View report"
                              >
                                <Eye size={20} color={COLORS.slainteBlue} />
                              </button>
                              <button
                                onClick={() => handleDownloadReport(report)}
                                style={{ padding: '0.5rem', borderRadius: '0.25rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
                                title="Download report"
                              >
                                <Download size={20} color={COLORS.incomeColor} />
                              </button>
                              <button
                                onClick={() => handleDeleteReport(report.id)}
                                style={{ padding: '0.5rem', borderRadius: '0.25rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
                                title="Delete report"
                              >
                                <Trash2 size={20} color={COLORS.expenseColor} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {savedReports.length > REPORTS_PER_PAGE && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '1rem',
                        marginTop: '1rem',
                        paddingTop: '1rem',
                        borderTop: `1px solid ${COLORS.borderLight}`
                      }}>
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          style={{
                            padding: '0.5rem',
                            borderRadius: '0.25rem',
                            border: `1px solid ${COLORS.borderLight}`,
                            background: 'white',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            opacity: currentPage === 1 ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <ChevronLeft size={18} color={COLORS.textSecondary} />
                        </button>
                        <span style={{ fontSize: '0.875rem', color: COLORS.textSecondary }}>
                          Page {currentPage} of {Math.ceil(savedReports.length / REPORTS_PER_PAGE)}
                        </span>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(Math.ceil(savedReports.length / REPORTS_PER_PAGE), p + 1))}
                          disabled={currentPage >= Math.ceil(savedReports.length / REPORTS_PER_PAGE)}
                          style={{
                            padding: '0.5rem',
                            borderRadius: '0.25rem',
                            border: `1px solid ${COLORS.borderLight}`,
                            background: 'white',
                            cursor: currentPage >= Math.ceil(savedReports.length / REPORTS_PER_PAGE) ? 'not-allowed' : 'pointer',
                            opacity: currentPage >= Math.ceil(savedReports.length / REPORTS_PER_PAGE) ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <ChevronRight size={18} color={COLORS.textSecondary} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      );
    }

    // P&L Report
    if (view === 'pl-report') {
      return (
        <div>
          <button
            onClick={() => setView('home')}
            style={{
              marginBottom: '1rem',
              padding: '0.5rem 1rem',
              border: `1px solid ${COLORS.borderLight}`,
              borderRadius: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'white',
              cursor: 'pointer',
              color: COLORS.textSecondary
            }}
          >
            &larr; Back to Reports
          </button>
          <ExportReports />
        </div>
      );
    }

    // Partner's Capital Accounts
    if (view === 'partner-capital') {
      return (
        <div>
          <button
            onClick={() => setView('home')}
            style={{
              marginBottom: '1rem',
              padding: '0.5rem 1rem',
              border: `1px solid ${COLORS.borderLight}`,
              borderRadius: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'white',
              cursor: 'pointer',
              color: COLORS.textSecondary
            }}
          >
            &larr; Back to Reports
          </button>
          <PartnerCapitalAccounts />
        </div>
      );
    }

    // Personal Tax Return Form
    if (view === 'tax-return') {
      return (
        <div>
          <button
            onClick={() => setView('home')}
            style={{
              marginBottom: '1rem',
              padding: '0.5rem 1rem',
              border: `1px solid ${COLORS.borderLight}`,
              borderRadius: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'white',
              cursor: 'pointer',
              color: COLORS.textSecondary
            }}
          >
            &larr; Back to Reports
          </button>
          <PersonalTaxReturnForm />
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {renderView()}
      <CategoryRefinementWizard
        isOpen={showRefinementWizard}
        onClose={handleRefinementClose}
      />
      {selectedAIReport && (
        <ReportModal
          report={selectedAIReport}
          onClose={() => setSelectedAIReport(null)}
        />
      )}
    </>
  );
};

export default ReportsSection;
