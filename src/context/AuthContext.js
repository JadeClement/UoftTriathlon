import React, { createContext, useContext, useState, useEffect } from 'react';
import { installFetchInterceptor } from '../utils/installFetchInterceptor';
import { registerForPushNotifications, unregisterFromPushNotifications } from '../services/pushNotificationService';
import { clearBiometricCredentials } from '../services/biometricAuth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

  useEffect(() => {
    console.log('🔄 AuthContext useEffect running...');

    // Install global fetch interceptor to handle expired/invalid tokens gracefully
    const remove = installFetchInterceptor(
      () => localStorage.getItem('triathlonToken'),
      ({ status, message }) => {
        console.warn('🔒 Auth interceptor caught unauthorized response:', status, message);
        handleTokenExpired(message);
      }
    );

    // Check if user is logged in and validate token
    const initializeAuth = async () => {
      const savedUser = localStorage.getItem('triathlonUser');
      const savedToken = localStorage.getItem('triathlonToken');
      
      console.log('📦 Saved user from localStorage:', savedUser);
      console.log('🔑 Saved token from localStorage:', savedToken ? 'present' : 'missing');
      console.log('🌐 Online status:', navigator.onLine);
      
      if (savedUser && savedToken) {
        try {
          const parsedUser = JSON.parse(savedUser);
          console.log('✅ Parsed user successfully:', parsedUser);
          
          // If offline, allow cached login without validation (for offline mode support)
          if (!navigator.onLine) {
            console.log('📴 Offline mode: Using cached login without token validation');
            setCurrentUser(parsedUser);
            setLoading(false);
            console.log('🏁 AuthContext loading complete (offline mode)');
            return;
          }
          
          // Online: Validate token before setting user
          const isValid = await isTokenValid();
          if (isValid) {
            console.log('✅ Token is valid, setting current user');
            setCurrentUser(parsedUser);
            
            // Update last login timestamp
            localStorage.setItem('triathlonLastLogin', Date.now().toString());
            
            // Register for push notifications (if on native platform)
            registerForPushNotifications(parsedUser.id).catch(error => {
              console.error('❌ Error registering for push notifications:', error);
            });
          } else {
            console.warn('⚠️ Token is invalid, clearing auth data');
            handleTokenExpired('Token expired or invalid');
          }
        } catch (error) {
          console.error('❌ Error parsing saved user:', error);
          // If offline, still allow cached login even if parsing had issues
          if (!navigator.onLine) {
            console.log('📴 Offline mode: Attempting to use cached login despite parsing error');
            try {
              const parsedUser = JSON.parse(savedUser);
              setCurrentUser(parsedUser);
            } catch (parseError) {
              console.error('❌ Could not parse user even in offline mode');
              handleTokenExpired('Invalid user data');
            }
          } else {
            handleTokenExpired('Invalid user data');
          }
        }
      } else {
        console.log('❌ No saved user or token found in localStorage');
        setCurrentUser(null);
      }
      
      setLoading(false);
      console.log('🏁 AuthContext loading complete');
    };

    initializeAuth();

    return () => {
      if (typeof remove === 'function') remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

    // Handle token expiration/invalidation
    const handleTokenExpired = (reason = 'session_expired') => {
      console.log('🔒 Handling token expiration:', reason);
      
      // Unregister from push notifications on logout
      unregisterFromPushNotifications().catch(error => {
        console.error('❌ Error unregistering from push notifications:', error);
      });

      // Only clear biometric credentials for real auth failures,
      // NOT for a normal, user-initiated logout.
      if (reason !== 'user_logout') {
        clearBiometricCredentials().catch(error => {
          console.error('❌ Error clearing biometric credentials:', error);
        });
      } else {
        console.log('🔐 Skipping clearBiometricCredentials on user_logout to preserve Face ID login');
      }
    
    localStorage.removeItem('triathlonUser');
    localStorage.removeItem('triathlonToken');
    setCurrentUser(null);
    
    // Only redirect if not already on login page
    if (!window.location.pathname.includes('/login')) {
      const params = new URLSearchParams();
      params.set('reason', reason);
      window.location.href = `/login?${params.toString()}`;
    }
  };

  const signup = async (email, password, name, phoneNumber) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name, phoneNumber }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Signup failed');
      }

      const responseData = await response.json();
      console.log('✅ Signup response received:', responseData);
      
      const { user, token } = responseData;
      
      if (!token) {
        console.error('❌ No token in signup response');
        throw new Error('Signup failed - no token received');
      }
      
      // Normalize user data to ensure consistent field names
      const normalizedUser = {
        ...user,
        charterAccepted: user.charter_accepted || user.charterAccepted,
        phoneNumber: user.phone_number || user.phoneNumber,
        sport: user.sport // Preserve sport field
      };
      
      // Remove duplicate fields to keep only normalized versions
      delete normalizedUser.phone_number;
      delete normalizedUser.charter_accepted;
      
      // Store user and token separately
      localStorage.setItem('triathlonUser', JSON.stringify(normalizedUser));
      localStorage.setItem('triathlonToken', token);
      localStorage.setItem('triathlonLastLogin', Date.now().toString());
      console.log('💾 User and token stored in localStorage');
      
      setCurrentUser(normalizedUser);
      
      // Register for push notifications (if on native platform)
      registerForPushNotifications(normalizedUser.id).catch(error => {
        console.error('❌ Error registering for push notifications:', error);
      });
      
      return normalizedUser;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      console.log('🔐 Attempting login for:', email);
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }

      const responseData = await response.json();
      console.log('✅ Login response received:', responseData);
      
      const { user: userData, token } = responseData;
      
      // Normalize user data to ensure consistent field names
      const user = {
        ...userData,
        charterAccepted: userData.charter_accepted || userData.charterAccepted,
        profilePictureUrl: userData.profile_picture_url || userData.profilePictureUrl,
        phoneNumber: userData.phone_number || userData.phoneNumber,
        resultsPublic: userData.results_public !== undefined ? userData.results_public : (userData.resultsPublic !== undefined ? userData.resultsPublic : false),
        results_public: userData.results_public !== undefined ? userData.results_public : (userData.resultsPublic !== undefined ? userData.resultsPublic : false)
      };
      
      if (!token) {
        console.error('❌ No token in login response');
        throw new Error('Login failed - no token received');
      }
      
      // Normalize user data to ensure consistent field names
      const normalizedUser = {
        ...user,
        charterAccepted: user.charter_accepted || user.charterAccepted,
        profilePictureUrl: user.profile_picture_url || user.profilePictureUrl,
        phoneNumber: user.phone_number || user.phoneNumber,
        bio: user.bio,
        sport: user.sport, // Preserve sport field
        resultsPublic: user.results_public !== undefined ? user.results_public : (user.resultsPublic !== undefined ? user.resultsPublic : false),
        results_public: user.results_public !== undefined ? user.results_public : (user.resultsPublic !== undefined ? user.resultsPublic : false)
      };
      
      // Remove duplicate fields to keep only normalized versions
      delete normalizedUser.phone_number;
      delete normalizedUser.profile_picture_url;
      delete normalizedUser.charter_accepted;
      
      // Store user and token separately
      localStorage.setItem('triathlonUser', JSON.stringify(normalizedUser));
      localStorage.setItem('triathlonToken', token);
      localStorage.setItem('triathlonLastLogin', Date.now().toString());
      console.log('💾 User and token stored in localStorage');
      
      setCurrentUser(normalizedUser);
      console.log('👤 Current user state set to:', normalizedUser);
      
      // Register for push notifications (if on native platform)
      registerForPushNotifications(normalizedUser.id).catch(error => {
        console.error('❌ Error registering for push notifications:', error);
      });
      
      return normalizedUser;
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  };

  // Login with existing token (for biometric authentication)
  const loginWithToken = async (token) => {
    try {
      console.log('🔐 Attempting login with token');
      
      // Validate token by fetching user profile
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Token is invalid or expired');
      }

      const responseData = await response.json();
      const userData = responseData.user;
      
      // Normalize user data to ensure consistent field names
      const normalizedUser = {
        ...userData,
        charterAccepted: userData.charter_accepted || userData.charterAccepted,
        profilePictureUrl: userData.profile_picture_url || userData.profilePictureUrl,
        phoneNumber: userData.phone_number || userData.phoneNumber,
        bio: userData.bio,
        sport: userData.sport,
        resultsPublic: userData.results_public !== undefined ? userData.results_public : (userData.resultsPublic !== undefined ? userData.resultsPublic : false),
        results_public: userData.results_public !== undefined ? userData.results_public : (userData.resultsPublic !== undefined ? userData.resultsPublic : false)
      };
      
      // Remove duplicate fields to keep only normalized versions
      delete normalizedUser.phone_number;
      delete normalizedUser.profile_picture_url;
      delete normalizedUser.charter_accepted;
      
      // Store user and token separately
      localStorage.setItem('triathlonUser', JSON.stringify(normalizedUser));
      localStorage.setItem('triathlonToken', token);
      localStorage.setItem('triathlonLastLogin', Date.now().toString());
      console.log('💾 User and token stored in localStorage');
      
      setCurrentUser(normalizedUser);
      console.log('👤 Current user state set to:', normalizedUser);
      
      // Register for push notifications (if on native platform)
      registerForPushNotifications(normalizedUser.id).catch(error => {
        console.error('❌ Error registering for push notifications:', error);
      });
      
      return normalizedUser;
    } catch (error) {
      console.error('❌ Token login error:', error);
      throw error;
    }
  };

  const logout = () => {
    console.log('🚪 Logging out user');
    handleTokenExpired('user_logout');
  };

  const getUserRole = (user) => {
    if (!user) return 'public';
    return user.role || 'public';
  };

  const hasPermission = (user, requiredRole) => {
    const userRole = getUserRole(user);
  const roleHierarchy = {
    'public': 0,
    'pending': 1,
    'member': 2,
    'coach': 3,
    'exec': 4,
    'administrator': 5
  };
    
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  };

  const isAdmin = (user) => {
    return hasPermission(user, 'administrator') || hasPermission(user, 'exec');
  };

  const isExec = (user) => {
    return hasPermission(user, 'exec');
  };

  const isCoach = (user) => {
    return hasPermission(user, 'coach');
  };


  const isMember = (user) => {
    return hasPermission(user, 'member');
  };

  // Temporary function to promote current user to admin (for development)
  const promoteToAdmin = () => {
    if (currentUser) {
      const updatedUser = { ...currentUser, role: 'administrator' };
      setCurrentUser(updatedUser);
      localStorage.setItem('triathlonUser', JSON.stringify(updatedUser));
      return updatedUser;
    }
    return null;
  };

  // Function to update user profile
  const updateUser = (updatedUserData) => {
    console.log('🔄 AuthContext updateUser called with:', updatedUserData);
    console.log('🔄 Current user before update:', currentUser);
    
    const updatedUser = { ...currentUser, ...updatedUserData };
    
    // Ensure charterAccepted field is normalized
    if (updatedUserData.charter_accepted !== undefined) {
      updatedUser.charterAccepted = updatedUserData.charter_accepted;
    }
    
    console.log('🔄 Updated user object:', updatedUser);
    
    setCurrentUser(updatedUser);
    localStorage.setItem('triathlonUser', JSON.stringify(updatedUser));
    
    console.log('✅ AuthContext updateUser completed');
    return updatedUser;
  };

  // Check if current token is valid
  const isTokenValid = async () => {
    const token = localStorage.getItem('triathlonToken');
    if (!token) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.warn('🔒 Token validation failed:', response.status, response.statusText);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Token validation error:', error);
      return false;
    }
  };

  // Periodic token validation (every 5 minutes) - skip when offline
  useEffect(() => {
    if (!currentUser) return;

    const validateTokenPeriodically = async () => {
      // Skip validation when offline (allow offline mode)
      if (!navigator.onLine) {
        console.log('📴 Offline mode: Skipping periodic token validation');
        return;
      }
      
      const isValid = await isTokenValid();
      if (!isValid) {
        console.warn('⚠️ Periodic token validation failed, logging out user');
        handleTokenExpired('Token expired during session');
      }
    };

    // Validate token every 5 minutes
    const interval = setInterval(validateTokenPeriodically, 5 * 60 * 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Refresh user data and token
  const refreshUserData = async () => {
    const token = localStorage.getItem('triathlonToken');
    if (!token) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const { user } = await response.json();
        
        // Normalize user data to ensure consistent field names
        const normalizedUser = {
          ...user,
          charterAccepted: user.charter_accepted || user.charterAccepted,
          profilePictureUrl: user.profile_picture_url || user.profilePictureUrl,
          phoneNumber: user.phone_number || user.phoneNumber,
          bio: user.bio,
          resultsPublic: user.results_public || user.resultsPublic || false,
          results_public: user.results_public !== undefined ? user.results_public : (user.resultsPublic !== undefined ? user.resultsPublic : false)
        };
        
        setCurrentUser(normalizedUser);
        localStorage.setItem('triathlonUser', JSON.stringify(normalizedUser));
        return true;
      } else {
        // Token is invalid, clear it and redirect to login
        logout();
        return false;
      }
    } catch (error) {
      console.error('Refresh user data error:', error);
      logout();
      return false;
    }
  };

  // Validate token before critical operations (less aggressive)
  const validateTokenBeforeAction = async (actionName = 'action') => {
    const token = localStorage.getItem('triathlonToken');
    if (!token) {
      console.warn(`⚠️ No token found before ${actionName}, redirecting to login`);
      handleTokenExpired(`No token found before ${actionName}`);
      return false;
    }

    // Only validate token if we have a current user (avoid unnecessary API calls)
    if (!currentUser) {
      console.warn(`⚠️ No current user before ${actionName}, redirecting to login`);
      handleTokenExpired(`No current user before ${actionName}`);
      return false;
    }

    // For now, just check if token exists and user is logged in
    // The actual API call will handle token validation
    console.log(`✅ Token validation passed for ${actionName}`);
    return true;
  };

  const value = {
    currentUser,
    signup,
    login,
    loginWithToken,
    logout,
    loading,
    isAdmin,
    isExec,
    isCoach,
    isMember,
    hasPermission,
    getUserRole,
    promoteToAdmin,
    updateUser,
    isTokenValid,
    validateTokenBeforeAction,
    refreshUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
