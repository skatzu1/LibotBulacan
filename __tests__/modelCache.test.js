import React from "react";
import { act, render } from "@testing-library/react-native";

// utils/modelCache.js against a fake expo-file-system: an in-memory folder,
// and a download that a test can hold open, fail, or let finish.

const mockFiles = new Map(); // uri -> size
let mockDownload; // (url, dest) => Promise; the test sets it

jest.mock("expo-file-system", () => {
  const join = (parent, name) => `${parent.uri.replace(/\/$/, "")}/${name}`;
  class Directory {
    constructor(parent, name) { this.uri = parent.uri ? join(parent, name) : `${parent}/${name}`; }
    get exists() { return mockFiles.has(`${this.uri}/`); }
    create() { mockFiles.set(`${this.uri}/`, 0); }
  }
  class File {
    constructor(dir, name) { this.uri = join(dir, name); }
    get exists() { return mockFiles.has(this.uri); }
    get size() { return mockFiles.get(this.uri) ?? 0; }
    delete() { mockFiles.delete(this.uri); }
    move(dest) { mockFiles.set(dest.uri, mockFiles.get(this.uri)); mockFiles.delete(this.uri); this.uri = dest.uri; }
    static downloadFileAsync(url, dest) { return mockDownload(url, dest); }
  }
  return { File, Directory, Paths: { cache: { uri: "file:///cache" } } };
});

const { useCachedModel, cachedModelUri, fileNameFor } = require("../utils/modelCache");

const URL_A = "https://res.cloudinary.com/x/raw/upload/v1/spot_models/abc.glb";
const LOCAL_A = `file:///cache/models/${fileNameFor(URL_A)}`;

let hook;
const Probe = ({ url }) => { hook = useCachedModel(url); return null; };
const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => {}); };

const finishes = (size = 1234) => jest.fn(async (_url, dest) => { mockFiles.set(dest.uri, size); });

beforeEach(() => {
  mockFiles.clear();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it("downloads a model once, then hands Viro the local file", async () => {
  mockDownload = finishes();
  render(<Probe url={URL_A} />);
  expect(hook.uri).toBeNull(); // nothing for Viro yet — it would start its own download
  await settle();
  expect(hook.uri).toBe(LOCAL_A);
  expect(mockDownload).toHaveBeenCalledTimes(1);
  expect(mockFiles.has(`${LOCAL_A}.part`)).toBe(false); // the side file was moved into place

  // Opening it again uses the file straight away, without a download.
  mockDownload = jest.fn();
  render(<Probe url={URL_A} />);
  expect(hook.uri).toBe(LOCAL_A);
  await settle();
  expect(mockDownload).not.toHaveBeenCalled();
});

it("two screens asking at once share one download", async () => {
  mockDownload = finishes();
  const uris = [];
  const Two = () => {
    uris[0] = useCachedModel(URL_A).uri;
    uris[1] = useCachedModel(URL_A).uri;
    return null;
  };
  render(<Two />);
  await settle();
  expect(uris).toEqual([LOCAL_A, LOCAL_A]);
  expect(mockDownload).toHaveBeenCalledTimes(1);
});

it("a failed download falls back to the URL, and leaves no partial file", async () => {
  mockDownload = jest.fn(async (_url, dest) => {
    mockFiles.set(dest.uri, 99); // Android can leave part of the body behind
    throw new Error("UnableToDownload 503");
  });
  render(<Probe url={URL_A} />);
  await settle();
  expect(hook.uri).toBe(URL_A);
  expect(cachedModelUri(URL_A)).toBeNull();
});

it("a local copy Viro can't read is deleted and swapped for the URL", async () => {
  mockFiles.set("file:///cache/models/", 0);
  mockFiles.set(LOCAL_A, 500);
  render(<Probe url={URL_A} />);
  expect(hook.uri).toBe(LOCAL_A);

  let handled;
  await act(async () => { handled = hook.onLocalError(); });
  expect(handled).toBe(true);
  expect(hook.uri).toBe(URL_A);
  expect(mockFiles.has(LOCAL_A)).toBe(false);

  // The URL failing too is a real error for the screen to show.
  await act(async () => { handled = hook.onLocalError(); });
  expect(handled).toBe(false);
});

it("an empty file never counts as cached", () => {
  mockFiles.set(LOCAL_A, 0);
  expect(cachedModelUri(URL_A)).toBeNull();
});

it("no URL, no model", async () => {
  mockDownload = jest.fn();
  render(<Probe url={undefined} />);
  await settle();
  expect(hook.uri).toBeNull();
  expect(mockDownload).not.toHaveBeenCalled();
});
