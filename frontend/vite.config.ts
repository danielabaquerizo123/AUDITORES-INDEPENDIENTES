import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Inline PostCSS config prevents Vite from traversing parent user directories.
export default defineConfig({ css: { postcss: { plugins: [] } }, plugins: [react(), tailwindcss()], test: { environment: 'jsdom', setupFiles: './src/test/setup.ts' } });
