import React, { useState, useEffect } from 'react';
import { Activity, Stethoscope, Target, Calendar } from 'lucide-react';
import COLORS from '../../utils/colors';
import { useAppContext } from '../../context/AppContext';
import PaymentAnalysis from '../PaymentAnalysis';
import GMSHealthCheck from '../GMSHealthCheck';
import NewGMSHealthCheck from '../NewGMSHealthCheck';

// Pink color for GMS theme
const GMS_PINK = '#E91E63';

/**
 * GMSOverview - Consolidated GMS management tab
 * Combines GMS Dashboard (PaymentAnalysis) and Health Check functionality
 */
const GMSOverview = ({ setCurrentView }) => {
  // Sub-navigation state
  const [activeSubView, setActiveSubView] = useState('dashboard');

  // Listen for tour events to switch between views
  useEffect(() => {
    const handleSwitchToHealthCheck = () => setActiveSubView('health-check');
    const handleSwitchToDashboard = () => setActiveSubView('dashboard');

    window.addEventListener('tour:switchToHealthCheck', handleSwitchToHealthCheck);
    window.addEventListener('tour:switchToDashboard', handleSwitchToDashboard);

    return () => {
      window.removeEventListener('tour:switchToHealthCheck', handleSwitchToHealthCheck);
      window.removeEventListener('tour:switchToDashboard', handleSwitchToDashboard);
    };
  }, []);

  // Use global context for year and view mode (shared with Financial Overview)
  const {
    selectedYear,
    setSelectedYear,
    useRollingYear,
    setUseRollingYear,
    getAvailableYears
  } = useAppContext();

  const subNavItems = [
    { id: 'dashboard', label: 'GMS Dashboard', icon: Activity },
    { id: 'health-check', label: 'GMS Health Check', icon: Stethoscope },
    { id: 'new-health-check', label: 'NEW Health Check', icon: Target }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.5rem' }}>
      {/* Sub-navigation bar */}
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
        {/* Left side - navigation buttons */}
        <div data-tour-id="gms-sub-nav" style={{ display: 'flex', gap: '0.5rem' }}>
          {subNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSubView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveSubView(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: isActive ? GMS_PINK : 'transparent',
                  color: isActive ? COLORS.white : COLORS.darkGray,
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = COLORS.backgroundGray;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <Icon style={{ width: '1rem', height: '1rem' }} />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Right side - view mode toggle and year selector (only visible on Dashboard view) */}
        {activeSubView === 'dashboard' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Toggle: Last 12 Months vs Calendar Year */}
            <div style={{ display: 'flex', borderRadius: '0.375rem', overflow: 'hidden', border: `1px solid ${GMS_PINK}` }}>
              <button
                onClick={() => setUseRollingYear(true)}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  border: 'none',
                  backgroundColor: useRollingYear ? GMS_PINK : 'white',
                  color: useRollingYear ? 'white' : GMS_PINK,
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
                  borderLeft: `1px solid ${GMS_PINK}`,
                  backgroundColor: !useRollingYear ? GMS_PINK : 'white',
                  color: !useRollingYear ? 'white' : GMS_PINK,
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
        )}
      </div>

      {/* Content area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: COLORS.backgroundGray
        }}
      >
        {activeSubView === 'dashboard' && (
          <PaymentAnalysis setCurrentView={setCurrentView} selectedYear={selectedYear.toString()} setSelectedYear={(year) => setSelectedYear(parseInt(year))} />
        )}
        {activeSubView === 'health-check' && (
          <GMSHealthCheck setCurrentView={setCurrentView} />
        )}
        {activeSubView === 'new-health-check' && (
          <NewGMSHealthCheck />
        )}
      </div>
    </div>
  );
};

export default GMSOverview;
