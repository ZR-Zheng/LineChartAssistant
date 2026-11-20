import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3025,
        host: '0.0.0.0',
      },
      plugins: [react()],
      build: {
        rollupOptions: {
          output: { manualChunks: {
            'pictograph-activities': ['./assets/noto-pictographs-activities.json'],
            'pictograph-objects': ['./assets/noto-pictographs-everyday.json'],
            'pictograph-food': ['./assets/noto-pictographs-food.json'],
            'pictograph-animals': ['./assets/noto-pictographs-animals.json'],
            'pictograph-nature': ['./assets/noto-pictographs-nature.json'],
            'pictograph-transport': ['./assets/noto-pictographs-transport.json'],
            'pictograph-places': ['./assets/noto-pictographs-places.json'],
            'pictograph-symbols': ['./assets/noto-pictographs-symbols.json'],
          } },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
