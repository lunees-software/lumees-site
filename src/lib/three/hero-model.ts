import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { gsap } from 'gsap';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const MODEL_URL = '/models/modular-core.glb';
const EXPLODE_SPREAD = 0.46;
const CUT = 0.2;

export interface HeroModel {
  dispose: () => void;
}

const MAX_YAW = 0.55;
const MAX_PITCH = 0.32;
const BASE_YAW = -0.25;
const BASE_PITCH = 0.12;


function hash(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * A textura do Meshy sai com um tom lavanda assado em tudo. Aqui o metal vira
 * prata/grafite neutro e só o roxo realmente saturado (núcleo, brilho) é mantido.
 */
function neutralizeMetal(texture: THREE.Texture): { map: THREE.Texture; glow: THREE.Texture; metalRough: THREE.Texture } | null {
  const image = texture.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  // Baixa para 1024 e sobe de volta: tira os riscos e o ruído assados pelo Meshy.
  const small = document.createElement('canvas');
  small.width = 1024;
  small.height = 1024;
  const sctx = small.getContext('2d');
  if (sctx) {
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(image, 0, 0, 1024, 1024);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.drawImage(image, 0, 0);
  }
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const glowData = ctx.createImageData(canvas.width, canvas.height);
  const gp = glowData.data;
  const mrData = ctx.createImageData(canvas.width, canvas.height);
  const mp = mrData.data;
  const W = canvas.width;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255;
    const g = px[i + 1] / 255;
    const b = px[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // Roxo só onde é saturado E claro (núcleo/brilho); azul-marinho escuro vira grafite.
    const keep = smoothstep(0.3, 0.6, sat) * smoothstep(0.06, 0.2, luma);
    const k = 0.05 + 0.95 * keep;
    // Contraste leve: escuros mais profundos, claros mais prateados.
    const dark = 1 - smoothstep(0.1, 0.3, luma);
    const light = smoothstep(0.28, 0.5, luma);
    const lift = Math.min(1, Math.pow(luma, 0.85) * 1.12 * (1 - 0.45 * dark) * (1 + 0.25 * light));
    const scale = luma > 0.0001 ? lift / luma : 1;
    const nr = luma + (r - luma) * k;
    const ng = luma + (g - luma) * k;
    const nb = luma + (b - luma) * k;
    // Emissivo: só o roxo saturado e claro, para brilhar mesmo sem luz direta.
    const glow = Math.pow(keep, 1.4);
    gp[i] = Math.min(255, r * 255 * glow * 1.15);
    gp[i + 1] = Math.min(255, g * 255 * glow * 0.9);
    gp[i + 2] = Math.min(255, b * 255 * glow * 1.35);
    gp[i + 3] = 255;
    // Metal de verdade: prata espelhada com escovado em faixas; grafite liso e brilhante.
    const px4 = i / 4;
    const x = px4 % W;
    const y = Math.floor(px4 / W);
    const silver = smoothstep(0.2, 0.36, luma);
    const streak = hash(y, Math.floor(x / 96)) - 0.5;
    const grain = hash(x, y) - 0.5;
    const rough = 0.34 - silver * 0.12 + streak * 0.05 * (0.5 + silver) + grain * 0.01;
    const metal = (0.88 + silver * 0.12) * (1 - keep * 0.75);
    mp[i] = 255;
    mp[i + 1] = Math.max(0, Math.min(255, rough * 255));
    mp[i + 2] = Math.max(0, Math.min(255, metal * 255));
    mp[i + 3] = 255;
    px[i] = Math.min(255, nr * scale * 255);
    px[i + 1] = Math.min(255, ng * scale * 255);
    px[i + 2] = Math.min(255, nb * scale * 255);
  }
  ctx.putImageData(data, 0, 0);
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = canvas.width;
  glowCanvas.height = canvas.height;
  glowCanvas.getContext('2d')?.putImageData(glowData, 0, 0);
  const mrCanvas = document.createElement('canvas');
  mrCanvas.width = canvas.width;
  mrCanvas.height = canvas.height;
  mrCanvas.getContext('2d')?.putImageData(mrData, 0, 0);
  const make = (source: HTMLCanvasElement, srgb = true) => {
    const tex = new THREE.CanvasTexture(source);
    tex.flipY = texture.flipY;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = texture.wrapS;
    tex.wrapT = texture.wrapT;
    return tex;
  };
  const result = { map: make(canvas), glow: make(glowCanvas), metalRough: make(mrCanvas, false) };
  texture.dispose();
  return result;
}

/**
 * Carrega o GLB do Modular Core num canvas transparente dentro de `.hero__render`.
 * Devolve `null` se o modelo não existir ou o WebGL falhar; a imagem do render
 * continua como fallback. O modelo é centralizado e normalizado automaticamente,
 * então a escala e a origem do GLB do Meshy não importam.
 */
export async function mountHeroModel(container: HTMLElement, reducedMotion: boolean): Promise<HeroModel | null> {
  let gltf;
  try {
    gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  } catch {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'hero__model';
  canvas.setAttribute('aria-hidden', 'true');

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  container.append(canvas);

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTarget = pmrem.fromScene(room, 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 1.5;
  pmrem.dispose();

  const key = new THREE.DirectionalLight('#f1f2f5', 2.2);
  key.position.set(-2, 3, 4);
  const rim = new THREE.DirectionalLight('#7c4dff', 3);
  rim.position.set(3, -1, -2);
  // Núcleo violeta: luz no centro do cubo ilumina as faces internas pelas frestas.
  const core = new THREE.PointLight('#7c4dff', 10, 3.2, 1.4);
  core.position.set(0, 0, 0);
  scene.add(key, rim, core);

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  camera.position.set(0, 0, 5);

  // Explosão: 26 cópias do modelo (uma por célula de uma grade 3x3x3), cada uma descartando
  // no shader tudo que está fora da sua célula. Os cortes são retos e nítidos; em repouso
  // só a malha original é desenhada.
  const uniforms = { uExplode: { value: 0 } };
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const middle = bounds.getCenter(new THREE.Vector3());
  const extent = bounds.getSize(new THREE.Vector3());

  const materials: THREE.MeshStandardMaterial[] = [];
  let baseMesh: THREE.Mesh | null = null;
  let cellMesh: THREE.InstancedMesh | null = null;

  gltf.scene.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || baseMesh) return;
    const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!(m instanceof THREE.MeshStandardMaterial)) return;
    baseMesh = mesh;
    if (m.map) {
      const processed = neutralizeMetal(m.map);
      if (processed) {
        m.map = processed.map;
        m.emissiveMap = processed.glow;
        m.emissive = new THREE.Color('#ffffff');
        m.emissiveIntensity = 1.1;
        m.metalnessMap = processed.metalRough;
        m.roughnessMap = processed.metalRough;
        m.metalness = 1;
        m.roughness = 1;
      }
    }
    m.envMapIntensity = 1.9;
    m.normalScale.set(0.18, 0.18);
    m.side = THREE.DoubleSide;

    // Faces internas: cor chapada, para os cortes parecerem blocos maciços.
    const capColor = `if (!gl_FrontFacing) { gl_FragColor = vec4(0.075, 0.055, 0.17, 1.0); }`;
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
${capColor}`,
      );
    };
    m.needsUpdate = true;
    materials.push(m);

    // Material das células: mesma aparência + deslocamento por instância + descarte fora da célula.
    const cellMat = m.clone();
    cellMat.customProgramCacheKey = () => 'lunees-cells';
    const cut = CUT;
    cellMat.onBeforeCompile = (shader) => {
      shader.uniforms.uExplode = uniforms.uExplode;
      shader.uniforms.uMid = { value: middle };
      shader.uniforms.uRng = { value: extent };
      shader.uniforms.uCut = { value: cut };
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute vec4 aCellDir;
attribute vec3 aCell;
attribute vec3 aPivot;
attribute vec3 aRot;
vec3 rotAA(vec3 v, vec3 ang) {
  float a = length(ang);
  if (a < 1e-4) return v;
  vec3 k = ang / a;
  return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1.0 - cos(a));
}
uniform float uExplode;
varying vec3 vCell;
varying vec3 vObj;`,
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
float ex = smoothstep(aCellDir.w * 0.35, aCellDir.w * 0.35 + 0.65, uExplode);
objectNormal = rotAA(objectNormal, aRot * ex);`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vCell = aCell;
vObj = position;
transformed = aPivot + rotAA(transformed - aPivot, aRot * ex) + aCellDir.xyz * ex;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform vec3 uMid;
uniform vec3 uRng;
uniform float uCut;
varying vec3 vCell;
varying vec3 vObj;`,
        )
        .replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
{
  vec3 rel = (vObj - uMid) / uRng;
  vec3 cell = vec3(
    rel.x < -uCut ? 0.0 : (rel.x > uCut ? 2.0 : 1.0),
    rel.y < -uCut ? 0.0 : (rel.y > uCut ? 2.0 : 1.0),
    rel.z < -uCut ? 0.0 : (rel.z > uCut ? 2.0 : 1.0)
  );
  if (abs(cell.x - vCell.x) + abs(cell.y - vCell.y) + abs(cell.z - vCell.z) > 0.5) discard;
}`,
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
${capColor}`,
        );
    };

    const cells: Array<{ cell: THREE.Vector3; dir: THREE.Vector3; phase: number; pivot: THREE.Vector3; rot: THREE.Vector3 }> = [];
    for (let ix = 0; ix < 3; ix += 1) {
      for (let iy = 0; iy < 3; iy += 1) {
        for (let iz = 0; iz < 3; iz += 1) {
          if (ix === 1 && iy === 1 && iz === 1) continue;
          const dir = new THREE.Vector3(ix - 1, iy - 1, iz - 1).multiply(extent).normalize().multiplyScalar(EXPLODE_SPREAD);
          const k = cells.length;
          const half = (0.5 + CUT) / 2;
          const pivot = new THREE.Vector3((ix - 1) * half, (iy - 1) * half, (iz - 1) * half).multiply(extent).add(middle);
          const rot = new THREE.Vector3(Math.sin(k * 12.9898), Math.sin(k * 78.233), Math.sin(k * 37.719)).multiplyScalar(0.16);
          cells.push({ cell: new THREE.Vector3(ix, iy, iz), dir, phase: (k * 0.61803) % 1, pivot, rot });
        }
      }
    }
    const instanced = new THREE.InstancedMesh(mesh.geometry, cellMat, cells.length);
    const dirAttr = new Float32Array(cells.length * 4);
    const cellAttr = new Float32Array(cells.length * 3);
    const pivotAttr = new Float32Array(cells.length * 3);
    const rotAttr = new Float32Array(cells.length * 3);
    const identity = new THREE.Matrix4();
    cells.forEach((c, i) => {
      instanced.setMatrixAt(i, identity);
      dirAttr.set([c.dir.x, c.dir.y, c.dir.z, c.phase], i * 4);
      cellAttr.set([c.cell.x, c.cell.y, c.cell.z], i * 3);
      pivotAttr.set([c.pivot.x, c.pivot.y, c.pivot.z], i * 3);
      rotAttr.set([c.rot.x, c.rot.y, c.rot.z], i * 3);
    });
    mesh.geometry.setAttribute('aCellDir', new THREE.InstancedBufferAttribute(dirAttr, 4));
    mesh.geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(cellAttr, 3));
    mesh.geometry.setAttribute('aPivot', new THREE.InstancedBufferAttribute(pivotAttr, 3));
    mesh.geometry.setAttribute('aRot', new THREE.InstancedBufferAttribute(rotAttr, 3));
    instanced.frustumCulled = false;
    instanced.visible = false;
    instanced.position.copy(mesh.position);
    instanced.quaternion.copy(mesh.quaternion);
    instanced.scale.copy(mesh.scale);
    mesh.parent?.add(instanced);
    cellMesh = instanced;
    materials.push(cellMat);
  });
  const canExplode = Boolean(baseMesh && cellMesh);

  // Normaliza: centro na origem e maior dimensão = 1.
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const pivot = new THREE.Group();
  const holder = new THREE.Group();
  holder.add(model);
  const baseScale = 1 / Math.max(size.x, size.y, size.z, 0.0001);
  holder.scale.setScalar(baseScale);
  pivot.add(holder);
  pivot.rotation.set(BASE_PITCH, BASE_YAW, 0);
  scene.add(pivot);

  // Núcleo no centro: cubo violeta emissivo girando, gaiola em wireframe contra-girando e halo.
  const coreGroup = new THREE.Group();
  const coreSolidMat = new THREE.MeshStandardMaterial({
    color: '#4a24d8',
    emissive: '#6a3cff',
    emissiveIntensity: 1.5,
    roughness: 0.25,
    metalness: 0.1,
  });
  const coreSolid = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.17), coreSolidMat);
  const cageGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.27, 0.27, 0.27));
  const cageMat = new THREE.LineBasicMaterial({ color: '#c9b8ff', transparent: true, opacity: 0.85 });
  const cage = new THREE.LineSegments(cageGeo, cageMat);
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = 128;
  haloCanvas.height = 128;
  const hctx = haloCanvas.getContext('2d');
  if (hctx) {
    const g = hctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(160,120,255,0.95)');
    g.addColorStop(0.35, 'rgba(110,70,255,0.4)');
    g.addColorStop(1, 'rgba(90,50,255,0)');
    hctx.fillStyle = g;
    hctx.fillRect(0, 0, 128, 128);
  }
  const haloTex = new THREE.CanvasTexture(haloCanvas);
  haloTex.colorSpace = THREE.SRGBColorSpace;
  const haloMat = new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(0.85);
  coreGroup.add(coreSolid, cage, halo);
  pivot.add(coreGroup);

  let width = 1;
  let height = 1;
  const resize = () => {
    const rect = container.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Ajusta a distância para o objeto ocupar ~78% do menor lado.
    const fit = 0.78;
    const vFov = (camera.fov * Math.PI) / 180;
    const limit = Math.min(1, camera.aspect);
    camera.position.z = 1 / (fit * limit * 2 * Math.tan(vFov / 2)) + 0.6;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  // Inclinação pelo mouse + giro lento ocioso.
  let tx = 0;
  let ty = 0;
  let cx = 0;
  let cy = 0;
  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    ty = (event.clientX / window.innerWidth - 0.5) * 2;
    tx = (event.clientY / window.innerHeight - 0.5) * 2;
  };
  const onLeave = () => {
    tx = 0;
    ty = 0;
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);

  // Clique no cubo: abre as peças (explodir) e, no clique seguinte, remonta.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickTarget = baseMesh as THREE.Mesh | null;
  const hits = (event: PointerEvent): boolean => {
    if (!pickTarget) return false;
    const rect = canvas.getBoundingClientRect();
    ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(pickTarget, false).length > 0;
  };

  let exploded = false;
  let tween: gsap.core.Tween | null = null;
  const toggleExplode = () => {
    exploded = !exploded;
    tween?.kill();
    if (reducedMotion) {
      uniforms.uExplode.value = exploded ? 1 : 0;
      return;
    }
    tween = gsap.to(uniforms.uExplode, {
      value: exploded ? 1 : 0,
      duration: exploded ? 1.5 : 1.2,
      ease: exploded ? 'expo.out' : 'power3.inOut',
    });
  };

  let lastHover = 0;
  const onCanvasMove = (event: PointerEvent) => {
    const now = performance.now();
    if (now - lastHover < 70) return;
    lastHover = now;
    canvas.style.cursor = canExplode && hits(event) ? 'pointer' : '';
  };
  const onCanvasDown = (event: PointerEvent) => {
    if (canExplode && event.button === 0 && hits(event)) toggleExplode();
  };
  canvas.addEventListener('pointermove', onCanvasMove);
  canvas.addEventListener('pointerdown', onCanvasDown);

  let visible = true;
  const io = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting);
  });
  io.observe(container);

  let raf = 0;
  let last = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    const ease = 1 - Math.exp(-dt * 3.2);
    cx += (tx * MAX_PITCH - cx) * ease;
    cy += (ty * MAX_YAW - cy) * ease;
    const t = now / 1000;
    pivot.rotation.x = BASE_PITCH + cx;
    const open = uniforms.uExplode.value;
    coreSolid.rotation.set(t * 0.9, t * 1.25, t * 0.4);
    cage.rotation.set(-t * 0.55, -t * 0.8, t * 0.3);
    const corePulse = 1 + Math.sin(t * 2) * 0.05 + open * 0.55;
    coreGroup.scale.setScalar(corePulse);
    coreSolidMat.emissiveIntensity = 1.3 + Math.sin(t * 2) * 0.25 + open * 0.55;
    haloMat.opacity = 0.42 + open * 0.4;
    const showCells = open > 0.002;
    if (baseMesh) (baseMesh as THREE.Mesh).visible = !showCells;
    if (cellMesh) (cellMesh as THREE.InstancedMesh).visible = showCells;
    pivot.rotation.y = BASE_YAW + cy + (reducedMotion ? 0 : Math.sin(t * 0.25) * 0.12) + open * 0.5;
    holder.scale.setScalar(baseScale * (1 - open * 0.08));
    core.intensity = 10 * (1 + open * 0.9);
    const pulse = 1.05 + Math.sin(t * 1.6) * 0.22 + open * 0.25;
    materials.forEach((m) => {
      m.emissiveIntensity = pulse;
    });
    pivot.position.y = reducedMotion ? 0 : Math.sin(t * 0.7) * 0.015;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      io.disconnect();
      tween?.kill();
      [coreSolid.geometry, cageGeo, coreSolidMat, cageMat, haloTex, haloMat].forEach((r) => r.dispose());
      (cellMesh as THREE.InstancedMesh | null)?.dispose();
      materials.forEach((m) => m.dispose());
      canvas.removeEventListener('pointermove', onCanvasMove);
      canvas.removeEventListener('pointerdown', onCanvasDown);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      model.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          Object.values(m).forEach((v) => {
            if (v instanceof THREE.Texture) v.dispose();
          });
          m.dispose();
        });
      });
      envTarget.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
