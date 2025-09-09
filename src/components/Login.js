import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        console.log('🔐 Login: Starting login process for:', email);
        if (!email || !password) {
          setErrorAndScroll('Email and password are required');
          return;
        }
        const user = await login(email, password);
        console.log('🔐 Login: Login successful, user:', user);
      } else {
        // Validate passwords match for signup
        if (password !== confirmPassword) {
          setErrorAndScroll("Passwords do not match. Please ensure both password fields are identical.");
          setLoading(false);
          return;
        }
        if (!name || !email || !password || !phoneNumber) {
          setErrorAndScroll('All fields are required');
          return;
        }
        await signup(email, password, name, phoneNumber);
      }
      console.log('🔐 Login: Navigating to home page...');
      navigate('/');
    } catch (error) {
      // Customize error message for login failures
      if (isLogin) {
        setErrorAndScroll("Username or password are incorrect. Please try again. If you do not have an account, please create one! ");
      } else {
        // Check if it's a duplicate email error
        if (error.message.includes('already exists')) {
          setErrorAndScroll("An account is already associated with this email. ");
        } else {
          setErrorAndScroll(error.message);
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

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>
        
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
              
              <div className="form-group">
                <label htmlFor="phoneNumber">Phone Number *</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />
                <small className="form-help">For SMS notifications when promoted from waitlists</small>
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
