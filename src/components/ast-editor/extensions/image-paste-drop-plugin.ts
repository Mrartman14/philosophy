import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

import { log } from "@/services/observability/client";

import { uploadImage } from "../upload/upload-image";

export const imagePasteDropPluginKey = new PluginKey("ast-editor-image-paste-drop");

/**
 * Captures pasted/dropped image files, uploads them, and inserts an `image`
 * block at the drop / paste position. Async upload — we do NOT insert a
 * placeholder; user sees the result when the response comes back. Failures
 * are logged via log.warn (no UI toast in MVP).
 *
 * Plugin is wired conditionally — only when `image` is in the allowed-block
 * set for the current entityContext (see extensions/index.ts).
 */
export function createImagePasteDropPlugin() {
  return new Plugin({
    key: imagePasteDropPluginKey,
    props: {
      handleDrop(view, event) {
        const dt = (event).dataTransfer;
        const files = collectImageFiles(dt?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        const drag = event;
        const pos =
          view.posAtCoords({ left: drag.clientX, top: drag.clientY })?.pos ??
          view.state.selection.from;
        for (const file of files) void insertUploaded(view, file, pos);
        return true;
      },
      handlePaste(view, event) {
        const cd = (event).clipboardData;
        const files = collectImageFiles(cd?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        const pos = view.state.selection.from;
        for (const file of files) void insertUploaded(view, file, pos);
        return true;
      },
    },
  });
}

function collectImageFiles(list: FileList | undefined | null): File[] {
  if (!list || list.length === 0) return [];
  const out: File[] = [];
  for (let i = 0; i < list.length; i++) {
    const f = list.item(i);
    if (f?.type.startsWith("image/")) out.push(f);
  }
  return out;
}

async function insertUploaded(view: EditorView, file: File, pos: number) {
  const fd = new FormData();
  fd.set("file", file);
  const res = await uploadImage(fd);
  if (!res.success) {
    log.warn("[ast-editor] image upload failed", { error: res.error });
    return;
  }
  const imageType = view.state.schema.nodes.image;
  if (!imageType) return;
  const node = imageType.create({
    storage_key: res.data.storage_key,
    alt: "",
    caption: "",
    blockId: "",
  });
  const safePos = Math.min(Math.max(pos, 0), view.state.doc.content.size);
  const tr = view.state.tr.insert(safePos, node);
  view.dispatch(tr);
}
