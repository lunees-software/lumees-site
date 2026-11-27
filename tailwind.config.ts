import type { Config } from 'tailwindcss';

const config: Config = {
  theme: {
    extend: {
      colors: {
        obsidian: '#101216',
        lunar: '#F1F2F5',
        'lunar-white': '#F1F2F5',
        graphite: '#23262E',
        titanium: '#A4AAB8',
        violet: '#8875E8',
      },
      fontFamily: {
        display: ['Unbounded', 'Unbounded Fallback', 'sans-serif'],
        sans: ['Exo 2', 'Exo 2 Fallback', 'sans-serif'],
        mono: ['Geist Mono', 'Geist Mono Fallback', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        container: '1600px',
      },
      height: {
        nav: '88px',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        nav: '300ms',
      },
    },
  },
};

export default config;
