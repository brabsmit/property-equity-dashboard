/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        slate: { 950: '#0f1419' },
        cream: { 50: '#f5f0e8', 100: '#ede5d5' },
        amber: { 400: '#d4a853' },
        rose: { 500: '#c45d5d' },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        body: ['"Source Sans 3"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
