import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.premium.ludo',
    appName: 'Premium Ludo',
    webDir: 'dist',
    server: {
        androidScheme: 'https',
    },
    android: {
        backgroundColor: '#0a0a12',
        allowMixedContent: true,
    },
    ios: {
        backgroundColor: '#0a0a12',
    },
    plugins: {
        SplashScreen: {
            launchAutoHide: true,
            launchShowDuration: 2000,
            backgroundColor: '#0a0a12',
            showSpinner: false,
        },
        StatusBar: {
            style: 'Dark',
            backgroundColor: '#0a0a12',
        },
    },
};

export default config;
