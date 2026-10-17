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

        // The five brand colours by name, for the few places that want a
        // specific one rather than a role — the navy pricing card, the gold
        // foil rule. Everything else should use the semantic tokens above.
        navy: '#0D1B2A',
        ocean: '#1B365D',
        antique: '#C99A47',
        champagne: '#E6C17A',
        ivory: '#F5EBDD',
      },
      borderColor: { DEFAULT: token('border') },
      ringColor: { DEFAULT: token('ring') },
      fontFamily: {
        display: ['var(--font-display)'],
        sans: ['var(--font-body)'],
      },
      boxShadow: {
        // Tinted with the brand navy rather than neutral black, so a card sits
        // on the page instead of looking cut out of it.
        card: '0 1px 2px rgb(13 27 42 / 0.05), 0 8px 24px -12px rgb(13 27 42 / 0.16)',
        lift: '0 2px 4px rgb(13 27 42 / 0.08), 0 18px 44px -16px rgb(13 27 42 / 0.28)',
        // For the gold primary button: a warm glow rather than a grey drop.
        gold: '0 1px 2px rgb(201 154 71 / 0.20), 0 10px 30px -12px rgb(201 154 71 / 0.45)',
      },
    },
  },
  plugins: [],
}
