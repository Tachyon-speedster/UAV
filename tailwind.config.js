/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Aerospace propulsion workstation palette — dark charcoal/graphite base
        base: {
          950: '#0b0d0f', // deepest background
          900: '#111417', // app background
          800: '#171b1f', // panel background
          700: '#1f242a', // raised panel / card
          600: '#2a3037', // borders / dividers
          500: '#3a424b', // inactive borders
        },
        ink: {
          100: '#eef1f3', // primary text
          300: '#c3ccd3', // secondary text
          500: '#8a949d', // muted / labels
          700: '#5c656d', // disabled
        },
        status: {
          healthy: '#4ade80',
          healthyDim: '#1f4530',
          warn: '#f5a524',
          warnDim: '#4a3312',
          critical: '#f0475a',
          criticalDim: '#4a1520',
          info: '#4ea8de',
          infoDim: '#173142',
        },
      },
      fontFamily: {
        // Native OS instrumentation stack (Segoe UI / Consolas) instead of a
        // trendy Google-fonts pairing — matches how real engineering /
        // avionics workstation software (MATLAB, LabVIEW, ground-control
        // software) actually renders text, and needs no external font load.
        ui: ['"Segoe UI"', 'Tahoma', 'Arial', 'system-ui', 'sans-serif'],
        mono: ['Consolas', '"Courier New"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 0 0 1px rgba(255,255,255,0.03), 0 4px 14px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
};
