import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.premium.ludo',
    appName: 'Premium Ludo',
    webDir: 'dist',
    server: {
        androidScheme: 'https',
    },
    android: {
        backgroundColor: '#F5ECD7',
        allowMixedContent: true,
    },
    ios: {
        backgroundColor: '#F5ECD7',
    },
    plugins: {
        SplashScreen: {
            launchAutoHide: true,
            launchShowDuration: 2000,
            backgroundColor: '#F5ECD7',
            showSpinner: false,
        },
        StatusBar: {
            style: 'Dark',
            backgroundColor: '#F5ECD7',
        },
    },
};

export default config;
