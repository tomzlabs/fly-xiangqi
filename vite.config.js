import { defineConfig } from 'vite';

export default defineConfig({ base: process.env.FLY_BASE_PATH || '/' });
