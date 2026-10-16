/** @type {import('tailwindcss').Config} */

// Every token is defined as "R G B" channels in app/globals.css, so wrapping
// them this way keeps Tailwind's opacity modifiers working: `bg-surface/60`
// and `text-muted/80` resolve, where a plain var() would silently ignore the
// slash and render at full opacity.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens — what pages should reach for, so that light and
        // dark stay a concern of globals.css alone.
        bg: token('bg'),
        surface: token('surface'),
        sunken: token('surface-sunken'),
        hairline: token('border'),
        'hairline-strong': token('border-strong'),

        ink: token('text'),
        muted: token('text-muted'),
        faint: token('text-faint'),

        primary: {
          DEFAULT: token('primary'),
          hover: token('primary-hover'),
          soft: token('primary-soft'),
          fg: token('on-primary'),
        },
        accent: {
          DEFAULT: token('accent'),
          bright: token('accent-bright'),
          soft: token('accent-soft'),
        },
        success: { DEFAULT: token('success'), soft: token('success-soft') },
        danger: { DEFAULT: token('danger'), soft: token('danger-soft') },
        warning: { DEFAULT: token('warning'), soft: token('warning-soft') },

        // The raw ramp, for the few places that want a specific step rather
        // than a role — the hero wash, mostly.
        sapphire: {
          50: '#eef2ff',
          100: '#dee6fb',
          200: '#bfcdf6',
          300: '#93a9ed',
          400: '#6480df',
          500: '#3f5bcb',
          600: '#2c42ac',
          700: '#233589',
          800: '#1b2968',
          900: '#141e4c',
          950: '#070b1c',
        },
        champagne: {
          100: '#faf4e8',
          200: '#f0d9a8',
          300: '#e3c27e',
          400: '#d4a855',
          500: '#b08339',
          600: '#8a6524',
        },
      },
      borderColor: { DEFAULT: token('border') },
      ringColor: { DEFAULT: token('ring') },
      boxShadow: {
        // Tinted with the brand navy instead of neutral black, so cards sit on
        // the porcelain background rather than looking cut out of it.
        card: '0 1px 2px rgb(15 23 51 / 0.04), 0 8px 24px -12px rgb(15 23 51 / 0.12)',
        lift: '0 2px 4px rgb(15 23 51 / 0.06), 0 16px 40px -16px rgb(15 23 51 / 0.22)',
      },
    },
  },
  plugins: [],
}
