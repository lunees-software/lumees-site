import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { playHeroAnimation } from './animation/hero-animation';
import { mountHeroRender } from './animation/hero-render';
import { mountCinematicScroll, refreshScroll } from './animation/scroll-timeline';
import { createSmoothScroll } from './animation/smooth-scroll';
import { prefersReducedMotion } from './quality';

gsap.registerPlugin(ScrollTrigger, SplitText);

export async function boot(): Promise<void> {
  window.__luneesDispose?.();

  const reducedMotion = prefersReducedMotion();
  const cleanups: Array<() => void> = [];

  const scroll = createSmoothScroll(reducedMotion);
  cleanups.push(scroll.destroy);

  if (!reducedMotion) {
    const onTick = (time: number) => scroll.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);
    cleanups.push(() => gsap.ticker.remove(onTick));
  }

  const sentinel = document.querySelector('#scroll-sentinel');
  if (sentinel) {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      document.documentElement.toggleAttribute('data-scrolled', !entry.isIntersecting);
    });
    observer.observe(sentinel);
    cleanups.push(() => observer.disconnect());
  }

  if (document.fonts?.ready) await document.fonts.ready;

  const render = mountHeroRender(reducedMotion);
  cleanups.push(render.destroy);

  const heroMotion = playHeroAnimation(reducedMotion, () => {
    if (reducedMotion) return;
    const cinematic = mountCinematicScroll();
    cleanups.push(cinematic.kill);
    refreshScroll();
  });
  cleanups.push(heroMotion.kill);

  const dispose = () => {
    cleanups.forEach((fn) => fn());
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    window.__luneesDispose = undefined;
  };

  window.__luneesDispose = dispose;
  window.addEventListener('pagehide', dispose, { once: true });
}
