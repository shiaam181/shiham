import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.d7ae568f9b984be2b3b6aa6c47628cad',
  appName: 'shiham',
  webDir: 'dist',
  server: {
    url: 'https://d7ae568f-9b98-4be2-b3b6-aa6c47628cad.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a65e8',
      showSpinner: true,
      spinnerColor: '#ffffff'
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1a65e8'
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
