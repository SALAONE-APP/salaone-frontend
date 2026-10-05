import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Underline,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "./doc-content.css";

interface Props {
  initialContent: string;
  onChange: (html: string) => void;
}

function ToolButton({ icon: Icon, label, active, disabled, onClick }: { icon: LucideIcon; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn("h-8 w-8", active && "bg-primary/10 text-primary")}
    >
      <Icon size={15} />
    </Button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" />;
}

function setLink(editor: Editor) {
  const previous = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("Endereço do link (deixe vazio para remover):", previous ?? "https://");
  if (url === null) return;
  if (url.trim() === "" || url.trim() === "https://") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
}

function Toolbar({ editor }: { editor: Editor }) {
  // Reage so ao que a barra mostra (negrito ativo, dentro de tabela...), nao a cada tecla.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      code: e.isActive("codeBlock"),
      link: e.isActive("link"),
      inTable: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const run = () => editor.chain().focus();

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-border bg-card px-2 py-1.5">
      <ToolButton icon={Undo2} label="Desfazer" disabled={!state.canUndo} onClick={() => run().undo().run()} />
      <ToolButton icon={Redo2} label="Refazer" disabled={!state.canRedo} onClick={() => run().redo().run()} />
      <Divider />
      <ToolButton icon={Heading1} label="Título 1" active={state.h1} onClick={() => run().toggleHeading({ level: 1 }).run()} />
      <ToolButton icon={Heading2} label="Título 2" active={state.h2} onClick={() => run().toggleHeading({ level: 2 }).run()} />
      <ToolButton icon={Heading3} label="Título 3" active={state.h3} onClick={() => run().toggleHeading({ level: 3 }).run()} />
      <Divider />
      <ToolButton icon={Bold} label="Negrito" active={state.bold} onClick={() => run().toggleBold().run()} />
      <ToolButton icon={Italic} label="Itálico" active={state.italic} onClick={() => run().toggleItalic().run()} />
      <ToolButton icon={Underline} label="Sublinhado" active={state.underline} onClick={() => run().toggleUnderline().run()} />
      <ToolButton icon={Strikethrough} label="Tachado" active={state.strike} onClick={() => run().toggleStrike().run()} />
      <ToolButton icon={Link2} label="Link" active={state.link} onClick={() => setLink(editor)} />
      <Divider />
      <ToolButton icon={List} label="Lista com marcadores" active={state.bullet} onClick={() => run().toggleBulletList().run()} />
      <ToolButton icon={ListOrdered} label="Lista numerada" active={state.ordered} onClick={() => run().toggleOrderedList().run()} />
      <ToolButton icon={ListChecks} label="Checklist" active={state.task} onClick={() => run().toggleTaskList().run()} />
      <ToolButton icon={Quote} label="Citação" active={state.quote} onClick={() => run().toggleBlockquote().run()} />
      <ToolButton icon={Code} label="Bloco de código" active={state.code} onClick={() => run().toggleCodeBlock().run()} />
      <ToolButton icon={Minus} label="Linha divisória" onClick={() => run().setHorizontalRule().run()} />
      <Divider />
      <ToolButton
        icon={TableIcon}
        label="Inserir tabela"
        disabled={state.inTable}
        onClick={() => run().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      />
      {state.inTable && (
        <>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => run().addRowAfter().run()}>
            + Linha
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => run().addColumnAfter().run()}>
            + Coluna
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => run().deleteRow().run()}>
            − Linha
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => run().deleteColumn().run()}>
            − Coluna
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs text-destructive" onClick={() => run().deleteTable().run()}>
            Excluir tabela
          </Button>
        </>
      )}
    </div>
  );
}

export function SalesDocEditor({ initialContent, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      // O StarterKit v3 ja traz link e sublinhado.
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true } }),
      Placeholder.configure({ placeholder: "Escreva o processo aqui…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table,
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialContent,
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-border bg-card">
      <Toolbar editor={editor} />
      <div className="doc-content px-5 py-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
