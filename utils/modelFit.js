// Per-model fit for the spot-page 3D viewer.
//
// The spot models come out of different tools in different units. Most are
// ~24 units across, but Barasoain and the Calumpit shrine are ~271 and STI is
// 68 with its origin well off to one side. One fixed scale for all of them put
// the camera inside the big ones and spun STI around an off-centre point.
// Instead the viewer reads each file's own bounds and scales/centres it so
// every model shows at the same size, turning about its own middle.
//
// Only the glTF JSON chunk at the front of a .glb is needed for that, so it is
// fetched with HTTP Range requests (Cloudinary honours them): 32–90 KB rather
// than the whole 1–6 MB model, which Viro downloads separately anyway.

const GLB_MAGIC   = 0x46546c67;   // "glTF", little-endian
const GLB_HEADER  = 20;           // 12-byte file header + 8-byte JSON chunk header
const FIRST_RANGE = 32 * 1024;    // fits every spot model's JSON but Barasoain's (~90 KB)
const TIMEOUT_MS  = 10000;

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// url → Promise<{ min, max } | null>
const boundsCache = new Map();

// Length of the JSON chunk, or null if these bytes aren't a GLB.
export function glbJsonLength(bytes) {
  if (!bytes || bytes.length < GLB_HEADER) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) return null;
  return view.getUint32(12, true);
}

// Byte-per-char, not UTF-8. glTF JSON is ASCII outside of names, and a
// non-ASCII name only comes out garbled — still valid JSON. This avoids
// depending on TextDecoder, which Hermes doesn't guarantee.
function latin1(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  }
  return out;
}

// Column-major 4×4 multiply, the layout glTF uses.
function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    }
  }
  return out;
}

// A node's local transform: its matrix, or translation · rotation · scale.
function localMatrix(node) {
  if (node.matrix) return node.matrix;
  const [tx, ty, tz] = node.translation || [0, 0, 0];
  const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale || [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

// Axis-aligned bounds of the scene as Viro will draw it, node transforms
// applied. An EXT_mesh_gpu_instancing node is measured once, not per instance,
// because Viro ignores that extension and draws the mesh once too.
export function modelBounds(gltf) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const nodes = gltf?.nodes || [];

  const visit = (index, parent, depth) => {
    const node = nodes[index];
    if (!node || depth > 64) return;
    const m = multiply(parent, localMatrix(node));
    const mesh = node.mesh === undefined ? null : gltf.meshes?.[node.mesh];
    for (const primitive of mesh?.primitives || []) {
      const accessor = gltf.accessors?.[primitive.attributes?.POSITION];
      if (!accessor?.min || !accessor?.max) continue;
      const [lo, hi] = [accessor.min, accessor.max];
      // All eight corners, so a rotated node's box is still covered.
      for (const x of [lo[0], hi[0]]) {
        for (const y of [lo[1], hi[1]]) {
          for (const z of [lo[2], hi[2]]) {
            const p = [
              m[0] * x + m[4] * y + m[8] * z + m[12],
              m[1] * x + m[5] * y + m[9] * z + m[13],
              m[2] * x + m[6] * y + m[10] * z + m[14],
            ];
            for (let i = 0; i < 3; i++) {
              if (p[i] < min[i]) min[i] = p[i];
              if (p[i] > max[i]) max[i] = p[i];
            }
          }
        }
      }
    }
    for (const child of node.children || []) visit(child, m, depth + 1);
  };

  const scene = gltf?.scenes?.[gltf.scene ?? 0];
  for (const root of scene?.nodes || []) visit(root, IDENTITY, 0);
  return Number.isFinite(min[0]) && Number.isFinite(max[0]) ? { min, max } : null;
}

// Scale + offset that shrink/grow the bounds' enclosing sphere to `radius` and
// move its centre onto the origin — so rotating the parent node turns the
// model about its middle and it never grows past the same size at any angle.
export function fitBounds(bounds, radius) {
  if (!bounds) return null;
  const { min, max } = bounds;
  const half = Math.hypot((max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2);
  if (!Number.isFinite(half) || half <= 0) return null;
  const scale = radius / half;
  return {
    scale,
    offset: [0, 1, 2].map((i) => -((min[i] + max[i]) / 2) * scale),
  };
}

async function fetchBytes(url, start, end, signal) {
  const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { whole: res.status === 200, bytes: new Uint8Array(await res.arrayBuffer()) };
}

async function loadBounds(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let { bytes } = await fetchBytes(url, 0, FIRST_RANGE - 1, controller.signal);
    const jsonLength = glbJsonLength(bytes);
    if (jsonLength == null) return null;
    const needed = GLB_HEADER + jsonLength;
    if (bytes.length < needed) {
      // The first range stopped inside the JSON chunk; fetch the rest of it.
      const rest = await fetchBytes(url, bytes.length, needed - 1, controller.signal);
      if (rest.whole) {
        bytes = rest.bytes;
      } else {
        const joined = new Uint8Array(bytes.length + rest.bytes.length);
        joined.set(bytes);
        joined.set(rest.bytes, bytes.length);
        bytes = joined;
      }
      if (bytes.length < needed) return null;
    }
    return modelBounds(JSON.parse(latin1(bytes.subarray(GLB_HEADER, needed))));
  } finally {
    clearTimeout(timer);
  }
}

// Bounds of the model at `url`, or null if they can't be read. Never rejects.
// Successes are cached for the session; a failure isn't, so reopening the
// viewer tries again.
export function fetchModelBounds(url) {
  if (!url) return Promise.resolve(null);
  if (!boundsCache.has(url)) {
    const pending = loadBounds(url).catch(() => null);
    boundsCache.set(url, pending);
    pending.then((bounds) => {
      if (!bounds) boundsCache.delete(url);
    });
  }
  return boundsCache.get(url);
}
