import type { Config } from 'tailwindcss';
import { theme } from './src/styles/theme';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Màu thương hiệu lấy từ src/styles/theme.ts: bg-primary, text-ink, border-line...
      colors: theme.colors,
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: { btn: '8px', card: '12px' },
      boxShadow: { card: '0 1px 3px rgba(43,30,22,0.06), 0 4px 14px rgba(43,30,22,0.04)' },
    },
  },
  plugins: [],
};

export default config;
