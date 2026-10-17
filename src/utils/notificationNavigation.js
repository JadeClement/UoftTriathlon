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
  console.log('👆 ===== handleNotificationNavigation called =====');
  console.log('👆 Full notification object:', JSON.stringify(notification, null, 2));
  console.log('👆 Notification keys:', notification ? Object.keys(notification) : 'null');
  
  try {
    // Extract data from notification
    // Based on the actual structure: notification.notification.data
    let data = {};
    
    if (notification?.notification?.data) {
      data = notification.notification.data;
      console.log('✅ Found data in notification.notification.data');
    } else if (notification?.data) {
      data = notification.data;
      console.log('✅ Found data in notification.data');
    } else if (notification?.notification) {
      // Sometimes the entire notification object is the data
      data = notification.notification;
      console.log('✅ Using notification.notification as data');
    } else {
      // Try to extract from payload
      data = notification?.payload || notification || {};
      console.log('✅ Using notification.payload or notification as data');
    }
    
    console.log('📍 Extracted notification data:', JSON.stringify(data, null, 2));
    console.log('📍 Data type:', data?.type);
    console.log('📍 Data workoutId:', data?.workoutId, '(type:', typeof data?.workoutId, ')');
    console.log('📍 Data eventId:', data?.eventId);
    console.log('📍 Data postId:', data?.postId);
    console.log('📍 Data raceId:', data?.raceId);
    
    // Handle workout navigation
    if (data?.type === 'workout' && data?.workoutId) {
      // workoutId might be a number, convert to string
      const workoutId = String(data.workoutId);
      console.log(`📍 Navigating to workout: /workout/${workoutId}`);
      navigateTo(`/workout/${workoutId}`);
      return; // Exit early after navigation
    }
    
    // Handle event navigation
    if (data?.type === 'event' && data?.eventId) {
      const eventId = String(data.eventId);
      console.log(`📍 Navigating to event: /event/${eventId}`);
      navigateTo(`/event/${eventId}`);
      return;
    }
    
    // Handle forum navigation
    // Forum replies on workout posts should navigate to the workout detail page
    if (data?.type === 'forum' && data?.postId) {
      // Check if this is a workout post by trying to navigate to workout detail
      // The postId for workout forum replies is the workout post ID
      const postId = String(data.postId);
      console.log(`📍 Navigating to forum post (workout): /workout/${postId}`);
      navigateTo(`/workout/${postId}`);
      return;
    }
    
    // Handle race navigation
    if (data?.type === 'race' && data?.raceId) {
      const raceId = String(data.raceId);
      console.log(`📍 Navigating to race: /race/${raceId}`);
      navigateTo(`/race/${raceId}`);
      return;
    }

    if (data?.type === 'bulletin' && data?.bulletinId) {
      const bulletinId = String(data.bulletinId);
      console.log(`📍 Navigating to bulletin: /news/${bulletinId}`);
      navigateTo(`/news/${bulletinId}`);
      return;
    }
    
    // If we get here, no valid navigation was found
    console.warn('⚠️ No navigation action for notification');
    console.warn('⚠️ Data:', data);
    console.warn('⚠️ Available keys in data:', Object.keys(data || {}));
    console.warn('⚠️ Full notification structure:', JSON.stringify(notification, null, 2));
  } catch (error) {
    console.error('❌ Error handling notification navigation:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    throw error; // Re-throw so fallback handler can catch it
  }
}

