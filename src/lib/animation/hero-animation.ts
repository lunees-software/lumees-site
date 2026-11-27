import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { motion } from '../config/tokens';

export interface HeroAnimation {
  kill: () => void;
}

function showStatic(): void {
  document.querySelectorAll<HTMLElement>('[data-animate]').forEach((node) => {
    node.style.opacity = '1';
    node.style.transform = 'none';
  });
}

export function playHeroAnimation(reducedMotion: boolean, onComplete: () => void): HeroAnimation {
  if (reducedMotion) {
    showStatic();
    onComplete();
    return { kill() {} };
  }

  const nav = document.querySelector('[data-animate="nav"]');
  const eyebrow = document.querySelector('[data-animate="eyebrow"]');
  const dot = document.querySelector('[data-dot]');
  const title = document.querySelector('[data-animate="title"]');
  const lede = document.querySelector('[data-animate="lede"]');
  const ctas = gsap.utils.toArray<HTMLElement>('[data-animate="cta"]');
  const render = document.querySelector('[data-animate="render"]');
  const lines = document.querySelector('[data-animate="lines"]');

  const timeline = gsap.timeline({
    defaults: { ease: motion.easeOut },
    onComplete,
  });

  if (nav) {
    gsap.set(nav, { y: -16 });
    timeline.to(nav, { y: 0, opacity: 1, duration: motion.nav.duration }, motion.nav.at);
  }
  if (eyebrow) {
    gsap.set(eyebrow, { y: 8 });
    timeline.to(eyebrow, { y: 0, opacity: 1, duration: motion.eyebrow.duration }, motion.eyebrow.at);
  }
  if (dot) {
    gsap.set(dot, { scale: 0, transformOrigin: '50% 50%' });
    timeline.to(dot, { scale: 1, duration: 0.5 }, motion.eyebrow.at);
  }
  if (lede) {
    gsap.set(lede, { y: 16 });
    timeline.to(lede, { y: 0, opacity: 1, duration: motion.lede.duration }, motion.lede.at);
  }
  if (ctas.length) {
    gsap.set(ctas, { y: 12 });
    timeline.to(ctas, { y: 0, opacity: 1, duration: motion.cta.duration, stagger: motion.cta.stagger }, motion.cta.at);
  }
  if (render) {
    gsap.set(render, { scale: 0.92 });
    timeline.to(render, { opacity: 1, scale: 1, duration: 1.4, ease: motion.easeExpo }, motion.canvas.at);
  }

  if (lines) {
    timeline.to(lines, { opacity: 1, duration: 1.2, ease: motion.easePower2 }, motion.violet.at);
  }

  let split: SplitText | null = null;
  if (title instanceof HTMLElement) {
    try {
      split = SplitText.create(title, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        aria: 'auto',
        tag: 'span',
        linesClass: 'hero__mask-line',
        onSplit: (self) => {
          gsap.set(title, { opacity: 1 });
          return gsap.from(self.lines, {
            yPercent: 110,
            duration: motion.headline.duration,
            stagger: motion.headline.stagger,
            ease: motion.easeExpo,
            delay: motion.headline.at,
          });
        },
      });
    } catch {
      gsap.set(title, { opacity: 1 });
    }
  }

  return {
    kill() {
      timeline.kill();
      split?.kill();
      split?.revert();
    },
  };
}
