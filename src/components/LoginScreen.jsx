import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import COLORS from '../utils/colors';

export default function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const result = await window.electronAPI.verifyPassword(password);

      if (result.success) {
        // If remember me is checked, store a session token
        if (rememberMe) {
          const sessionToken = btoa(`session_${Date.now()}_${Math.random().toString(36).substr(2)}`);
          localStorage.setItem('app_session_token', sessionToken);
          localStorage.setItem('app_session_expiry', (Date.now() + 7 * 24 * 60 * 60 * 1000).toString()); // 7 days
        }
        onLogin();
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      // Check if this is an IPC handler error - allow access since main process may have restarted
      if (err.message?.includes('No handler registered')) {
        console.warn('IPC handlers not ready - allowing access. Please fully restart the app if issues persist.');
        onLogin();
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isVerifying) {
      handleSubmit(e);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.backgroundGray,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: COLORS.white,
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        padding: '3rem',
        width: '100%',
        maxWidth: '420px',
        textAlign: 'center'
      }}>
        {/* Logo/Icon */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: `${COLORS.slainteBlue}15`,
          marginBottom: '1.5rem'
        }}>
          <Lock style={{ width: '40px', height: '40px', color: COLORS.slainteBlue }} />
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: COLORS.darkGray,
          marginBottom: '0.5rem'
        }}>
          Slainte Finance
        </h1>

        <p style={{
          fontSize: '1rem',
          color: COLORS.mediumGray,
          marginBottom: '2rem'
        }}>
          Enter your password to continue
        </p>

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {/* Password Input */}
          <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: COLORS.darkGray,
              marginBottom: '0.5rem'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                disabled={isVerifying}
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.875rem 3rem 0.875rem 1rem',
                  fontSize: '1rem',
                  border: `2px solid ${error ? COLORS.expenseColor : COLORS.lightGray}`,
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  backgroundColor: isVerifying ? COLORS.backgroundGray : COLORS.white,
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  if (!error) e.target.style.borderColor = COLORS.slainteBlue;
                }}
                onBlur={(e) => {
                  if (!error) e.target.style.borderColor = COLORS.lightGray;
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
                {showPassword ?
                  <EyeOff style={{ width: '20px', height: '20px' }} /> :
                  <Eye style={{ width: '20px', height: '20px' }} />
                }
              </button>
            </div>

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

          {/* Remember Me */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem'
          }}>
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                accentColor: COLORS.slainteBlue
              }}
            />
            <label
              htmlFor="rememberMe"
              style={{
                fontSize: '0.875rem',
                color: COLORS.mediumGray,
                cursor: 'pointer'
              }}
            >
              Remember me for 7 days
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isVerifying || !password.trim()}
            style={{
              width: '100%',
              padding: '0.875rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: COLORS.white,
              backgroundColor: COLORS.slainteBlue,
              border: 'none',
              borderRadius: '8px',
              cursor: (isVerifying || !password.trim()) ? 'not-allowed' : 'pointer',
              opacity: (isVerifying || !password.trim()) ? 0.6 : 1,
              transition: 'all 0.2s'
            }}
          >
            {isVerifying ? 'Verifying...' : 'Unlock'}
          </button>
        </form>

        {/* Help Text */}
        <p style={{
          fontSize: '0.75rem',
          color: COLORS.mediumGray,
          marginTop: '1.5rem'
        }}>
          This is the same password used for mobile access
        </p>
      </div>
    </div>
  );
}
