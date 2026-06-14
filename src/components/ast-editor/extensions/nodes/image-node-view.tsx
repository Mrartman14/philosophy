import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

import { resolveStorageUrl } from "../../upload/storage-url";

export function ImageNodeView({
  node,
  updateAttributes,
  editor,
  selected,
}: NodeViewProps) {
  const editable = editor.isEditable;
  const storageKey = (node.attrs.storage_key as string) ?? "";
  const alt = (node.attrs.alt as string) ?? "";
  const caption = (node.attrs.caption as string) ?? "";

  return (
    <NodeViewWrapper
      as="figure"
      data-ast-image=""
      data-selected={selected || undefined}
    >
      {storageKey ? (
        // next/image не подходит для editor NodeView: требует width/height
        // upfront, а размеры известны только после load; AST хранит лишь
        // storage_key. Нативный <img> здесь обоснован.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolveStorageUrl(storageKey)} alt={alt} />
      ) : (
        <div role="img" aria-label="Изображение загружается" />
      )}

      {editable && selected && (
        <div contentEditable={false} className="ast-image-fields">
          <label>
            <span>alt</span>
            <input
              type="text"
              value={alt}
              maxLength={1000}
              onChange={(e) => { updateAttributes({ alt: e.target.value }); }}
            />
          </label>
          <label>
            <span>caption</span>
            <input
              type="text"
              value={caption}
              maxLength={1000}
              onChange={(e) => { updateAttributes({ caption: e.target.value }); }}
            />
          </label>
        </div>
      )}

      {!editable && caption ? <figcaption>{caption}</figcaption> : null}
    </NodeViewWrapper>
  );
}
