import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import {
  checkBiometricAvailability,
  authenticateWithBiometrics,
  saveBiometricCredentials,
  isBiometricEnabled,
  performBiometricLogin,
  getBiometricCredentials,
} from '../services/biometricAuth';
import './Login.css';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [enableBiometricAfterLogin, setEnableBiometricAfterLogin] = useState(false);

  // Function to scroll to top of the page
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Function to set error and scroll to top
  const setErrorAndScroll = (errorMessage) => {
    setError(errorMessage);
    scrollToTop();
  };
  
  const { signup, login, loginWithToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check for redirect reasons and show appropriate messages
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const reason = urlParams.get('reason');
    
    if (reason) {
      switch (reason) {
        case 'session_expired':
          setError('Your session has expired. Please log in again.');
          break;
        case 'Token expired or invalid':
          setError('Your login session has expired. Please log in again.');
          break;
        case 'Token expired during session':
          setError('Your session expired while you were using the app. Please log in again.');
          break;
        case 'Invalid user data':
          setError('There was an issue with your account data. Please log in again.');
          break;
        case 'user_logout':
          setError('You have been logged out successfully.');
          break;
        default:
          setError('Please log in to continue.');
      }
    }
    
  }, [location.search]);

  // Check biometric availability on mount
  useEffect(() => {
    // Log to both console and show alert for debugging (remove alert later)
    console.log('🔐 Login: Component mounted, starting biometric check...');
    if (Capacitor.isNativePlatform()) {
      console.log('🔐 Login: ✅ On native iOS platform');
    }
    
    const checkBiometric = async () => {
      if (!Capacitor.isNativePlatform()) {
        console.log('🔐 Login: Not on native platform, skipping biometric check');
        return;
      }
      
      console.log('🔐 Login: On native platform, checking biometrics...');
      
      // Wait for Capacitor to fully initialize and plugins to register
      // Try multiple times with increasing delays in case plugin loads slowly
      let availability = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 500 + (attempt * 500)));
        
        console.log(`🔐 Login: Checking biometric availability (attempt ${attempt + 1})...`);
        try {
          availability = await checkBiometricAvailability();
          console.log('🔐 Login: Biometric availability result:', availability);
          
          if (availability.available) {
            break; // Success, exit retry loop
          }
        } catch (error) {
          console.warn(`🔐 Login: Attempt ${attempt + 1} failed:`, error);
          if (attempt === 2) {
            console.error('🔐 Login: All attempts failed to check biometric availability');
          }
        }
      }
      
      if (availability) {
        setBiometricAvailable(availability.available);
        setBiometricType(availability.biometryType);
        
          if (availability.available) {
            const enabled = await isBiometricEnabled();
            console.log('🔐 Login: Biometric enabled:', enabled);
            console.log('🔐 Login: Biometric type:', availability.biometryType);
            setBiometricEnabled(enabled);
            
            // Debug: Check if credentials exist and pre-fill email
            if (enabled) {
              const credentials = await getBiometricCredentials();
              console.log('🔐 Login: Saved credentials found:', !!credentials);
              if (credentials) {
                console.log('🔐 Login: Credentials email:', credentials.email);
                console.log('🔐 Login: Face ID button should be visible');
                
                // Pre-fill email field for better UX
                if (credentials.email) {
                  setEmail(credentials.email);
                  console.log('🔐 Login: Email field pre-filled:', credentials.email);
                }
              } else {
                console.warn('⚠️ Login: Enabled but no credentials found - this is a problem!');
              }
            } else {
              console.log('🔐 Login: Biometric not enabled - user needs to enable it first');
            }
          } else {
          console.warn('🔐 Login: Biometric not available.');
          console.warn('⚠️ NOTE: Face ID/Touch ID does NOT work on iOS Simulator!');
          console.warn('⚠️ You must test on a real iOS device to use Face ID.');
          console.warn('Possible reasons:');
          console.warn('  - Running on iOS Simulator (no biometric hardware)');
          console.warn('  - Face ID/Touch ID not set up on device');
          console.warn('  - Device doesn\'t support biometrics');
          console.warn('  - Biometric authentication disabled in device settings');
        }
      }
    };
    
    checkBiometric();
  }, []);

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhoneNumber = (phone) => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    // Check if it's 10 digits (North American format)
    return digitsOnly.length === 10;
  };

  const formatPhoneNumber = (phone) => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    // Format as (XXX) XXX-XXXX
    if (digitsOnly.length === 10) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }
    return phone; // Return original if not 10 digits
  };

  const handlePhoneNumberChange = (e) => {
    const value = e.target.value;
    // Remove all non-digit characters
    const digitsOnly = value.replace(/\D/g, '');
    
    // Limit to 10 digits
    if (digitsOnly.length <= 10) {
      // Format as user types
      let formatted = digitsOnly;
      if (digitsOnly.length >= 6) {
        formatted = `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
      } else if (digitsOnly.length >= 3) {
        formatted = `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;
      } else if (digitsOnly.length > 0) {
        formatted = `(${digitsOnly}`;
      }
      setPhoneNumber(formatted);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check if offline - login requires internet connection
      if (!navigator.onLine) {
        setErrorAndScroll("You're currently offline. Login requires an internet connection. Please check your connection and try again.");
        setLoading(false);
        return;
      }

      if (isLogin) {
        console.log('🔐 Login: Starting login process for:', email);
        if (!email || !password) {
          setErrorAndScroll('Email and password are required');
          setLoading(false);
          return;
        }
        await login(email, password);
        console.log('🔐 Login: Login successful');
        
        // If biometric is available and user wants to enable it, prompt Face ID first
        if (enableBiometricAfterLogin && biometricAvailable) {
          const token = localStorage.getItem('triathlonToken');
          console.log('🔐 Login: User wants to enable Face ID');
          console.log('🔐 Login: Email:', email);
          console.log('🔐 Login: Token available:', !!token);
          
          if (token) {
            try {
              // Prompt Face ID to verify user wants to enable it
              console.log('🔐 Login: Prompting Face ID to enable biometric login...');
              const authenticated = await authenticateWithBiometrics('Enable Face ID login for faster access');
              
              if (authenticated) {
                // Only save credentials if Face ID authentication succeeded
                await saveBiometricCredentials(email, token);
                
                // Verify it was saved
                const enabled = await isBiometricEnabled();
                const verifyCredentials = await getBiometricCredentials();
                console.log('🔐 Login: Biometric enabled after save:', enabled);
                console.log('🔐 Login: Credentials verified:', !!verifyCredentials);
                
                // Update state - this will trigger the auto-trigger useEffect
                setBiometricEnabled(enabled);
                console.log('✅ Face ID login enabled successfully');
                console.log('🔐 Login: State updated - biometricEnabled set to:', enabled);
                
                // Show success message
                setError(''); // Clear any errors
                // Could show a toast here if you have one
              } else {
                console.warn('⚠️ Face ID authentication failed or was cancelled - not enabling');
                setError('Face ID authentication was cancelled or failed. Please try again if you want to enable Face ID login.');
              }
            } catch (error) {
              console.error('❌ Error enabling Face ID:', error);
              setError('Failed to enable Face ID login. Please try again.');
              // Don't fail the login if biometric setup fails
            }
          } else {
            console.warn('⚠️ No token available to save for biometric login');
          }
        } else {
          console.log('🔐 Login: Not enabling biometric login:', {
            enableBiometricAfterLogin,
            biometricAvailable
          });
        }
      } else {
          // Check if offline - signup requires internet connection
        if (!navigator.onLine) {
          setErrorAndScroll("You're currently offline. Creating an account requires an internet connection. Please check your connection and try again.");
          setLoading(false);
          return;
        }

        // Validate passwords match for signup
        if (password !== confirmPassword) {
          setErrorAndScroll("Passwords do not match. Please ensure both password fields are identical.");
          setLoading(false);
          return;
        }
        if (!name || !email || !password) {
          setErrorAndScroll('Name, email, and password are required');
          setLoading(false);
          return;
        }
        
        // Validate email format
        if (!validateEmail(email)) {
          setErrorAndScroll('Please enter a valid email address (e.g., user@example.com)');
          setLoading(false);
          return;
        }
        
        // Validate phone number format if provided
        let formattedPhone = '';
        if (phoneNumber && phoneNumber.trim().length > 0) {
          if (!validatePhoneNumber(phoneNumber)) {
            setErrorAndScroll('Please enter a valid 10-digit phone number (e.g., 1234567890 or (123) 456-7890)');
            setLoading(false);
            return;
          }
          formattedPhone = formatPhoneNumber(phoneNumber);
        }
        
        await signup(email, password, name, formattedPhone);
      }
      console.log('🔐 Login: Navigating to home page...');
      navigate('/');
    } catch (error) {
      // Customize error message for login failures
      if (isLogin) {
        setErrorAndScroll("Username or password are incorrect. Please try again. If you do not have an account, please create one! ");
      } else {
        const msg = error.message || '';
        if (msg.toLowerCase().includes('phone number')) {
          setErrorAndScroll('An account is already associated with this phone number.');
        } else if (msg.toLowerCase().includes('email')) {
          setErrorAndScroll('An account is already associated with this email.');
        } else {
          setErrorAndScroll(msg || 'Signup failed. Please try again.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setPhoneNumber('');
    scrollToTop();
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotPasswordEmail) {
      setErrorAndScroll('Please enter your email address');
      return;
    }

    // Check if offline - password reset requires internet connection
    if (!navigator.onLine) {
      setErrorAndScroll("You're currently offline. Password reset requires an internet connection. Please check your connection and try again.");
      return;
    }

    console.log('🔑 Submitting forgot password request for email:', forgotPasswordEmail);
    setForgotPasswordLoading(true);
    setError('');

    try {
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';
      const url = `${API_BASE_URL}/auth/forgot-password`;
      console.log('🔑 Forgot password POST to:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });

      console.log('🔑 Forgot password response status:', response.status);
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('🔑 Forgot password success:', responseData);
        setForgotPasswordSuccess(true);
        setForgotPasswordEmail('');
      } else {
        const errorData = await response.json();
        console.error('🔑 Forgot password error:', errorData);
        setErrorAndScroll(errorData.error || 'Failed to send reset email');
      }
    } catch (error) {
      console.error('🔑 Forgot password network error:', error);
      setErrorAndScroll('Failed to send reset email. Please try again.');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const openForgotPasswordModal = () => {
    // Auto-fill the email if it's already entered in the login form
    console.log('🔑 Opening forgot password modal with email:', email);
    setForgotPasswordEmail(email);
    setShowForgotPassword(true);
    scrollToTop();
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotPasswordEmail('');
    setForgotPasswordSuccess(false);
    setError('');
  };

  // Check if offline
  const isOffline = !navigator.onLine;
  
  // Check if there's a cached login available for offline mode
  const hasCachedLogin = () => {
    if (!isOffline) return false;
    const savedUser = localStorage.getItem('triathlonUser');
    const savedToken = localStorage.getItem('triathlonToken');
    return !!(savedUser && savedToken);
  };
  
  // Handle continue offline
  const handleContinueOffline = () => {
    const savedUser = localStorage.getItem('triathlonUser');
    if (savedUser) {
      try {
        // Validate that savedUser is valid JSON; auth context will reinitialize on reload
        JSON.parse(savedUser);
        // Trigger a reload so AuthContext picks up cached login
        window.location.reload();
      } catch (error) {
        console.error('Error parsing cached user:', error);
        setErrorAndScroll('Unable to load cached login. Please connect to the internet to sign in.');
      }
    }
  };
  
  // Handle biometric login
  const handleBiometricLogin = async () => {
    console.log('═══════════════════════════════════════');
    console.log('🔐 HANDLE BIOMETRIC LOGIN CALLED');
    console.log('═══════════════════════════════════════');
    
    if (!Capacitor.isNativePlatform()) {
      console.log('🔐 ❌ Not on native platform');
      return;
    }

    // Prevent multiple simultaneous attempts
    if (biometricLoading) {
      console.log('🔐 ⚠️ Already in progress');
      return;
    }

    console.log('🔐 ✅ Starting biometric login...');
    setBiometricLoading(true);
    setError('');

    try {
      const credentials = await performBiometricLogin();
      
      if (!credentials) {
        console.log('🔐 handleBiometricLogin: No credentials returned');
        setBiometricLoading(false);
        return;
      }

      console.log('🔐 handleBiometricLogin: Got credentials, logging in...');
      console.log('🔐 handleBiometricLogin: Email from credentials:', credentials.email);
      
      // Fill in the email field for visual feedback
      if (credentials.email) {
        setEmail(credentials.email);
      }
      
      // Use the token to login (more secure than email/password)
      if (loginWithToken) {
        await loginWithToken(credentials.token);
        console.log('✅ Biometric login successful');
        navigate('/');
      } else {
        // Fallback: use email/password if token login not available
        // This shouldn't happen, but handle gracefully
        setErrorAndScroll('Biometric login failed. Please use email and password.');
      }
    } catch (error) {
      console.error('❌ Biometric login error:', error);
      setErrorAndScroll('Biometric authentication failed. Please try again or use email and password.');
    } finally {
      setBiometricLoading(false);
    }
  };

  // Auto-trigger Face ID when biometric is enabled and available
  useEffect(() => {
    console.log('═══════════════════════════════════════');
    console.log('🔐 AUTO-TRIGGER useEffect running');
    console.log('🔐 Current State:', {
      isLogin,
      biometricAvailable,
      biometricEnabled,
      loading,
      biometricLoading
    });
    console.log('═══════════════════════════════════════');
    
    // Only auto-trigger if all conditions are met
    const shouldAutoTrigger = isLogin && 
                              biometricAvailable && 
                              biometricEnabled && 
                              !loading && 
                              !biometricLoading;
    
    console.log('🔐 Should auto-trigger?', shouldAutoTrigger);
    
    if (shouldAutoTrigger) {
      console.log('🔐 ✅✅✅ ALL CONDITIONS MET - WILL AUTO-TRIGGER IN 1.5 SECONDS');
      
      // Wait a moment for UI to settle, then auto-trigger Face ID
      const timer = setTimeout(() => {
        console.log('🔐 ⏰ TIMER FIRED - Checking conditions again...');
        
        // Re-check conditions (they might have changed)
        const stillShouldTrigger = isLogin && 
                                   biometricAvailable && 
                                   biometricEnabled && 
                                   !loading && 
                                   !biometricLoading;
        
        if (stillShouldTrigger) {
          console.log('🔐 ✅✅✅✅✅ AUTO-TRIGGERING FACE ID NOW! ✅✅✅✅✅');
          handleBiometricLogin();
        } else {
          console.log('🔐 ❌ Conditions changed, NOT triggering:', {
            isLogin,
            biometricAvailable,
            biometricEnabled,
            loading,
            biometricLoading
          });
        }
      }, 1500); // 1.5 second delay

      return () => {
        console.log('🔐 Cleaning up auto-trigger timer');
        clearTimeout(timer);
      };
    } else {
      console.log('🔐 ❌ Conditions NOT met for auto-trigger. Missing:', {
        isLogin: !isLogin ? '❌' : '✅',
        biometricAvailable: !biometricAvailable ? '❌' : '✅',
        biometricEnabled: !biometricEnabled ? '❌' : '✅',
        loading: loading ? '❌ (still loading)' : '✅',
        biometricLoading: biometricLoading ? '❌ (already authenticating)' : '✅'
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLogin, biometricAvailable, biometricEnabled, loading, biometricLoading]);

  // Check if in Capacitor app for styling
  const isNativeApp = Capacitor.isNativePlatform();

  return (
    <div className={`login-container ${isNativeApp ? 'capacitor' : ''}`}>
      <div className="login-card">
        <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>
        
        {/* Offline Notice */}
        {isOffline && (
          <div className="offline-notice" style={{
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
            color: '#92400e'
          }}>
            <p style={{ margin: 0, fontWeight: 500 }}>
              📴 <strong>You're offline</strong>
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px' }}>
              {hasCachedLogin() 
                ? "You have a cached login. You can continue using the app offline, or connect to the internet to sign in with a different account."
                : "Login requires an internet connection. If you're already logged in, you can use the app offline."}
            </p>
            {hasCachedLogin() && (
              <button
                type="button"
                onClick={handleContinueOffline}
                style={{
                  marginTop: '0.75rem',
                  padding: '0.5rem 1rem',
                  background: '#4169E1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                  width: '100%'
                }}
              >
                Continue Offline with Last Login
              </button>
            )}
          </div>
        )}
        
        {/* Biometric Login Button */}
        {isLogin && biometricAvailable && biometricEnabled && !loading && (
          <div className="biometric-login-container">
            <button
              type="button"
              onClick={() => {
                console.log('🔐 Face ID button clicked manually');
                handleBiometricLogin();
              }}
              disabled={biometricLoading}
              className="biometric-login-btn"
            >
              {biometricLoading ? (
                'Authenticating...'
              ) : (
                <>
                  {biometricType === 'faceID' ? '🔐' : '👆'} 
                  {' '}
                  {biometricType === 'faceID' ? 'Sign in with Face ID' : 
                   biometricType === 'touchID' ? 'Sign in with Touch ID' : 
                   'Sign in with Biometrics'}
                </>
              )}
            </button>
            <div className="biometric-divider">
              <span>or</span>
            </div>
          </div>
        )}
        {error && (
          <div className="error-message">
            <div className="error-text">{error}</div>
            {isLogin && error.includes("please create one!") && (
              <div className="error-links">
                <button type="button" onClick={toggleMode} className="error-link">
                  Sign Up
                </button>
              </div>
            )}
            {!isLogin && error.includes("already associated with this email") && (
              <div className="error-links">
                <button type="button" onClick={toggleMode} className="error-link">
                  Sign In
                </button>
                <span className="error-link-separator">or</span>
                <button type="button" onClick={openForgotPasswordModal} className="error-link">
                  Forgot Password
                </button>
              </div>
            )}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <div className="form-group">
                <label htmlFor="name">Full Name *</label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  placeholder="Enter your full name"
                />
              </div>
            </>
          )}
          
          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="phoneNumber">Phone Number</label>
              <input
                type="tel"
                id="phoneNumber"
                value={phoneNumber}
                onChange={handlePhoneNumberChange}
                placeholder="(123) 456-7890"
              />
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>

          {!isLogin && (
            <>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password *</label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={!isLogin}
                  placeholder="Confirm your password"
                />
                {!isLogin && confirmPassword && (
                  <div className={`password-validation ${password === confirmPassword ? 'valid' : 'invalid'}`}>
                    {password === confirmPassword ? '✅ Passwords match' : '❌ Passwords do not match'}
                  </div>
                )}
              </div>
              <div className="approval-notice">
                <p><strong>Important:</strong> Your account will be approved once we receive confirmation of your membership payment from the Athletic Centre.</p>
                <p>You'll receive an email notification when your account is activated.</p>
              </div>
            </>
          )}
          
          <button 
            type="submit" 
            className="submit-btn" 
            disabled={loading}
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
          
          {/* Enable Biometric Option (only show after successful login attempt) */}
          {isLogin && biometricAvailable && !biometricEnabled && (
            <div className="biometric-option">
              <label className="biometric-checkbox-label">
                <input
                  type="checkbox"
                  checked={enableBiometricAfterLogin}
                  onChange={(e) => setEnableBiometricAfterLogin(e.target.checked)}
                />
                <span>Enable {biometricType === 'faceID' ? 'Face ID' : biometricType === 'touchID' ? 'Touch ID' : 'Biometric'} login for faster access</span>
              </label>
            </div>
          )}
        </form>
        
        <div className="toggle-mode">
          <p>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button type="button" onClick={toggleMode} className="toggle-btn">
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
          {isLogin && (
            <p className="forgot-password-link">
              <button type="button" onClick={openForgotPasswordModal} className="link-btn">
                Forgot your password?
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Reset Password</h2>
            {forgotPasswordSuccess ? (
              <div className="success-message">
                <p>✅ Password reset email sent successfully!</p>
                <p>Please check your email and follow the instructions to reset your password.</p>
                <button type="button" onClick={closeForgotPassword} className="btn btn-primary">
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <div className="form-group">
                  <label htmlFor="forgotPasswordEmail">Email Address</label>
                  <input
                    type="email"
                    id="forgotPasswordEmail"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    required
                    placeholder="Enter your email address"
                  />
                </div>
                <div className="modal-actions">
                  <button type="submit" className="btn btn-primary" disabled={forgotPasswordLoading}>
                    {forgotPasswordLoading ? 'Sending...' : 'Send Reset Email'}
                  </button>
                  <button type="button" onClick={closeForgotPassword} className="btn btn-secondary">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
