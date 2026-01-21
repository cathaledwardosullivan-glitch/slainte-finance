import React, { useState } from 'react';
import { FilePlus, FileText, Download, ChevronRight, Calculator, PiggyBank, Users, Trash2, Eye, Activity, Briefcase, ChevronDown, X } from 'lucide-react';
import COLORS from '../utils/colors';
import ExportReports from './ExportReports';
import PersonalTaxReturnForm from './PersonalTaxReturnForm';
import PartnerCapitalAccounts from './PartnerCapitalAccounts';
import CategoryRefinementWizard from './CategoryRefinementWizard';
import AccountantExport from './AccountantExport';
import ReportModal from './UnifiedFinnWidget/ReportModal';
import { useAppContext } from '../context/AppContext';
import { shouldRecommendRefinement, getRefinementCategoryCounts } from '../utils/categoryRefinementUtils';

export default function Reports({ setCurrentView }) {
  const { transactions } = useAppContext();
  const [view, setView] = useState('home'); // 'home', 'generate', 'view', 'tax-return', 'avc', 'partner-capital'
  const [savedReports, setSavedReports] = useState([]);
  const [showRefinementWizard, setShowRefinementWizard] = useState(false);
  const [proceedToPLAfterRefinement, setProceedToPLAfterRefinement] = useState(false);
  const [showAccountantExport, setShowAccountantExport] = useState(false);
  const [selectedAIReport, setSelectedAIReport] = useState(null); // For viewing Finn-generated reports

  // Load saved reports from localStorage on mount and when view changes
  React.useEffect(() => {
    const loadSavedReports = () => {
      const saved = JSON.parse(localStorage.getItem('gp_finance_saved_reports') || '[]');
      setSavedReports(saved);
    };
    loadSavedReports();
  }, [view]); // Reload when view changes so we see newly saved reports

  // Check if refinement is needed
  const refinementCheck = shouldRecommendRefinement(transactions);
  const refinementCounts = getRefinementCategoryCounts(transactions);

  // Check for pending navigation from Dashboard Financial Action Plan (only on mount)
  const hasCheckedPendingNav = React.useRef(false);
  React.useEffect(() => {
    if (hasCheckedPendingNav.current) return;
    hasCheckedPendingNav.current = true;

    const pendingView = localStorage.getItem('reports_pending_view');
    if (pendingView) {
      localStorage.removeItem('reports_pending_view');
      // Go directly to the requested view (skip refinement check for task-based navigation)
      setView(pendingView);
    }
  }, []); // Only on mount

  // Watch for tour view state changes
  React.useEffect(() => {
    const checkTourViewState = () => {
      const tourState = localStorage.getItem('tour_view_state');
      if (tourState) {
        try {
          const { page, view: targetView } = JSON.parse(tourState);
          if (page === 'export' && targetView) {
            setView(targetView);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    };

    // Check immediately
    checkTourViewState();

    // Also listen for storage events (in case tour changes it)
    const handleStorageChange = (e) => {
      if (e.key === 'tour_view_state') {
        checkTourViewState();
      }
    };

    // Use a small interval to check for tour state changes (since storage events don't fire for same-window changes)
    const interval = setInterval(checkTourViewState, 200);

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Handle P&L Report generation - check for partially classified first
  const handlePLReportClick = () => {
    if (refinementCheck.shouldShow && refinementCounts.essential > 0) {
      // Show refinement wizard first
      setShowRefinementWizard(true);
      setProceedToPLAfterRefinement(true);
    } else {
      // Proceed directly to P&L
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
    // Check if this is a Finn-generated AI report (has content but no htmlContent)
    if (report.type === 'AI Report' || report.metadata?.generatedBy === 'Finn AI' || (!report.htmlContent && report.content)) {
      // Use the ReportModal for AI reports
      setSelectedAIReport(report);
    } else if (report.htmlContent) {
      // Legacy reports with HTML content - open in new window
      const newWindow = window.open('', '_blank');
      newWindow.document.write(report.htmlContent);
      newWindow.document.close();
    } else {
      console.error('Report has no viewable content');
    }
  };

  // Handle downloading a saved report as HTML file
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

  // Wrapper to render wizard alongside views
  const renderView = () => {
    // Home screen with two main options
    if (view === 'home') {
      return (
        <>
        <div className="bg-white rounded-lg shadow p-6" data-tour-id="reports-home">
        <h2 className="text-2xl font-semibold mb-2" style={{ color: COLORS.darkGray }}>
          Reports
        </h2>
        <p className="text-sm mb-8" style={{ color: COLORS.mediumGray }}>
          Generate new reports or view previously saved reports
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Generate New Report - Now goes to selection screen */}
          <button
            onClick={() => setView('generate')}
            className="p-8 border-2 rounded-lg hover:shadow-md transition-all text-left"
            style={{ borderColor: COLORS.lightGray }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.slainteBlue}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.lightGray}
            data-tour-id="reports-generate-button"
          >
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: COLORS.slainteBlue }}>
                <FilePlus size={32} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1" style={{ color: COLORS.darkGray }}>
                  Generate New Report
                </h3>
                <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                  P&L reports, tax returns, and financial calculators
                </p>
              </div>
              <ChevronRight size={24} style={{ color: COLORS.mediumGray }} />
            </div>
          </button>

          {/* View Saved Reports */}
          <button
            onClick={() => setView('view')}
            className="p-8 border-2 rounded-lg hover:shadow-md transition-all text-left"
            style={{ borderColor: COLORS.lightGray }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.incomeColor}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.lightGray}
          >
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: COLORS.incomeColor }}>
                <FileText size={32} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1" style={{ color: COLORS.darkGray }}>
                  View Saved Reports
                </h3>
                <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                  Access previously generated reports
                </p>
              </div>
              <ChevronRight size={24} style={{ color: COLORS.mediumGray }} />
            </div>
          </button>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 p-4 rounded-lg" style={{ backgroundColor: COLORS.backgroundGray }}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold mb-1" style={{ color: COLORS.slainteBlue }}>
                {savedReports.length}
              </div>
              <div className="text-sm" style={{ color: COLORS.mediumGray }}>
                Saved Reports
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold mb-1" style={{ color: COLORS.incomeColor }}>
                0
              </div>
              <div className="text-sm" style={{ color: COLORS.mediumGray }}>
                This Month
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold mb-1" style={{ color: COLORS.highlightYellow }}>
                P&L
              </div>
              <div className="text-sm" style={{ color: COLORS.mediumGray }}>
                Most Common
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accountant Export Section */}
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <button
          onClick={() => setShowAccountantExport(!showAccountantExport)}
          className="w-full flex items-center justify-between hover:opacity-70 transition-opacity"
        >
          <h3 className="text-lg font-semibold flex items-center">
            <Briefcase className="h-5 w-5 mr-2" style={{ color: COLORS.incomeColor }} />
            Collect & Share Data for Accountant
          </h3>
          <ChevronDown
            className={`h-5 w-5 transition-transform ${showAccountantExport ? 'transform rotate-180' : ''}`}
            style={{ color: COLORS.incomeColor }}
          />
        </button>

        {showAccountantExport && (
          <div className="mt-4">
            <AccountantExport />
          </div>
        )}
      </div>
      </>
      );
    }

    // Generate Report - Show report type selection
    if (view === 'generate') {
      return (
      <div className="bg-white rounded-lg shadow p-6">
        <button
          onClick={() => setView('home')}
          className="mb-6 px-4 py-2 border rounded flex items-center gap-2 hover:bg-gray-50"
          style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
        >
          ← Back to Reports Home
        </button>

        <h2 className="text-2xl font-semibold mb-2" style={{ color: COLORS.darkGray }}>
          Select Report Type
        </h2>
        <p className="text-sm mb-8" style={{ color: COLORS.mediumGray }}>
          Choose the type of report or calculator you want to generate
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-tour-id="reports-section">
          {/* P&L Report */}
          <button
            onClick={handlePLReportClick}
            className="p-6 border-2 rounded-lg hover:shadow-md transition-all text-left"
            style={{ borderColor: COLORS.lightGray }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.slainteBlue}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.lightGray}
          >
            <div className="p-3 rounded-lg mb-4 inline-block" style={{ backgroundColor: COLORS.slainteBlue }}>
              <FileText size={28} className="text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: COLORS.darkGray }}>
              Profit & Loss Report
            </h3>
            <p className="text-sm" style={{ color: COLORS.mediumGray }}>
              Professional accountant format P&L for your practice
            </p>
            <div className="mt-3 text-xs px-2 py-1 rounded inline-block" style={{ backgroundColor: COLORS.highlightYellow, color: COLORS.darkGray }}>
              Step 1
            </div>
          </button>

          {/* Partner's Capital Accounts */}
          <button
            onClick={() => setView('partner-capital')}
            className="p-6 border-2 rounded-lg hover:shadow-md transition-all text-left"
            style={{ borderColor: COLORS.lightGray }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#9C27B0'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.lightGray}
          >
            <div className="p-3 rounded-lg mb-4 inline-block" style={{ backgroundColor: '#9C27B0' }}>
              <Users size={28} className="text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: COLORS.darkGray }}>
              Partner's Capital Accounts
            </h3>
            <p className="text-sm" style={{ color: COLORS.mediumGray }}>
              Allocate profit to partners and track capital balances
            </p>
            <div className="mt-3 text-xs px-2 py-1 rounded inline-block" style={{ backgroundColor: '#F3E5F5', color: '#9C27B0' }}>
              Step 2
            </div>
          </button>

          {/* Personal Tax Return */}
          <button
            onClick={() => setView('tax-return')}
            className="p-6 border-2 rounded-lg hover:shadow-md transition-all text-left"
            style={{ borderColor: COLORS.lightGray }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.incomeColor}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.lightGray}
          >
            <div className="p-3 rounded-lg mb-4 inline-block" style={{ backgroundColor: COLORS.incomeColor }}>
              <Calculator size={28} className="text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: COLORS.darkGray }}>
              Personal Tax Return Form
            </h3>
            <p className="text-sm" style={{ color: COLORS.mediumGray }}>
              Comprehensive tax information checklist for self-employed GPs
            </p>
            <div className="mt-3 text-xs px-2 py-1 rounded inline-block" style={{ backgroundColor: '#E8F5E9', color: COLORS.incomeColor }}>
              Step 3
            </div>
          </button>

          {/* GMS Health Check Report */}
          <button
            onClick={() => setCurrentView('gms-health-check')}
            className="p-6 border-2 rounded-lg hover:shadow-md transition-all text-left"
            style={{ borderColor: COLORS.lightGray }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#FF6B6B'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.lightGray}
          >
            <div className="p-3 rounded-lg mb-4 inline-block" style={{ backgroundColor: '#FF6B6B' }}>
              <Activity size={28} className="text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: COLORS.darkGray }}>
              GMS Health Check Report
            </h3>
            <p className="text-sm" style={{ color: COLORS.mediumGray }}>
              Analyze GMS payment patterns and identify issues
            </p>
            <div className="mt-3 text-xs px-2 py-1 rounded inline-block" style={{ backgroundColor: '#FFE5E5', color: '#FF6B6B' }}>
              Health Check
            </div>
          </button>

          {/* AVC Calculator - Coming Soon */}
          <div
            className="p-6 border-2 rounded-lg text-left opacity-50"
            style={{ borderColor: COLORS.lightGray }}
          >
            <div className="p-3 rounded-lg mb-4 inline-block" style={{ backgroundColor: COLORS.mediumGray }}>
              <PiggyBank size={28} className="text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: COLORS.darkGray }}>
              AVC Calculator
            </h3>
            <p className="text-sm" style={{ color: COLORS.mediumGray }}>
              Calculate maximum Additional Voluntary Contributions
            </p>
            <div className="mt-3 text-xs px-2 py-1 rounded inline-block" style={{ backgroundColor: COLORS.backgroundGray, color: COLORS.mediumGray }}>
              🚧 Coming Soon
            </div>
          </div>
        </div>
      </div>
      );
    }

    // P&L Report - Show existing ExportReports component
    if (view === 'pl-report') {
      return (
      <div>
        <button
          onClick={() => setView('generate')}
          className="mb-4 px-4 py-2 border rounded flex items-center gap-2 hover:bg-gray-50"
          style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
        >
          ← Back to Report Selection
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
          className="mb-4 px-4 py-2 border rounded flex items-center gap-2 hover:bg-gray-50"
          style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
        >
          ← Back to Report Selection
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
          className="mb-4 px-4 py-2 border rounded flex items-center gap-2 hover:bg-gray-50"
          style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
        >
          ← Back to Report Selection
        </button>
        <PersonalTaxReturnForm />
      </div>
      );
    }

    // View Saved Reports
    if (view === 'view') {
      return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold" style={{ color: COLORS.darkGray }}>
              Saved Reports
            </h2>
            <p className="text-sm mt-1" style={{ color: COLORS.mediumGray }}>
              View and download previously generated reports
            </p>
          </div>
          <button
            onClick={() => setView('home')}
            className="px-4 py-2 border rounded hover:bg-gray-50"
            style={{ borderColor: COLORS.lightGray, color: COLORS.mediumGray }}
          >
            ← Back
          </button>
        </div>

        {savedReports.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto mb-4" style={{ color: COLORS.lightGray }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: COLORS.darkGray }}>
              No Saved Reports
            </h3>
            <p className="text-sm mb-4" style={{ color: COLORS.mediumGray }}>
              Generate your first report to see it here
            </p>
            <button
              onClick={() => setView('generate')}
              className="px-6 py-2 rounded text-white"
              style={{ backgroundColor: COLORS.slainteBlue }}
            >
              Generate Report
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {savedReports.map((report) => (
              <div
                key={report.id}
                className="p-4 border rounded-lg hover:shadow-md transition-all"
                style={{ borderColor: COLORS.lightGray }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText size={24} style={{ color: COLORS.slainteBlue }} />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold" style={{ color: COLORS.darkGray }}>
                          {report.title}
                        </h4>
                        {/* Type badge */}
                        {report.type && (
                          <span
                            className="text-xs px-2 py-0.5 rounded font-medium"
                            style={{
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
                      <p className="text-sm" style={{ color: COLORS.mediumGray }}>
                        Generated {formatReportDate(report.generatedDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewReport(report)}
                      className="p-2 rounded hover:bg-gray-100 transition-colors"
                      title="View report"
                    >
                      <Eye size={20} style={{ color: COLORS.slainteBlue }} />
                    </button>
                    <button
                      onClick={() => handleDownloadReport(report)}
                      className="p-2 rounded hover:bg-gray-100 transition-colors"
                      title="Download report"
                    >
                      <Download size={20} style={{ color: COLORS.incomeColor }} />
                    </button>
                    <button
                      onClick={() => handleDeleteReport(report.id)}
                      className="p-2 rounded hover:bg-red-100 transition-colors"
                      title="Delete report"
                    >
                      <Trash2 size={20} style={{ color: COLORS.expenseColor }} />
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

  // Render view and wizard
  return (
    <>
      {renderView()}
      <CategoryRefinementWizard
        isOpen={showRefinementWizard}
        onClose={handleRefinementClose}
      />
      {/* Modal for viewing AI-generated reports */}
      {selectedAIReport && (
        <ReportModal
          report={selectedAIReport}
          onClose={() => setSelectedAIReport(null)}
        />
      )}
    </>
  );
}
