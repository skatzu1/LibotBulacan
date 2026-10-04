import { useCallback, useEffect, useState } from "react";
import { File, Directory, Paths } from "expo-file-system";

/*
 * 3D models, downloaded once and kept on the phone.
 *
 * Viro downloaded a spot's model again every time its viewer or the AR screen
 * opened. The live models are 0.3–5.9 MB each (49 MB for all 27, measured
 * 2026-10-04) — on mobile data, at a rural spot, that is the slowest thing
 * the app does, and it was repeated for nothing. Now each model is saved in
 * the app's cache folder the first time and Viro reads the local file.
 *
 * A model URL never changes content: Cloudinary puts the upload version in
 * it, so a replaced model is a new URL and a new file. The cache folder is the
 * system's to clear when storage runs low; a missing file is downloaded again.
 *
 * Anything going wrong falls back to what happened before — Viro loading the
 * URL itself: a failed download hands back the URL, and a local copy Viro
 * can't read is deleted and swapped for the URL (onLocalError).
 */

const folder = () => new Directory(Paths.cache, "models");

// The URL, made into a file name: unique per model and version, readable.
export const fileNameFor = (url) =>
  `${String(url).replace(/^https?:\/\//, "").replace(/[^A-Za-z0-9]+/g, "_").slice(-150)}.glb`;

/** The local copy's file:// URI, or null when there isn't a complete one. */
export function cachedModelUri(url) {
  if (!url) return null;
  try {
    const file = new File(folder(), fileNameFor(url));
    return file.exists && file.size > 0 ? file.uri : null;
  } catch {
    return null;
  }
}

const downloads = new Map(); // url -> Promise<file uri>, so two screens share one download

/** Downloads the model (once, however many ask) and resolves its local URI. */
export function downloadModel(url) {
  if (downloads.has(url)) return downloads.get(url);
  const job = (async () => {
    const dir = folder();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    // Into a side file first: on Android a failed download can leave a
    // partial file behind, and a partial .glb must never look complete.
    const part = new File(dir, `${fileNameFor(url)}.part`);
    if (part.exists) part.delete();
    await File.downloadFileAsync(url, part, { idempotent: true });
    const done = new File(dir, fileNameFor(url));
    if (done.exists) done.delete();
    part.move(done);
    return done.uri;
  })().finally(() => downloads.delete(url));
  downloads.set(url, job);
  return job;
}

/** Deletes the local copy (Viro couldn't read it). */
export function forgetModel(url) {
  try {
    const file = new File(folder(), fileNameFor(url));
    if (file.exists) file.delete();
  } catch {}
}

/**
 * What to hand Viro for `url`: { uri, onLocalError }.
 *   uri — the local file once it's there; the URL itself if the download
 *         failed; null while downloading (render nothing yet, or Viro starts
 *         a second download of its own).
 *   onLocalError() — call from Viro's onError. If it was the local copy that
 *         failed, deletes it, switches to the URL and returns true; returns
 *         false when the URL itself failed (a real error to show).
 */
export function useCachedModel(url) {
  const [state, setState] = useState(() => ({ url, uri: cachedModelUri(url) }));
  // A new url: start from its cached copy, if any, in the same render.
  const current = state.url === url ? state : { url, uri: cachedModelUri(url) };

  useEffect(() => {
    if (!url) return undefined;
    let live = true;
    const hit = cachedModelUri(url);
    if (hit) {
      setState({ url, uri: hit });
      return undefined;
    }
    setState({ url, uri: null });
    downloadModel(url)
      .then((uri) => { if (live) setState({ url, uri }); })
      .catch((e) => {
        console.warn("[Model] Download failed, Viro will load it directly:", e?.message);
        if (live) setState({ url, uri: url });
      });
    return () => { live = false; };
  }, [url]);

  const onLocalError = useCallback(() => {
    if (!url || !current.uri || current.uri === url) return false;
    console.warn("[Model] Local copy unreadable, using the network:", url);
    forgetModel(url);
    setState({ url, uri: url });
    return true;
  }, [url, current.uri]);

  return { uri: url ? current.uri : null, onLocalError };
}
