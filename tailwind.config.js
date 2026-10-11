/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg-main)',
        surface: 'var(--bg-card)',
        'surface-hover': 'var(--bg-card-hover)',
        border: 'var(--border-color)',
        'border-subtle': 'var(--border-subtle)',
        'text-main': 'var(--text-main)',
        'text-muted': 'var(--text-muted)',
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          subtle: 'var(--accent-subtle)',
        },
        financial: {
          income: 'var(--color-income)',
          'income-bg': 'var(--color-income-bg)',
          expense: 'var(--color-expense)',
          'expense-bg': 'var(--color-expense-bg)',
          transfer: 'var(--color-transfer)',
          'transfer-bg': 'var(--color-transfer-bg)',
          debt: 'var(--color-debt)',
          'debt-bg': 'var(--color-debt-bg)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card': '0 2px 5px -1px rgba(0, 0, 0, 0.08), 0 1px 3px -1px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
