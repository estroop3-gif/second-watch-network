import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Strikethrough, List, ListOrdered,
  Link as LinkIcon, ImageIcon, Undo, Redo, Loader2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUploadEmailAttachment } from '@/hooks/crm/useEmail';
import { api } from '@/lib/api';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  compact?: boolean;
}

const ToolbarButton = ({
  onClick, active, disabled, children, title,
}: {
  onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode; title: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-1.5 rounded transition-colors ${
      disabled
        ? 'text-muted-gray/40 cursor-not-allowed'
        : active
          ? 'bg-accent-yellow/20 text-accent-yellow'
          : 'text-muted-gray hover:text-bone-white hover:bg-muted-gray/20'
    }`}
  >
    {children}
  </button>
);

const RichTextEditor = ({
  content, onChange, placeholder, minHeight = '200px', compact,
}: RichTextEditorProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const uploadAttachment = useUploadEmailAttachment();
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        blockquote: false,
        link: false, // Disable StarterKit's built-in Link; we configure it separately below
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-accent-yellow underline' },
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: { class: 'max-w-full rounded', style: 'max-height: 400px;' },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Compose your email...',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none text-bone-white [&_p]:mb-4 [&_p:last-child]:mb-0 [&_img]:max-w-full [&_img]:rounded',
        style: `min-height: ${compact ? '100px' : minHeight}`,
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) handleImageUpload(file);
            return true;
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        for (const file of Array.from(files)) {
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            handleImageUpload(file);
            return true;
          }
        }
        return false;
      },
    },
  });

  // Sync external content changes (template selection)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be under 10 MB');
      return;
    }

    setUploading(true);
    try {
      const attachment = await uploadAttachment.mutateAsync(file);
      // Use absolute API URL so images work in both dev and production
      const baseUrl = api.getBaseUrl();
      const imageUrl = `${baseUrl}/api/v1/crm/email/inline-image/${attachment.id}`;
      editor.chain().focus().setImage({ src: imageUrl, alt: file.name }).run();
    } catch {
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [editor, uploadAttachment]);

  const handleImageButtonClick = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleImageInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    // Reset input so the same file can be selected again
    if (imageInputRef.current) imageInputRef.current.value = '';
  }, [handleImageUpload]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div className="border border-muted-gray/50 rounded-lg overflow-hidden bg-charcoal-black">
      {/* Hidden file input for image upload */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageInputChange}
        className="hidden"
      />

      {/* Toolbar */}
      <div className={`flex items-center gap-0.5 border-b border-muted-gray/30 bg-muted-gray/5 ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className={iconSize} />
        </ToolbarButton>

        <div className="w-px h-4 bg-muted-gray/30 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Ordered List"
        >
          <ListOrdered className={iconSize} />
        </ToolbarButton>

        <div className="w-px h-4 bg-muted-gray/30 mx-1" />

        <ToolbarButton
          onClick={setLink}
          active={editor.isActive('link')}
          title="Link"
        >
          <LinkIcon className={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleImageButtonClick}
          disabled={uploading}
          title="Insert Image"
        >
          {uploading ? <Loader2 className={`${iconSize} animate-spin`} /> : <ImageIcon className={iconSize} />}
        </ToolbarButton>

        <div className="flex-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
        >
          <Undo className={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
        >
          <Redo className={iconSize} />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div className={compact ? 'px-3 py-2' : 'px-4 py-3'}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default RichTextEditor;
