import React, { useState, useEffect } from 'react';
import { X, Database, HardDrive, Layers, Building2, BookOpen, Download, Briefcase, Shield, Wifi } from 'lucide-react';
import COLORS from '../../utils/colors';
import DataSection from './sections/DataSection';
import BackupRestoreSection from './sections/BackupRestoreSection';
import CategoriesSection from './sections/CategoriesSection';
import PracticeProfileSection from './sections/PracticeProfileSection';
import TourOnboardingSection from './sections/TourOnboardingSection';
import AppUpdateSection from './sections/AppUpdateSection';
import AccountantDataSection from './sections/AccountantDataSection';
import PrivacySection from './sections/PrivacySection';
import ConnectedPracticeSection from './sections/ConnectedPracticeSection';

/**
 * SettingsModal - Main settings modal with left sidebar navigation
 * Centered on screen with overlay, 800px max width
 */
const SettingsModal = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState('data');

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Listen for tour section switching events
  useEffect(() => {
    const handleSwitchSection = (e) => {
      if (isOpen && e.detail) {
        setActiveSection(e.detail);
      }
    };

    window.addEventListener('tour:switchSettingsSection', handleSwitchSection);
    return () => window.removeEventListener('tour:switchSettingsSection', handleSwitchSection);
  }, [isOpen]);

  if (!isOpen) return null;

  const sections = [
    { id: 'data', label: 'Data Upload', icon: Database, tourId: 'settings-data-tab' },
    { id: 'privacy', label: 'Privacy & AI', icon: Shield },
    { id: 'tour', label: 'Tour/Onboarding', icon: BookOpen },
    { id: 'profile', label: 'Practice Profile', icon: Building2 },
    { id: 'categories', label: 'Categorisation', icon: Layers, tourId: 'settings-categories-tab' },
    { id: 'accountant', label: 'Data for Accountant', icon: Briefcase, tourId: 'settings-accountant-tab' },
    { id: 'backup', label: 'Backup & Restore', icon: HardDrive },
    { id: 'connected', label: 'Connected Practice', icon: Wifi },
    { id: 'update', label: 'App Update', icon: Download }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '2rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: COLORS.white,
          borderRadius: '16px',
          maxWidth: '900px',
          width: '100%',
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.5rem',
            borderBottom: `1px solid ${COLORS.lightGray}`,
            flexShrink: 0
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: COLORS.darkGray }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.5rem',
              cursor: 'pointer',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.backgroundGray}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X style={{ width: '1.25rem', height: '1.25rem', color: COLORS.mediumGray }} />
          </button>
        </div>

        {/* Main Content Area */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Sidebar Navigation */}
          <nav
            style={{
              width: '200px',
              borderRight: `1px solid ${COLORS.lightGray}`,
              padding: '1rem 0',
              flexShrink: 0,
              backgroundColor: COLORS.backgroundGray
            }}
          >
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  data-tour-id={section.tourId}
                  onClick={() => setActiveSection(section.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1.25rem',
                    border: 'none',
                    background: isActive ? COLORS.white : 'transparent',
                    cursor: 'pointer',
                    color: isActive ? COLORS.slainteBlue : COLORS.darkGray,
                    fontWeight: isActive ? 600 : 400,
                    fontSize: '0.9375rem',
                    textAlign: 'left',
                    borderRight: isActive ? `3px solid ${COLORS.slainteBlue}` : '3px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <Icon style={{ width: '1.125rem', height: '1.125rem' }} />
                  {section.label}
                </button>
              );
            })}
          </nav>

          {/* Content Area */}
          <main
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '1.5rem'
            }}
          >
            {activeSection === 'data' && <DataSection />}
            {activeSection === 'privacy' && <PrivacySection />}
            {activeSection === 'backup' && <BackupRestoreSection />}
            {activeSection === 'categories' && <CategoriesSection />}
            {activeSection === 'accountant' && <AccountantDataSection />}
            {activeSection === 'profile' && <PracticeProfileSection />}
            {activeSection === 'tour' && <TourOnboardingSection />}
            {activeSection === 'connected' && <ConnectedPracticeSection />}
            {activeSection === 'update' && <AppUpdateSection />}
          </main>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
