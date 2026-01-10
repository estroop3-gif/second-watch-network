/**
 * StoryManagementView - Manage stories, beats, characters, and character arcs
 * Story structure and narrative planning tool
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  MoreVertical,
  Users,
  ListOrdered,
  Download,
  Printer,
  AlertCircle,
  User,
  Sparkles,
  Link2,
} from 'lucide-react';
import {
  useStories,
  useStory,
  useCreateStory,
  useUpdateStory,
  useDeleteStory,
  useCreateBeat,
  useUpdateBeat,
  useDeleteBeat,
  useReorderBeats,
  useCreateCharacter,
  useUpdateCharacter,
  useDeleteCharacter,
  useCreateCharacterArc,
  useUpdateCharacterArc,
  useDeleteCharacterArc,
  getStoryExportUrl,
  Story,
  StoryBeat,
  StoryCharacter,
  CharacterArc,
} from '@/hooks/backlot';

interface StoryManagementViewProps {
  projectId: string;
  canEdit: boolean;
}

const STRUCTURE_TYPES = [
  { value: 'three-act', label: 'Three-Act Structure' },
  { value: 'five-act', label: 'Five-Act Structure' },
  { value: 'hero-journey', label: "Hero's Journey" },
  { value: 'save-the-cat', label: 'Save the Cat' },
  { value: 'custom', label: 'Custom' },
];

const CHARACTER_ROLES = [
  { value: 'protagonist', label: 'Protagonist' },
  { value: 'antagonist', label: 'Antagonist' },
  { value: 'supporting', label: 'Supporting' },
  { value: 'minor', label: 'Minor' },
];

export default function StoryManagementView({ projectId, canEdit }: StoryManagementViewProps) {
  // State
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);
  const [showCharactersPanel, setShowCharactersPanel] = useState(true);

  // Dialog states
  const [showCreateStoryDialog, setShowCreateStoryDialog] = useState(false);
  const [showEditStoryDialog, setShowEditStoryDialog] = useState(false);
  const [showDeleteStoryDialog, setShowDeleteStoryDialog] = useState(false);
  const [storyToDelete, setStoryToDelete] = useState<Story | null>(null);

  const [showCreateBeatDialog, setShowCreateBeatDialog] = useState(false);
  const [showEditBeatDialog, setShowEditBeatDialog] = useState(false);
  const [beatToEdit, setBeatToEdit] = useState<StoryBeat | null>(null);
  const [showDeleteBeatDialog, setShowDeleteBeatDialog] = useState(false);
  const [beatToDelete, setBeatToDelete] = useState<StoryBeat | null>(null);

  const [showCreateCharacterDialog, setShowCreateCharacterDialog] = useState(false);
  const [showEditCharacterDialog, setShowEditCharacterDialog] = useState(false);
  const [characterToEdit, setCharacterToEdit] = useState<StoryCharacter | null>(null);
  const [showDeleteCharacterDialog, setShowDeleteCharacterDialog] = useState(false);
  const [characterToDelete, setCharacterToDelete] = useState<StoryCharacter | null>(null);

  const [showCreateArcDialog, setShowCreateArcDialog] = useState(false);
  const [arcCharacterId, setArcCharacterId] = useState<string | null>(null);
  const [showEditArcDialog, setShowEditArcDialog] = useState(false);
  const [arcToEdit, setArcToEdit] = useState<{ arc: CharacterArc; characterId: string } | null>(null);
  const [showDeleteArcDialog, setShowDeleteArcDialog] = useState(false);
  const [arcToDelete, setArcToDelete] = useState<{ arc: CharacterArc; characterId: string } | null>(null);

  // Form states
  const [storyForm, setStoryForm] = useState({
    title: '',
    logline: '',
    genre: '',
    tone: '',
    themes: '',
    structure_type: 'three-act',
  });

  const [beatForm, setBeatForm] = useState({
    title: '',
    act_marker: '',
    content: '',
    notes: '',
  });

  const [characterForm, setCharacterForm] = useState({
    name: '',
    role: '',
    arc_summary: '',
    notes: '',
  });

  const [arcForm, setArcForm] = useState({
    beat_id: '',
    description: '',
  });

  // Queries
  const { data: stories, isLoading: loadingStories } = useStories(projectId);
  const { data: storyDetail, isLoading: loadingDetail } = useStory(projectId, selectedStoryId);

  // Mutations
  const createStory = useCreateStory(projectId);
  const updateStory = useUpdateStory(projectId, selectedStoryId || '');
  const deleteStory = useDeleteStory(projectId);

  const createBeat = useCreateBeat(projectId, selectedStoryId || '');
  const updateBeat = useUpdateBeat(projectId, selectedStoryId || '');
  const deleteBeat = useDeleteBeat(projectId, selectedStoryId || '');
  const reorderBeats = useReorderBeats(projectId, selectedStoryId || '');

  const createCharacter = useCreateCharacter(projectId, selectedStoryId || '');
  const updateCharacter = useUpdateCharacter(projectId, selectedStoryId || '');
  const deleteCharacter = useDeleteCharacter(projectId, selectedStoryId || '');

  // For arc mutations, we need the character ID dynamically
  const getArcMutations = (characterId: string) => ({
    create: useCreateCharacterArc(projectId, selectedStoryId || '', characterId),
    update: useUpdateCharacterArc(projectId, selectedStoryId || '', characterId),
    delete: useDeleteCharacterArc(projectId, selectedStoryId || '', characterId),
  });

  // Selected beat's character arcs
  const selectedBeat = useMemo(() => {
    if (!storyDetail?.beats || !selectedBeatId) return null;
    return storyDetail.beats.find(b => b.id === selectedBeatId) || null;
  }, [storyDetail?.beats, selectedBeatId]);

  // Handlers
  const handleCreateStory = async () => {
    await createStory.mutateAsync({
      title: storyForm.title,
      logline: storyForm.logline || undefined,
      genre: storyForm.genre || undefined,
      tone: storyForm.tone || undefined,
      themes: storyForm.themes ? storyForm.themes.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      structure_type: storyForm.structure_type,
    });
    setShowCreateStoryDialog(false);
    setStoryForm({ title: '', logline: '', genre: '', tone: '', themes: '', structure_type: 'three-act' });
  };

  const handleUpdateStory = async () => {
    await updateStory.mutateAsync({
      title: storyForm.title || undefined,
      logline: storyForm.logline || undefined,
      genre: storyForm.genre || undefined,
      tone: storyForm.tone || undefined,
      themes: storyForm.themes ? storyForm.themes.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      structure_type: storyForm.structure_type || undefined,
    });
    setShowEditStoryDialog(false);
  };

  const handleDeleteStory = async () => {
    if (!storyToDelete) return;
    await deleteStory.mutateAsync(storyToDelete.id);
    if (selectedStoryId === storyToDelete.id) {
      setSelectedStoryId(null);
    }
    setShowDeleteStoryDialog(false);
    setStoryToDelete(null);
  };

  const openEditStoryDialog = (story: Story) => {
    setStoryForm({
      title: story.title,
      logline: story.logline || '',
      genre: story.genre || '',
      tone: story.tone || '',
      themes: (story.themes || []).join(', '),
      structure_type: story.structure_type || 'three-act',
    });
    setShowEditStoryDialog(true);
  };

  const handleCreateBeat = async () => {
    await createBeat.mutateAsync({
      title: beatForm.title,
      act_marker: beatForm.act_marker || undefined,
      content: beatForm.content || undefined,
      notes: beatForm.notes || undefined,
    });
    setShowCreateBeatDialog(false);
    setBeatForm({ title: '', act_marker: '', content: '', notes: '' });
  };

  const handleUpdateBeat = async () => {
    if (!beatToEdit) return;
    await updateBeat.mutateAsync({
      beatId: beatToEdit.id,
      data: {
        title: beatForm.title || undefined,
        act_marker: beatForm.act_marker || undefined,
        content: beatForm.content || undefined,
        notes: beatForm.notes || undefined,
      },
    });
    setShowEditBeatDialog(false);
    setBeatToEdit(null);
  };

  const handleDeleteBeat = async () => {
    if (!beatToDelete) return;
    await deleteBeat.mutateAsync(beatToDelete.id);
    if (selectedBeatId === beatToDelete.id) {
      setSelectedBeatId(null);
    }
    setShowDeleteBeatDialog(false);
    setBeatToDelete(null);
  };

  const openEditBeatDialog = (beat: StoryBeat) => {
    setBeatToEdit(beat);
    setBeatForm({
      title: beat.title,
      act_marker: beat.act_marker || '',
      content: beat.content || '',
      notes: beat.notes || '',
    });
    setShowEditBeatDialog(true);
  };

  const handleReorderBeat = async (beatId: string, direction: 'UP' | 'DOWN') => {
    await reorderBeats.mutateAsync({ beatId, direction });
  };

  const handleCreateCharacter = async () => {
    await createCharacter.mutateAsync({
      name: characterForm.name,
      role: characterForm.role || undefined,
      arc_summary: characterForm.arc_summary || undefined,
      notes: characterForm.notes || undefined,
    });
    setShowCreateCharacterDialog(false);
    setCharacterForm({ name: '', role: '', arc_summary: '', notes: '' });
  };

  const handleUpdateCharacter = async () => {
    if (!characterToEdit) return;
    await updateCharacter.mutateAsync({
      characterId: characterToEdit.id,
      data: {
        name: characterForm.name || undefined,
        role: characterForm.role || undefined,
        arc_summary: characterForm.arc_summary || undefined,
        notes: characterForm.notes || undefined,
      },
    });
    setShowEditCharacterDialog(false);
    setCharacterToEdit(null);
  };

  const handleDeleteCharacter = async () => {
    if (!characterToDelete) return;
    await deleteCharacter.mutateAsync(characterToDelete.id);
    setShowDeleteCharacterDialog(false);
    setCharacterToDelete(null);
  };

  const openEditCharacterDialog = (character: StoryCharacter) => {
    setCharacterToEdit(character);
    setCharacterForm({
      name: character.name,
      role: character.role || '',
      arc_summary: character.arc_summary || '',
      notes: character.notes || '',
    });
    setShowEditCharacterDialog(true);
  };

  const handleExportCSV = () => {
    if (!selectedStoryId) return;
    const url = getStoryExportUrl(projectId, selectedStoryId);
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    if (!selectedStoryId) return;
    window.open(`/backlot/${projectId}/stories/${selectedStoryId}/print`, '_blank');
  };

  // List View (no story selected)
  if (!selectedStoryId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-heading text-bone-white">Story Management</h2>
            <p className="text-sm text-muted-gray">Manage narrative structure, beats, and characters</p>
          </div>
          {canEdit && (
            <Button onClick={() => setShowCreateStoryDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Story
            </Button>
          )}
        </div>

        {loadingStories ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : !stories || stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-accent-yellow/10 flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-accent-yellow" />
            </div>
            <h3 className="text-xl font-semibold text-bone-white mb-2">No Stories Yet</h3>
            <p className="text-muted-gray text-center max-w-md mb-4">
              Create your first story to start planning your narrative structure, beats, and characters.
            </p>
            {canEdit && (
              <Button onClick={() => setShowCreateStoryDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Story
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stories.map(story => (
              <Card
                key={story.id}
                className="cursor-pointer hover:border-accent-yellow/50 transition-colors bg-charcoal-black/50"
                onClick={() => setSelectedStoryId(story.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg text-bone-white">{story.title}</CardTitle>
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={e => { e.stopPropagation(); openEditStoryDialog(story); }}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-500"
                            onClick={e => {
                              e.stopPropagation();
                              setStoryToDelete(story);
                              setShowDeleteStoryDialog(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {story.logline && (
                    <p className="text-sm text-muted-gray mb-3 line-clamp-2">{story.logline}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {story.genre && <Badge variant="outline">{story.genre}</Badge>}
                    {story.structure_type && (
                      <Badge variant="secondary">
                        {STRUCTURE_TYPES.find(s => s.value === story.structure_type)?.label || story.structure_type}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-gray">
                    <span className="flex items-center gap-1">
                      <ListOrdered className="w-3 h-3" />
                      {story.beat_count || 0} beats
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {story.character_count || 0} characters
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Story Dialog */}
        <Dialog open={showCreateStoryDialog} onOpenChange={setShowCreateStoryDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Story</DialogTitle>
              <DialogDescription>Add a new story to plan your narrative structure.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={storyForm.title}
                  onChange={e => setStoryForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Story title"
                />
              </div>
              <div>
                <Label>Logline</Label>
                <Textarea
                  value={storyForm.logline}
                  onChange={e => setStoryForm(prev => ({ ...prev, logline: e.target.value }))}
                  placeholder="One-sentence summary of your story"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Genre</Label>
                  <Input
                    value={storyForm.genre}
                    onChange={e => setStoryForm(prev => ({ ...prev, genre: e.target.value }))}
                    placeholder="e.g., Drama, Comedy"
                  />
                </div>
                <div>
                  <Label>Tone</Label>
                  <Input
                    value={storyForm.tone}
                    onChange={e => setStoryForm(prev => ({ ...prev, tone: e.target.value }))}
                    placeholder="e.g., Dark, Uplifting"
                  />
                </div>
              </div>
              <div>
                <Label>Themes (comma-separated)</Label>
                <Input
                  value={storyForm.themes}
                  onChange={e => setStoryForm(prev => ({ ...prev, themes: e.target.value }))}
                  placeholder="e.g., Redemption, Family, Faith"
                />
              </div>
              <div>
                <Label>Structure Type</Label>
                <Select
                  value={storyForm.structure_type}
                  onValueChange={val => setStoryForm(prev => ({ ...prev, structure_type: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STRUCTURE_TYPES.map(st => (
                      <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateStoryDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateStory} disabled={!storyForm.title || createStory.isPending}>
                {createStory.isPending ? 'Creating...' : 'Create Story'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Story Dialog */}
        <Dialog open={showEditStoryDialog} onOpenChange={setShowEditStoryDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Story</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={storyForm.title}
                  onChange={e => setStoryForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div>
                <Label>Logline</Label>
                <Textarea
                  value={storyForm.logline}
                  onChange={e => setStoryForm(prev => ({ ...prev, logline: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Genre</Label>
                  <Input
                    value={storyForm.genre}
                    onChange={e => setStoryForm(prev => ({ ...prev, genre: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Tone</Label>
                  <Input
                    value={storyForm.tone}
                    onChange={e => setStoryForm(prev => ({ ...prev, tone: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Themes (comma-separated)</Label>
                <Input
                  value={storyForm.themes}
                  onChange={e => setStoryForm(prev => ({ ...prev, themes: e.target.value }))}
                />
              </div>
              <div>
                <Label>Structure Type</Label>
                <Select
                  value={storyForm.structure_type}
                  onValueChange={val => setStoryForm(prev => ({ ...prev, structure_type: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STRUCTURE_TYPES.map(st => (
                      <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditStoryDialog(false)}>Cancel</Button>
              <Button onClick={handleUpdateStory} disabled={updateStory.isPending}>
                {updateStory.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Story Dialog */}
        <AlertDialog open={showDeleteStoryDialog} onOpenChange={setShowDeleteStoryDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Story?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{storyToDelete?.title}" and all its beats, characters, and arcs. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteStory} className="bg-red-600 hover:bg-red-700">
                Delete Story
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Detail View (story selected)
  if (loadingDetail) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-6">
          <Skeleton className="h-96 flex-1" />
          <Skeleton className="h-96 w-80" />
        </div>
      </div>
    );
  }

  if (!storyDetail) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-xl font-semibold text-bone-white mb-2">Story Not Found</h3>
        <Button variant="outline" onClick={() => setSelectedStoryId(null)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Stories
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedStoryId(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-heading text-bone-white">{storyDetail.title}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-gray">
              {storyDetail.genre && <span>{storyDetail.genre}</span>}
              {storyDetail.genre && storyDetail.structure_type && <span>|</span>}
              {storyDetail.structure_type && (
                <span>{STRUCTURE_TYPES.find(s => s.value === storyDetail.structure_type)?.label}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCharactersPanel(!showCharactersPanel)}>
            <Users className="w-4 h-4 mr-2" />
            {showCharactersPanel ? 'Hide' : 'Show'} Characters
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => openEditStoryDialog(storyDetail)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit Story
            </Button>
          )}
        </div>
      </div>

      {/* Logline and themes */}
      {(storyDetail.logline || (storyDetail.themes && storyDetail.themes.length > 0)) && (
        <Card className="bg-charcoal-black/50">
          <CardContent className="pt-4">
            {storyDetail.logline && (
              <p className="text-muted-gray italic mb-2">{storyDetail.logline}</p>
            )}
            {storyDetail.themes && storyDetail.themes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {storyDetail.themes.map((theme, idx) => (
                  <Badge key={idx} variant="outline">{theme}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main content: Beats + Characters */}
      <div className="flex gap-6">
        {/* Beats Section */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-bone-white flex items-center gap-2">
              <ListOrdered className="w-5 h-5" />
              Story Beats
            </h3>
            {canEdit && (
              <Button size="sm" onClick={() => setShowCreateBeatDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Beat
              </Button>
            )}
          </div>

          {!storyDetail.beats || storyDetail.beats.length === 0 ? (
            <Card className="bg-charcoal-black/30">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Sparkles className="w-10 h-10 text-muted-gray mb-3" />
                <p className="text-muted-gray text-center">No beats yet. Add story beats to outline your narrative.</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-400px)]">
              <div className="space-y-3 pr-4">
                {storyDetail.beats.map((beat, idx) => (
                  <Card
                    key={beat.id}
                    className={`bg-charcoal-black/50 cursor-pointer transition-colors ${
                      selectedBeatId === beat.id ? 'border-accent-yellow' : 'hover:border-muted-gray'
                    }`}
                    onClick={() => setSelectedBeatId(beat.id === selectedBeatId ? null : beat.id)}
                  >
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-gray font-mono">#{beat.sort_order}</span>
                            {beat.act_marker && (
                              <Badge variant="secondary" className="text-xs">{beat.act_marker}</Badge>
                            )}
                          </div>
                          <h4 className="font-medium text-bone-white">{beat.title}</h4>
                          {beat.content && (
                            <p className="text-sm text-muted-gray mt-1 line-clamp-2">{beat.content}</p>
                          )}
                          {beat.character_arcs && beat.character_arcs.length > 0 && (
                            <div className="flex items-center gap-1 mt-2">
                              <Link2 className="w-3 h-3 text-accent-yellow" />
                              <span className="text-xs text-accent-yellow">
                                {beat.character_arcs.length} character arc{beat.character_arcs.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={idx === 0}
                              onClick={() => handleReorderBeat(beat.id, 'UP')}
                            >
                              <ChevronUp className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={idx === storyDetail.beats!.length - 1}
                              onClick={() => handleReorderBeat(beat.id, 'DOWN')}
                            >
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditBeatDialog(beat)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-500"
                                  onClick={() => {
                                    setBeatToDelete(beat);
                                    setShowDeleteBeatDialog(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Characters Panel */}
        {showCharactersPanel && (
          <div className="w-80 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-bone-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Characters
              </h3>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => setShowCreateCharacterDialog(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>

            <ScrollArea className="h-[calc(100vh-400px)]">
              <div className="space-y-3 pr-4">
                {!storyDetail.characters || storyDetail.characters.length === 0 ? (
                  <Card className="bg-charcoal-black/30">
                    <CardContent className="py-8 text-center">
                      <User className="w-8 h-8 text-muted-gray mx-auto mb-2" />
                      <p className="text-sm text-muted-gray">No characters yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  storyDetail.characters.map(character => (
                    <Card key={character.id} className="bg-charcoal-black/50">
                      <CardContent className="py-3">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-bone-white">{character.name}</h4>
                            {character.role && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {CHARACTER_ROLES.find(r => r.value === character.role)?.label || character.role}
                              </Badge>
                            )}
                          </div>
                          {canEdit && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditCharacterDialog(character)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setArcCharacterId(character.id);
                                    setArcForm({ beat_id: '', description: '' });
                                    setShowCreateArcDialog(true);
                                  }}
                                >
                                  <Link2 className="w-4 h-4 mr-2" />
                                  Add Arc Point
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-500"
                                  onClick={() => {
                                    setCharacterToDelete(character);
                                    setShowDeleteCharacterDialog(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        {character.arc_summary && (
                          <p className="text-xs text-muted-gray line-clamp-2">{character.arc_summary}</p>
                        )}
                        {character.arcs && character.arcs.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-muted-gray/20">
                            <p className="text-xs text-accent-yellow mb-1">Arc Points:</p>
                            <div className="space-y-1">
                              {character.arcs.slice(0, 3).map(arc => (
                                <p key={arc.id} className="text-xs text-muted-gray truncate">
                                  • {arc.description}
                                </p>
                              ))}
                              {character.arcs.length > 3 && (
                                <p className="text-xs text-muted-gray">+{character.arcs.length - 3} more</p>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Beat Dialogs */}
      <Dialog open={showCreateBeatDialog} onOpenChange={setShowCreateBeatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Beat</DialogTitle>
            <DialogDescription>Add a new story beat to your narrative structure.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={beatForm.title}
                onChange={e => setBeatForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Beat title"
              />
            </div>
            <div>
              <Label>Act Marker</Label>
              <Input
                value={beatForm.act_marker}
                onChange={e => setBeatForm(prev => ({ ...prev, act_marker: e.target.value }))}
                placeholder="e.g., Act 1, Midpoint, Climax"
              />
            </div>
            <div>
              <Label>Content</Label>
              <Textarea
                value={beatForm.content}
                onChange={e => setBeatForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="What happens in this beat?"
                rows={4}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={beatForm.notes}
                onChange={e => setBeatForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateBeatDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateBeat} disabled={!beatForm.title || createBeat.isPending}>
              {createBeat.isPending ? 'Adding...' : 'Add Beat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditBeatDialog} onOpenChange={setShowEditBeatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Beat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={beatForm.title}
                onChange={e => setBeatForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>Act Marker</Label>
              <Input
                value={beatForm.act_marker}
                onChange={e => setBeatForm(prev => ({ ...prev, act_marker: e.target.value }))}
              />
            </div>
            <div>
              <Label>Content</Label>
              <Textarea
                value={beatForm.content}
                onChange={e => setBeatForm(prev => ({ ...prev, content: e.target.value }))}
                rows={4}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={beatForm.notes}
                onChange={e => setBeatForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditBeatDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateBeat} disabled={updateBeat.isPending}>
              {updateBeat.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteBeatDialog} onOpenChange={setShowDeleteBeatDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Beat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{beatToDelete?.title}" and any character arcs linked to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBeat} className="bg-red-600 hover:bg-red-700">
              Delete Beat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Character Dialogs */}
      <Dialog open={showCreateCharacterDialog} onOpenChange={setShowCreateCharacterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Character</DialogTitle>
            <DialogDescription>Add a new character to your story.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={characterForm.name}
                onChange={e => setCharacterForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Character name"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select
                value={characterForm.role}
                onValueChange={val => setCharacterForm(prev => ({ ...prev, role: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {CHARACTER_ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Arc Summary</Label>
              <Textarea
                value={characterForm.arc_summary}
                onChange={e => setCharacterForm(prev => ({ ...prev, arc_summary: e.target.value }))}
                placeholder="Brief summary of this character's journey"
                rows={3}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={characterForm.notes}
                onChange={e => setCharacterForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCharacterDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateCharacter} disabled={!characterForm.name || createCharacter.isPending}>
              {createCharacter.isPending ? 'Adding...' : 'Add Character'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditCharacterDialog} onOpenChange={setShowEditCharacterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Character</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={characterForm.name}
                onChange={e => setCharacterForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select
                value={characterForm.role}
                onValueChange={val => setCharacterForm(prev => ({ ...prev, role: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {CHARACTER_ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Arc Summary</Label>
              <Textarea
                value={characterForm.arc_summary}
                onChange={e => setCharacterForm(prev => ({ ...prev, arc_summary: e.target.value }))}
                rows={3}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={characterForm.notes}
                onChange={e => setCharacterForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCharacterDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateCharacter} disabled={updateCharacter.isPending}>
              {updateCharacter.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteCharacterDialog} onOpenChange={setShowDeleteCharacterDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Character?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{characterToDelete?.name}" and all their arc entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCharacter} className="bg-red-600 hover:bg-red-700">
              Delete Character
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Character Arc Dialog */}
      <Dialog open={showCreateArcDialog} onOpenChange={setShowCreateArcDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Arc Point</DialogTitle>
            <DialogDescription>Link a character's development to a specific beat.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Beat *</Label>
              <Select
                value={arcForm.beat_id}
                onValueChange={val => setArcForm(prev => ({ ...prev, beat_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select beat" />
                </SelectTrigger>
                <SelectContent>
                  {storyDetail.beats?.map(beat => (
                    <SelectItem key={beat.id} value={beat.id}>
                      #{beat.sort_order} - {beat.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea
                value={arcForm.description}
                onChange={e => setArcForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="How does the character change or develop at this beat?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateArcDialog(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!arcCharacterId) return;
                const token = localStorage.getItem('access_token');
                const response = await fetch(
                  `/api/v1/backlot/projects/${projectId}/stories/${selectedStoryId}/characters/${arcCharacterId}/arcs`,
                  {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(arcForm),
                  }
                );
                if (response.ok) {
                  setShowCreateArcDialog(false);
                  // Refetch story detail - this is a workaround since we can't use the hook directly
                  window.location.reload();
                }
              }}
              disabled={!arcForm.beat_id || !arcForm.description}
            >
              Add Arc Point
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
