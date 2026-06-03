/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1E4D8B',
          dark: '#1F3F6E',
          50: '#EAF2FA',
          100: '#D4E2F2',
          500: '#2B5797',
          600: '#1E4D8B',
          700: '#1F3F6E',
        },
        severity: {
          critical: '#D32F2F',
          high: '#F57C00',
          medium: '#FBC02D',
          low: '#388E3C',
        },
        category: {
          one: '#C62828',
          two: '#F9A825',
          three: '#6B7280',
        },
        surface: {
          DEFAULT: '#F5F7FA',
          card: '#FFFFFF',
          border: '#D9DDE3',
        },
        ink: {
          DEFAULT: '#222B36',
          muted: '#6B7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        serif: ['Times New Roman', 'serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        card: '8px',
      },
    },
  },
  plugins: [],
};
