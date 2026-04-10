import { MarkdownEditor } from "@/components/markdown-editor/markdown-editor";

export default function EditorDevPage() {
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-xl font-bold mb-4">Markdown Editor Dev</h1>
      <MarkdownEditor
        defaultValue={"# Hello\n\nThis is **bold** and *italic*.\n\n- list item\n- another item"}
        placeholder="Начните писать..."
        name="content"
      />
    </div>
  );
}
