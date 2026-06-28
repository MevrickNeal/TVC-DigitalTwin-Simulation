/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: 'rgba(255, 255, 255, 0.05)',
        surfaceBorder: 'rgba(255, 255, 255, 0.1)',
        primary: '#3b82f6',
        primaryGlow: 'rgba(59, 130, 246, 0.5)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
