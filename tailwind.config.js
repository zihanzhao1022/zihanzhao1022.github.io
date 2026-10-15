/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './lemma.html',
    './app/**/*.{ts,tsx}',
    './App.tsx',
    './index.tsx',
    './components/**/*.{ts,tsx}',
    './views/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './editor/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
