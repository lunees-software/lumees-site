import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * Scroll da Hero: ao sair, o render sobe, cresce um pouco e some,
 * e o texto sai antes. Sem pin; o progresso é o scroll nativo (Lenis).
 * `immediateRender: false` evita brigar com a timeline de entrada.
 */
export interface CinematicScroll {
  kill: () => void;
}

export function mountCinematicScroll(): CinematicScroll {
  const early = gsap.utils.toArray<HTMLElement>('[data-scroll-early]');
  const items = gsap.utils.toArray<HTMLElement>('[data-scroll-item]');
  const lines = document.querySelector('[data-scroll-lines]');
  const render = document.querySelector('[data-animate="render"]');

  const timeline = gsap.timeline({
    defaults: { ease: 'none', overwrite: 'auto' },
    scrollTrigger: {
      trigger: '#hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 1,
      invalidateOnRefresh: true,
    },
  });

  if (early.length) {
    timeline.to(early, { opacity: 0, y: -28, stagger: 0.03, immediateRender: false }, 0);
  }
  if (items.length) {
    timeline.to(items, { opacity: 0, y: -40, stagger: 0.05, immediateRender: false }, 0.06);
  }
  if (lines) {
    timeline.to(lines, { opacity: 0, immediateRender: false }, 0);
  }

  if (render) {
    timeline.to(render, { y: -50, scale: 1.06, opacity: 0.15, immediateRender: false }, 0);
  }

  return {
    kill() {
      timeline.scrollTrigger?.kill();
      timeline.kill();
    },
  };
}

export function refreshScroll(): void {
  ScrollTrigger.refresh();
}
