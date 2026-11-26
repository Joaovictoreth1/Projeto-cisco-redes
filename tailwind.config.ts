import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.ts'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        cyber: {
          bg: '#030306',
          surface: '#090910',
          panel: 'rgba(10, 10, 18, 0.88)',
          primary: '#0ea5e9',
          accent: '#8b5cf6',
          success: '#10b981',
          danger: '#f43f5e',
          warning: '#f59e0b',
        },
      },
      animation: {
        'slide-up': 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pop-in': 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        dash: { to: { strokeDashoffset: '-24' } },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'translate(-50%, -50%) scale(0.85)' },
          '100%': { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
      },
    },
  },
} satisfies Config;
