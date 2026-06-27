import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  build: {
    assets: '_assets',
  },
  vite: {
    define: {
      'import.meta.env.PUBLIC_CHATBOT_API_URL': JSON.stringify(
        process.env.PUBLIC_CHATBOT_API_URL || 'http://localhost:8000'
      ),
      'import.meta.env.PUBLIC_STOREFRONT_API_URL': JSON.stringify(
        process.env.PUBLIC_STOREFRONT_API_URL ||
          'http://localhost:3000/api/storefront'
      ),
    },
  },
});
