/**
 * StoryManagementView - Manage beat sheets, beats, characters, and character arcs
 * Professional beat sheet planning tool with templates and PDF export
 */
import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertCircle,
  User,
  Sparkles,
  Link2,
  Contact,
  Film,
  Clapperboard,
  FileText,
  LayoutTemplate,
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
  useCreateCharacterFromContact,
  useUpdateCharacter,
  useDeleteCharacter,
  useCreateCharacterArc,
  useUpdateCharacterArc,
  useDeleteCharacterArc,
  getStoryExportUrl,
  useStoryEpisodeLinks,
  useLinkStoryToEpisode,
  useUnlinkStoryFromEpisode,
  useBeatSceneLinks,
  useLinkBeatToScene,
  useUnlinkBeatFromScene,
  useCharacterCastLinks,
  useLinkCharacterToCast,
  useUnlinkCharacterFromCast,
  useContacts,
  useBeatTemplates,
  useApplyTemplate,
  getBeatSheetPdfUrl,
  Story,
  StoryBeat,
  StoryCharacter,
  CharacterArc,
  StoryEpisodeLink,
  BeatSceneLink,
  CharacterCastLink,
  BeatTemplate,
  useEpisodes,
  useScenesList,
  useProjectRoles,
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

const EMOTIONAL_TONES = [
  { value: 'establishing', label: 'Establishing', color: '#6B7280' },
  { value: 'introducing', label: 'Introducing', color: '#3B82F6' },
  { value: 'hopeful', label: 'Hopeful', color: '#22C55E' },
  { value: 'tense', label: 'Tense', color: '#EF4444' },
  { value: 'exciting', label: 'Exciting', color: '#F97316' },
  { value: 'devastating', label: 'Devastating', color: '#DC2626' },
  { value: 'triumphant', label: 'Triumphant', color: '#8B5CF6' },
  { value: 'contemplative', label: 'Contemplative', color: '#6366F1' },
  { value: 'comedic', label: 'Comedic', color: '#FBBF24' },
  { value: 'romantic', label: 'Romantic', color: '#EC4899' },
  { value: 'mysterious', label: 'Mysterious', color: '#7C3AED' },
  { value: 'uncertain', label: 'Uncertain', color: '#9CA3AF' },
  { value: 'surprising', label: 'Surprising', color: '#F59E0B' },
  { value: 'determined', label: 'Determined', color: '#059669' },
  { value: 'warm', label: 'Warm', color: '#FB923C' },
  { value: 'pivotal', label: 'Pivotal', color: '#8B5CF6' },
  { value: 'despairing', label: 'Despairing', color: '#1F2937' },
  { value: 'resolved', label: 'Resolved', color: '#10B981' },
];

const ACT_MARKERS = [
  { value: 'ACT 1', label: 'Act 1' },
  { value: 'ACT 2', label: 'Act 2' },
  { value: 'ACT 3', label: 'Act 3' },
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

  // Connection dialog states
  const [showEpisodeLinkDialog, setShowEpisodeLinkDialog] = useState(false);
  const [showSceneLinkDialog, setShowSceneLinkDialog] = useState(false);
  const [beatToLink, setBeatToLink] = useState<StoryBeat | null>(null);
  const [showCastLinkDialog, setShowCastLinkDialog] = useState(false);
  const [characterToLink, setCharacterToLink] = useState<StoryCharacter | null>(null);

  // Unified connections dialog
  const [showConnectionsDialog, setShowConnectionsDialog] = useState(false);
  const [connectionsTab, setConnectionsTab] = useState<'episodes' | 'scenes' | 'cast'>('episodes');
  const [selectedBeatForScene, setSelectedBeatForScene] = useState<string>('');
  const [selectedCharacterForCast, setSelectedCharacterForCast] = useState<string>('');

  // Character creation with contact linking
  const [characterTab, setCharacterTab] = useState<'contact' | 'new'>('new');
  const [selectedContactId, setSelectedContactId] = useState<string>('');

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
    page_start: '' as string,
    page_end: '' as string,
    emotional_tone: '',
    primary_character_id: '',
  });

  // Template selection for new beat sheet
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showApplyTemplateDialog, setShowApplyTemplateDialog] = useState(false);

  // Beat detail view modal
  const [showBeatDetailDialog, setShowBeatDetailDialog] = useState(false);
  const [beatToView, setBeatToView] = useState<StoryBeat | null>(null);

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
  const { data: beatTemplates } = useBeatTemplates(projectId, selectedStoryId);

  // Connection queries
  const { data: episodeLinks } = useStoryEpisodeLinks(projectId, selectedStoryId);
  const { data: episodes } = useEpisodes(projectId);
  const { data: scenes } = useScenesList(projectId);
  const { data: projectRoles } = useProjectRoles(projectId);
  const { data: beatSceneLinks } = useBeatSceneLinks(projectId, selectedStoryId, beatToLink?.id || null);
  const { data: characterCastLinks } = useCharacterCastLinks(projectId, selectedStoryId, characterToLink?.id || null);
  const { data: contacts } = useContacts(projectId);

  // Queries for unified connections dialog
  const { data: unifiedBeatSceneLinks } = useBeatSceneLinks(projectId, selectedStoryId, selectedBeatForScene || null);
  const { data: unifiedCharacterCastLinks } = useCharacterCastLinks(projectId, selectedStoryId, selectedCharacterForCast || null);

  // Mutations
  const createStory = useCreateStory(projectId);
  const updateStory = useUpdateStory(projectId, selectedStoryId || '');
  const deleteStory = useDeleteStory(projectId);

  const createBeat = useCreateBeat(projectId, selectedStoryId || '');
  const updateBeat = useUpdateBeat(projectId, selectedStoryId || '');
  const deleteBeat = useDeleteBeat(projectId, selectedStoryId || '');
  const reorderBeats = useReorderBeats(projectId, selectedStoryId || '');
  const applyTemplate = useApplyTemplate(projectId, selectedStoryId || '');

  const createCharacter = useCreateCharacter(projectId, selectedStoryId || '');
  const createCharacterFromContact = useCreateCharacterFromContact(projectId, selectedStoryId || '');
  const updateCharacter = useUpdateCharacter(projectId, selectedStoryId || '');
  const deleteCharacter = useDeleteCharacter(projectId, selectedStoryId || '');

  // Connection mutations
  const linkStoryToEpisode = useLinkStoryToEpisode(projectId, selectedStoryId || '');
  const unlinkStoryFromEpisode = useUnlinkStoryFromEpisode(projectId, selectedStoryId || '');
  const linkBeatToScene = useLinkBeatToScene(projectId, selectedStoryId || '', beatToLink?.id || '');
  const unlinkBeatFromScene = useUnlinkBeatFromScene(projectId, selectedStoryId || '', beatToLink?.id || '');
  const linkCharacterToCast = useLinkCharacterToCast(projectId, selectedStoryId || '', characterToLink?.id || '');
  const unlinkCharacterFromCast = useUnlinkCharacterFromCast(projectId, selectedStoryId || '', characterToLink?.id || '');

  // Unified connections dialog mutations
  const unifiedLinkBeatToScene = useLinkBeatToScene(projectId, selectedStoryId || '', selectedBeatForScene || '');
  const unifiedUnlinkBeatFromScene = useUnlinkBeatFromScene(projectId, selectedStoryId || '', selectedBeatForScene || '');
  const unifiedLinkCharacterToCast = useLinkCharacterToCast(projectId, selectedStoryId || '', selectedCharacterForCast || '');
  const unifiedUnlinkCharacterFromCast = useUnlinkCharacterFromCast(projectId, selectedStoryId || '', selectedCharacterForCast || '');

  // Query client for invalidating queries after arc creation
  const queryClient = useQueryClient();

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
    // Only set selectedStoryId if not already viewing this story (from list view)
    if (selectedStoryId !== story.id) {
      setSelectedStoryId(story.id);
    }
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
      page_start: beatForm.page_start ? parseInt(beatForm.page_start) : undefined,
      page_end: beatForm.page_end ? parseInt(beatForm.page_end) : undefined,
      emotional_tone: beatForm.emotional_tone || undefined,
      primary_character_id: beatForm.primary_character_id || undefined,
    });
    setShowCreateBeatDialog(false);
    setBeatForm({ title: '', act_marker: '', content: '', notes: '', page_start: '', page_end: '', emotional_tone: '', primary_character_id: '' });
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
        page_start: beatForm.page_start ? parseInt(beatForm.page_start) : undefined,
        page_end: beatForm.page_end ? parseInt(beatForm.page_end) : undefined,
        emotional_tone: beatForm.emotional_tone || undefined,
        primary_character_id: beatForm.primary_character_id || undefined,
      },
    });
    setShowEditBeatDialog(false);
    setBeatToEdit(null);
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;
    await applyTemplate.mutateAsync({ template: selectedTemplate });
    setShowApplyTemplateDialog(false);
    setSelectedTemplate('');
  };

  const handleExportPdf = () => {
    if (!selectedStoryId) return;
    const url = getBeatSheetPdfUrl(projectId, selectedStoryId);
    window.open(url, '_blank');
  };

  const openBeatDetail = (beat: StoryBeat) => {
    setBeatToView(beat);
    setShowBeatDetailDialog(true);
  };

  const handleEditFromDetail = () => {
    if (beatToView) {
      openEditBeatDialog(beatToView);
      setShowBeatDetailDialog(false);
    }
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
      page_start: beat.page_start?.toString() || '',
      page_end: beat.page_end?.toString() || '',
      emotional_tone: beat.emotional_tone || '',
      primary_character_id: beat.primary_character_id || '',
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
    setCharacterTab('new');
    setSelectedContactId('');
  };

  const handleCreateCharacterFromContact = async () => {
    await createCharacterFromContact.mutateAsync({
      contact_id: selectedContactId,
      role: characterForm.role || undefined,
      arc_summary: characterForm.arc_summary || undefined,
      notes: characterForm.notes || undefined,
    });
    setShowCreateCharacterDialog(false);
    setCharacterForm({ name: '', role: '', arc_summary: '', notes: '' });
    setCharacterTab('new');
    setSelectedContactId('');
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

  // List View (no beat sheet selected)
  if (!selectedStoryId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-heading text-bone-white">Beat Sheet</h2>
            <p className="text-sm text-muted-gray">Professional beat sheet planning with templates</p>
          </div>
          {canEdit && (
            <Button onClick={() => setShowCreateStoryDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Beat Sheet
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
            <h3 className="text-xl font-semibold text-bone-white mb-2">No Beat Sheets Yet</h3>
            <p className="text-muted-gray text-center max-w-md mb-4">
              Create your first beat sheet to start planning your narrative structure with professional templates.
            </p>
            {canEdit && (
              <Button onClick={() => setShowCreateStoryDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Beat Sheet
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stories.map(story => (
              <Card
                key={story.id}
                className="cursor-pointer hover:border-accent-yellow/50 transition-colors bg-charcoal-black/50 border-muted-gray/20"
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

        {/* Create Beat Sheet Dialog */}
        <Dialog open={showCreateStoryDialog} onOpenChange={setShowCreateStoryDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Beat Sheet</DialogTitle>
              <DialogDescription>Create a beat sheet with optional template to get started.</DialogDescription>
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
                {createStory.isPending ? 'Creating...' : 'Create Beat Sheet'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Beat Sheet Dialog */}
        <Dialog open={showEditStoryDialog} onOpenChange={setShowEditStoryDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Beat Sheet</DialogTitle>
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

        {/* Delete Beat Sheet Dialog */}
        <AlertDialog open={showDeleteStoryDialog} onOpenChange={setShowDeleteStoryDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Beat Sheet?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{storyToDelete?.title}" and all its beats, characters, and arcs. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteStory} className="bg-red-600 hover:bg-red-700">
                Delete Beat Sheet
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Detail View (beat sheet selected)
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
        <h3 className="text-xl font-semibold text-bone-white mb-2">Beat Sheet Not Found</h3>
        <Button variant="outline" onClick={() => setSelectedStoryId(null)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Beat Sheets
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
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowApplyTemplateDialog(true)}
              className="border-purple-500/50 hover:border-purple-500"
            >
              <LayoutTemplate className="w-4 h-4 mr-2" />
              Apply Template
            </Button>
          )}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConnectionsDialog(true)}
              className="border-accent-yellow/50 hover:border-accent-yellow"
            >
              <Link2 className="w-4 h-4 mr-2" />
              Connections
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowCharactersPanel(!showCharactersPanel)}>
            <Users className="w-4 h-4 mr-2" />
            {showCharactersPanel ? 'Hide' : 'Show'} Characters
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => openEditStoryDialog(storyDetail)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Logline and themes */}
      {(storyDetail.logline || (storyDetail.themes && storyDetail.themes.length > 0) || (episodeLinks && episodeLinks.length > 0)) && (
        <Card className="bg-charcoal-black/50 border-muted-gray/20">
          <CardContent className="pt-4">
            {storyDetail.logline && (
              <p className="text-muted-gray italic mb-2">{storyDetail.logline}</p>
            )}
            {storyDetail.themes && storyDetail.themes.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {storyDetail.themes.map((theme, idx) => (
                  <Badge key={idx} variant="outline">{theme}</Badge>
                ))}
              </div>
            )}
            {/* Episode connections */}
            {episodeLinks && episodeLinks.length > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t border-muted-gray/20 mt-2">
                <Film className="w-4 h-4 text-accent-yellow" />
                <span className="text-sm text-muted-gray">
                  Linked to {episodeLinks.length} episode{episodeLinks.length !== 1 ? 's' : ''}:
                </span>
                <div className="flex flex-wrap gap-1">
                  {episodeLinks.slice(0, 3).map(link => (
                    <Badge key={link.id} variant="secondary" className="text-xs">
                      {link.episode?.episode_code || 'Episode'}
                    </Badge>
                  ))}
                  {episodeLinks.length > 3 && (
                    <Badge variant="secondary" className="text-xs">+{episodeLinks.length - 3}</Badge>
                  )}
                </div>
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
            <Card className="bg-charcoal-black/30 border-muted-gray/20">
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
                    className={`bg-charcoal-black/50 cursor-pointer transition-colors border-muted-gray/20 ${
                      selectedBeatId === beat.id ? 'border-accent-yellow' : 'hover:border-muted-gray'
                    }`}
                    onClick={() => openBeatDetail(beat)}
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
                          {/* New beat info: pages, tone, character */}
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-gray">
                            {(beat.page_start || beat.page_end) && (
                              <span>
                                {beat.page_start === beat.page_end
                                  ? `p. ${beat.page_start}`
                                  : `pp. ${beat.page_start || '?'}-${beat.page_end || '?'}`}
                              </span>
                            )}
                            {beat.emotional_tone && (
                              <Badge
                                variant="outline"
                                className="text-xs"
                                style={{
                                  borderColor: EMOTIONAL_TONES.find(t => t.value === beat.emotional_tone)?.color || '#6B7280',
                                  color: EMOTIONAL_TONES.find(t => t.value === beat.emotional_tone)?.color || '#6B7280',
                                }}
                              >
                                {EMOTIONAL_TONES.find(t => t.value === beat.emotional_tone)?.label || beat.emotional_tone}
                              </Badge>
                            )}
                            {beat.primary_character && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {beat.primary_character.name}
                              </span>
                            )}
                          </div>
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
                                <DropdownMenuItem onClick={() => {
                                  setBeatToLink(beat);
                                  setShowSceneLinkDialog(true);
                                }}>
                                  <Link2 className="w-4 h-4 mr-2" />
                                  Link Scenes
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
                  <Card className="bg-charcoal-black/30 border-muted-gray/20">
                    <CardContent className="py-8 text-center">
                      <User className="w-8 h-8 text-muted-gray mx-auto mb-2" />
                      <p className="text-sm text-muted-gray">No characters yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  storyDetail.characters.map(character => (
                    <Card key={character.id} className="bg-charcoal-black/50 border-muted-gray/20">
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
                                  onClick={() => {
                                    setCharacterToLink(character);
                                    setShowCastLinkDialog(true);
                                  }}
                                >
                                  <Users className="w-4 h-4 mr-2" />
                                  Link to Cast
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
                        {/* Connection indicators */}
                        {character.contact && (
                          <div className="flex items-center gap-1 text-xs text-blue-400 mb-1">
                            <Contact className="w-3 h-3" />
                            <span className="truncate">{character.contact.email || character.contact.name}</span>
                          </div>
                        )}
                        {character.arc_summary && (
                          <p className="text-xs text-muted-gray line-clamp-2">{character.arc_summary}</p>
                        )}
                        {character.arcs && character.arcs.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-muted-gray/20">
                            <p className="text-xs text-accent-yellow mb-1">
                              <Link2 className="w-3 h-3 inline mr-1" />
                              {character.arcs.length} arc point{character.arcs.length !== 1 ? 's' : ''}
                            </p>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Beat</DialogTitle>
            <DialogDescription>Add a new beat to your beat sheet.</DialogDescription>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Act Marker</Label>
                <Select
                  value={beatForm.act_marker}
                  onValueChange={val => setBeatForm(prev => ({ ...prev, act_marker: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select act" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACT_MARKERS.map(act => (
                      <SelectItem key={act.value} value={act.value}>{act.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Emotional Tone</Label>
                <Select
                  value={beatForm.emotional_tone}
                  onValueChange={val => setBeatForm(prev => ({ ...prev, emotional_tone: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMOTIONAL_TONES.map(tone => (
                      <SelectItem key={tone.value} value={tone.value}>
                        <span style={{ color: tone.color }}>{tone.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Page Start</Label>
                <Input
                  type="number"
                  value={beatForm.page_start}
                  onChange={e => setBeatForm(prev => ({ ...prev, page_start: e.target.value }))}
                  placeholder="1"
                  min="1"
                />
              </div>
              <div>
                <Label>Page End</Label>
                <Input
                  type="number"
                  value={beatForm.page_end}
                  onChange={e => setBeatForm(prev => ({ ...prev, page_end: e.target.value }))}
                  placeholder="10"
                  min="1"
                />
              </div>
            </div>
            <div>
              <Label>Primary Character</Label>
              <Select
                value={beatForm.primary_character_id}
                onValueChange={val => setBeatForm(prev => ({ ...prev, primary_character_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select character" />
                </SelectTrigger>
                <SelectContent>
                  {storyDetail?.characters?.map(char => (
                    <SelectItem key={char.id} value={char.id}>
                      {char.name} {char.role && `(${CHARACTER_ROLES.find(r => r.value === char.role)?.label || char.role})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Content</Label>
              <Textarea
                value={beatForm.content}
                onChange={e => setBeatForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="What happens in this beat?"
                rows={3}
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
        <DialogContent className="max-w-lg">
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Act Marker</Label>
                <Select
                  value={beatForm.act_marker}
                  onValueChange={val => setBeatForm(prev => ({ ...prev, act_marker: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select act" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACT_MARKERS.map(act => (
                      <SelectItem key={act.value} value={act.value}>{act.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Emotional Tone</Label>
                <Select
                  value={beatForm.emotional_tone}
                  onValueChange={val => setBeatForm(prev => ({ ...prev, emotional_tone: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMOTIONAL_TONES.map(tone => (
                      <SelectItem key={tone.value} value={tone.value}>
                        <span style={{ color: tone.color }}>{tone.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Page Start</Label>
                <Input
                  type="number"
                  value={beatForm.page_start}
                  onChange={e => setBeatForm(prev => ({ ...prev, page_start: e.target.value }))}
                  placeholder="1"
                  min="1"
                />
              </div>
              <div>
                <Label>Page End</Label>
                <Input
                  type="number"
                  value={beatForm.page_end}
                  onChange={e => setBeatForm(prev => ({ ...prev, page_end: e.target.value }))}
                  placeholder="10"
                  min="1"
                />
              </div>
            </div>
            <div>
              <Label>Primary Character</Label>
              <Select
                value={beatForm.primary_character_id}
                onValueChange={val => setBeatForm(prev => ({ ...prev, primary_character_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select character" />
                </SelectTrigger>
                <SelectContent>
                  {storyDetail?.characters?.map(char => (
                    <SelectItem key={char.id} value={char.id}>
                      {char.name} {char.role && `(${CHARACTER_ROLES.find(r => r.value === char.role)?.label || char.role})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Content</Label>
              <Textarea
                value={beatForm.content}
                onChange={e => setBeatForm(prev => ({ ...prev, content: e.target.value }))}
                rows={3}
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
      <Dialog open={showCreateCharacterDialog} onOpenChange={(open) => {
        setShowCreateCharacterDialog(open);
        if (!open) {
          setCharacterForm({ name: '', role: '', arc_summary: '', notes: '' });
          setCharacterTab('new');
          setSelectedContactId('');
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Character</DialogTitle>
            <DialogDescription>Add a new character from a contact or create a new one.</DialogDescription>
          </DialogHeader>
          <Tabs value={characterTab} onValueChange={(v) => setCharacterTab(v as 'contact' | 'new')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="contact" className="flex items-center gap-2">
                <Contact className="w-4 h-4" />
                From Contact
              </TabsTrigger>
              <TabsTrigger value="new" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Create New
              </TabsTrigger>
            </TabsList>
            <TabsContent value="contact" className="space-y-4 mt-4">
              <div>
                <Label>Select Contact *</Label>
                <Select
                  value={selectedContactId}
                  onValueChange={(val) => {
                    setSelectedContactId(val);
                    // Pre-fill name from selected contact
                    const contact = contacts?.find(c => c.id === val);
                    if (contact) {
                      setCharacterForm(prev => ({ ...prev, name: contact.name }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a contact..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts?.map(contact => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name}
                        {contact.email && <span className="text-muted-gray ml-2">({contact.email})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedContactId && (
                <div className="bg-charcoal-black/50 rounded p-3 space-y-1">
                  <p className="text-sm text-bone-white font-medium">Contact Info</p>
                  {(() => {
                    const contact = contacts?.find(c => c.id === selectedContactId);
                    return contact ? (
                      <>
                        <p className="text-xs text-muted-gray">{contact.name}</p>
                        {contact.email && <p className="text-xs text-muted-gray">{contact.email}</p>}
                        {contact.phone && <p className="text-xs text-muted-gray">{contact.phone}</p>}
                      </>
                    ) : null;
                  })()}
                </div>
              )}
            </TabsContent>
            <TabsContent value="new" className="space-y-4 mt-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={characterForm.name}
                  onChange={e => setCharacterForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Character name"
                />
              </div>
            </TabsContent>
          </Tabs>
          {/* Common fields for both tabs */}
          <div className="space-y-4 mt-4 pt-4 border-t border-muted-gray/20">
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
            {characterTab === 'contact' ? (
              <Button
                onClick={handleCreateCharacterFromContact}
                disabled={!selectedContactId || createCharacterFromContact.isPending}
              >
                {createCharacterFromContact.isPending ? 'Adding...' : 'Add Character'}
              </Button>
            ) : (
              <Button
                onClick={handleCreateCharacter}
                disabled={!characterForm.name || createCharacter.isPending}
              >
                {createCharacter.isPending ? 'Adding...' : 'Add Character'}
              </Button>
            )}
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
                  setArcForm({ character_id: '', beat_id: '', description: '' });
                  // Invalidate story detail query to refetch with new arc
                  queryClient.invalidateQueries({ queryKey: ['backlot-story', projectId, selectedStoryId] });
                }
              }}
              disabled={!arcForm.beat_id || !arcForm.description}
            >
              Add Arc Point
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Episode Link Dialog */}
      <Dialog open={showEpisodeLinkDialog} onOpenChange={setShowEpisodeLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Story to Episodes</DialogTitle>
            <DialogDescription>
              Connect this story to episodes where it appears.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current links */}
            {episodeLinks && episodeLinks.length > 0 && (
              <div className="space-y-2">
                <Label>Linked Episodes</Label>
                {episodeLinks.map(link => (
                  <div key={link.id} className="flex items-center justify-between bg-charcoal-black/50 p-2 rounded">
                    <span className="text-sm">
                      {link.episode?.episode_code} - {link.episode?.title}
                      <Badge variant="outline" className="ml-2 text-xs">{link.relationship}</Badge>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500"
                      onClick={() => unlinkStoryFromEpisode.mutate(link.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {/* Add new link */}
            <div className="space-y-2">
              <Label>Add Episode</Label>
              <Select
                onValueChange={(episodeId) => {
                  linkStoryToEpisode.mutate({ episode_id: episodeId, relationship: 'primary' });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an episode..." />
                </SelectTrigger>
                <SelectContent>
                  {episodes?.filter(ep => !episodeLinks?.some(l => l.episode_id === ep.id)).map(ep => (
                    <SelectItem key={ep.id} value={ep.id}>
                      {ep.episode_code} - {ep.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEpisodeLinkDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scene Link Dialog */}
      <Dialog open={showSceneLinkDialog} onOpenChange={(open) => {
        setShowSceneLinkDialog(open);
        if (!open) setBeatToLink(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Beat to Scenes</DialogTitle>
            <DialogDescription>
              Connect "{beatToLink?.title}" to scenes where this beat occurs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current links */}
            {beatSceneLinks && beatSceneLinks.length > 0 && (
              <div className="space-y-2">
                <Label>Linked Scenes</Label>
                {beatSceneLinks.map(link => (
                  <div key={link.id} className="flex items-center justify-between bg-charcoal-black/50 p-2 rounded">
                    <span className="text-sm">
                      Scene {link.scene?.scene_number} - {link.scene?.location}
                      <Badge variant="outline" className="ml-2 text-xs">{link.relationship}</Badge>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500"
                      onClick={() => unlinkBeatFromScene.mutate(link.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {/* Add new link */}
            <div className="space-y-2">
              <Label>Add Scene</Label>
              <Select
                onValueChange={(sceneId) => {
                  linkBeatToScene.mutate({ scene_id: sceneId, relationship: 'features' });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a scene..." />
                </SelectTrigger>
                <SelectContent>
                  {scenes?.filter(sc => !beatSceneLinks?.some(l => l.scene_id === sc.id)).map(sc => (
                    <SelectItem key={sc.id} value={sc.id}>
                      Scene {sc.scene_number} {sc.slugline ? `- ${sc.slugline}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSceneLinkDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cast Link Dialog */}
      <Dialog open={showCastLinkDialog} onOpenChange={(open) => {
        setShowCastLinkDialog(open);
        if (!open) setCharacterToLink(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Character to Cast</DialogTitle>
            <DialogDescription>
              Connect "{characterToLink?.name}" to project roles/cast members.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current links */}
            {characterCastLinks && characterCastLinks.length > 0 && (
              <div className="space-y-2">
                <Label>Linked Roles</Label>
                {characterCastLinks.map(link => (
                  <div key={link.id} className="flex items-center justify-between bg-charcoal-black/50 p-2 rounded">
                    <span className="text-sm">
                      {link.role?.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500"
                      onClick={() => unlinkCharacterFromCast.mutate(link.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {/* Add new link */}
            <div className="space-y-2">
              <Label>Add Role</Label>
              <Select
                onValueChange={(roleId) => {
                  linkCharacterToCast.mutate({ role_id: roleId });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role..." />
                </SelectTrigger>
                <SelectContent>
                  {projectRoles?.filter(r => !characterCastLinks?.some(l => l.role_id === r.id)).map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCastLinkDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unified Connections Dialog */}
      <Dialog open={showConnectionsDialog} onOpenChange={(open) => {
        setShowConnectionsDialog(open);
        if (!open) {
          setSelectedBeatForScene('');
          setSelectedCharacterForCast('');
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Beat Sheet Connections</DialogTitle>
            <DialogDescription>
              Link this beat sheet to episodes, beats to scenes, and characters to contacts.
            </DialogDescription>
          </DialogHeader>
          <Tabs value={connectionsTab} onValueChange={(v) => setConnectionsTab(v as 'episodes' | 'scenes' | 'cast')}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="episodes" className="flex items-center gap-2">
                <Film className="w-4 h-4" />
                Episodes
                {episodeLinks && episodeLinks.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{episodeLinks.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="scenes" className="flex items-center gap-2">
                <Clapperboard className="w-4 h-4" />
                Scenes
              </TabsTrigger>
              <TabsTrigger value="cast" className="flex items-center gap-2">
                <Contact className="w-4 h-4" />
                Contacts
              </TabsTrigger>
            </TabsList>

            {/* Episodes Tab */}
            <TabsContent value="episodes" className="mt-4 space-y-4">
              <ScrollArea className="h-[300px] pr-4">
                {episodeLinks && episodeLinks.length > 0 ? (
                  <div className="space-y-2">
                    {episodeLinks.map(link => (
                      <div key={link.id} className="flex items-center justify-between bg-charcoal-black/50 p-3 rounded">
                        <div className="flex items-center gap-3">
                          <Film className="w-4 h-4 text-accent-yellow" />
                          <div>
                            <p className="text-sm font-medium text-bone-white">
                              {link.episode?.episode_code} - {link.episode?.title}
                            </p>
                            <Badge variant="outline" className="text-xs">{link.relationship}</Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500"
                          onClick={() => unlinkStoryFromEpisode.mutate(link.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Film className="w-8 h-8 text-muted-gray mb-2" />
                    <p className="text-sm text-muted-gray">No episodes linked yet</p>
                  </div>
                )}
              </ScrollArea>
              <div className="pt-4 border-t border-muted-gray/20">
                <Label className="text-xs text-muted-gray mb-2 block">Add Episode</Label>
                <Select
                  onValueChange={(episodeId) => {
                    linkStoryToEpisode.mutate({ episode_id: episodeId, relationship: 'primary' });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an episode to link..." />
                  </SelectTrigger>
                  <SelectContent>
                    {episodes?.filter(ep => !episodeLinks?.some(l => l.episode_id === ep.id)).map(ep => (
                      <SelectItem key={ep.id} value={ep.id}>
                        {ep.episode_code} - {ep.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* Scenes Tab */}
            <TabsContent value="scenes" className="mt-4 space-y-4">
              <div>
                <Label className="text-xs text-muted-gray mb-2 block">Select Beat</Label>
                <Select
                  value={selectedBeatForScene}
                  onValueChange={setSelectedBeatForScene}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a beat to manage scene links..." />
                  </SelectTrigger>
                  <SelectContent>
                    {storyDetail?.beats?.map(beat => (
                      <SelectItem key={beat.id} value={beat.id}>
                        #{beat.sort_order} - {beat.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedBeatForScene && (
                <>
                  <ScrollArea className="h-[200px] pr-4">
                    {unifiedBeatSceneLinks && unifiedBeatSceneLinks.length > 0 ? (
                      <div className="space-y-2">
                        {unifiedBeatSceneLinks.map(link => (
                          <div key={link.id} className="flex items-center justify-between bg-charcoal-black/50 p-3 rounded">
                            <div className="flex items-center gap-3">
                              <Clapperboard className="w-4 h-4 text-accent-yellow" />
                              <div>
                                <p className="text-sm font-medium text-bone-white">
                                  Scene {link.scene?.scene_number} - {link.scene?.location || 'No location'}
                                </p>
                                <Badge variant="outline" className="text-xs">{link.relationship}</Badge>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500"
                              onClick={() => unifiedUnlinkBeatFromScene.mutate(link.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Clapperboard className="w-8 h-8 text-muted-gray mb-2" />
                        <p className="text-sm text-muted-gray">No scenes linked to this beat</p>
                      </div>
                    )}
                  </ScrollArea>
                  <div className="pt-4 border-t border-muted-gray/20">
                    <Label className="text-xs text-muted-gray mb-2 block">Add Scene</Label>
                    <Select
                      onValueChange={(sceneId) => {
                        unifiedLinkBeatToScene.mutate({ scene_id: sceneId, relationship: 'features' });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a scene to link..." />
                      </SelectTrigger>
                      <SelectContent>
                        {scenes?.filter(sc => !unifiedBeatSceneLinks?.some(l => l.scene_id === sc.id)).map(sc => (
                          <SelectItem key={sc.id} value={sc.id}>
                            Scene {sc.scene_number} {sc.slugline ? `- ${sc.slugline}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              {!selectedBeatForScene && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ListOrdered className="w-8 h-8 text-muted-gray mb-2" />
                  <p className="text-sm text-muted-gray">Select a beat above to manage its scene links</p>
                </div>
              )}
            </TabsContent>

            {/* Contacts Tab - Link characters to contacts */}
            <TabsContent value="cast" className="mt-4 space-y-4">
              <ScrollArea className="h-[350px] pr-4">
                <div className="space-y-3">
                  {storyDetail?.characters?.map(character => {
                    const linkedContact = contacts?.find(c => c.id === character.linked_contact_id);
                    return (
                      <div key={character.id} className="bg-charcoal-black/50 p-3 rounded border border-muted-gray/20">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-accent-yellow" />
                            <span className="font-medium text-bone-white">{character.name}</span>
                            {character.role && (
                              <Badge variant="outline" className="text-xs">
                                {CHARACTER_ROLES.find(r => r.value === character.role)?.label || character.role}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Contact className="w-4 h-4 text-muted-gray" />
                          {linkedContact ? (
                            <span className="text-sm text-bone-white">{linkedContact.name}</span>
                          ) : (
                            <span className="text-sm text-muted-gray italic">No contact linked</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {(!storyDetail?.characters || storyDetail.characters.length === 0) && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Users className="w-8 h-8 text-muted-gray mb-2" />
                      <p className="text-sm text-muted-gray">No characters in this beat sheet</p>
                      <p className="text-xs text-muted-gray mt-1">Add characters to link them to contacts</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-gray">
                To link a character to a contact, edit the character from the Characters panel.
              </p>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Apply Template Dialog */}
      <Dialog open={showApplyTemplateDialog} onOpenChange={setShowApplyTemplateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply Beat Sheet Template</DialogTitle>
            <DialogDescription>
              Select a template to add pre-defined beats to your beat sheet. Existing beats will not be removed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={selectedTemplate} onValueChange={setSelectedTemplate}>
              {beatTemplates?.map(template => (
                <div
                  key={template.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTemplate === template.id
                      ? 'border-accent-yellow bg-accent-yellow/10'
                      : 'border-muted-gray/20 hover:border-muted-gray/40'
                  }`}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <RadioGroupItem value={template.id} id={template.id} className="mt-1" />
                  <div className="flex-1">
                    <label htmlFor={template.id} className="text-sm font-medium text-bone-white cursor-pointer">
                      {template.name}
                    </label>
                    <p className="text-xs text-muted-gray mt-1">{template.description}</p>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {template.beat_count} beats
                    </Badge>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyTemplateDialog(false)}>Cancel</Button>
            <Button
              onClick={handleApplyTemplate}
              disabled={!selectedTemplate || applyTemplate.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {applyTemplate.isPending ? (
                'Applying...'
              ) : (
                <>
                  <LayoutTemplate className="w-4 h-4 mr-2" />
                  Apply Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Beat Detail Modal (Read-Only) */}
      <Dialog open={showBeatDetailDialog} onOpenChange={setShowBeatDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-muted-gray font-mono">Beat #{beatToView?.sort_order}</span>
                  {beatToView?.act_marker && (
                    <Badge variant="secondary">{beatToView.act_marker}</Badge>
                  )}
                  {beatToView?.emotional_tone && (
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: EMOTIONAL_TONES.find(t => t.value === beatToView.emotional_tone)?.color || '#6B7280',
                        color: EMOTIONAL_TONES.find(t => t.value === beatToView.emotional_tone)?.color || '#6B7280',
                      }}
                    >
                      {EMOTIONAL_TONES.find(t => t.value === beatToView?.emotional_tone)?.label || beatToView.emotional_tone}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl">{beatToView?.title}</DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Info Bar */}
            <div className="flex flex-wrap gap-4 text-sm">
              {(beatToView?.page_start || beatToView?.page_end) && (
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-gray" />
                  <span className="text-muted-gray">Pages:</span>
                  <span className="text-bone-white">
                    {beatToView.page_start === beatToView.page_end
                      ? beatToView.page_start
                      : `${beatToView.page_start || '?'}-${beatToView.page_end || '?'}`}
                  </span>
                </div>
              )}
              {beatToView?.primary_character && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-gray" />
                  <span className="text-muted-gray">Primary:</span>
                  <span className="text-bone-white">{beatToView.primary_character.name}</span>
                </div>
              )}
            </div>

            {/* Content */}
            {beatToView?.content && (
              <div>
                <Label className="text-xs text-muted-gray uppercase tracking-wide">Description</Label>
                <p className="mt-1 text-bone-white whitespace-pre-wrap">{beatToView.content}</p>
              </div>
            )}

            {/* Character Arcs */}
            {beatToView?.character_arcs && beatToView.character_arcs.length > 0 && (
              <div>
                <Label className="text-xs text-muted-gray uppercase tracking-wide">Character Arcs</Label>
                <div className="mt-2 space-y-2">
                  {beatToView.character_arcs.map(arc => {
                    const char = storyDetail?.characters?.find(c => c.id === arc.character_id);
                    return (
                      <div key={arc.id} className="flex items-start gap-2 bg-charcoal-black/50 p-3 rounded">
                        <Users className="w-4 h-4 text-accent-yellow mt-0.5" />
                        <div>
                          <span className="font-medium text-bone-white">{char?.name || 'Unknown'}</span>
                          <p className="text-sm text-muted-gray mt-1">{arc.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            {beatToView?.notes && (
              <div className="bg-amber-900/20 p-3 rounded border-l-4 border-amber-500">
                <Label className="text-xs text-amber-400 uppercase tracking-wide">Notes</Label>
                <p className="mt-1 text-amber-100 whitespace-pre-wrap">{beatToView.notes}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBeatDetailDialog(false)}>Close</Button>
            {canEdit && (
              <Button onClick={handleEditFromDetail}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit Beat
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
