/**
 * MySpacePanel - Personal notes and bookmarks for the user
 * Private workspace for individual crew members
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Label } from '@/components/ui/label';
import {
  Plus,
  StickyNote,
  Bookmark,
  Search,
  Pencil,
  Trash2,
  Lock,
  ExternalLink,
  Calendar,
  Filter,
  Tag,
  FileText,
  MapPin,
  Users,
  Clapperboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useMyNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useMyBookmarks,
  useCreateBookmark,
  useDeleteBookmark,
  NOTE_COLORS,
  BOOKMARK_ENTITY_TYPES,
  UserNote,
  UserBookmark,
} from '@/hooks/backlot';

interface MySpacePanelProps {
  projectId: string;
}

const NOTE_COLOR_CLASSES: Record<string, string> = {
  yellow: 'bg-yellow-500/20 border-yellow-500/30',
  blue: 'bg-blue-500/20 border-blue-500/30',
  green: 'bg-green-500/20 border-green-500/30',
  pink: 'bg-pink-500/20 border-pink-500/30',
  purple: 'bg-purple-500/20 border-purple-500/30',
  orange: 'bg-orange-500/20 border-orange-500/30',
};

const ENTITY_ICONS: Record<string, React.ElementType> = {
  scene: Clapperboard,
  shot: FileText,
  production_day: Calendar,
  location: MapPin,
  person: Users,
  task: Tag,
};

const MySpacePanel: React.FC<MySpacePanelProps> = ({ projectId }) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'bookmarks'>('notes');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState<UserNote | null>(null);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [deleteConfirmNote, setDeleteConfirmNote] = useState<string | null>(null);
  const [deleteConfirmBookmark, setDeleteConfirmBookmark] = useState<string | null>(null);

  // Queries
  const { data: notes, isLoading: notesLoading } = useMyNotes(projectId);
  const { data: bookmarks, isLoading: bookmarksLoading } = useMyBookmarks(projectId);

  // Mutations
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const createBookmark = useCreateBookmark();
  const deleteBookmark = useDeleteBookmark();

  // Form state for notes
  const [noteForm, setNoteForm] = useState({
    title: '',
    content: '',
    color: 'yellow',
    tags: [] as string[],
    tagsInput: '',
  });

  // Form state for bookmarks
  const [bookmarkForm, setBookmarkForm] = useState({
    entity_type: 'scene',
    entity_id: '',
    label: '',
  });

  const resetNoteForm = () => {
    setNoteForm({
      title: '',
      content: '',
      color: 'yellow',
      tags: [],
      tagsInput: '',
    });
  };

  const resetBookmarkForm = () => {
    setBookmarkForm({
      entity_type: 'scene',
      entity_id: '',
      label: '',
    });
  };

  const handleOpenAddNote = () => {
    resetNoteForm();
    setShowNoteModal(true);
  };

  const handleOpenEditNote = (note: UserNote) => {
    setNoteForm({
      title: note.title || '',
      content: note.content,
      color: note.color || 'yellow',
      tags: note.tags || [],
      tagsInput: (note.tags || []).join(', '),
    });
    setEditingNote(note);
    setShowNoteModal(true);
  };

  const handleSaveNote = async () => {
    const tags = noteForm.tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      project_id: projectId,
      title: noteForm.title || null,
      content: noteForm.content,
      color: noteForm.color,
      tags: tags.length > 0 ? tags : null,
    };

    if (editingNote) {
      await updateNote.mutateAsync({
        id: editingNote.id,
        data: payload,
      });
      setEditingNote(null);
    } else {
      await createNote.mutateAsync(payload);
    }
    setShowNoteModal(false);
    resetNoteForm();
  };

  const handleDeleteNote = async () => {
    if (!deleteConfirmNote) return;
    await deleteNote.mutateAsync(deleteConfirmNote);
    setDeleteConfirmNote(null);
  };

  const handleSaveBookmark = async () => {
    await createBookmark.mutateAsync({
      project_id: projectId,
      entity_type: bookmarkForm.entity_type,
      entity_id: bookmarkForm.entity_id,
      label: bookmarkForm.label || null,
    });
    setShowBookmarkModal(false);
    resetBookmarkForm();
  };

  const handleDeleteBookmark = async () => {
    if (!deleteConfirmBookmark) return;
    await deleteBookmark.mutateAsync(deleteConfirmBookmark);
    setDeleteConfirmBookmark(null);
  };

  // Filter notes
  const filteredNotes = notes?.filter((note) => {
    if (!searchTerm) return true;
    return (
      note.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.tags?.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  // Filter bookmarks
  const filteredBookmarks = bookmarks?.filter((bookmark) => {
    if (!searchTerm) return true;
    return (
      bookmark.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bookmark.entity_type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-bone-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-muted-gray" />
            My Space
          </h2>
          <p className="text-muted-gray text-sm">
            Your private notes and bookmarks - only visible to you
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList className="bg-soft-black border border-muted-gray/20 p-1">
            <TabsTrigger
              value="notes"
              className="data-[state=active]:bg-accent-yellow/10 data-[state=active]:text-accent-yellow"
            >
              <StickyNote className="w-4 h-4 mr-2" />
              Notes ({notes?.length || 0})
            </TabsTrigger>
            <TabsTrigger
              value="bookmarks"
              className="data-[state=active]:bg-accent-yellow/10 data-[state=active]:text-accent-yellow"
            >
              <Bookmark className="w-4 h-4 mr-2" />
              Bookmarks ({bookmarks?.length || 0})
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
              <Input
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-soft-black border-muted-gray/30"
              />
            </div>
            <Button
              onClick={activeTab === 'notes' ? handleOpenAddNote : () => setShowBookmarkModal(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add {activeTab === 'notes' ? 'Note' : 'Bookmark'}
            </Button>
          </div>
        </div>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-6">
          {notesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : filteredNotes?.length === 0 ? (
            <Card className="bg-soft-black border-muted-gray/20">
              <CardContent className="py-12 text-center">
                <StickyNote className="w-10 h-10 mx-auto text-muted-gray mb-3" />
                <p className="text-muted-gray">
                  {searchTerm ? 'No notes match your search' : 'No notes yet'}
                </p>
                {!searchTerm && (
                  <Button
                    variant="link"
                    className="text-accent-yellow mt-2"
                    onClick={handleOpenAddNote}
                  >
                    Create your first note
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotes?.map((note) => (
                <Card
                  key={note.id}
                  className={cn(
                    'border transition-colors hover:border-muted-gray/40',
                    NOTE_COLOR_CLASSES[note.color || 'yellow']
                  )}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base text-bone-white line-clamp-1">
                        {note.title || 'Untitled Note'}
                      </CardTitle>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleOpenEditNote(note)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-300"
                          onClick={() => setDeleteConfirmNote(note.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-gray whitespace-pre-wrap line-clamp-4">
                      {note.content}
                    </p>
                    {note.tags && note.tags.length > 0 && (
                      <div className="mt-3 flex gap-1 flex-wrap">
                        {note.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs border-muted-gray/30"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-muted-gray/60">
                      {new Date(note.updated_at).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Bookmarks Tab */}
        <TabsContent value="bookmarks" className="mt-6">
          {bookmarksLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filteredBookmarks?.length === 0 ? (
            <Card className="bg-soft-black border-muted-gray/20">
              <CardContent className="py-12 text-center">
                <Bookmark className="w-10 h-10 mx-auto text-muted-gray mb-3" />
                <p className="text-muted-gray">
                  {searchTerm ? 'No bookmarks match your search' : 'No bookmarks yet'}
                </p>
                {!searchTerm && (
                  <Button
                    variant="link"
                    className="text-accent-yellow mt-2"
                    onClick={() => setShowBookmarkModal(true)}
                  >
                    Create your first bookmark
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredBookmarks?.map((bookmark) => {
                const EntityIcon = ENTITY_ICONS[bookmark.entity_type] || Tag;
                return (
                  <Card
                    key={bookmark.id}
                    className="bg-soft-black border-muted-gray/20 hover:border-muted-gray/40 transition-colors"
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-charcoal-black">
                            <EntityIcon className="w-4 h-4 text-muted-gray" />
                          </div>
                          <div>
                            <div className="font-medium text-bone-white">
                              {bookmark.label ||
                                `${bookmark.entity_type} ${bookmark.entity_id.slice(0, 8)}`}
                            </div>
                            <div className="text-xs text-muted-gray capitalize">
                              {bookmark.entity_type.replace('_', ' ')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-300"
                            onClick={() => setDeleteConfirmBookmark(bookmark.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Note Modal */}
      <Dialog
        open={showNoteModal}
        onOpenChange={() => {
          setShowNoteModal(false);
          setEditingNote(null);
          resetNoteForm();
        }}
      >
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Edit Note' : 'New Note'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title (Optional)</Label>
              <Input
                value={noteForm.title}
                onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                placeholder="Note title..."
                className="bg-charcoal-black border-muted-gray/30"
              />
            </div>
            <div>
              <Label>Content *</Label>
              <Textarea
                value={noteForm.content}
                onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                placeholder="Write your note..."
                className="bg-charcoal-black border-muted-gray/30"
                rows={5}
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2">
                {NOTE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setNoteForm({ ...noteForm, color: color.value })}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-all',
                      NOTE_COLOR_CLASSES[color.value],
                      noteForm.color === color.value
                        ? 'ring-2 ring-bone-white ring-offset-2 ring-offset-soft-black'
                        : ''
                    )}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input
                value={noteForm.tagsInput}
                onChange={(e) => setNoteForm({ ...noteForm, tagsInput: e.target.value })}
                placeholder="e.g., important, scene-12, reminder"
                className="bg-charcoal-black border-muted-gray/30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNoteModal(false);
                setEditingNote(null);
                resetNoteForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNote}
              disabled={!noteForm.content || createNote.isPending || updateNote.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {editingNote ? 'Save Changes' : 'Create Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bookmark Modal */}
      <Dialog open={showBookmarkModal} onOpenChange={setShowBookmarkModal}>
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle>Add Bookmark</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Entity Type</Label>
              <Select
                value={bookmarkForm.entity_type}
                onValueChange={(v) => setBookmarkForm({ ...bookmarkForm, entity_type: v })}
              >
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOOKMARK_ENTITY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entity ID *</Label>
              <Input
                value={bookmarkForm.entity_id}
                onChange={(e) => setBookmarkForm({ ...bookmarkForm, entity_id: e.target.value })}
                placeholder="Paste the ID of the item to bookmark"
                className="bg-charcoal-black border-muted-gray/30"
              />
              <p className="text-xs text-muted-gray mt-1">
                You can find IDs in the URL or use the bookmark button on individual items
              </p>
            </div>
            <div>
              <Label>Label (Optional)</Label>
              <Input
                value={bookmarkForm.label}
                onChange={(e) => setBookmarkForm({ ...bookmarkForm, label: e.target.value })}
                placeholder="e.g., Scene 12 - Kitchen"
                className="bg-charcoal-black border-muted-gray/30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBookmarkModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveBookmark}
              disabled={!bookmarkForm.entity_id || createBookmark.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              Add Bookmark
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Note Confirmation */}
      <Dialog open={!!deleteConfirmNote} onOpenChange={() => setDeleteConfirmNote(null)}>
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
          </DialogHeader>
          <p className="text-muted-gray">
            Are you sure you want to delete this note? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmNote(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteNote}
              disabled={deleteNote.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Bookmark Confirmation */}
      <Dialog open={!!deleteConfirmBookmark} onOpenChange={() => setDeleteConfirmBookmark(null)}>
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle>Remove Bookmark</DialogTitle>
          </DialogHeader>
          <p className="text-muted-gray">
            Are you sure you want to remove this bookmark? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmBookmark(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteBookmark}
              disabled={deleteBookmark.isPending}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MySpacePanel;
