import type { Config } from 'tailwindcss';
import { theme } from './src/styles/theme';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Màu thương hiệu lấy từ src/styles/theme.ts: bg-primary, text-primary, bg-secondary...
      colors: theme.colors,
    },
  },
  plugins: [],
};

export default config;
