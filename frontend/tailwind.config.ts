import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // THISO brand — charcoal / gray
        thiso: {
          50:  '#F6F6F6',
          100: '#EBEBEB',
          200: '#D5D5D5',
          300: '#ABABAB',
          400: '#818181',
          500: '#5E5E5E',
          600: '#454545',
          700: '#2C2C2C',
          800: '#1C1C1C',
          900: '#0F0F0F',
        },
        // Emart — orange-amber
        emart: {
          50:  '#FFF6E6',
          100: '#FFE9BF',
          200: '#FFD591',
          300: '#FFC063',
          400: '#FFAB36',
          500: '#FF9500',
          600: '#E08000',
          700: '#C06900',
          800: '#9F5400',
          900: '#7E4000',
        },
        // Thiskyhall — forest green
        sky: {
          50:  '#E8F5EE',
          100: '#C3E6D2',
          200: '#9BD6B5',
          300: '#73C698',
          400: '#4AB57B',
          500: '#27A55E',
          600: '#1B8D4D',
          700: '#14753D',
          800: '#0E5D2E',
          900: '#07451F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 4px 0 rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-md': '0 4px 12px 0 rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-lg': '0 8px 24px 0 rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
      },
      keyframes: {
        scanline: {
          '0%':   { top: '0%' },
          '50%':  { top: '100%' },
          '100%': { top: '0%' },
        },
      },
      animation: {
        scanline: 'scanline 2s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
