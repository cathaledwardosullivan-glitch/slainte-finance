import React, { useState } from 'react';
import { List, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import COLORS from '../../utils/colors';

export default function CategoryPreferences({ profile, onComplete, onBack }) {
  const [mode, setMode] = useState('all');

  const handleContinue = () => {
    onComplete({
      mode: mode,
      hiddenCategories: []
    });
  };

  return (
    <div>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: `${COLORS.slainteBlue}15`,
          marginBottom: '1rem'
        }}>
          <List style={{ width: '32px', height: '32px', color: COLORS.slainteBlue }} />
        </div>

        <h2 style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: COLORS.darkGray,
          marginBottom: '0.5rem'
        }}>
          Category Preferences
        </h2>

        <p style={{
          fontSize: '1rem',
          color: COLORS.mediumGray,
          maxWidth: '600px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          We've set up 120+ transaction categories for your practice.
          How would you like to view them?
        </p>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {/* Option 1: Show All */}
        <div
          onClick={() => setMode('all')}
          style={{
            padding: '1.5rem',
            border: `2px solid ${mode === 'all' ? COLORS.slainteBlue : COLORS.lightGray}`,
            borderRadius: '12px',
            cursor: 'pointer',
            backgroundColor: mode === 'all' ? `${COLORS.slainteBlue}05` : COLORS.white,
            transition: 'all 0.2s',
            position: 'relative'
          }}
        >
          {mode === 'all' && (
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem'
            }}>
              <CheckCircle style={{ width: '24px', height: '24px', color: COLORS.slainteBlue }} />
            </div>
          )}

          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: COLORS.darkGray,
            marginBottom: '0.5rem'
          }}>
            Show All Categories
          </h3>
          <p style={{
            fontSize: '0.875rem',
            color: COLORS.mediumGray,
            lineHeight: 1.6
          }}>
            Recommended for detailed tracking. You'll see all income and expense categories,
            including specialized ones. You can always hide specific categories later.
          </p>
          <div style={{
            marginTop: '0.75rem',
            padding: '0.5rem 0.75rem',
            backgroundColor: `${COLORS.incomeColor}15`,
            borderRadius: '6px',
            fontSize: '0.75rem',
            color: COLORS.darkGray,
            display: 'inline-block'
          }}>
            ✓ Best for comprehensive financial management
          </div>
        </div>

        {/* Option 2: Show Commonly Used */}
        <div
          onClick={() => setMode('common')}
          style={{
            padding: '1.5rem',
            border: `2px solid ${mode === 'common' ? COLORS.slainteBlue : COLORS.lightGray}`,
            borderRadius: '12px',
            cursor: 'pointer',
            backgroundColor: mode === 'common' ? `${COLORS.slainteBlue}05` : COLORS.white,
            transition: 'all 0.2s',
            position: 'relative'
          }}
        >
          {mode === 'common' && (
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem'
            }}>
              <CheckCircle style={{ width: '24px', height: '24px', color: COLORS.slainteBlue }} />
            </div>
          )}

          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: COLORS.darkGray,
            marginBottom: '0.5rem'
          }}>
            Show Commonly Used Only
          </h3>
          <p style={{
            fontSize: '0.875rem',
            color: COLORS.mediumGray,
            lineHeight: 1.6
          }}>
            Simpler interface with only the most frequently used categories visible.
            Specialized categories will be hidden but still available in your data.
          </p>
          <div style={{
            marginTop: '0.75rem',
            padding: '0.5rem 0.75rem',
            backgroundColor: `${COLORS.highlightYellow}15`,
            borderRadius: '6px',
            fontSize: '0.75rem',
            color: COLORS.darkGray,
            display: 'inline-block'
          }}>
            ✓ Cleaner interface, easier to navigate
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div style={{
        padding: '1rem',
        backgroundColor: COLORS.backgroundGray,
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <p style={{
          fontSize: '0.875rem',
          color: COLORS.mediumGray,
          margin: 0
        }}>
          💡 <strong>Don't worry!</strong> You can change this anytime in Settings,
          and you can always customize which categories to show or hide.
        </p>
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        justifyContent: 'space-between'
      }}>
        <button
          onClick={onBack}
          style={{
            padding: '0.875rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 500,
            color: COLORS.mediumGray,
            backgroundColor: 'transparent',
            border: `2px solid ${COLORS.lightGray}`,
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <ArrowLeft style={{ width: '18px', height: '18px' }} />
          Back
        </button>

        <button
          onClick={handleContinue}
          style={{
            padding: '0.875rem 2rem',
            fontSize: '1rem',
            fontWeight: 600,
            color: COLORS.white,
            backgroundColor: COLORS.slainteBlue,
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#1e40af'}
          onMouseLeave={(e) => e.target.style.backgroundColor = COLORS.slainteBlue}
        >
          Continue
          <ArrowRight style={{ width: '18px', height: '18px' }} />
        </button>
      </div>
    </div>
  );
}
