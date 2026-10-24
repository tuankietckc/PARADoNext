/**
 * RichEditor — trình soạn thảo kiểu Notion dùng Tiptap.
 *
 * Tính năng:
 * - Checklist (check/uncheck)
 * - Bold, Italic, Strikethrough, Underline
 * - Headings H1 / H2 / H3
 * - Bullet list & Numbered list
 * - Code block & Inline code
 * - Highlight (màu nền)
 *
 * Dữ liệu lưu dưới dạng JSON string (editor.getJSON()) hoặc null nếu rỗng.
 */

import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Highlight } from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import { Underline } from '@tiptap/extension-underline'
import {
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  Highlighter,
  CheckSquare,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Code,
  CodeSquare,
  Undo2,
  Redo2,
  RemoveFormatting,
} from 'lucide-react'
import { cx } from './ui'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Chuỗi JSON → object Tiptap, hoặc null nếu không hợp lệ. */
function parseContent(value: string | null | undefined) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && parsed.type === 'doc') return parsed
  } catch {
    if (value.trim()) {
      return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }] }
    }
  }
  return null
}

function isEmpty(editor: Editor | null) {
  if (!editor) return true
  return editor.isEmpty
}

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

function ToolBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cx(
        'grid size-7 place-items-center rounded-md transition-colors',
        'disabled:pointer-events-none disabled:opacity-30',
        active
          ? 'bg-accent/15 text-accent'
          : 'text-subtle hover:bg-surface-2 hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-line" />
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1.5">
      <ToolBtn
        title="Hoàn tác (Ctrl+Z)"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 size={14} />
      </ToolBtn>
      <ToolBtn
        title="Làm lại (Ctrl+Y)"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 size={14} />
      </ToolBtn>

      <ToolbarDivider />

      <ToolBtn
        title="Tiêu đề 1"
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 size={14} />
      </ToolBtn>
      <ToolBtn
        title="Tiêu đề 2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={14} />
      </ToolBtn>
      <ToolBtn
        title="Tiêu đề 3"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={14} />
      </ToolBtn>

      <ToolbarDivider />

      <ToolBtn
        title="In đậm (Ctrl+B)"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={14} />
      </ToolBtn>
      <ToolBtn
        title="In nghiêng (Ctrl+I)"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={14} />
      </ToolBtn>
      <ToolBtn
        title="Gạch ngang (Ctrl+Shift+S)"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={14} />
      </ToolBtn>
      <ToolBtn
        title="Gạch chân (Ctrl+U)"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={14} />
      </ToolBtn>
      <ToolBtn
        title="Code nội dòng"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code size={14} />
      </ToolBtn>
      <ToolBtn
        title="Đánh dấu highlight"
        active={editor.isActive('highlight')}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        <Highlighter size={14} />
      </ToolBtn>

      <ToolbarDivider />

      <ToolBtn
        title="Danh sách bullet"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={14} />
      </ToolBtn>
      <ToolBtn
        title="Danh sách số"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={14} />
      </ToolBtn>
      <ToolBtn
        title="Checklist"
        active={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <CheckSquare size={14} />
      </ToolBtn>

      <ToolbarDivider />

      <ToolBtn
        title="Khối code"
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <CodeSquare size={14} />
      </ToolBtn>

      <ToolbarDivider />

      <ToolBtn
        title="Xoá định dạng"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        <RemoveFormatting size={14} />
      </ToolBtn>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface RichEditorProps {
  value: string | null | undefined
  onChange: (json: string | null) => void
  placeholder?: string
  minHeight?: number
  className?: string
}

export function RichEditor({
  value,
  onChange,
  placeholder = 'Bước đầu tiên là gì?…',
  minHeight = 120,
  className,
}: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: false }),
      TextStyle,
      Underline,
    ],
    content: parseContent(value) ?? undefined,
    editorProps: {
      attributes: {
        class: 'rich-editor-content outline-none',
        'data-placeholder': placeholder,
      },
    },
    onUpdate({ editor }) {
      onChange(isEmpty(editor) ? null : JSON.stringify(editor.getJSON()))
    },
  })

  return (
    <div
      className={cx(
        'overflow-hidden rounded-lg border border-line bg-surface transition-colors',
        'hover:border-line-strong',
        'focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--ring)]',
        className,
      )}
    >
      {editor && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        style={{ minHeight }}
        className="rich-editor-wrapper px-3 py-2"
      />
    </div>
  )
}

/** Hiển thị nội dung JSON của Tiptap dưới dạng read-only (không toolbar). */
export function RichContent({
  value,
  className,
}: {
  value: string | null | undefined
  className?: string
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      TextStyle,
      Underline,
    ],
    content: parseContent(value) ?? undefined,
    editable: false,
    editorProps: {
      attributes: { class: 'rich-editor-content outline-none' },
    },
  })

  if (!value) return null

  return (
    <EditorContent
      editor={editor}
      className={cx('rich-editor-wrapper', className)}
    />
  )
}
