import React, { createContext, useContext, useState, useEffect } from 'react';
import { installFetchInterceptor } from '../utils/installFetchInterceptor';

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
        localStorage.removeItem('triathlonUser');
        localStorage.removeItem('triathlonToken');
        const params = new URLSearchParams();
        params.set('reason', (message || 'session_expired'));
        window.location.href = `/login?${params.toString()}`;
      }
    );

    // Check if user is logged in from localStorage (for now)
    const savedUser = localStorage.getItem('triathlonUser');
    console.log('📦 Saved user from localStorage:', savedUser);
    
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        console.log('✅ Parsed user successfully:', parsedUser);
        setCurrentUser(parsedUser);
      } catch (error) {
        console.error('❌ Error parsing saved user:', error);
        localStorage.removeItem('triathlonUser');
      }
    } else {
      console.log('❌ No saved user found in localStorage');
    }
    
    setLoading(false);
    console.log('🏁 AuthContext loading complete');

    return () => {
      if (typeof remove === 'function') remove();
    };
  }, []);

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
      console.log('💾 User and token stored in localStorage');
      
      setCurrentUser(normalizedUser);
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
      
      const { user, token } = responseData;
      
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
        sport: user.sport // Preserve sport field
      };
      
      // Remove duplicate fields to keep only normalized versions
      delete normalizedUser.phone_number;
      delete normalizedUser.profile_picture_url;
      delete normalizedUser.charter_accepted;
      
      // Store user and token separately
      localStorage.setItem('triathlonUser', JSON.stringify(normalizedUser));
      localStorage.setItem('triathlonToken', token);
      console.log('💾 User and token stored in localStorage');
      
      setCurrentUser(normalizedUser);
      console.log('👤 Current user state set to:', normalizedUser);
      
      return normalizedUser;
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('triathlonUser');
    localStorage.removeItem('triathlonToken');
    setCurrentUser(null);
    
    // Force a page reload to clear any protected routes
    window.location.href = '/login';
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
      'leader': 3,
      'exec': 4,
      'administrator': 5
    };
    
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  };

  const isAdmin = (user) => {
    return hasPermission(user, 'administrator');
  };

  const isExec = (user) => {
    return hasPermission(user, 'exec');
  };

  const isLeader = (user) => {
    return hasPermission(user, 'leader');
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
      return response.ok;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  };

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
          bio: user.bio
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

  const value = {
    currentUser,
    signup,
    login,
    logout,
    loading,
    isAdmin,
    isExec,
    isLeader,
    isMember,
    hasPermission,
    getUserRole,
    promoteToAdmin,
    updateUser,
    isTokenValid,
    refreshUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
