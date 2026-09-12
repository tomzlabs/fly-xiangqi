import { defineConfig } from 'vite';

// Project Pages lives at /<repository>/; local development stays at /.
export default defineConfig({
  base: process.env.FLY_BASE_PATH || '/',
});
