import React, { useState } from 'react';
import { Play, BookOpen, Stethoscope } from 'lucide-react';
import COLORS from '../../../utils/colors';
import { useTour } from '../../Tour';
import PrintableGuide from '../../PrintableGuide';

const GMS_PINK = COLORS.chartPink;

/**
 * TourOnboardingSection - App Tour, User Guide, and Health Check Tour
 */
const TourOnboardingSection = () => {
  const { startTour, startGMSHealthCheckTour, getTourCompletionDate, getGMSHCTourCompletionDate } = useTour();
  const [showPrintableGuide, setShowPrintableGuide] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ backgroundColor: COLORS.white, padding: '1.5rem', borderRadius: '0.5rem', border: `1px solid ${COLORS.borderLight}` }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: COLORS.textPrimary, marginBottom: '1rem' }}>
          Getting Started
        </h3>
        <p style={{ fontSize: '0.875rem', color: COLORS.textSecondary, marginBottom: '1.5rem' }}>
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
            <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary, marginBottom: '1rem' }}>
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
              <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginTop: '0.75rem' }}>
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
            <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary, marginBottom: '1rem' }}>
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

          {/* GMS Health Check Tour */}
          <div style={{ padding: '1.25rem', border: `2px solid ${GMS_PINK}`, borderRadius: '0.5rem', backgroundColor: `${GMS_PINK}10` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: COLORS.white }}>
                <Stethoscope style={{ height: '1.25rem', width: '1.25rem', color: GMS_PINK }} />
              </div>
              <h4 style={{ fontWeight: 600, color: GMS_PINK }}>Health Check Tour</h4>
            </div>
            <p style={{ fontSize: '0.875rem', color: COLORS.textPrimary, marginBottom: '1rem' }}>
              A guided walkthrough of the GMS Health Check report, explaining each income category and what to look for.
            </p>
            <button
              onClick={startGMSHealthCheckTour}
              style={{
                width: '100%',
                padding: '0.625rem 1rem',
                borderRadius: '0.375rem',
                fontWeight: 500,
                color: COLORS.white,
                backgroundColor: GMS_PINK,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <Play style={{ height: '1rem', width: '1rem' }} />
              Start Health Check Tour
            </button>
            {getGMSHCTourCompletionDate() && (
              <p style={{ fontSize: '0.75rem', color: COLORS.textSecondary, marginTop: '0.75rem' }}>
                Last completed: {getGMSHCTourCompletionDate().toLocaleDateString()}
              </p>
            )}
          </div>
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
