/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // Paleta B&Q — herdada do Dash_Metro
        beq: {
          navy: '#0a2540',       // azul-marinho header
          navyDark: '#061a30',   // azul mais escuro (sidebar)
          navyLight: '#143862',  // hover/cards
          blue: '#1e6091',       // azul B&Q principal
          accent: '#f59e0b',     // amarelo/laranja destaque
          accentLight: '#fbbf24',
        },
        slate: {
          950: '#020617',
        },
        // Semáforo
        good: '#10b981',
        warn: '#f59e0b',
        bad: '#ef4444',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.05), 0 1px 3px 0 rgb(0 0 0 / 0.10)',
        cardHover: '0 4px 6px -1px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.10)',
      },
    },
  },
  plugins: [],
};
