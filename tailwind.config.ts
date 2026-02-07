import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Broadcast dark theme
        broadcast: {
          bg: '#0a0b0d',
          surface: '#12141a',
          panel: '#1a1d26',
          panelHover: '#20232e',
          border: '#2a2d38',
          borderSubtle: '#1e2128',
          accent: '#e63946',
          accentHover: '#ff4655',
          accentMuted: '#8b2530',
        },
        // Text hierarchy
        text: {
          primary: '#f8f9fa',
          secondary: '#b8bcc4',
          tertiary: '#7e8391',
          muted: '#5a5f6f',
        },
        // Momentum colors
        momentum: {
          up: '#00e676',
          upMuted: '#1b5e3f',
          down: '#ff1744',
          downMuted: '#5e1b2a',
          neutral: '#7e8391',
        },
        // Source badges
        source: {
          youtube: '#ff0000',
          youtubeMuted: '#3d0000',
          reddit: '#ff4500',
          redditMuted: '#3d1100',
          x: '#1da1f2',
          xMuted: '#0a2838',
        },
        // Ranks
        rank: {
          gold: '#ffd700',
          silver: '#c0c0c0',
          bronze: '#cd7f32',
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'broadcast-sm': ['0.8125rem', { lineHeight: '1.25rem' }],
        'broadcast-base': ['0.9375rem', { lineHeight: '1.5rem' }],
        'broadcast-lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'broadcast-xl': ['1.5rem', { lineHeight: '2rem' }],
        'broadcast-2xl': ['2rem', { lineHeight: '2.5rem' }],
      },
      spacing: {
        'broadcast-xs': '0.25rem',
        'broadcast-sm': '0.5rem',
        'broadcast-md': '0.75rem',
        'broadcast-lg': '1rem',
        'broadcast-xl': '1.5rem',
        'broadcast-2xl': '2rem',
      },
      borderRadius: {
        'broadcast': '0.375rem',
        'broadcast-lg': '0.5rem',
      },
      boxShadow: {
        'broadcast': '0 2px 8px rgba(0, 0, 0, 0.4)',
        'broadcast-lg': '0 4px 16px rgba(0, 0, 0, 0.5)',
        'broadcast-glow': '0 0 20px rgba(230, 57, 70, 0.3)',
      },
      backgroundImage: {
        'broadcast-gradient': 'linear-gradient(180deg, #12141a 0%, #0a0b0d 100%)',
        'broadcast-panel-gradient': 'linear-gradient(180deg, #1a1d26 0%, #12141a 100%)',
        'momentum-up-gradient': 'linear-gradient(90deg, rgba(0, 230, 118, 0.1) 0%, transparent 100%)',
        'momentum-down-gradient': 'linear-gradient(90deg, rgba(255, 23, 68, 0.1) 0%, transparent 100%)',
      },
      animation: {
        'pulse-subtle': 'pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slide-in 0.3s ease-out',
      },
      keyframes: {
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
