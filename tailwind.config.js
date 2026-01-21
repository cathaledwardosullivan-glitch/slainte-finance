/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary Brand Colors
        'slainte-blue': '#4A90E2',
        'slainte-blue-dark': '#3D7BC7',

        // Financial Data Colors
        'income': '#4ECDC4',
        'expense': '#FF6B6B',

        // Accent Colors
        'highlight-yellow': '#FFD23C',

        // Neutral Colors
        'dark-gray': '#333333',
        'medium-gray': '#9B9B9B',
        'light-gray': '#E0E0E0',
        'background-gray': '#FAFAFA',
      },
    },
  },
  plugins: [],
}

