import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bone: '#F6F3EE',
        ink: '#101011',
        plum: '#4F2958',
        brandblue: '#24358C',
        acid: '#D5D846',
        magenta: '#D6396F',
        pale: '#DCE9F2',
        sage: '#B0D6A7',
        gold: {
          50: '#FBFBEF',
          100: '#F4F5C9',
          300: '#E4E685',
          500: '#D5D846',
          600: '#BDC03A',
          900: '#55571D',
        },
        charcoal: '#101011',
      },
      borderRadius: {
        control: '12px',
        pill: '999px',
      },
    },
  },
  plugins: [],
};
export default config;
