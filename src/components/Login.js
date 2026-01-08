import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
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
  const [debugLogs, setDebugLogs] = useState(null);

  // Function to scroll to top of the page
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Function to set error and scroll to top
  const setErrorAndScroll = (errorMessage) => {
    setError(errorMessage);
    scrollToTop();
  };
  
  const { signup, login } = useAuth();
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
    
    // Check for debug logs from order submission
    const orderLog = localStorage.getItem('orderDebugLog');
    const responseLog = localStorage.getItem('orderResponseLog');
    if (orderLog || responseLog) {
      setDebugLogs({
        order: orderLog ? JSON.parse(orderLog) : null,
        response: responseLog ? JSON.parse(responseLog) : null
      });
    }
  }, [location.search]);

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
        const user = await login(email, password);
        console.log('🔐 Login: Login successful, user:', user);
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
              Login requires an internet connection. If you're already logged in, you can use the app offline.
            </p>
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
