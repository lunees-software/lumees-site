// Gera o modelo 3D do Modular Core no Meshy a partir de 4 vistas do render (multi-image-to-3d).
// Uso (PowerShell):  $env:MESHY_API_KEY = "msy_..."; node scripts/generate-core.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const key = process.env.MESHY_API_KEY;
if (!key) {
  console.error('MESHY_API_KEY ausente. Defina a variável de ambiente e rode de novo.');
  process.exit(1);
}

const root = resolve(import.meta.dirname, '..');
const views = ['front', 'three-quarter', 'side', 'other-corner'];
const output = resolve(root, 'public/models/modular-core.glb');
const images = views.map((v) => `data:image/png;base64,${readFileSync(resolve(root, `scripts/views/${v}.png`)).toString('base64')}`);
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

const created = await fetch('https://api.meshy.ai/openapi/v1/multi-image-to-3d', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    image_urls: images,
    ai_model: 'meshy-7.1',
    should_texture: true,
    enable_pbr: true,
    should_remesh: true,
    topology: 'triangle',
    target_polycount: 60000,
    target_formats: ['glb'],
  }),
});

if (!created.ok) {
  console.error('Falha ao criar a tarefa:', created.status, await created.text());
  process.exit(1);
}

const { result: id } = await created.json();
console.log('tarefa', id);

const started = Date.now();
while (Date.now() - started < 15 * 60 * 1000) {
  await new Promise((r) => setTimeout(r, 8000));
  const response = await fetch(`https://api.meshy.ai/openapi/v1/multi-image-to-3d/${id}`, { headers });
  if (!response.ok) {
    console.error('Falha ao consultar:', response.status, await response.text());
    process.exit(1);
  }
  const task = await response.json();
  console.log(task.status, task.progress ?? '');
  if (task.status === 'SUCCEEDED') {
    const glbUrl = task.model_urls?.glb;
    if (!glbUrl) {
      console.error('A tarefa terminou sem GLB.');
      process.exit(1);
    }
    const file = await fetch(glbUrl);
    if (!file.ok) {
      console.error('Falha no download:', file.status);
      process.exit(1);
    }
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, Buffer.from(await file.arrayBuffer()));
    console.log('salvo em', output);
    process.exit(0);
  }
  if (task.status === 'FAILED' || task.status === 'CANCELED') {
    console.error(JSON.stringify(task.task_error ?? task));
    process.exit(1);
  }
}

console.error('Tempo esgotado.');
process.exit(1);
