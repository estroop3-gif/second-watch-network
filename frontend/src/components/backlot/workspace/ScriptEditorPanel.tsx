/**
 * ScriptEditorPanel - Celtx-style screenplay editor with revision workflow
 *
 * Features:
 * - Celtx-style formatting with element detection
 * - Smart auto-formatting (Tab/Enter to cycle through elements)
 * - Industry-standard color-coded revisions
 * - Create new revision versions
 * - Lock/unlock versions
 * - Track changes between versions
 * - Dual-column dialogue formatting
 */
import React, { useState, useEffect, useCallback, useRef, useMemo, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Edit,
  Save,
  Lock,
  Unlock,
  GitBranch,
  History,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Type,
  AlignCenter,
  AlignLeft,
  MessageSquare,
  Clapperboard,
  Users,
  ArrowRight,
  Parentheses,
  Maximize2,
  Minimize2,
  FileStack,
  AlignJustify,
} from 'lucide-react';
import ScriptPageView from './ScriptPageView';
import {
  useScript,
  useUpdateScriptText,
  useCreateScriptVersion,
  useLockScriptVersion,
  useExtractScriptText,
} from '@/hooks/backlot';
import {
  BacklotScript,
  BacklotScriptVersion,
  BacklotScriptColorCode,
  SCRIPT_COLOR_CODE_HEX,
  SCRIPT_COLOR_CODE_LABELS,
} from '@/types/backlot';

// Extended script type that includes versioning fields (what the API actually returns)
type ScriptWithVersioning = BacklotScript & Partial<BacklotScriptVersion>;
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// SCREENPLAY ELEMENT TYPES
// ============================================================================

type ScriptElementType =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'shot'
  | 'general';

interface ScriptElement {
  type: ScriptElementType;
  content: string;
  lineIndex: number;
}

// Element detection patterns
const ELEMENT_PATTERNS = {
  scene_heading: /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)[\s\S]*/i,
  transition: /^(FADE IN:|FADE OUT:|FADE TO:|CUT TO:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|JUMP CUT TO:|TIME CUT:|IRIS IN:|IRIS OUT:|WIPE TO:)[\s\S]*/i,
  shot: /^(CLOSE ON|ANGLE ON|POV|INSERT|FLASHBACK|FLASH FORWARD|BACK TO SCENE|CONTINUOUS|LATER|MOMENTS LATER|SAME TIME|INTERCUT)[\s\S]*/i,
  character: /^[A-Z][A-Z0-9\s\-'\.]+(\s*\(V\.O\.\)|\s*\(O\.S\.\)|\s*\(O\.C\.\)|\s*\(CONT'D\)|\s*\(CONTINUING\))?\s*$/,
  parenthetical: /^\([\s\S]*\)$/,
};

// Element styling
const ELEMENT_STYLES: Record<ScriptElementType, React.CSSProperties> = {
  scene_heading: {
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: '24px',
    marginBottom: '12px',
  },
  action: {
    marginBottom: '12px',
  },
  character: {
    textTransform: 'uppercase',
    marginLeft: '35%',
    marginTop: '12px',
    marginBottom: '0',
  },
  dialogue: {
    marginLeft: '15%',
    marginRight: '15%',
    marginBottom: '0',
  },
  parenthetical: {
    marginLeft: '25%',
    marginRight: '25%',
    fontStyle: 'italic',
  },
  transition: {
    textAlign: 'right',
    textTransform: 'uppercase',
    marginTop: '12px',
    marginBottom: '12px',
  },
  shot: {
    textTransform: 'uppercase',
    marginTop: '12px',
    marginBottom: '12px',
  },
  general: {
    marginBottom: '12px',
  },
};

// Element info for toolbar
const ELEMENT_INFO: Record<ScriptElementType, { label: string; shortcut: string; icon: any }> = {
  scene_heading: { label: 'Scene Heading', shortcut: 'Ctrl+1', icon: Clapperboard },
  action: { label: 'Action', shortcut: 'Ctrl+2', icon: AlignLeft },
  character: { label: 'Character', shortcut: 'Ctrl+3', icon: Users },
  dialogue: { label: 'Dialogue', shortcut: 'Ctrl+4', icon: MessageSquare },
  parenthetical: { label: 'Parenthetical', shortcut: 'Ctrl+5', icon: Parentheses },
  transition: { label: 'Transition', shortcut: 'Ctrl+6', icon: ArrowRight },
  shot: { label: 'Shot', shortcut: 'Ctrl+7', icon: Type },
  general: { label: 'General', shortcut: 'Ctrl+0', icon: AlignLeft },
};

// Element cycle order (Tab to advance)
const ELEMENT_CYCLE: ScriptElementType[] = [
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'action',
];

// Detect element type from content
function detectElementType(line: string, prevLine?: string, prevType?: ScriptElementType): ScriptElementType {
  const trimmed = line.trim();

  if (!trimmed) return 'general';

  // Check for scene heading
  if (ELEMENT_PATTERNS.scene_heading.test(trimmed)) {
    return 'scene_heading';
  }

  // Check for transition
  if (ELEMENT_PATTERNS.transition.test(trimmed)) {
    return 'transition';
  }

  // Check for shot
  if (ELEMENT_PATTERNS.shot.test(trimmed)) {
    return 'shot';
  }

  // Check for parenthetical (must be after character or dialogue)
  if (ELEMENT_PATTERNS.parenthetical.test(trimmed) &&
      (prevType === 'character' || prevType === 'dialogue')) {
    return 'parenthetical';
  }

  // Check for character (all caps, possibly with extensions)
  if (ELEMENT_PATTERNS.character.test(trimmed) && trimmed.length < 50) {
    return 'character';
  }

  // Check for dialogue (after character or parenthetical)
  if (prevType === 'character' || prevType === 'parenthetical') {
    return 'dialogue';
  }

  // Default to action
  return 'action';
}

// Parse script into elements
function parseScriptElements(content: string): ScriptElement[] {
  const lines = content.split('\n');
  const elements: ScriptElement[] = [];

  let prevType: ScriptElementType | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = i > 0 ? lines[i - 1] : undefined;
    const type = detectElementType(line, prevLine, prevType);

    elements.push({
      type,
      content: line,
      lineIndex: i,
    });

    prevType = type;
  }

  return elements;
}

interface ScriptEditorPanelProps {
  script: ScriptWithVersioning;
  canEdit: boolean;
  onBack?: () => void;
  onVersionCreated?: (newScript: BacklotScript) => void;
  onScriptUpdated?: () => void;
}

// Industry-standard revision colors
const REVISION_COLORS: BacklotScriptColorCode[] = [
  'white',    // First draft
  'blue',     // First revision
  'pink',     // Second revision
  'yellow',   // Third revision
  'green',    // Fourth revision
  'goldenrod', // Fifth revision
  'buff',     // Sixth revision
  'salmon',   // Seventh revision
  'cherry',   // Eighth revision
  'tan',      // Ninth revision
  'gray',     // Tenth revision
  'ivory',    // Eleventh revision
];

const ScriptEditorPanel: React.FC<ScriptEditorPanelProps> = ({
  script,
  canEdit,
  onBack,
  onVersionCreated,
  onScriptUpdated,
}) => {
  const { toast } = useToast();
  const { data: currentScript, refetch } = useScript(script.id);
  const updateScriptText = useUpdateScriptText();
  const createVersion = useCreateScriptVersion();
  const lockVersion = useLockScriptVersion();
  const extractText = useExtractScriptText();

  // Editor refs
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Editor state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [currentElementType, setCurrentElementType] = useState<ScriptElementType>('action');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFormatted, setShowFormatted] = useState(true);
  const [viewMode, setViewMode] = useState<'page' | 'inline'>('page'); // Default to page view

  // New version modal
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [newVersionColor, setNewVersionColor] = useState<BacklotScriptColorCode>('blue');
  const [revisionNotes, setRevisionNotes] = useState('');

  // Use current script data or fallback to prop, with defaults for versioning fields
  const activeScript: ScriptWithVersioning = {
    ...script,
    ...(currentScript || {}),
    color_code: currentScript?.color_code || script.color_code || 'white',
    is_locked: currentScript?.is_locked ?? script.is_locked ?? false,
    text_content: currentScript?.text_content || script.text_content || null,
    version_number: currentScript?.version_number || script.version_number || 1,
    revision_notes: currentScript?.revision_notes || script.revision_notes || null,
  };

  // Parse script elements for formatted view
  const scriptElements = useMemo(() => {
    return parseScriptElements(editContent || activeScript?.text_content || '');
  }, [editContent, activeScript?.text_content]);

  // Initialize content when script loads or changes
  useEffect(() => {
    if (activeScript?.text_content) {
      setEditContent(activeScript.text_content);
    }
  }, [activeScript?.text_content]);

  // Track changes
  useEffect(() => {
    if (isEditing) {
      setHasUnsavedChanges(editContent !== (activeScript?.text_content || ''));
    }
  }, [editContent, activeScript?.text_content, isEditing]);

  const handleStartEditing = useCallback(() => {
    if (!canEdit || activeScript?.is_locked) return;
    setEditContent(activeScript?.text_content || '');
    setIsEditing(true);
  }, [canEdit, activeScript]);

  const handleCancelEdit = useCallback(() => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Discard them?')) {
        return;
      }
    }
    setEditContent(activeScript?.text_content || '');
    setIsEditing(false);
    setHasUnsavedChanges(false);
  }, [hasUnsavedChanges, activeScript]);

  const handleSave = useCallback(async () => {
    try {
      // Always create a new revision when saving, with the next color in sequence
      const nextColor = getNextColor();
      const result = await updateScriptText.mutateAsync({
        scriptId: activeScript.id,
        textContent: editContent,
        createNewVersion: true,
        colorCode: nextColor,
        revisionNotes: `Edited from ${SCRIPT_COLOR_CODE_LABELS[(activeScript.color_code || 'white') as BacklotScriptColorCode]} revision`,
      });
      setIsEditing(false);
      setHasUnsavedChanges(false);
      await refetch();
      // Notify parent to refresh script data and switch to new version
      onScriptUpdated?.();
      if (result?.script && onVersionCreated) {
        onVersionCreated(result.script);
      }
      toast({
        title: 'New Revision Created',
        description: `${SCRIPT_COLOR_CODE_LABELS[nextColor]} revision created with all highlights preserved.`,
      });
    } catch (error: any) {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save script',
        variant: 'destructive',
      });
    }
  }, [activeScript, editContent, updateScriptText, refetch, toast, onScriptUpdated, onVersionCreated, getNextColor]);

  const handleCreateNewVersion = useCallback(async () => {
    try {
      const result = await createVersion.mutateAsync({
        scriptId: activeScript.id,
        color_code: newVersionColor,
        revision_notes: revisionNotes || undefined,
      });
      setShowNewVersionModal(false);
      setRevisionNotes('');
      toast({
        title: 'New Version Created',
        description: `${SCRIPT_COLOR_CODE_LABELS[newVersionColor]} revision has been created.`,
      });
      if (onVersionCreated && result) {
        onVersionCreated(result);
      }
      await refetch();
    } catch (error: any) {
      toast({
        title: 'Version Creation Failed',
        description: error.message || 'Failed to create new version',
        variant: 'destructive',
      });
    }
  }, [activeScript, newVersionColor, revisionNotes, createVersion, onVersionCreated, refetch, toast]);

  const handleToggleLock = useCallback(async () => {
    try {
      await lockVersion.mutateAsync({
        scriptId: activeScript.id,
        lock: !activeScript.is_locked,
      });
      await refetch();
      toast({
        title: activeScript.is_locked ? 'Script Unlocked' : 'Script Locked',
        description: activeScript.is_locked
          ? 'This version can now be edited.'
          : 'This version is now locked and cannot be edited.',
      });
    } catch (error: any) {
      toast({
        title: 'Lock Failed',
        description: error.message || 'Failed to toggle lock status',
        variant: 'destructive',
      });
    }
  }, [activeScript, lockVersion, refetch, toast]);

  // Extract text from PDF
  const handleExtractText = useCallback(async () => {
    try {
      const result = await extractText.mutateAsync(activeScript.id);
      await refetch();
      toast({
        title: 'Text Extracted',
        description: result.message || `Extracted text from ${result.page_count || 0} pages`,
      });
      // After extraction, start editing with the new content
      if (result.text_content) {
        setEditContent(result.text_content);
        setIsEditing(true);
      }
    } catch (error: any) {
      toast({
        title: 'Extraction Failed',
        description: error.message || 'Failed to extract text from PDF',
        variant: 'destructive',
      });
    }
  }, [activeScript, extractText, refetch, toast]);

  // Get next color in sequence
  const getNextColor = useCallback(() => {
    const currentColorCode = (activeScript.color_code || 'white') as BacklotScriptColorCode;
    const currentIndex = REVISION_COLORS.indexOf(currentColorCode);
    const nextIndex = (currentIndex + 1) % REVISION_COLORS.length;
    return REVISION_COLORS[nextIndex];
  }, [activeScript]);

  // Set default color for new version
  useEffect(() => {
    if (showNewVersionModal) {
      setNewVersionColor(getNextColor());
    }
  }, [showNewVersionModal, getNextColor]);

  // Fullscreen handling
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Update current element type based on cursor position
  const updateCurrentElement = useCallback(() => {
    if (!editorRef.current) return;

    const textarea = editorRef.current;
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;

    // Find current line
    const textBeforeCursor = text.substring(0, cursorPos);
    const lines = textBeforeCursor.split('\n');
    const currentLineIndex = lines.length - 1;
    const currentLine = lines[currentLineIndex];

    // Get previous line for context
    const prevLine = currentLineIndex > 0 ? lines[currentLineIndex - 1] : undefined;
    let prevType: ScriptElementType | undefined;
    if (prevLine !== undefined) {
      prevType = detectElementType(prevLine, undefined, undefined);
    }

    const elementType = detectElementType(currentLine, prevLine, prevType);
    setCurrentElementType(elementType);
    setCursorPosition(cursorPos);
  }, []);

  // Format current line as specific element
  const formatAsElement = useCallback((elementType: ScriptElementType) => {
    if (!editorRef.current || !isEditing) return;

    const textarea = editorRef.current;
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;

    // Find current line boundaries
    const textBeforeCursor = text.substring(0, cursorPos);
    const textAfterCursor = text.substring(cursorPos);
    const lineStart = textBeforeCursor.lastIndexOf('\n') + 1;
    const lineEnd = textAfterCursor.indexOf('\n');
    const actualLineEnd = lineEnd === -1 ? text.length : cursorPos + lineEnd;

    const currentLine = text.substring(lineStart, actualLineEnd);
    let formattedLine = currentLine.trim();

    // Apply formatting based on element type
    // Only add prefixes/suffixes if the line has content
    switch (elementType) {
      case 'scene_heading':
        if (formattedLine && !ELEMENT_PATTERNS.scene_heading.test(formattedLine)) {
          formattedLine = 'INT. ' + formattedLine.toUpperCase();
        } else if (formattedLine) {
          formattedLine = formattedLine.toUpperCase();
        }
        // Don't add "INT. " to empty lines - just set the element type indicator
        break;
      case 'character':
        if (formattedLine) {
          formattedLine = formattedLine.toUpperCase();
        }
        break;
      case 'transition':
        if (formattedLine && !ELEMENT_PATTERNS.transition.test(formattedLine)) {
          formattedLine = formattedLine.toUpperCase() + ':';
        }
        break;
      case 'parenthetical':
        if (formattedLine) {
          if (!formattedLine.startsWith('(')) {
            formattedLine = '(' + formattedLine;
          }
          if (!formattedLine.endsWith(')')) {
            formattedLine = formattedLine + ')';
          }
        }
        break;
    }

    // Update content
    const newText = text.substring(0, lineStart) + formattedLine + text.substring(actualLineEnd);
    setEditContent(newText);

    // Update cursor position
    setTimeout(() => {
      if (editorRef.current) {
        const newCursorPos = lineStart + formattedLine.length;
        editorRef.current.selectionStart = newCursorPos;
        editorRef.current.selectionEnd = newCursorPos;
        editorRef.current.focus();
      }
    }, 0);

    setCurrentElementType(elementType);
  }, [isEditing]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Number shortcuts for element types
    if (e.ctrlKey || e.metaKey) {
      const key = e.key;
      if (key === '1') {
        e.preventDefault();
        formatAsElement('scene_heading');
      } else if (key === '2') {
        e.preventDefault();
        formatAsElement('action');
      } else if (key === '3') {
        e.preventDefault();
        formatAsElement('character');
      } else if (key === '4') {
        e.preventDefault();
        formatAsElement('dialogue');
      } else if (key === '5') {
        e.preventDefault();
        formatAsElement('parenthetical');
      } else if (key === '6') {
        e.preventDefault();
        formatAsElement('transition');
      } else if (key === 's') {
        e.preventDefault();
        if (hasUnsavedChanges) {
          handleSave();
        }
      }
    }

    // Tab to cycle through elements (after Enter on empty line)
    if (e.key === 'Tab' && !e.shiftKey) {
      const textarea = e.currentTarget;
      const text = textarea.value;
      const cursorPos = textarea.selectionStart;

      // Find current line
      const textBeforeCursor = text.substring(0, cursorPos);
      const lineStart = textBeforeCursor.lastIndexOf('\n') + 1;
      const currentLine = text.substring(lineStart, cursorPos);

      // If line is empty or just whitespace, cycle element type
      if (!currentLine.trim()) {
        e.preventDefault();
        const currentIndex = ELEMENT_CYCLE.indexOf(currentElementType);
        const nextIndex = (currentIndex + 1) % ELEMENT_CYCLE.length;
        setCurrentElementType(ELEMENT_CYCLE[nextIndex]);
      }
    }
  }, [currentElementType, formatAsElement, handleSave, hasUnsavedChanges]);

  const colorCode = (activeScript.color_code || 'white') as BacklotScriptColorCode;
  const colorHex = SCRIPT_COLOR_CODE_HEX[colorCode] || '#FFFFFF';
  const colorLabel = SCRIPT_COLOR_CODE_LABELS[colorCode] || 'White (First Draft)';

  return (
    <div ref={containerRef} className={cn(
      "flex flex-col h-full bg-charcoal-black",
      isFullscreen && "fixed inset-0 z-50"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-muted-gray/20">
        <div className="flex items-center gap-3">
          {onBack && !isFullscreen && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent-yellow" />
              <h2 className="text-lg font-medium text-bone-white">
                {activeScript.title}
              </h2>
              <Badge
                variant="outline"
                style={{
                  backgroundColor: `${colorHex}20`,
                  borderColor: colorHex,
                  color: colorHex === '#FFFFFF' ? '#111' : colorHex,
                }}
              >
                {colorLabel}
              </Badge>
              {activeScript.is_locked && (
                <Badge variant="outline" className="border-red-500 text-red-400">
                  <Lock className="w-3 h-3 mr-1" />
                  Locked
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-gray">
              {activeScript.version && <span>v{activeScript.version}</span>}
              {activeScript.version_number && (
                <span>Revision #{activeScript.version_number}</span>
              )}
              {activeScript.draft_date && (
                <span>Draft: {activeScript.draft_date}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center border border-muted-gray/30 rounded-md overflow-hidden">
            <Button
              variant={viewMode === 'page' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('page')}
              className={cn(
                'h-8 rounded-none border-0',
                viewMode === 'page' ? 'bg-accent-yellow/20 text-accent-yellow' : 'text-muted-gray'
              )}
            >
              <FileStack className="w-4 h-4 mr-1" />
              Page
            </Button>
            <Button
              variant={viewMode === 'inline' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('inline')}
              className={cn(
                'h-8 rounded-none border-0',
                viewMode === 'inline' ? 'bg-accent-yellow/20 text-accent-yellow' : 'text-muted-gray'
              )}
            >
              <AlignJustify className="w-4 h-4 mr-1" />
              Inline
            </Button>
          </div>

          {/* Fullscreen Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="text-muted-gray hover:text-bone-white"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>

          {/* Lock/Unlock Button */}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleLock}
              disabled={lockVersion.isPending}
              className={cn(
                'border-muted-gray/30',
                activeScript.is_locked
                  ? 'text-red-400 hover:text-red-300'
                  : 'text-green-400 hover:text-green-300'
              )}
            >
              {lockVersion.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : activeScript.is_locked ? (
                <Unlock className="w-4 h-4 mr-2" />
              ) : (
                <Lock className="w-4 h-4 mr-2" />
              )}
              {activeScript.is_locked ? 'Unlock' : 'Lock'}
            </Button>
          )}

          {/* New Version Button */}
          {canEdit && !activeScript.is_locked && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewVersionModal(true)}
              className="border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow/10"
            >
              <GitBranch className="w-4 h-4 mr-2" />
              New Revision
            </Button>
          )}

          {/* Edit/Save Buttons */}
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                className="border-muted-gray/30"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateScriptText.isPending || !hasUnsavedChanges}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {updateScriptText.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save
              </Button>
            </>
          ) : (
            canEdit && !activeScript.is_locked && (
              <Button
                size="sm"
                onClick={handleStartEditing}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Script
              </Button>
            )
          )}
        </div>
      </div>

      {/* Unsaved Changes Warning */}
      {hasUnsavedChanges && (
        <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 border-b border-orange-500/30">
          <AlertCircle className="w-4 h-4 text-orange-400" />
          <span className="text-sm text-orange-400">
            You have unsaved changes
          </span>
        </div>
      )}

      {/* Formatting Toolbar - Only show when editing */}
      {isEditing && (
        <TooltipProvider>
          <div className="flex items-center gap-1 px-4 py-2 border-b border-muted-gray/20 bg-muted-gray/5">
            <span className="text-xs text-muted-gray mr-2">Element:</span>

            {/* Element Type Buttons */}
            {(['scene_heading', 'action', 'character', 'dialogue', 'parenthetical', 'transition'] as ScriptElementType[]).map((type) => {
              const info = ELEMENT_INFO[type];
              const Icon = info.icon;
              const isActive = currentElementType === type;

              return (
                <Tooltip key={type}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActive ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => formatAsElement(type)}
                      className={cn(
                        'h-7 px-2',
                        isActive
                          ? 'bg-accent-yellow text-charcoal-black'
                          : 'text-muted-gray hover:text-bone-white'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5 mr-1" />
                      <span className="text-xs">{info.label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{info.label}</p>
                    <p className="text-xs text-muted-gray">{info.shortcut}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}

            <div className="flex-1" />

            {/* Current Element Indicator */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-gray">Current:</span>
              <Badge variant="outline" className="text-xs">
                {ELEMENT_INFO[currentElementType]?.label || 'General'}
              </Badge>
            </div>

            {/* Toggle View Mode */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFormatted(!showFormatted)}
              className="h-7 px-2 text-muted-gray hover:text-bone-white"
            >
              <Type className="w-3.5 h-3.5 mr-1" />
              <span className="text-xs">{showFormatted ? 'Raw' : 'Formatted'}</span>
            </Button>
          </div>
        </TooltipProvider>
      )}

      {/* Editor Content */}
      {viewMode === 'page' ? (
        // Page View Mode - give it explicit height so scroll works
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScriptPageView
            content={isEditing ? editContent : (activeScript.text_content || '')}
            title={activeScript.title}
            pageCount={activeScript.total_pages || undefined}
            isEditing={isEditing}
            canEdit={canEdit && !activeScript.is_locked}
            onContentChange={(content) => {
              setEditContent(content);
              setHasUnsavedChanges(true);
            }}
            onStartEdit={handleStartEditing}
            onSave={handleSave}
            onCancel={handleCancelEdit}
          />
        </div>
      ) : (
        // Inline View Mode
        <ScrollArea className="flex-1">
          <div className="p-6">
            {isEditing ? (
              <div className="relative">
                {/* Raw Editor (always present for input) */}
                <Textarea
                  ref={editorRef}
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    updateCurrentElement();
                  }}
                  onKeyDown={handleKeyDown}
                  onClick={updateCurrentElement}
                  onSelect={updateCurrentElement}
                  placeholder="Start writing your script...

Use keyboard shortcuts:
  Ctrl+1: Scene Heading (INT./EXT.)
  Ctrl+2: Action
  Ctrl+3: Character
  Ctrl+4: Dialogue
  Ctrl+5: Parenthetical
  Ctrl+6: Transition
  Ctrl+S: Save

Or Tab to cycle between element types on empty lines."
                  className={cn(
                    "min-h-[600px] font-mono text-sm bg-charcoal-black border-muted-gray/30 resize-none",
                    !showFormatted && "text-bone-white"
                  )}
                  style={{
                    lineHeight: 1.8,
                    fontFamily: 'Courier New, monospace',
                    opacity: showFormatted ? 0 : 1,
                    position: showFormatted ? 'absolute' : 'relative',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: showFormatted ? -1 : 1,
                  }}
                />

                {/* Formatted Preview (overlay when showFormatted is true) */}
                {showFormatted && (
                  <div
                    className="min-h-[600px] font-mono text-sm border border-muted-gray/30 rounded-md p-4 bg-charcoal-black cursor-text"
                    onClick={() => editorRef.current?.focus()}
                  >
                    {scriptElements.map((element, idx) => {
                      const style = ELEMENT_STYLES[element.type];
                      const isEmptyLine = !element.content.trim();

                      return (
                        <div
                          key={idx}
                          className={cn(
                            "text-bone-white",
                            isEmptyLine && "h-6"
                          )}
                          style={{
                            ...style,
                            fontFamily: 'Courier New, monospace',
                            lineHeight: 1.8,
                          }}
                        >
                          {element.content || '\u00A0'}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : activeScript.text_content ? (
              // Read-only formatted view
              <div className="max-w-[800px] mx-auto">
                {scriptElements.map((element, idx) => {
                  const style = ELEMENT_STYLES[element.type];
                  const isEmptyLine = !element.content.trim();

                return (
                  <div
                    key={idx}
                    className={cn(
                      "text-bone-white font-mono text-sm",
                      isEmptyLine && "h-6"
                    )}
                    style={{
                      ...style,
                      fontFamily: 'Courier New, monospace',
                      lineHeight: 1.8,
                    }}
                  >
                    {element.content || '\u00A0'}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-bone-white mb-2">
                {activeScript.file_url ? 'PDF Script Imported' : 'No Script Content'}
              </h3>
              <p className="text-muted-gray mb-4">
                {activeScript.file_url
                  ? 'Extract text from the PDF to enable editing, or view the original in the PDF Viewer tab.'
                  : 'Start writing to create script content for this project.'}
              </p>
              <div className="flex items-center justify-center gap-3">
                {/* Extract text from PDF */}
                {canEdit && !activeScript.is_locked && activeScript.file_url && (
                  <Button
                    onClick={handleExtractText}
                    disabled={extractText.isPending}
                    className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                  >
                    {extractText.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 mr-2" />
                    )}
                    {extractText.isPending ? 'Extracting...' : 'Extract Text from PDF'}
                  </Button>
                )}
                {/* Start writing from scratch */}
                {canEdit && !activeScript.is_locked && (
                  <Button
                    onClick={handleStartEditing}
                    variant={activeScript.file_url ? 'outline' : 'default'}
                    className={activeScript.file_url
                      ? 'border-muted-gray/30 hover:bg-muted-gray/10'
                      : 'bg-accent-yellow text-charcoal-black hover:bg-bone-white'
                    }
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {activeScript.file_url ? 'Write From Scratch' : 'Start Writing'}
                  </Button>
                )}
              </div>
            </div>
          )}
          </div>
        </ScrollArea>
      )}

      {/* Revision Notes */}
      {activeScript.revision_notes && (
        <div className="p-4 border-t border-muted-gray/20 bg-muted-gray/5">
          <div className="flex items-start gap-2">
            <History className="w-4 h-4 text-muted-gray mt-0.5" />
            <div>
              <p className="text-xs text-muted-gray mb-1">Revision Notes:</p>
              <p className="text-sm text-bone-white">{activeScript.revision_notes}</p>
            </div>
          </div>
        </div>
      )}

      {/* New Version Modal */}
      <Dialog open={showNewVersionModal} onOpenChange={setShowNewVersionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              Create New Revision
            </DialogTitle>
            <DialogDescription>
              Create a new color-coded revision of this script. The current content will be copied to the new version.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-bone-white">
                Revision Color
              </label>
              <Select
                value={newVersionColor}
                onValueChange={(v) => setNewVersionColor(v as BacklotScriptColorCode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REVISION_COLORS.map((color) => (
                    <SelectItem key={color} value={color}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded border"
                          style={{
                            backgroundColor: SCRIPT_COLOR_CODE_HEX[color],
                            borderColor: color === 'white' ? '#666' : SCRIPT_COLOR_CODE_HEX[color],
                          }}
                        />
                        <span>{SCRIPT_COLOR_CODE_LABELS[color]}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-bone-white">
                Revision Notes (optional)
              </label>
              <Textarea
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                placeholder="Describe the changes in this revision..."
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewVersionModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateNewVersion}
              disabled={createVersion.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {createVersion.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Create Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScriptEditorPanel;
