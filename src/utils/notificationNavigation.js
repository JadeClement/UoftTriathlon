/**
 * Notification Navigation Helper
 * 
 * Handles navigation from push notifications, supporting both:
 * - App already open: Uses React Router navigation
 * - App closed/backgrounded: Stores navigation intent and navigates after app loads
 */

// Store navigation function globally so it can be called from anywhere
let globalNavigate = null;

/**
 * Set the React Router navigate function
 * @param {Function} navigate - React Router's navigate function
 */
export function setNavigationFunction(navigate) {
  globalNavigate = navigate;
  console.log('📍 Navigation function set');
}

/**
 * Navigate to a route, using React Router if available, otherwise storing for later
 * @param {string} path - Route path to navigate to
 */
export function navigateTo(path) {
  console.log(`📍 navigateTo called with path: ${path}`);
  
  if (globalNavigate) {
    // App is already loaded, use React Router navigation
    try {
      console.log(`📍 Using React Router navigation to: ${path}`);
      globalNavigate(path);
    } catch (error) {
      console.error('❌ Error navigating with React Router:', error);
      // Fallback to window.location
      window.location.href = path;
    }
  } else {
    // App is not loaded yet, store navigation intent
    console.log(`📍 App not loaded yet, storing navigation intent: ${path}`);
    localStorage.setItem('pendingNotificationNavigation', path);
    
    // Also try window.location as fallback
    if (window.location) {
      console.log(`📍 Using window.location fallback: ${path}`);
      window.location.href = path;
    }
  }
}

/**
 * Get and clear pending navigation (called when app loads)
 * @returns {string|null} Pending navigation path or null
 */
export function getPendingNavigation() {
  const pending = localStorage.getItem('pendingNotificationNavigation');
  if (pending) {
    console.log(`📍 Found pending navigation: ${pending}`);
    localStorage.removeItem('pendingNotificationNavigation');
    return pending;
  }
  return null;
}

/**
 * Handle notification action and navigate appropriately
 * @param {Object} notification - Notification action object
 */
export function handleNotificationNavigation(notification) {
  console.log('👆 handleNotificationNavigation called');
  console.log('👆 Full notification object:', JSON.stringify(notification, null, 2));
  console.log('👆 Notification keys:', notification ? Object.keys(notification) : 'null');
  
  try {
    // Extract data from notification
    // The structure varies: 
    // - notification.notification.data (when app is open)
    // - notification.data (when app is opened from notification)
    // - notification.notification?.data (nested structure)
    let data = {};
    
    if (notification?.notification?.data) {
      data = notification.notification.data;
      console.log('📍 Found data in notification.notification.data');
    } else if (notification?.data) {
      data = notification.data;
      console.log('📍 Found data in notification.data');
    } else if (notification?.notification) {
      // Sometimes the entire notification object is the data
      data = notification.notification;
      console.log('📍 Using notification.notification as data');
    } else {
      // Try to extract from payload
      data = notification?.payload || notification || {};
      console.log('📍 Using notification.payload or notification as data');
    }
    
    console.log('📍 Extracted notification data:', JSON.stringify(data, null, 2));
    console.log('📍 Data type:', data?.type);
    console.log('📍 Data workoutId:', data?.workoutId);
    console.log('📍 Data eventId:', data?.eventId);
    console.log('📍 Data postId:', data?.postId);
    console.log('📍 Data raceId:', data?.raceId);
    
    if (data?.type === 'workout' && data?.workoutId) {
      const workoutId = data.workoutId;
      console.log(`📍 Navigating to workout: /workout/${workoutId}`);
      navigateTo(`/workout/${workoutId}`);
    } else if (data?.type === 'event' && data?.eventId) {
      console.log(`📍 Navigating to event: /event/${data.eventId}`);
      navigateTo(`/event/${data.eventId}`);
    } else if (data?.type === 'forum' && data?.postId) {
      console.log(`📍 Navigating to forum post: /forum`);
      navigateTo(`/forum`);
    } else if (data?.type === 'race' && data?.raceId) {
      console.log(`📍 Navigating to race: /race/${data.raceId}`);
      navigateTo(`/race/${data.raceId}`);
    } else {
      console.warn('📍 No navigation action for notification. Data:', data);
      console.warn('📍 Available keys in data:', Object.keys(data));
    }
  } catch (error) {
    console.error('❌ Error handling notification navigation:', error);
    console.error('❌ Error stack:', error.stack);
  }
}

