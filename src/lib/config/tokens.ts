export const colors = {
  obsidian: '#101216',
  lunar: '#F1F2F5',
  graphite: '#23262E',
  titanium: '#A4AAB8',
  violet: '#8875E8',
} as const;

export const motion = {
  easeOut: 'power3.out',
  easeExpo: 'expo.out',
  easePower4: 'power4.out',
  easePower2: 'power2.out',
  nav: { at: 0, duration: 0.7 },
  eyebrow: { at: 0.15, duration: 0.65 },
  headline: { at: 0.25, duration: 1, stagger: 0.1 },
  lede: { at: 0.65, duration: 0.7 },
  cta: { at: 0.8, duration: 0.55, stagger: 0.08 },
  canvas: { at: 0.3, duration: 0.9 },
  assemble: { at: 0.55, duration: 1.6 },
  violet: { at: 1.6, duration: 1 },
} as const;

export const limits = {
  navOffset: 88,
} as const;
