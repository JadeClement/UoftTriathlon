import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { navigateDetailBack } from '../utils/swipeNavigation';

/**
 * Android system back button: keep users in-app on detail pages
 * (workout/event/race/bio/settings/results) instead of exiting the app.
 */
export function useNativeBackButton(navigate, location) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return undefined;
    }

    let listener;
    let cancelled = false;

    const register = async () => {
      listener = await App.addListener('backButton', ({ canGoBack }) => {
        if (navigateDetailBack(navigate, location.pathname)) {
          return;
        }

        const historyIdx = window.history.state?.idx;
        if (typeof historyIdx === 'number' && historyIdx > 0) {
          navigate(-1);
          return;
        }

        if (canGoBack) {
          window.history.back();
          return;
        }

        // Prefer home over exiting unless already on home
        if (location.pathname !== '/') {
          navigate('/');
          return;
        }

        App.exitApp();
      });

      if (cancelled && listener) {
        listener.remove();
      }
    };

    register();

    return () => {
      cancelled = true;
      if (listener) {
        listener.remove();
      }
    };
  }, [navigate, location.pathname]);
}
