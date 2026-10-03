import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', './e2e/**/*.{html,ts,tsx}'],
  theme: {
    screens: { sm: '640px', lg: '1025px' },
    fontFamily: { sans: ['Inter', 'Arial', 'sans-serif'] },
    fontSize: {
      xs: ['var(--font-size-xs)', { lineHeight: '1.5' }],
      sm: ['var(--font-size-sm)', { lineHeight: '1.5' }],
      base: ['var(--font-size-base)', { lineHeight: '1.5' }],
      lg: ['var(--font-size-lg)', { lineHeight: '1.5' }],
      xl: ['var(--font-size-xl)', { lineHeight: '1.5' }],
      '2xl': ['var(--font-size-2xl)', { lineHeight: '1.5' }],
    },
    spacing: {
      0: '0',
      1: 'var(--space-1)',
      2: 'var(--space-2)',
      3: 'var(--space-3)',
      4: 'var(--space-4)',
      6: 'var(--space-6)',
      8: 'var(--space-8)',
      12: 'var(--space-12)',
    },
    borderRadius: {
      none: '0',
      control: 'var(--radius-control)',
      card: 'var(--radius-card)',
      full: '9999px',
    },
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        info: 'var(--color-info)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        text: 'var(--color-text)',
        muted: 'var(--color-text-secondary)',
        border: 'var(--color-border)',
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
      },
    },
  },
  plugins: [],
} satisfies Config;
