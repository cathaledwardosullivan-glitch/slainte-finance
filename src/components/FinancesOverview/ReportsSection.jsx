import React, { useState, useEffect, useRef } from 'react';
import { FilePlus, FileText, Download, ChevronRight, Calculator, PiggyBank, Users, Trash2, Eye, Activity, Briefcase, ChevronDown, X } from 'lucide-react';
import COLORS from '../../utils/colors';
import ExportReports from '../ExportReports';
import PersonalTaxReturnForm from '../PersonalTaxReturnForm';
import PartnerCapitalAccounts from '../PartnerCapitalAccounts';
import CategoryRefinementWizard from '../CategoryRefinementWizard';
import AccountantExport from '../AccountantExport';
import ReportModal from '../UnifiedFinnWidget/ReportModal';
import { useAppContext } from '../../context/AppContext';
import { shouldRecommendRefinement, getRefinementCategoryCounts } from '../../utils/categoryRefinementUtils';

/**
 * ReportsSection - Reports functionality from Reports.jsx
 * This is the Reports sub-view within Finances Overview tab
 */
const ReportsSection = ({ setCurrentView }) => {
  const { transactions } = useAppContext();
  const [view, setView] = useState('home');
  const [savedReports, setSavedReports] = useState([]);
  const [showRefinementWizard, setShowRefinementWizard] = useState(false);
  const [proceedToPLAfterRefinement, setProceedToPLAfterRefinement] = useState(false);
  const [showAccountantExport, setShowAccountantExport] = useState(false);
  const [selectedAIReport, setSelectedAIReport] = useState(null);

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
    // Home screen
    if (view === 'home') {
      return (
        <>
          <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.darkGray }}>
              Reports
            </h2>
            <p style={{ fontSize: '0.875rem', marginBottom: '2rem', color: COLORS.mediumGray }}>
              Generate new reports or view previously saved reports
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
              {/* Generate New Report */}
              <button
                onClick={() => setView('generate')}
                style={{
                  padding: '2rem',
                  border: `2px solid ${COLORS.lightGray}`,
                  borderRadius: '0.5rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  backgroundColor: 'white',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.slainteBlue}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.lightGray}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: COLORS.slainteBlue }}>
                    <FilePlus size={32} color="white" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem', color: COLORS.darkGray }}>
                      Generate New Report
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                      P&L reports, tax returns, and financial calculators
                    </p>
                  </div>
                  <ChevronRight size={24} color={COLORS.mediumGray} />
                </div>
              </button>

              {/* View Saved Reports */}
              <button
                onClick={() => setView('view')}
                style={{
                  padding: '2rem',
                  border: `2px solid ${COLORS.lightGray}`,
                  borderRadius: '0.5rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  backgroundColor: 'white',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.incomeColor}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.lightGray}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: COLORS.incomeColor }}>
                    <FileText size={32} color="white" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem', color: COLORS.darkGray }}>
                      View Saved Reports
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                      Access previously generated reports
                    </p>
                  </div>
                  <ChevronRight size={24} color={COLORS.mediumGray} />
                </div>
              </button>
            </div>

            {/* Quick Stats */}
            <div style={{ marginTop: '2rem', padding: '1rem', borderRadius: '0.5rem', backgroundColor: COLORS.backgroundGray }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem', color: COLORS.slainteBlue }}>
                    {savedReports.length}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                    Saved Reports
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem', color: COLORS.incomeColor }}>
                    0
                  </div>
                  <div style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                    This Month
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem', color: COLORS.highlightYellow }}>
                    P&L
                  </div>
                  <div style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                    Most Common
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Accountant Export Section */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginTop: '1.5rem' }}>
            <button
              onClick={() => setShowAccountantExport(!showAccountantExport)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0
              }}
            >
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                <Briefcase style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem', color: COLORS.incomeColor }} />
                Collect & Share Data for Accountant
              </h3>
              <ChevronDown
                style={{
                  height: '1.25rem',
                  width: '1.25rem',
                  transition: 'transform 0.15s',
                  transform: showAccountantExport ? 'rotate(180deg)' : 'rotate(0deg)',
                  color: COLORS.incomeColor
                }}
              />
            </button>

            {showAccountantExport && (
              <div style={{ marginTop: '1rem' }}>
                <AccountantExport />
              </div>
            )}
          </div>
        </>
      );
    }

    // Generate Report - Selection screen
    if (view === 'generate') {
      return (
        <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
          <button
            onClick={() => setView('home')}
            style={{
              marginBottom: '1.5rem',
              padding: '0.5rem 1rem',
              border: `1px solid ${COLORS.lightGray}`,
              borderRadius: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'white',
              cursor: 'pointer',
              color: COLORS.mediumGray
            }}
          >
            &larr; Back to Reports Home
          </button>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.darkGray }}>
            Select Report Type
          </h2>
          <p style={{ fontSize: '0.875rem', marginBottom: '2rem', color: COLORS.mediumGray }}>
            Choose the type of report or calculator you want to generate
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
            {/* P&L Report */}
            <button
              onClick={handlePLReportClick}
              style={{
                padding: '1.5rem',
                border: `2px solid ${COLORS.lightGray}`,
                borderRadius: '0.5rem',
                textAlign: 'left',
                cursor: 'pointer',
                backgroundColor: 'white',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.slainteBlue}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.lightGray}
            >
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'inline-block', backgroundColor: COLORS.slainteBlue }}>
                <FileText size={28} color="white" />
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.darkGray }}>
                Profit & Loss Report
              </h3>
              <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                Professional accountant format P&L for your practice
              </p>
              <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', display: 'inline-block', backgroundColor: COLORS.highlightYellow, color: COLORS.darkGray }}>
                Step 1
              </div>
            </button>

            {/* Partner's Capital Accounts */}
            <button
              onClick={() => setView('partner-capital')}
              style={{
                padding: '1.5rem',
                border: `2px solid ${COLORS.lightGray}`,
                borderRadius: '0.5rem',
                textAlign: 'left',
                cursor: 'pointer',
                backgroundColor: 'white',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#9C27B0'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.lightGray}
            >
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'inline-block', backgroundColor: '#9C27B0' }}>
                <Users size={28} color="white" />
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.darkGray }}>
                Partner's Capital Accounts
              </h3>
              <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                Allocate profit to partners and track capital balances
              </p>
              <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', display: 'inline-block', backgroundColor: '#F3E5F5', color: '#9C27B0' }}>
                Step 2
              </div>
            </button>

            {/* Personal Tax Return */}
            <button
              onClick={() => setView('tax-return')}
              style={{
                padding: '1.5rem',
                border: `2px solid ${COLORS.lightGray}`,
                borderRadius: '0.5rem',
                textAlign: 'left',
                cursor: 'pointer',
                backgroundColor: 'white',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.incomeColor}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.lightGray}
            >
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'inline-block', backgroundColor: COLORS.incomeColor }}>
                <Calculator size={28} color="white" />
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.darkGray }}>
                Personal Tax Return Form
              </h3>
              <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                Comprehensive tax information checklist for self-employed GPs
              </p>
              <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', display: 'inline-block', backgroundColor: '#E8F5E9', color: COLORS.incomeColor }}>
                Step 3
              </div>
            </button>

            {/* GMS Health Check Report */}
            <button
              onClick={() => setCurrentView && setCurrentView('gms-health-check')}
              style={{
                padding: '1.5rem',
                border: `2px solid ${COLORS.lightGray}`,
                borderRadius: '0.5rem',
                textAlign: 'left',
                cursor: 'pointer',
                backgroundColor: 'white',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#FF6B6B'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.lightGray}
            >
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'inline-block', backgroundColor: '#FF6B6B' }}>
                <Activity size={28} color="white" />
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.darkGray }}>
                GMS Health Check Report
              </h3>
              <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                Analyze GMS payment patterns and identify issues
              </p>
              <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', display: 'inline-block', backgroundColor: '#FFE5E5', color: '#FF6B6B' }}>
                Health Check
              </div>
            </button>

            {/* AVC Calculator - Coming Soon */}
            <div
              style={{
                padding: '1.5rem',
                border: `2px solid ${COLORS.lightGray}`,
                borderRadius: '0.5rem',
                textAlign: 'left',
                opacity: 0.5
              }}
            >
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'inline-block', backgroundColor: COLORS.mediumGray }}>
                <PiggyBank size={28} color="white" />
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.darkGray }}>
                AVC Calculator
              </h3>
              <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
                Calculate maximum Additional Voluntary Contributions
              </p>
              <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', display: 'inline-block', backgroundColor: COLORS.backgroundGray, color: COLORS.mediumGray }}>
                Coming Soon
              </div>
            </div>
          </div>
        </div>
      );
    }

    // P&L Report
    if (view === 'pl-report') {
      return (
        <div>
          <button
            onClick={() => setView('generate')}
            style={{
              marginBottom: '1rem',
              padding: '0.5rem 1rem',
              border: `1px solid ${COLORS.lightGray}`,
              borderRadius: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'white',
              cursor: 'pointer',
              color: COLORS.mediumGray
            }}
          >
            &larr; Back to Report Selection
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
            onClick={() => setView('generate')}
            style={{
              marginBottom: '1rem',
              padding: '0.5rem 1rem',
              border: `1px solid ${COLORS.lightGray}`,
              borderRadius: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'white',
              cursor: 'pointer',
              color: COLORS.mediumGray
            }}
          >
            &larr; Back to Report Selection
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
            onClick={() => setView('generate')}
            style={{
              marginBottom: '1rem',
              padding: '0.5rem 1rem',
              border: `1px solid ${COLORS.lightGray}`,
              borderRadius: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'white',
              cursor: 'pointer',
              color: COLORS.mediumGray
            }}
          >
            &larr; Back to Report Selection
          </button>
          <PersonalTaxReturnForm />
        </div>
      );
    }

    // View Saved Reports
    if (view === 'view') {
      return (
        <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: COLORS.darkGray }}>
                Saved Reports
              </h2>
              <p style={{ fontSize: '0.875rem', marginTop: '0.25rem', color: COLORS.mediumGray }}>
                View and download previously generated reports
              </p>
            </div>
            <button
              onClick={() => setView('home')}
              style={{
                padding: '0.5rem 1rem',
                border: `1px solid ${COLORS.lightGray}`,
                borderRadius: '0.25rem',
                backgroundColor: 'white',
                cursor: 'pointer',
                color: COLORS.mediumGray
              }}
            >
              &larr; Back
            </button>
          </div>

          {savedReports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <FileText size={48} style={{ margin: '0 auto 1rem', color: COLORS.lightGray }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: COLORS.darkGray }}>
                No Saved Reports
              </h3>
              <p style={{ fontSize: '0.875rem', marginBottom: '1rem', color: COLORS.mediumGray }}>
                Generate your first report to see it here
              </p>
              <button
                onClick={() => setView('generate')}
                style={{
                  padding: '0.5rem 1.5rem',
                  borderRadius: '0.25rem',
                  color: 'white',
                  backgroundColor: COLORS.slainteBlue,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Generate Report
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {savedReports.map((report) => (
                <div
                  key={report.id}
                  style={{
                    padding: '1rem',
                    border: `1px solid ${COLORS.lightGray}`,
                    borderRadius: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <FileText size={24} color={COLORS.slainteBlue} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <h4 style={{ fontWeight: 600, color: COLORS.darkGray }}>
                            {report.title}
                          </h4>
                          {report.type && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.125rem 0.5rem',
                                borderRadius: '0.25rem',
                                fontWeight: 500,
                                backgroundColor: report.type === 'AI Report' ? '#3b82f620' :
                                                report.type === 'GMS Health Check' ? '#10b98120' :
                                                '#f59e0b20',
                                color: report.type === 'AI Report' ? '#3b82f6' :
                                      report.type === 'GMS Health Check' ? '#10b981' :
                                      '#f59e0b'
                              }}
                            >
                              {report.type}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray }}>
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
          )}
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
