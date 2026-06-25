/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // support manual dark mode toggles or default
  theme: {
    extend: {
      colors: {
        // iOS Light Theme colors
        bg: {
          deep: '#f2f2f7',      // iOS light background
          card: '#ffffff',      // Pure white card
          panel: '#ffffff'
        },
        primary: {
          DEFAULT: '#007aff',  // iOS System Blue
          glow: '#0a84ff',
          dark: '#0056b3',
        },
        secondary: {
          DEFAULT: '#e5e5ea',  // iOS Light Gray 4
          glow: '#d1d1d6',     // iOS Light Gray 3
        },
        success: '#34c759',    // iOS Green
        warning: '#ff9500',    // iOS Orange
        danger: '#ff3b30',     // iOS Red
        // Inverted scales to keep component styling dark and readable
        slate: {
          50: '#09090b',
          100: '#1c1c1e', // Dark Gray
          200: '#2c2c2e',
          300: '#3a3a3c',
          400: '#8e8e93', // Muted Gray
          500: '#aeaeb2',
          600: '#c7c7cc',
          700: '#d1d1d6',
          800: '#e5e5ea',
          900: '#f2f2f7',
        },
        zinc: {
          50: '#09090b',
          100: '#1c1c1e',
          200: '#2c2c2e',
          300: '#3a3a3c',
          400: '#8e8e93',
          500: '#aeaeb2',
          600: '#c7c7cc',
          700: '#d1d1d6',
          800: '#e5e5ea',
          900: '#f2f2f7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 4px 20px rgba(0, 0, 0, 0.04)',
        'glass-glow': '0 4px 20px rgba(0, 122, 255, 0.05)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2.5s infinite linear',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(15px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
