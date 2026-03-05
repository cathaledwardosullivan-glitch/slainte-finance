import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { COLORS } from '../../utils/colors';
import { useAppContext } from '../../context/AppContext';
import OverviewSection from '../FinancesOverview/OverviewSection';
import ReportsModal from '../FinancesOverview/ReportsModal';
import TransactionListModalV2 from '../TransactionListModalV2';
import PaymentAnalysis from '../PaymentAnalysis';

// Dashboard accent colors
const GMS_PINK = '#E91E63';

/**
 * BusinessOverview - Unified business dashboard tab
 * Combines Financial Dashboard and GMS Dashboard with a shared banner
 */
const BusinessOverview = ({ setCurrentView }) => {
  const [activeDashboard, setActiveDashboard] = useState('financial');

  // Modal states (for Financial Dashboard)
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  // Shared year controls from AppContext
  const {
    selectedYear,
    setSelectedYear,
    useRollingYear,
    setUseRollingYear,
    getAvailableYears
  } = useAppContext();

  // Listen for tour/task events
  useEffect(() => {
    const handleOpenReports = () => setShowReportsModal(true);
    const handleCloseReports = () => setShowReportsModal(false);
    const handleOpenTransactions = () => setShowTransactionModal(true);
    const handleSwitchToDashboard = () => setActiveDashboard('financial');
    const handleSwitchToGMSDashboard = () => setActiveDashboard('gms');

    window.addEventListener('tour:openReportsModal', handleOpenReports);
    window.addEventListener('tour:closeReportsModal', handleCloseReports);
    window.addEventListener('task:openTransactions', handleOpenTransactions);
    window.addEventListener('tour:switchToDashboard', handleSwitchToDashboard);
    window.addEventListener('tour:switchToGMSDashboard', handleSwitchToGMSDashboard);

    return () => {
      window.removeEventListener('tour:openReportsModal', handleOpenReports);
      window.removeEventListener('tour:closeReportsModal', handleCloseReports);
      window.removeEventListener('task:openTransactions', handleOpenTransactions);
      window.removeEventListener('tour:switchToDashboard', handleSwitchToDashboard);
      window.removeEventListener('tour:switchToGMSDashboard', handleSwitchToGMSDashboard);
    };
  }, []);

  // Active accent color based on selected dashboard
  const accentColor = activeDashboard === 'financial' ? COLORS.slainteBlue : GMS_PINK;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.5rem' }}>
      {/* Unified Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem',
          backgroundColor: COLORS.white,
          borderRadius: '0.5rem',
          border: `1px solid ${COLORS.lightGray}`,
          flexShrink: 0
        }}
      >
        {/* Left side - Dashboard toggle */}
        <div data-tour-id="business-dashboard-toggle" style={{ display: 'flex', borderRadius: '0.5rem', overflow: 'hidden', border: `1px solid ${COLORS.lightGray}` }}>
          <button
            onClick={() => setActiveDashboard('financial')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              border: 'none',
              backgroundColor: activeDashboard === 'financial' ? COLORS.slainteBlue : 'transparent',
              color: activeDashboard === 'financial' ? COLORS.white : COLORS.darkGray,
              fontWeight: activeDashboard === 'financial' ? 600 : 400,
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (activeDashboard !== 'financial') {
                e.currentTarget.style.backgroundColor = COLORS.backgroundGray;
              }
            }}
            onMouseLeave={(e) => {
              if (activeDashboard !== 'financial') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            Financial Dashboard
          </button>
          <button
            onClick={() => setActiveDashboard('gms')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              border: 'none',
              borderLeft: `1px solid ${COLORS.lightGray}`,
              backgroundColor: activeDashboard === 'gms' ? GMS_PINK : 'transparent',
              color: activeDashboard === 'gms' ? COLORS.white : COLORS.darkGray,
              fontWeight: activeDashboard === 'gms' ? 600 : 400,
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (activeDashboard !== 'gms') {
                e.currentTarget.style.backgroundColor = COLORS.backgroundGray;
              }
            }}
            onMouseLeave={(e) => {
              if (activeDashboard !== 'gms') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            GMS Dashboard
          </button>
        </div>

        {/* Right side - Year controls (always visible) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Toggle: Last 12 Months vs Calendar Year */}
          <div style={{ display: 'flex', borderRadius: '0.375rem', overflow: 'hidden', border: `1px solid ${accentColor}` }}>
            <button
              onClick={() => setUseRollingYear(true)}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                border: 'none',
                backgroundColor: useRollingYear ? accentColor : 'white',
                color: useRollingYear ? 'white' : accentColor,
                cursor: 'pointer'
              }}
            >
              Last 12 Months
            </button>
            <button
              onClick={() => setUseRollingYear(false)}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                border: 'none',
                borderLeft: `1px solid ${accentColor}`,
                backgroundColor: !useRollingYear ? accentColor : 'white',
                color: !useRollingYear ? 'white' : accentColor,
                cursor: 'pointer'
              }}
            >
              Calendar Year
            </button>
          </div>

          {/* Year Selector - only shown in calendar year mode */}
          {!useRollingYear && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar style={{ height: '1rem', width: '1rem', color: COLORS.mediumGray }} />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: `1px solid ${COLORS.lightGray}`,
                  backgroundColor: COLORS.white,
                  fontSize: '0.875rem',
                  color: COLORS.darkGray,
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {getAvailableYears().length > 0 ? getAvailableYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                )) : (
                  <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                )}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: COLORS.backgroundGray
        }}
      >
        {activeDashboard === 'financial' && (
          <OverviewSection
            setCurrentView={setCurrentView}
            onOpenReports={() => setShowReportsModal(true)}
            onOpenTransactions={() => setShowTransactionModal(true)}
          />
        )}
        {activeDashboard === 'gms' && (
          <PaymentAnalysis
            setCurrentView={setCurrentView}
            selectedYear={selectedYear.toString()}
            setSelectedYear={(year) => setSelectedYear(parseInt(year))}
          />
        )}
      </div>

      {/* Modals (for Financial Dashboard) */}
      <ReportsModal
        isOpen={showReportsModal}
        onClose={() => setShowReportsModal(false)}
        setCurrentView={setCurrentView}
      />
      <TransactionListModalV2
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
      />
    </div>
  );
};

export default BusinessOverview;
