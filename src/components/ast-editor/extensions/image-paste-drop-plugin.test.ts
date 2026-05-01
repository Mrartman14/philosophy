import { describe, it, expect, vi, beforeEach } from "vitest";
import { Editor, Extension } from "@tiptap/core";
import { buildExtensions } from "./index";
import { createImagePasteDropPlugin } from "./image-paste-drop-plugin";
import { makePngFile } from "../upload/__fixtures__/png-1x1";
import type { SchemaSnapshot } from "../types";

vi.mock("../upload/upload-image", () => ({
  uploadImage: vi.fn(async () => ({
    success: true,
    data: { storage_key: "abc-key", upload_id: "u-1" },
  })),
}));

import { uploadImage } from "../upload/upload-image";

const fullSnapshot: SchemaSnapshot = {
  blockLevels: { full: ["paragraph", "image"] },
  entityBlockLimits: { full: 100 },
  entityContexts: { document: "full" },
  limits: {
    maxDepth: 32,
    maxTextLen: 1_000_000,
    maxContentItems: 10_000,
    maxMarksPerNode: 100,
  },
  urlPolicy: { dangerousSchemes: [] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

const wrap = Extension.create({
  name: "wrap",
  addProseMirrorPlugins() {
    return [createImagePasteDropPlugin()];
  },
});

function makeEditor(): Editor {
  return new Editor({
    extensions: [
      ...buildExtensions({ snapshot: fullSnapshot, context: "document" }),
      wrap,
    ],
  });
}

// jsdom lacks DataTransfer/ClipboardEvent — minimal fake covering the
// surface our plugin reads (`.files` FileList-shaped, `.getData()` for the
// text fallback path). Patched onto a plain Event via defineProperty since
// ClipboardEvent ctor cannot accept clipboardData in jsdom.
function fakeFileList(files: File[]): FileList {
  const list: { [k: number]: File; length: number; item(i: number): File | null } = {
    length: files.length,
    item(i: number) {
      return files[i] ?? null;
    },
  };
  files.forEach((f, i) => {
    list[i] = f;
  });
  return list as unknown as FileList;
}

function fakeDataTransfer(files: File[], text = "") {
  return {
    files: fakeFileList(files),
    types: text ? ["text/plain"] : [],
    getData: (t: string) => (t === "text/plain" ? text : ""),
  };
}

function dispatchPaste(editor: Editor, files: File[]): boolean {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: fakeDataTransfer(files) });
  return editor.view.dom.dispatchEvent(event);
}

function dispatchDrop(editor: Editor, files: File[]): boolean {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: fakeDataTransfer(files) });
  Object.defineProperty(event, "clientX", { value: 0 });
  Object.defineProperty(event, "clientY", { value: 0 });
  return editor.view.dom.dispatchEvent(event);
}

describe("imagePasteDropPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom does not implement elementFromPoint; PM's posAtCoords falls back
    // gracefully when it returns null (our plugin then uses selection.from).
    if (!document.elementFromPoint) {
      (document as unknown as { elementFromPoint: () => null }).elementFromPoint = () => null;
    }
  });

  it("paste with image file → uploads and inserts image block", async () => {
    const editor = makeEditor();

    dispatchPaste(editor, [makePngFile()]);
    await new Promise((r) => setTimeout(r, 0));

    expect(uploadImage).toHaveBeenCalledOnce();
    const has = JSON.stringify(editor.getJSON()).includes('"image"');
    expect(has).toBe(true);
    editor.destroy();
  });

  it("drop with image file → uploads and inserts image block", async () => {
    const editor = makeEditor();

    dispatchDrop(editor, [makePngFile()]);
    await new Promise((r) => setTimeout(r, 0));

    expect(uploadImage).toHaveBeenCalledOnce();
    const has = JSON.stringify(editor.getJSON()).includes('"image"');
    expect(has).toBe(true);
    editor.destroy();
  });

  it("paste with non-image content → does nothing (lets PM handle text)", async () => {
    const editor = makeEditor();

    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: fakeDataTransfer([], "hello"),
    });
    editor.view.dom.dispatchEvent(event);

    await new Promise((r) => setTimeout(r, 0));
    expect(uploadImage).not.toHaveBeenCalled();
    editor.destroy();
  });

  it("upload failure → no image inserted", async () => {
    (uploadImage as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: false,
      error: "boom",
    });
    const editor = makeEditor();

    dispatchPaste(editor, [makePngFile()]);
    await new Promise((r) => setTimeout(r, 0));

    const has = JSON.stringify(editor.getJSON()).includes('"image"');
    expect(has).toBe(false);
    editor.destroy();
  });
});
