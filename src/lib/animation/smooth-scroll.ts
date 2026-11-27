import Lenis from 'lenis';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { limits } from '../config/tokens';

export interface SmoothScroll {
  raf: (timeMs: number) => void;
  destroy: () => void;
}

function isHashLink(value: string | null): value is string {
  return Boolean(value && value.startsWith('#') && value.length > 1);
}

export function createSmoothScroll(reducedMotion: boolean): SmoothScroll {
  if (reducedMotion) {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href^="#"]');
      if (!(link instanceof HTMLAnchorElement)) return;
      const href = link.getAttribute('href');
      if (!isHashLink(href)) return;
      const node = document.querySelector(href);
      if (!(node instanceof HTMLElement)) return;
      event.preventDefault();
      const top = node.getBoundingClientRect().top + window.scrollY - limits.navOffset;
      window.scrollTo({ top, behavior: 'auto' });
    };
    document.addEventListener('click', onClick);
    return {
      raf() {},
      destroy() {
        document.removeEventListener('click', onClick);
      },
    };
  }

  const lenis = new Lenis({
    lerp: 0.1,
    smoothWheel: true,
    autoRaf: false,
    anchors: { offset: -limits.navOffset },
  });

  const onScroll = () => {
    ScrollTrigger.update();
  };
  lenis.on('scroll', onScroll);

  return {
    raf(timeMs) {
      lenis.raf(timeMs);
    },
    destroy() {
      lenis.off('scroll', onScroll);
      lenis.destroy();
    },
  };
}
