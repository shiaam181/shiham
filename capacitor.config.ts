import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.01f992f63ab4460592b282fdccfead96',
  appName: 'AttendanceHub',
  webDir: 'dist',
  server: {
    url: 'https://01f992f6-3ab4-4605-92b2-82fdccfead96.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#6366f1',
      showSpinner: true,
      spinnerColor: '#ffffff'
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#6366f1'
    }
  }
};

export default config;
