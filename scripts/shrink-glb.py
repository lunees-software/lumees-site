"""Reduz as texturas de um GLB (redimensiona e recodifica em JPEG) sem dependências externas.
Uso: python scripts/shrink-glb.py entrada.glb saida.glb [tamanho=1024] [qualidade=82]
"""
import io, json, struct, sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
size = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
quality = int(sys.argv[4]) if len(sys.argv) > 4 else 82

data = open(src, 'rb').read()
jlen = struct.unpack('<I', data[12:16])[0]
gltf = json.loads(data[20:20 + jlen])
bstart = 20 + jlen + 8
blen = struct.unpack('<I', data[20 + jlen:24 + jlen])[0]
blob = data[bstart:bstart + blen]

views = gltf['bufferViews']
image_views = {img['bufferView'] for img in gltf['images']}
out = bytearray()
for i, v in enumerate(views):
    chunk = blob[v['byteOffset']:v['byteOffset'] + v['byteLength']]
    if i in image_views:
        im = Image.open(io.BytesIO(chunk)).convert('RGB')
        im.thumbnail((size, size), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, 'JPEG', quality=quality, optimize=True)
        chunk = buf.getvalue()
    while len(out) % 4:
        out.append(0)
    v['byteOffset'] = len(out)
    v['byteLength'] = len(chunk)
    out += chunk
for img in gltf['images']:
    img['mimeType'] = 'image/jpeg'
while len(out) % 4:
    out.append(0)
gltf['buffers'][0]['byteLength'] = len(out)

j = json.dumps(gltf, separators=(',', ':')).encode()
j += b' ' * ((4 - len(j) % 4) % 4)
total = 12 + 8 + len(j) + 8 + len(out)
with open(dst, 'wb') as f:
    f.write(struct.pack('<4sII', b'glTF', 2, total))
    f.write(struct.pack('<I4s', len(j), b'JSON') + j)
    f.write(struct.pack('<I4s', len(out), b'BIN\0') + bytes(out))
print(dst, round(total / 1e6, 2), 'MB')
