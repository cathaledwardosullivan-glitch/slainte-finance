import React, { useState } from 'react';
import { Play, BookOpen, RefreshCw } from 'lucide-react';
import COLORS from '../../../utils/colors';
import { useTour } from '../../Tour';
import PrintableGuide from '../../PrintableGuide';

/**
 * TourOnboardingSection - App Tour, User Guide, and Start Fresh
 */
const TourOnboardingSection = () => {
  const { startTour, getTourCompletionDate } = useTour();
  const [showPrintableGuide, setShowPrintableGuide] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.lightGray}` }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: COLORS.darkGray, marginBottom: '1rem' }}>
          Getting Started
        </h3>
        <p style={{ fontSize: '0.875rem', color: COLORS.mediumGray, marginBottom: '1.5rem' }}>
          Learn how to use Sláinte Finance with our guided tour and comprehensive user guide.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {/* Take App Tour */}
          <div style={{ padding: '1.25rem', border: `2px solid ${COLORS.slainteBlue}`, borderRadius: '0.5rem', backgroundColor: `${COLORS.slainteBlue}10` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: COLORS.white }}>
                <Play style={{ height: '1.25rem', width: '1.25rem', color: COLORS.slainteBlue }} />
              </div>
              <h4 style={{ fontWeight: 600, color: COLORS.slainteBlue }}>App Tour</h4>
            </div>
            <p style={{ fontSize: '0.875rem', color: COLORS.darkGray, marginBottom: '1rem' }}>
              Take a guided tour through the key features of Sláinte Finance. Perfect for new users or a quick refresher.
            </p>
            <button
              onClick={startTour}
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                borderRadius: '0.375rem',
                fontWeight: 500,
                color: COLORS.white,
                backgroundColor: COLORS.slainteBlue,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <Play style={{ height: '1rem', width: '1rem' }} />
              Start Tour
            </button>
            {getTourCompletionDate() && (
              <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray, marginTop: '0.75rem' }}>
                Last completed: {getTourCompletionDate().toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Download User Guide */}
          <div style={{ padding: '1.25rem', border: `2px solid ${COLORS.incomeColor}`, borderRadius: '0.5rem', backgroundColor: `${COLORS.incomeColor}10` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: COLORS.white }}>
                <BookOpen style={{ height: '1.25rem', width: '1.25rem', color: COLORS.incomeColor }} />
              </div>
              <h4 style={{ fontWeight: 600, color: COLORS.incomeColor }}>User Guide</h4>
            </div>
            <p style={{ fontSize: '0.875rem', color: COLORS.darkGray, marginBottom: '1rem' }}>
              View or print a comprehensive guide to all features in Sláinte Finance. Perfect for training or reference.
            </p>
            <button
              onClick={() => setShowPrintableGuide(true)}
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                borderRadius: '0.375rem',
                fontWeight: 500,
                color: COLORS.white,
                backgroundColor: COLORS.incomeColor,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <BookOpen style={{ height: '1rem', width: '1rem' }} />
              Open User Guide
            </button>
          </div>
        </div>
      </div>

      {/* Restart Onboarding */}
      <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.lightGray}` }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: COLORS.darkGray, marginBottom: '1rem' }}>
          Start Fresh
        </h3>

        <div style={{ padding: '1.25rem', border: `2px solid ${COLORS.highlightYellow}`, borderRadius: '0.5rem', backgroundColor: `${COLORS.highlightYellow}10` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: COLORS.white }}>
              <RefreshCw style={{ height: '1.25rem', width: '1.25rem', color: '#D97706' }} />
            </div>
            <h4 style={{ fontWeight: 600, color: COLORS.darkGray }}>Restart Onboarding</h4>
          </div>
          <p style={{ fontSize: '0.875rem', color: COLORS.darkGray, marginBottom: '1rem' }}>
            Clear all personalized categories and restart the onboarding wizard from scratch. This will not delete transaction data.
          </p>
          <button
            onClick={() => {
              if (window.confirm('This will remove all personalized categories and restart onboarding. Transaction data will NOT be deleted. Continue?')) {
                localStorage.removeItem('slainte_practice_profile');
                localStorage.removeItem('slainte_onboarding_complete');
                window.location.reload();
              }
            }}
            style={{
              padding: '0.625rem 1rem',
              borderRadius: '0.375rem',
              fontWeight: 500,
              backgroundColor: COLORS.highlightYellow,
              color: COLORS.darkGray,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <RefreshCw style={{ height: '1rem', width: '1rem' }} />
            Restart Onboarding
          </button>
        </div>

        <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: COLORS.backgroundGray }}>
          <p style={{ fontSize: '0.75rem', color: COLORS.mediumGray }}>
            <strong>Note:</strong> Restarting onboarding will clear your practice profile and personalized category settings.
            Your transaction data and PCRS records will be preserved.
          </p>
        </div>
      </div>

      {/* Printable Guide Modal */}
      {showPrintableGuide && (
        <PrintableGuide onClose={() => setShowPrintableGuide(false)} />
      )}
    </div>
  );
};

export default TourOnboardingSection;
