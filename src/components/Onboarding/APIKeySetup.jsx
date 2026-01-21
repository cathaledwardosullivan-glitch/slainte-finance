import React, { useState } from 'react';
import { Key, AlertCircle, Sparkles, Shield, Eye, EyeOff, CheckCircle } from 'lucide-react';
import COLORS from '../../utils/colors';

export default function APIKeySetup({ onComplete, onSkip }) {
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  // Mobile access password state
  const [showMobileSetup, setShowMobileSetup] = useState(false);
  const [mobilePassword, setMobilePassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mobileError, setMobileError] = useState('');
  const [isSavingMobile, setIsSavingMobile] = useState(false);
  const [validatedApiKey, setValidatedApiKey] = useState('');

  const handleSubmit = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your license key');
      return;
    }

    if (!apiKey.startsWith('sk-ant-')) {
      setError('Invalid license key format');
      return;
    }

    setIsValidating(true);
    setError('');

    // Test the API key with a simple request
    try {
      // Check if running in Electron
      const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

      if (isElectron) {
        // In Electron: Store the key temporarily in localStorage, test via IPC, then confirm
        await window.electronAPI.setLocalStorage('claude_api_key', apiKey.trim());

        // Test the API key via IPC
        const response = await window.electronAPI.callClaude(
          "Say 'API key is valid' if you receive this message.",
          null
        );

        // Check if we got a valid response
        if (!response || !response.content || response.content.length === 0) {
          // Remove the invalid key
          await window.electronAPI.setLocalStorage('claude_api_key', null);
          throw new Error('Invalid API key. Please check your key and try again.');
        }

        // Success! API key is valid - move to mobile setup step
        setValidatedApiKey(apiKey.trim());
        setShowMobileSetup(true);

      } else {
        // In Browser/PWA: Not supported for initial setup (needs desktop)
        throw new Error('API key setup must be done in the desktop app first.');
      }

    } catch (err) {
      console.error('API key validation error:', err);
      setError(err.message || 'Failed to validate API key. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isValidating) {
      handleSubmit();
    }
  };

  // Handle mobile password setup
  const handleMobilePasswordSubmit = async () => {
    setMobileError('');

    // Validate password
    if (mobilePassword.length < 6) {
      setMobileError('Password must be at least 6 characters');
      return;
    }

    if (mobilePassword !== confirmPassword) {
      setMobileError('Passwords do not match');
      return;
    }

    setIsSavingMobile(true);

    try {
      // Save the mobile password via IPC
      const success = await window.electronAPI.setMobilePassword(mobilePassword);

      if (!success) {
        throw new Error('Failed to save mobile password');
      }

      // Complete setup with the validated API key
      onComplete(validatedApiKey);

    } catch (err) {
      console.error('Mobile password save error:', err);
      setMobileError(err.message || 'Failed to save mobile password');
    } finally {
      setIsSavingMobile(false);
    }
  };

  // Skip mobile setup and continue
  const handleSkipMobileSetup = () => {
    onComplete(validatedApiKey);
  };

  // If showing mobile setup screen
  if (showMobileSetup) {
    return (
      <div style={{ textAlign: 'center' }}>
        {/* Header */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: `${COLORS.incomeColor}15`,
          marginBottom: '1.5rem'
        }}>
          <Shield style={{ width: '32px', height: '32px', color: COLORS.incomeColor }} />
        </div>

        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: COLORS.darkGray,
          marginBottom: '1rem'
        }}>
          Set Up App Security
        </h2>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          color: COLORS.incomeColor
        }}>
          <CheckCircle style={{ width: '20px', height: '20px' }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>License Key Verified</span>
        </div>

        <p style={{
          fontSize: '1rem',
          color: COLORS.mediumGray,
          marginBottom: '2rem',
          maxWidth: '500px',
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: 1.6
        }}>
          Create a security password for your app. This single password protects your data
          and enables secure features.
        </p>

        {/* Info Box */}
        <div style={{
          backgroundColor: `${COLORS.slainteBlue}10`,
          border: `1px solid ${COLORS.slainteBlue}30`,
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
          textAlign: 'left'
        }}>
          <p style={{
            fontSize: '0.875rem',
            color: COLORS.darkGray,
            lineHeight: 1.5,
            marginBottom: '0.75rem'
          }}>
            <strong>This password enables:</strong>
          </p>
          <ul style={{
            fontSize: '0.875rem',
            color: COLORS.darkGray,
            lineHeight: 1.6,
            margin: 0,
            paddingLeft: '1.25rem'
          }}>
            <li><strong>Encrypted backups</strong> - Your data is automatically backed up and encrypted on app close</li>
            <li><strong>Mobile access</strong> - Partners can view the dashboard from phones on your local network</li>
          </ul>
        </div>

        {/* Password Input */}
        <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: COLORS.darkGray,
            marginBottom: '0.5rem'
          }}>
            App Security Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter a password (min 6 characters)"
              value={mobilePassword}
              onChange={(e) => {
                setMobilePassword(e.target.value);
                setMobileError('');
              }}
              disabled={isSavingMobile}
              style={{
                width: '100%',
                padding: '0.75rem 3rem 0.75rem 1rem',
                fontSize: '1rem',
                border: `2px solid ${mobileError ? COLORS.expenseColor : COLORS.lightGray}`,
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => {
                if (!mobileError) e.target.style.borderColor = COLORS.slainteBlue;
              }}
              onBlur={(e) => {
                if (!mobileError) e.target.style.borderColor = COLORS.lightGray;
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem',
                color: COLORS.mediumGray
              }}
            >
              {showPassword ? <EyeOff style={{ width: '20px', height: '20px' }} /> : <Eye style={{ width: '20px', height: '20px' }} />}
            </button>
          </div>
        </div>

        {/* Confirm Password Input */}
        <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: COLORS.darkGray,
            marginBottom: '0.5rem'
          }}>
            Confirm Password
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setMobileError('');
            }}
            disabled={isSavingMobile}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              fontSize: '1rem',
              border: `2px solid ${mobileError ? COLORS.expenseColor : COLORS.lightGray}`,
              borderRadius: '8px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => {
              if (!mobileError) e.target.style.borderColor = COLORS.slainteBlue;
            }}
            onBlur={(e) => {
              if (!mobileError) e.target.style.borderColor = COLORS.lightGray;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isSavingMobile && mobilePassword && confirmPassword) {
                handleMobilePasswordSubmit();
              }
            }}
          />

          {mobileError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.5rem',
              color: COLORS.expenseColor,
              fontSize: '0.875rem'
            }}>
              <AlertCircle style={{ width: '16px', height: '16px' }} />
              {mobileError}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center'
        }}>
          <button
            onClick={handleMobilePasswordSubmit}
            disabled={isSavingMobile || !mobilePassword || !confirmPassword}
            style={{
              padding: '0.875rem 2rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: COLORS.white,
              backgroundColor: COLORS.slainteBlue,
              border: 'none',
              borderRadius: '8px',
              cursor: (isSavingMobile || !mobilePassword || !confirmPassword) ? 'not-allowed' : 'pointer',
              opacity: (isSavingMobile || !mobilePassword || !confirmPassword) ? 0.6 : 1,
              transition: 'all 0.2s',
              minWidth: '180px'
            }}
          >
            {isSavingMobile ? 'Saving...' : 'Save & Continue'}
          </button>

          <button
            onClick={handleSkipMobileSetup}
            disabled={isSavingMobile}
            style={{
              padding: '0.875rem 2rem',
              fontSize: '1rem',
              fontWeight: 500,
              color: COLORS.mediumGray,
              backgroundColor: 'transparent',
              border: `2px solid ${COLORS.lightGray}`,
              borderRadius: '8px',
              cursor: isSavingMobile ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Skip for now
          </button>
        </div>

        {/* Help Text */}
        <p style={{
          fontSize: '0.75rem',
          color: COLORS.mediumGray,
          marginTop: '1.5rem'
        }}>
          You can set this up later in Admin Settings if you skip now.
        </p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center' }}>
      {/* Header */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        backgroundColor: `${COLORS.slainteBlue}15`,
        marginBottom: '1.5rem'
      }}>
        <Sparkles style={{ width: '32px', height: '32px', color: COLORS.slainteBlue }} />
      </div>

      <h2 style={{
        fontSize: '2rem',
        fontWeight: 700,
        color: COLORS.darkGray,
        marginBottom: '1rem'
      }}>
        Welcome to Slainte Finance Manager
      </h2>

      <p style={{
        fontSize: '1.125rem',
        color: COLORS.mediumGray,
        marginBottom: '2rem',
        maxWidth: '600px',
        marginLeft: 'auto',
        marginRight: 'auto',
        lineHeight: 1.6
      }}>
        This AI-powered setup will help you configure your practice in just a few minutes.
        We'll analyze your practice website and guide you through a personalized conversation.
      </p>

      {/* Info Box */}
      <div style={{
        backgroundColor: `${COLORS.highlightYellow}15`,
        border: `1px solid ${COLORS.highlightYellow}`,
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '2rem',
        textAlign: 'left'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem'
        }}>
          <Key style={{
            width: '24px',
            height: '24px',
            color: COLORS.darkGray,
            flexShrink: 0,
            marginTop: '2px'
          }} />
          <div>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: COLORS.darkGray,
              marginBottom: '0.5rem'
            }}>
              Sláinte License Key Required
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: COLORS.mediumGray,
              marginBottom: '0',
              lineHeight: 1.6
            }}>
              Enter your Sláinte License Key to activate the app.
              Your key is stored locally and never shared with anyone.
            </p>
          </div>
        </div>
      </div>

      {/* API Key Input */}
      <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: COLORS.darkGray,
          marginBottom: '0.5rem'
        }}>
          Sláinte License Key
        </label>
        <input
          type="password"
          placeholder="Enter your license key"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setError('');
          }}
          onKeyDown={handleKeyDown}
          disabled={isValidating}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            fontSize: '1rem',
            border: `2px solid ${error ? COLORS.expenseColor : COLORS.lightGray}`,
            borderRadius: '8px',
            outline: 'none',
            transition: 'border-color 0.2s',
            backgroundColor: isValidating ? COLORS.backgroundGray : COLORS.white
          }}
          onFocus={(e) => {
            if (!error) e.target.style.borderColor = COLORS.slainteBlue;
          }}
          onBlur={(e) => {
            if (!error) e.target.style.borderColor = COLORS.lightGray;
          }}
        />

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '0.5rem',
            color: COLORS.expenseColor,
            fontSize: '0.875rem'
          }}>
            <AlertCircle style={{ width: '16px', height: '16px' }} />
            {error}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        justifyContent: 'center'
      }}>
        <button
          onClick={handleSubmit}
          disabled={isValidating || !apiKey.trim()}
          style={{
            padding: '0.875rem 2rem',
            fontSize: '1rem',
            fontWeight: 600,
            color: COLORS.white,
            backgroundColor: COLORS.slainteBlue,
            border: 'none',
            borderRadius: '8px',
            cursor: (isValidating || !apiKey.trim()) ? 'not-allowed' : 'pointer',
            opacity: (isValidating || !apiKey.trim()) ? 0.6 : 1,
            transition: 'all 0.2s',
            minWidth: '180px'
          }}
          onMouseEnter={(e) => {
            if (!isValidating && apiKey.trim()) {
              e.target.style.backgroundColor = '#1e40af';
            }
          }}
          onMouseLeave={(e) => {
            if (!isValidating && apiKey.trim()) {
              e.target.style.backgroundColor = COLORS.slainteBlue;
            }
          }}
        >
          {isValidating ? 'Validating...' : 'Continue'}
        </button>

        {onSkip && (
          <button
            onClick={onSkip}
            disabled={isValidating}
            style={{
              padding: '0.875rem 2rem',
              fontSize: '1rem',
              fontWeight: 500,
              color: COLORS.mediumGray,
              backgroundColor: 'transparent',
              border: `2px solid ${COLORS.lightGray}`,
              borderRadius: '8px',
              cursor: isValidating ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!isValidating) {
                e.target.style.borderColor = COLORS.mediumGray;
                e.target.style.color = COLORS.darkGray;
              }
            }}
            onMouseLeave={(e) => {
              if (!isValidating) {
                e.target.style.borderColor = COLORS.lightGray;
                e.target.style.color = COLORS.mediumGray;
              }
            }}
          >
            Skip for now
          </button>
        )}
      </div>

      {/* Help Text */}
      <p style={{
        fontSize: '0.75rem',
        color: COLORS.mediumGray,
        marginTop: '1.5rem'
      }}>
        Don't worry - you can add this later in Settings if you skip now.
      </p>
    </div>
  );
}
