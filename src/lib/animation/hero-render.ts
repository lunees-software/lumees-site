import { gsap } from 'gsap';

export interface HeroRender {
  destroy: () => void;
}

const MAX_YAW = 11;
const MAX_PITCH = 8;

/**
 * Render do Modular Core com inclinação 3D que segue o mouse e flutuação suave.
 * O arraste não é necessário: o objeto reage ao ponteiro, como na hero do Resend.
 */
export function mountHeroRender(reducedMotion: boolean): HeroRender {
  const img = document.querySelector<HTMLImageElement>('[data-render-img]');
  if (!img) return { destroy() {} };

  gsap.set(img, { transformPerspective: 1100, transformOrigin: '50% 50%' });

  const rotY = gsap.quickTo(img, 'rotationY', { duration: 0.9, ease: 'power3.out' });
  const rotX = gsap.quickTo(img, 'rotationX', { duration: 0.9, ease: 'power3.out' });

  const float = gsap.to(img, reducedMotion ? { y: 0, duration: 0 } : {
    y: -10,
    duration: 3.2,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
  });

  let model: { dispose: () => void } | null = null;
  let destroyed = false;
  const container = img.closest<HTMLElement>('.hero__render');
  if (container) {
    // Se existir /models/modular-core.glb, o modelo 3D assume e a imagem vira fallback.
    void import('../three/hero-model').then(async (mod) => {
      const mounted = await mod.mountHeroModel(container, reducedMotion);
      if (!mounted) return;
      if (destroyed) {
        mounted.dispose();
        return;
      }
      model = mounted;
      window.removeEventListener('pointermove', onMove);
      float.kill();
      gsap.to(img, { opacity: 0, duration: 0.6, onComplete: () => void (img.style.visibility = 'hidden') });
    });
  }

  const onMove = (event: PointerEvent) => {
    if (reducedMotion || event.pointerType !== 'mouse') return;
    const nx = (event.clientX / window.innerWidth - 0.5) * 2;
    const ny = (event.clientY / window.innerHeight - 0.5) * 2;
    rotY(nx * MAX_YAW);
    rotX(-ny * MAX_PITCH);
  };
  const onLeave = () => {
    rotY(0);
    rotX(0);
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);

  return {
    destroy() {
      destroyed = true;
      model?.dispose();
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      float.kill();
      gsap.killTweensOf(img);
    },
  };
}
