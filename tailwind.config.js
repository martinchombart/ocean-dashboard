/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        mono:    ['Space Mono', 'monospace'],
      },
      colors: {
        ocean: {
          950: '#020810', 900: '#040e1a', 800: '#071626',
          700: '#0a2035', 600: '#0d2a42', 500: '#0f3350',
          accent: '#00b4ff', warm: '#ff6b35',
          teal: '#00c9a7', violet: '#a78bfa', amber: '#fbbf24',
        }
      },
      boxShadow: {
        'glow-blue':   '0 0 20px -4px rgba(0,180,255,0.45)',
        'glow-orange': '0 0 20px -4px rgba(255,107,53,0.45)',
      }
    },
  },
  plugins: [],
}
