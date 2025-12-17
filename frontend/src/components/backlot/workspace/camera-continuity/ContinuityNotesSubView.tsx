/**
 * ContinuityNotesSubView - Continuity notes sub-tab
 * Notes for wardrobe, makeup, props, and set continuity with image support
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  FileText,
  Search,
  Pencil,
  Trash2,
  Shirt,
  Palette,
  Lamp,
  Box,
  Filter,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useContinuityNotes,
  useCreateContinuityNote,
  useUpdateContinuityNote,
  useDeleteContinuityNote,
  CONTINUITY_DEPARTMENTS,
  ContinuityNoteItem,
} from '@/hooks/backlot';
import { useScenes } from '@/hooks/backlot';

interface ContinuityNotesSubViewProps {
  projectId: string;
  productionDayId: string | null;
  canEdit: boolean;
}

const DEPARTMENT_ICONS: Record<string, React.ElementType> = {
  wardrobe: Shirt,
  makeup: Palette,
  props: Lamp,
  set: Box,
  other: FileText,
};

const DEPARTMENT_COLORS: Record<string, string> = {
  wardrobe: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  makeup: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  props: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  set: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  other: 'bg-muted-gray/10 text-muted-gray border-muted-gray/30',
};

const ContinuityNotesSubView: React.FC<ContinuityNotesSubViewProps> = ({
  projectId,
  productionDayId,
  canEdit,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNote, setEditingNote] = useState<ContinuityNoteItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Queries
  const { data: notes, isLoading } = useContinuityNotes(
    projectId,
    productionDayId || undefined,
    departmentFilter !== 'all' ? departmentFilter : undefined
  );
  const { data: scenes } = useScenes(projectId);

  // Mutations
  const createNote = useCreateContinuityNote(projectId);
  const updateNote = useUpdateContinuityNote(projectId);
  const deleteNote = useDeleteContinuityNote(projectId);

  // Form state
  const [formData, setFormData] = useState({
    scene_id: '',
    department: 'wardrobe',
    character_name: '',
    note_text: '',
    image_urls: [] as string[],
  });

  const resetForm = () => {
    setFormData({
      scene_id: '',
      department: 'wardrobe',
      character_name: '',
      note_text: '',
      image_urls: [],
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (note: ContinuityNoteItem) => {
    setFormData({
      scene_id: note.scene_id || '',
      department: note.department,
      character_name: note.character_name || '',
      note_text: note.note_text,
      image_urls: note.image_urls || [],
    });
    setEditingNote(note);
  };

  const handleSubmit = async () => {
    if (!productionDayId) return;

    const payload = {
      project_id: projectId,
      production_day_id: productionDayId,
      scene_id: formData.scene_id || null,
      department: formData.department,
      character_name: formData.character_name || null,
      note_text: formData.note_text,
      image_urls: formData.image_urls.length > 0 ? formData.image_urls : null,
    };

    if (editingNote) {
      await updateNote.mutateAsync({
        id: editingNote.id,
        data: payload,
      });
      setEditingNote(null);
    } else {
      await createNote.mutateAsync(payload);
      setShowAddModal(false);
    }
    resetForm();
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteNote.mutateAsync(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  // Filter notes
  const filteredNotes = notes?.filter((note) => {
    if (!searchTerm) return true;
    return (
      note.note_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.character_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Group notes by scene
  const groupedNotes = filteredNotes?.reduce((acc, note) => {
    const scene = scenes?.find((s) => s.id === note.scene_id);
    const sceneKey = scene?.scene_number || 'General';
    if (!acc[sceneKey]) {
      acc[sceneKey] = [];
    }
    acc[sceneKey].push(note);
    return acc;
  }, {} as Record<string, ContinuityNoteItem[]>);

  // Calculate stats
  const stats = CONTINUITY_DEPARTMENTS.map((dept) => ({
    ...dept,
    count: notes?.filter((n) => n.department === dept.value).length || 0,
  }));

  if (!productionDayId) {
    return (
      <Card className="bg-soft-black border-muted-gray/20">
        <CardContent className="py-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-gray mb-4" />
          <h3 className="text-bone-white font-medium mb-2">Select a Shoot Day</h3>
          <p className="text-muted-gray text-sm">
            Choose a production day above to manage continuity notes
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {stats.map((dept) => {
          const DeptIcon = DEPARTMENT_ICONS[dept.value] || FileText;
          return (
            <Card
              key={dept.value}
              className={cn(
                'bg-soft-black cursor-pointer transition-colors',
                departmentFilter === dept.value
                  ? DEPARTMENT_COLORS[dept.value]
                  : 'border-muted-gray/20 hover:border-muted-gray/40'
              )}
              onClick={() =>
                setDepartmentFilter(departmentFilter === dept.value ? 'all' : dept.value)
              }
            >
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <DeptIcon className="w-5 h-5" />
                <div>
                  <div className="text-xl font-bold text-bone-white">{dept.count}</div>
                  <div className="text-xs text-muted-gray">{dept.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
            <Input
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-soft-black border-muted-gray/30"
            />
          </div>
          {departmentFilter !== 'all' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDepartmentFilter('all')}
              className="border-muted-gray/30"
            >
              <Filter className="w-4 h-4 mr-1" />
              Clear Filter
            </Button>
          )}
        </div>
        {canEdit && (
          <Button
            onClick={handleOpenAdd}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Note
          </Button>
        )}
      </div>

      {/* Notes Grid - Grouped by Scene */}
      {Object.keys(groupedNotes || {}).length === 0 ? (
        <Card className="bg-soft-black border-muted-gray/20">
          <CardContent className="py-12 text-center">
            <FileText className="w-8 h-8 mx-auto text-muted-gray mb-2" />
            <p className="text-muted-gray">No continuity notes found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedNotes || {}).map(([sceneKey, sceneNotes]) => (
            <div key={sceneKey}>
              <h3 className="text-sm font-medium text-muted-gray mb-3">
                {sceneKey === 'General' ? 'General Notes' : `Scene ${sceneKey}`}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sceneNotes.map((note) => {
                  const DeptIcon = DEPARTMENT_ICONS[note.department] || FileText;
                  return (
                    <Card
                      key={note.id}
                      className="bg-soft-black border-muted-gray/20 hover:border-muted-gray/40 transition-colors"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn('text-xs', DEPARTMENT_COLORS[note.department])}
                            >
                              <DeptIcon className="w-3 h-3 mr-1" />
                              {CONTINUITY_DEPARTMENTS.find(
                                (d) => d.value === note.department
                              )?.label}
                            </Badge>
                            {note.character_name && (
                              <span className="text-sm font-medium text-bone-white">
                                {note.character_name}
                              </span>
                            )}
                          </div>
                          {canEdit && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleOpenEdit(note)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-400 hover:text-red-300"
                                onClick={() => setDeleteConfirmId(note.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-gray whitespace-pre-wrap">
                          {note.note_text}
                        </p>
                        {note.image_urls && note.image_urls.length > 0 && (
                          <div className="mt-3 flex gap-2 flex-wrap">
                            {note.image_urls.map((url, idx) => (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-16 h-16 rounded overflow-hidden bg-muted-gray/20 hover:opacity-80 transition-opacity"
                              >
                                <img
                                  src={url}
                                  alt={`Continuity reference ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 text-xs text-muted-gray/60">
                          {new Date(note.created_at).toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={showAddModal || !!editingNote}
        onOpenChange={() => {
          setShowAddModal(false);
          setEditingNote(null);
          resetForm();
        }}
      >
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Edit Note' : 'Add Continuity Note'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Department *</Label>
                <Select
                  value={formData.department}
                  onValueChange={(v) => setFormData({ ...formData, department: v })}
                >
                  <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTINUITY_DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept.value} value={dept.value}>
                        {dept.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Scene</Label>
                <Select
                  value={formData.scene_id}
                  onValueChange={(v) => setFormData({ ...formData, scene_id: v })}
                >
                  <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                    <SelectValue placeholder="Select scene" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">General (No Scene)</SelectItem>
                    {scenes?.map((scene) => (
                      <SelectItem key={scene.id} value={scene.id}>
                        Scene {scene.scene_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Character Name</Label>
              <Input
                value={formData.character_name}
                onChange={(e) => setFormData({ ...formData, character_name: e.target.value })}
                placeholder="e.g., John, Sarah"
                className="bg-charcoal-black border-muted-gray/30"
              />
            </div>
            <div>
              <Label>Note *</Label>
              <Textarea
                value={formData.note_text}
                onChange={(e) => setFormData({ ...formData, note_text: e.target.value })}
                placeholder="Describe the continuity details..."
                className="bg-charcoal-black border-muted-gray/30"
                rows={4}
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Image URLs (comma-separated)
              </Label>
              <Input
                value={formData.image_urls.join(', ')}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    image_urls: e.target.value
                      .split(',')
                      .map((url) => url.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="https://example.com/image1.jpg, https://..."
                className="bg-charcoal-black border-muted-gray/30"
              />
              <p className="text-xs text-muted-gray mt-1">
                Add URLs to reference images for this continuity note
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setEditingNote(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.note_text || createNote.isPending || updateNote.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {editingNote ? 'Save Changes' : 'Add Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle>Delete Continuity Note</DialogTitle>
          </DialogHeader>
          <p className="text-muted-gray">
            Are you sure you want to delete this note? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteNote.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContinuityNotesSubView;
