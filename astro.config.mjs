import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    // Pré-otimiza as dependências para evitar reotimização e recarga (504) no dev.
    optimizeDeps: {
      include: ['three', 'three/addons/loaders/GLTFLoader.js', 'three/addons/environments/RoomEnvironment.js', 'gsap', 'gsap/ScrollTrigger', 'gsap/SplitText', 'lenis'],
    },
  },
});
