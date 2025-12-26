import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 3000,
        open: true,
    },
    build: {
        target: 'es2020',
        minify: 'terser',
        rollupOptions: {
            output: {
                manualChunks: {
                    three: ['three'],
                    gsap: ['gsap'],
                },
            },
        },
    },
    optimizeDeps: {
        include: ['three', 'gsap'],
    },
});
