import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zentrek.app',
  appName: 'Zentrek',
  webDir: 'dist',
  server: {
    url: 'https://d7ae568f-9b98-4be2-b3b6-aa6c47628cad.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#004D4D',
      showSpinner: true,
      spinnerColor: '#00C8C8',
      splashImmersive: true,
      splashFullScreen: true
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#004D4D'
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    Camera: {
      presentationStyle: 'fullscreen'
    }
  }
};

export default config;
