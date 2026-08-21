import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fffdf2',
          100: '#fff8d6',
          300: '#f3e49a',
          500: '#e6d36a',
          600: '#cbb957',
          900: '#5c542d',
        },
        charcoal: '#111113',
      },
    },
  },
  plugins: [],
};
export default config;
