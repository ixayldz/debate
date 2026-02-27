import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        base: 'var(--color-bg)',
        card: 'var(--color-card)',
        muted: 'var(--color-muted)',
        text: 'var(--color-text)',
        accent: 'var(--color-accent)',
        border: 'var(--color-border)',
      },
      borderRadius: {
        card: '22px',
      },
      boxShadow: {
        card: '0 8px 20px rgba(40, 36, 26, 0.08)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        display: ['var(--font-display)', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
