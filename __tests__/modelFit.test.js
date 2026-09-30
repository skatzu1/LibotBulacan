import { glbJsonLength, modelBounds, fitBounds, fetchModelBounds } from "../utils/modelFit";

// A minimal .glb: 12-byte header, then the JSON chunk (space-padded to 4 bytes).
// No BIN chunk — the bounds come from accessor min/max, which is all the fit reads.
function makeGlb(gltf) {
  let json = JSON.stringify(gltf);
  while (json.length % 4) json += " ";
  const bytes = new Uint8Array(20 + json.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.length, true);
  view.setUint32(12, json.length, true);
  view.setUint32(16, 0x4e4f534a, true);   // "JSON"
  for (let i = 0; i < json.length; i++) bytes[20 + i] = json.charCodeAt(i);
  return bytes;
}

// One unit cube's worth of positions, [-1,1] on every axis, as mesh 0.
const cube = (nodes, scene = [0], extra = {}) => ({
  asset: { version: "2.0" },
  scene: 0,
  scenes: [{ nodes: scene }],
  nodes,
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  accessors: [{ min: [-1, -1, -1], max: [1, 1, 1], count: 8, type: "VEC3", componentType: 5126 }],
  ...extra,
});

const close = (actual, expected) =>
  expected.forEach((v, i) => expect(actual[i]).toBeCloseTo(v, 6));

describe("glbJsonLength", () => {
  it("reads the JSON chunk length from a GLB header", () => {
    const glb = makeGlb({ asset: { version: "2.0" } });
    expect(glbJsonLength(glb)).toBe(glb.length - 20);
  });

  it("rejects anything that isn't a GLB (e.g. an HTML error page)", () => {
    const html = new Uint8Array([...'<!DOCTYPE html><html>'].map((c) => c.charCodeAt(0)));
    expect(glbJsonLength(html)).toBeNull();
    expect(glbJsonLength(new Uint8Array(4))).toBeNull();
  });
});

describe("modelBounds", () => {
  it("applies translation and scale", () => {
    const b = modelBounds(cube([{ mesh: 0, translation: [10, 5, 0], scale: [2, 3, 4] }]));
    close(b.min, [8, 2, -4]);
    close(b.max, [12, 8, 4]);
  });

  it("composes a parent matrix with a child's TRS (a SimLab-style root)", () => {
    const parentScale10 = [10, 0, 0, 0, 0, 10, 0, 0, 0, 0, 10, 0, 0, 0, 0, 1];
    const b = modelBounds(cube([{ matrix: parentScale10, children: [1] }, { mesh: 0, translation: [1, 0, 0] }]));
    close(b.min, [0, -10, -10]);
    close(b.max, [20, 10, 10]);
  });

  it("covers a node rotated 90° about Y (x and z extents swap)", () => {
    const s = Math.SQRT1_2;
    const b = modelBounds(cube([{ mesh: 0, scale: [5, 1, 1], rotation: [0, s, 0, s] }]));
    close(b.min, [-1, -1, -5]);
    close(b.max, [1, 1, 5]);
  });

  it("measures an EXT_mesh_gpu_instancing node once, the way Viro draws it", () => {
    const b = modelBounds(cube([{ mesh: 0, extensions: { EXT_mesh_gpu_instancing: { attributes: { TRANSLATION: 1 } } } }]));
    close(b.min, [-1, -1, -1]);
    close(b.max, [1, 1, 1]);
  });

  it("returns null when the scene has no measurable mesh", () => {
    expect(modelBounds(cube([{ name: "empty" }]))).toBeNull();
    expect(modelBounds({})).toBeNull();
  });
});

describe("fitBounds", () => {
  it("gives a small model and a 10x larger copy the same on-screen size and centre", () => {
    const small = fitBounds({ min: [0, 0, 0], max: [24, 10, 24] }, 4.6);
    const big   = fitBounds({ min: [0, 0, 0], max: [240, 100, 240] }, 4.6);
    expect(small.scale).toBeCloseTo(big.scale * 10, 6);
    close(small.offset, big.offset);
  });

  it("scales the enclosing sphere to the radius and moves the centre onto the pivot", () => {
    const { scale, offset } = fitBounds({ min: [0, 0, 0], max: [24, 10, 24] }, 4.6);
    expect(scale).toBeCloseTo(4.6 / Math.hypot(12, 5, 12), 6);
    close(offset, [-12 * scale, -5 * scale, -12 * scale]);
  });

  it("refuses empty or degenerate bounds", () => {
    expect(fitBounds(null, 4.6)).toBeNull();
    expect(fitBounds({ min: [1, 1, 1], max: [1, 1, 1] }, 4.6)).toBeNull();
  });
});

describe("fetchModelBounds", () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  // Serves `file` the way Cloudinary does: 206 + the requested slice.
  const rangeServer = (file, { honourRange = true, status = 200 } = {}) =>
    jest.fn(async (_url, { headers }) => {
      if (status !== 200) return { ok: false, status, arrayBuffer: async () => new ArrayBuffer(0) };
      const [, start, end] = headers.Range.match(/bytes=(\d+)-(\d+)/).map(Number);
      const body = honourRange ? file.slice(start, end + 1) : file;
      return { ok: true, status: honourRange ? 206 : 200, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) };
    });

  it("reads the bounds from the first range request", async () => {
    global.fetch = rangeServer(makeGlb(cube([{ mesh: 0, scale: [3, 3, 3] }])));
    const b = await fetchModelBounds("https://cdn.test/a.glb");
    close(b.max, [3, 3, 3]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][1].headers.Range).toBe("bytes=0-32767");
  });

  it("fetches the rest of a JSON chunk longer than the first range (Barasoain's is ~90 KB)", async () => {
    const glb = makeGlb(cube([{ mesh: 0 }], [0], { extras: { pad: "x".repeat(90 * 1024) } }));
    global.fetch = rangeServer(glb);
    const b = await fetchModelBounds("https://cdn.test/long.glb");
    close(b.max, [1, 1, 1]);
    expect(global.fetch.mock.calls[1][1].headers.Range).toBe(`bytes=32768-${glb.length - 1}`);
  });

  it("copes with a server that ignores Range and sends the whole file", async () => {
    global.fetch = rangeServer(makeGlb(cube([{ mesh: 0 }])), { honourRange: false });
    expect(await fetchModelBounds("https://cdn.test/whole.glb")).not.toBeNull();
  });

  it("caches a success per URL", async () => {
    global.fetch = rangeServer(makeGlb(cube([{ mesh: 0 }])));
    await fetchModelBounds("https://cdn.test/cached.glb");
    await fetchModelBounds("https://cdn.test/cached.glb");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("resolves null on a 404 and tries again next time instead of caching the failure", async () => {
    global.fetch = rangeServer(null, { status: 404 });
    expect(await fetchModelBounds("https://cdn.test/gone.glb")).toBeNull();
    expect(await fetchModelBounds("https://cdn.test/gone.glb")).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("resolves null for a missing URL without fetching", async () => {
    global.fetch = jest.fn();
    expect(await fetchModelBounds("")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
