import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: { colors: { gold: { 50: '#fff8db', 100: '#ffefad', 300: '#ffd85a', 500: '#d4af37', 600: '#b88a16', 900: '#4f3607' }, charcoal: '#111113' } } },
  plugins: [],
};
export default config;
