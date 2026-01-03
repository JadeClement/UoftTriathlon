import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uofttri.club.app',
  appName: 'University of Toronto Triathlon Team',
  webDir: 'build',
  server: {
    // Uncomment and set your production API URL when ready
    // url: 'https://www.uoft-tri.club',
    // cleartext: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#1E3A8A",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      iosSpinnerStyle: "small",
      spinnerColor: "#ffffff"
    }
  }
};

export default config;
