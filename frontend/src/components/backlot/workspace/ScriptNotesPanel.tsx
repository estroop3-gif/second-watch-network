/**
 * ScriptNotesPanel - Displays all script page notes for a project
 * with filtering, grouping, and PDF export capabilities
 */
import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  FileText,
  StickyNote,
  Search,
  Filter,
  Download,
  CheckCircle2,
  Clock,
  User,
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  FileDown,
  Layers,
  Tag,
  Users,
  Check,
  X,
  Loader2,
} from "lucide-react";
import {
  useProjectScriptNotes,
  useProjectNotesSummary,
  useProjectNotesPdfExport,
  useScriptPageNoteMutations,
  type NotesGroupBy,
} from "@/hooks/backlot";
import {
  BacklotScriptPageNote,
  BacklotScriptPageNoteType,
  SCRIPT_PAGE_NOTE_TYPE_LABELS,
  SCRIPT_PAGE_NOTE_TYPE_COLORS,
} from "@/types/backlot";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface ScriptNotesPanelProps {
  projectId: string;
  canEdit: boolean;
  onNoteClick?: (note: BacklotScriptPageNote, page: number) => void;
}

// Note type color helpers
const getNoteTypeColor = (type: BacklotScriptPageNoteType): string => {
  const colors: Record<BacklotScriptPageNoteType, string> = {
    general: "bg-gray-500/20 text-gray-500 border-gray-500/40",
    direction: "bg-purple-500/20 text-purple-400 border-purple-500/40",
    production: "bg-blue-500/20 text-blue-400 border-blue-500/40",
    character: "bg-red-500/20 text-red-400 border-red-500/40",
    blocking: "bg-orange-500/20 text-orange-400 border-orange-500/40",
    camera: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
    continuity: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
    sound: "bg-sky-500/20 text-sky-400 border-sky-500/40",
    vfx: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/40",
    prop: "bg-violet-500/20 text-violet-400 border-violet-500/40",
    wardrobe: "bg-indigo-500/20 text-indigo-400 border-indigo-500/40",
    makeup: "bg-pink-500/20 text-pink-400 border-pink-500/40",
    location: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    safety: "bg-rose-500/20 text-rose-400 border-rose-500/40",
    other: "bg-slate-500/20 text-slate-400 border-slate-500/40",
  };
  return colors[type] || colors.general;
};

// Summary Stats Component
const NotesSummaryStats: React.FC<{
  projectId: string;
}> = ({ projectId }) => {
  const {
    totalNotes,
    unresolvedCount,
    resolvedCount,
    pagesWithNotes,
    uniqueAuthors,
    byType,
    isLoading,
  } = useProjectNotesSummary({ projectId });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-blue-500/20">
              <StickyNote className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-bone-white">{totalNotes}</div>
              <div className="text-xs text-muted-gray">Total Notes</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-orange-500/20">
              <Clock className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-bone-white">{unresolvedCount}</div>
              <div className="text-xs text-muted-gray">Unresolved</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-green-500/20">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-bone-white">{resolvedCount}</div>
              <div className="text-xs text-muted-gray">Resolved</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-purple-500/20">
              <FileText className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-bone-white">{pagesWithNotes}</div>
              <div className="text-xs text-muted-gray">Pages w/ Notes</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-cyan-500/20">
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-bone-white">{uniqueAuthors}</div>
              <div className="text-xs text-muted-gray">Contributors</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Note Card Component
const NoteCard: React.FC<{
  note: BacklotScriptPageNote;
  canEdit: boolean;
  onToggleResolved: (noteId: string, resolved: boolean) => void;
  onClick?: () => void;
  showPage?: boolean;
  showScene?: boolean;
  isToggling?: boolean;
}> = ({ note, canEdit, onToggleResolved, onClick, showPage = true, showScene = true, isToggling }) => {
  const typeLabel = SCRIPT_PAGE_NOTE_TYPE_LABELS[note.note_type] || note.note_type;
  const typeColor = getNoteTypeColor(note.note_type);
  const authorName = note.author?.full_name || "Unknown";
  const authorInitials = authorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const timeAgo = note.created_at
    ? formatDistanceToNow(new Date(note.created_at), { addSuffix: true })
    : "";

  return (
    <div
      className={cn(
        "bg-charcoal-black border border-muted-gray/20 rounded-lg p-4 hover:border-muted-gray/40 transition-colors",
        note.resolved && "opacity-60 bg-green-500/5",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {showPage && (
            <Badge variant="outline" className="text-xs font-mono">
              Page {note.page_number}
            </Badge>
          )}
          {showScene && note.scene && (
            <Badge variant="outline" className="text-xs">
              Scene {note.scene.scene_number}
            </Badge>
          )}
          <Badge className={cn("text-xs border", typeColor)}>{typeLabel}</Badge>
        </div>
        {note.resolved && (
          <Badge className="bg-green-500/20 text-green-400 text-xs">
            <Check className="w-3 h-3 mr-1" />
            Resolved
          </Badge>
        )}
      </div>

      {/* Note Content */}
      <p className="text-sm text-bone-white whitespace-pre-wrap line-clamp-4 mb-3">
        {note.note_text}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="w-5 h-5">
            <AvatarImage src={note.author?.avatar_url || undefined} />
            <AvatarFallback className="text-[10px] bg-muted-gray/20">
              {authorInitials}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-gray">{authorName}</span>
          <span className="text-xs text-muted-gray/60">•</span>
          <span className="text-xs text-muted-gray/60">{timeAgo}</span>
        </div>

        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onToggleResolved(note.id, !note.resolved);
            }}
            disabled={isToggling}
          >
            {isToggling ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : note.resolved ? (
              <>
                <X className="w-3 h-3 mr-1" />
                Unresolve
              </>
            ) : (
              <>
                <Check className="w-3 h-3 mr-1" />
                Resolve
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

// Group Section Component
const NoteGroupSection: React.FC<{
  title: string;
  notes: BacklotScriptPageNote[];
  canEdit: boolean;
  onToggleResolved: (noteId: string, resolved: boolean) => void;
  onNoteClick?: (note: BacklotScriptPageNote) => void;
  showPage?: boolean;
  showScene?: boolean;
  togglingIds: Set<string>;
}> = ({ title, notes, canEdit, onToggleResolved, onNoteClick, showPage, showScene, togglingIds }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const unresolvedCount = notes.filter((n) => !n.resolved).length;

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left mb-3 hover:opacity-80"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-gray" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-gray" />
        )}
        <h3 className="text-sm font-medium text-bone-white">{title}</h3>
        <Badge variant="outline" className="text-xs">
          {notes.length} note{notes.length !== 1 ? "s" : ""}
        </Badge>
        {unresolvedCount > 0 && (
          <Badge className="bg-orange-500/20 text-orange-400 text-xs">
            {unresolvedCount} open
          </Badge>
        )}
      </button>

      {isExpanded && (
        <div className="space-y-3 pl-6">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              canEdit={canEdit}
              onToggleResolved={onToggleResolved}
              onClick={onNoteClick ? () => onNoteClick(note) : undefined}
              showPage={showPage}
              showScene={showScene}
              isToggling={togglingIds.has(note.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Main Component
const ScriptNotesPanel: React.FC<ScriptNotesPanelProps> = ({
  projectId,
  canEdit,
  onNoteClick,
}) => {
  const { toast } = useToast();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [noteTypeFilter, setNoteTypeFilter] = useState<BacklotScriptPageNoteType | "all">("all");
  const [resolvedFilter, setResolvedFilter] = useState<boolean | undefined>(undefined);
  const [groupBy, setGroupBy] = useState<NotesGroupBy>("page");
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  // Data fetching
  const {
    notes,
    grouped,
    scripts,
    scenes,
    authors,
    totalCount,
    unresolvedCount,
    isLoading,
    refetch,
  } = useProjectScriptNotes({
    projectId,
    noteType: noteTypeFilter,
    resolved: resolvedFilter,
    groupBy,
  });

  const { exportNotesPdf, isExporting } = useProjectNotesPdfExport({ projectId });
  const { toggleResolved } = useScriptPageNoteMutations();

  // Filter notes by search query locally
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const query = searchQuery.toLowerCase();
    return notes.filter(
      (note) =>
        note.note_text.toLowerCase().includes(query) ||
        note.author?.full_name?.toLowerCase().includes(query) ||
        note.scene?.scene_number?.toLowerCase().includes(query)
    );
  }, [notes, searchQuery]);

  // Group filtered notes
  const groupedNotes = useMemo(() => {
    if (!grouped) {
      return { "All Notes": filteredNotes };
    }

    // Filter each group
    const result: Record<string, BacklotScriptPageNote[]> = {};
    for (const [key, groupNotes] of Object.entries(grouped)) {
      const filtered = groupNotes.filter((note) =>
        filteredNotes.some((fn) => fn.id === note.id)
      );
      if (filtered.length > 0) {
        result[key] = filtered;
      }
    }
    return result;
  }, [grouped, filteredNotes]);

  const handleToggleResolved = async (noteId: string, resolved: boolean) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    setTogglingIds((prev) => new Set(prev).add(noteId));

    try {
      await toggleResolved.mutateAsync({
        scriptId: note.script_id,
        noteId,
        resolved,
      });
      toast({
        title: resolved ? "Note Resolved" : "Note Reopened",
        description: resolved ? "The note has been marked as resolved" : "The note has been reopened",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update note status",
        variant: "destructive",
      });
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
    }
  };

  const handleExportPdf = async () => {
    try {
      await exportNotesPdf.mutateAsync({
        noteType: noteTypeFilter !== "all" ? noteTypeFilter : undefined,
        resolved: resolvedFilter,
        groupBy,
      });
      toast({
        title: "PDF Exported",
        description: "Script notes PDF has been downloaded",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export PDF",
        variant: "destructive",
      });
    }
  };

  // Group label formatter
  const getGroupLabel = (key: string): string => {
    if (groupBy === "page") {
      return `Page ${key}`;
    } else if (groupBy === "type") {
      return SCRIPT_PAGE_NOTE_TYPE_LABELS[key as BacklotScriptPageNoteType] || key;
    }
    return String(key);
  };

  // Empty state
  if (!isLoading && notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <StickyNote className="w-16 h-16 text-muted-gray/40 mb-4" />
        <h3 className="text-xl font-medium text-bone-white mb-2">No Notes Yet</h3>
        <p className="text-muted-gray mb-6 max-w-md">
          Add notes to your script pages in the Script Viewer. Notes will appear here for easy
          tracking and management.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <NotesSummaryStats projectId={projectId} />

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-charcoal-black border-muted-gray/20"
          />
        </div>

        <Select
          value={noteTypeFilter}
          onValueChange={(v) => setNoteTypeFilter(v as BacklotScriptPageNoteType | "all")}
        >
          <SelectTrigger className="w-[160px] bg-charcoal-black border-muted-gray/20">
            <Tag className="w-3 h-3 mr-2" />
            <SelectValue placeholder="Note Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(SCRIPT_PAGE_NOTE_TYPE_LABELS).map(([type, label]) => (
              <SelectItem key={type} value={type}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={resolvedFilter === undefined ? "all" : resolvedFilter ? "resolved" : "unresolved"}
          onValueChange={(v) => {
            if (v === "all") setResolvedFilter(undefined);
            else if (v === "resolved") setResolvedFilter(true);
            else setResolvedFilter(false);
          }}
        >
          <SelectTrigger className="w-[140px] bg-charcoal-black border-muted-gray/20">
            <CheckCircle2 className="w-3 h-3 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="unresolved">Unresolved</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={groupBy}
          onValueChange={(v) => setGroupBy(v as NotesGroupBy)}
        >
          <SelectTrigger className="w-[140px] bg-charcoal-black border-muted-gray/20">
            <Layers className="w-3 h-3 mr-2" />
            <SelectValue placeholder="Group By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="page">By Page</SelectItem>
            <SelectItem value="scene">By Scene</SelectItem>
            <SelectItem value="type">By Type</SelectItem>
            <SelectItem value="author">By Author</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={isExporting || notes.length === 0}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4 mr-2" />
            )}
            Export PDF
          </Button>
        </div>
      </div>

      {/* Notes Count */}
      <div className="flex items-center gap-2 text-sm text-muted-gray">
        <MessageSquare className="w-4 h-4" />
        <span>
          {filteredNotes.length} of {totalCount} notes
          {unresolvedCount > 0 && (
            <span className="text-orange-400 ml-2">({unresolvedCount} unresolved)</span>
          )}
        </span>
      </div>

      {/* Notes List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-12 text-muted-gray">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p>No notes match your filters</p>
        </div>
      ) : (
        <div>
          {Object.entries(groupedNotes)
            .sort(([a], [b]) => {
              // Sort page numbers numerically
              if (groupBy === "page") {
                return Number(a) - Number(b);
              }
              return String(a).localeCompare(String(b));
            })
            .map(([key, groupNotes]) => (
              <NoteGroupSection
                key={key}
                title={getGroupLabel(key)}
                notes={groupNotes}
                canEdit={canEdit}
                onToggleResolved={handleToggleResolved}
                onNoteClick={
                  onNoteClick
                    ? (note) => onNoteClick(note, note.page_number)
                    : undefined
                }
                showPage={groupBy !== "page"}
                showScene={groupBy !== "scene"}
                togglingIds={togglingIds}
              />
            ))}
        </div>
      )}
    </div>
  );
};

export default ScriptNotesPanel;
