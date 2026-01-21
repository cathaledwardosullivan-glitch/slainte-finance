import React, { useState } from 'react';
import { Activity, Stethoscope } from 'lucide-react';
import COLORS from '../../utils/colors';
import PaymentAnalysis from '../PaymentAnalysis';
import GMSHealthCheck from '../GMSHealthCheck';

// Pink color for GMS theme
const GMS_PINK = '#E91E63';

/**
 * GMSOverview - Consolidated GMS management tab
 * Combines GMS Dashboard (PaymentAnalysis) and Health Check functionality
 */
const GMSOverview = ({ setCurrentView }) => {
  // Sub-navigation state
  const [activeSubView, setActiveSubView] = useState('dashboard');
  // Year selector state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const subNavItems = [
    { id: 'dashboard', label: 'GMS Dashboard', icon: Activity },
    { id: 'health-check', label: 'GMS Health Check', icon: Stethoscope }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-navigation bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.5rem',
          backgroundColor: COLORS.white,
          borderBottom: `1px solid ${COLORS.lightGray}`,
          flexShrink: 0
        }}
      >
        {/* Left side - navigation buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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

        {/* Right side - year selector (only visible on Dashboard view) */}
        {activeSubView === 'dashboard' && (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: `1px solid ${COLORS.lightGray}`,
              backgroundColor: COLORS.white,
              fontSize: '0.875rem',
              color: COLORS.darkGray,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
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
          <PaymentAnalysis setCurrentView={setCurrentView} selectedYear={selectedYear} setSelectedYear={setSelectedYear} />
        )}
        {activeSubView === 'health-check' && (
          <GMSHealthCheck setCurrentView={setCurrentView} />
        )}
      </div>
    </div>
  );
};

export default GMSOverview;
