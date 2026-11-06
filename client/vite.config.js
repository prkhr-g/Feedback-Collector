import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const TEST_SITE_KEY = '1x00000000000000000000AA';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'production' && (!env.VITE_TURNSTILE_SITE_KEY?.trim() || env.VITE_TURNSTILE_SITE_KEY.trim() === TEST_SITE_KEY)) {
    throw new Error('Production build requires a live Cloudflare VITE_TURNSTILE_SITE_KEY');
  }
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': 'http://localhost:3000',
      },
    },
  };
});
