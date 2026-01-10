/**
 * ScriptSidesView - Script Sides Auto Generator
 * Create and manage printable sides packets for production days
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  MoreVertical,
  Users,
  Printer,
  AlertCircle,
  Upload,
  RefreshCw,
  Calendar,
  Film,
  Search,
  X,
  CheckCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  useActiveScript,
  useCreateScript,
  useUpdateScript,
  useScriptScenes,
  useProductionDaysForSides,
  useSidesPackets,
  useSidesPacket,
  useCreateSidesPacket,
  useUpdateSidesPacket,
  useDeleteSidesPacket,
  useAddSceneToPacket,
  useRemoveSceneFromPacket,
  useReorderPacketScene,
  useSyncPacketFromSchedule,
  ScriptScene,
  SidesPacket,
} from '@/hooks/backlot';

interface ScriptSidesViewProps {
  projectId: string;
  canEdit: boolean;
}

type ViewMode = 'list' | 'packet' | 'script';

export default function ScriptSidesView({ projectId, canEdit }: ScriptSidesViewProps) {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'packets' | 'script'>('packets');

  // Dialog states
  const [showCreatePacketDialog, setShowCreatePacketDialog] = useState(false);
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const [showScenePickerDialog, setShowScenePickerDialog] = useState(false);
  const [showDeletePacketDialog, setShowDeletePacketDialog] = useState(false);
  const [packetToDelete, setPacketToDelete] = useState<SidesPacket | null>(null);

  // Form states
  const [packetForm, setPacketForm] = useState({
    production_day_id: '',
    title: '',
    notes: '',
    mode: 'MANUAL' as 'AUTO' | 'MANUAL',
  });

  const [scriptForm, setScriptForm] = useState({
    title: '',
    format: 'FOUNTAIN',
    raw_text: '',
  });

  const [sceneSearch, setSceneSearch] = useState('');

  // Queries
  const { data: scriptData, isLoading: loadingScript } = useActiveScript(projectId);
  const { data: scenes, isLoading: loadingScenes } = useScriptScenes(projectId, sceneSearch || undefined);
  const { data: productionDays } = useProductionDaysForSides(projectId);
  const { data: packets, isLoading: loadingPackets } = useSidesPackets(projectId);
  const { data: packetDetail, isLoading: loadingPacketDetail } = useSidesPacket(
    projectId,
    selectedPacketId
  );

  // Mutations
  const createScript = useCreateScript(projectId);
  const updateScript = useUpdateScript(projectId, scriptData?.script?.id || '');
  const createPacket = useCreateSidesPacket(projectId);
  const updatePacket = useUpdateSidesPacket(projectId, selectedPacketId || '');
  const deletePacket = useDeleteSidesPacket(projectId);
  const addSceneToPacket = useAddSceneToPacket(projectId, selectedPacketId || '');
  const removeSceneFromPacket = useRemoveSceneFromPacket(projectId, selectedPacketId || '');
  const reorderPacketScene = useReorderPacketScene(projectId, selectedPacketId || '');
  const syncFromSchedule = useSyncPacketFromSchedule(projectId, selectedPacketId || '');

  // Computed
  const hasScript = !!scriptData?.script;
  const scenesInPacket = useMemo(() => {
    return new Set(packetDetail?.scenes?.map(s => s.script_scene_id) || []);
  }, [packetDetail?.scenes]);

  // Handlers
  const handleCreatePacket = async () => {
    await createPacket.mutateAsync({
      production_day_id: packetForm.production_day_id,
      title: packetForm.title,
      notes: packetForm.notes || undefined,
      mode: packetForm.mode,
    });
    setShowCreatePacketDialog(false);
    setPacketForm({ production_day_id: '', title: '', notes: '', mode: 'MANUAL' });
  };

  const handleSaveScript = async () => {
    if (scriptData?.script) {
      await updateScript.mutateAsync({
        title: scriptForm.title || undefined,
        raw_text: scriptForm.raw_text,
      });
    } else {
      await createScript.mutateAsync({
        title: scriptForm.title,
        format: scriptForm.format,
        raw_text: scriptForm.raw_text,
      });
    }
    setShowScriptDialog(false);
  };

  const handleDeletePacket = async () => {
    if (!packetToDelete) return;
    await deletePacket.mutateAsync(packetToDelete.id);
    if (selectedPacketId === packetToDelete.id) {
      setSelectedPacketId(null);
      setViewMode('list');
    }
    setShowDeletePacketDialog(false);
    setPacketToDelete(null);
  };

  const handleAddScene = async (sceneId: string) => {
    await addSceneToPacket.mutateAsync(sceneId);
  };

  const handleRemoveScene = async (packetSceneId: string) => {
    await removeSceneFromPacket.mutateAsync(packetSceneId);
  };

  const handleReorderScene = async (packetSceneId: string, direction: 'UP' | 'DOWN') => {
    await reorderPacketScene.mutateAsync({ packetSceneId, direction });
  };

  const handleSyncFromSchedule = async () => {
    try {
      await syncFromSchedule.mutateAsync();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handlePublish = async () => {
    await updatePacket.mutateAsync({ status: 'PUBLISHED' });
  };

  const handlePrint = () => {
    if (!selectedPacketId) return;
    window.open(`/backlot/${projectId}/sides/${selectedPacketId}/print`, '_blank');
  };

  const openEditScript = () => {
    if (scriptData?.script) {
      setScriptForm({
        title: scriptData.script.title,
        format: scriptData.script.format,
        raw_text: scriptData.script.raw_text,
      });
    } else {
      setScriptForm({ title: '', format: 'FOUNTAIN', raw_text: '' });
    }
    setShowScriptDialog(true);
  };

  // List View
  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-heading text-bone-white">Script Sides</h2>
            <p className="text-sm text-muted-gray">Generate printable sides packets for production days</p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <>
                <Button variant="outline" onClick={openEditScript}>
                  <FileText className="w-4 h-4 mr-2" />
                  {hasScript ? 'Edit Script' : 'Upload Script'}
                </Button>
                <Button onClick={() => setShowCreatePacketDialog(true)} disabled={!hasScript}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Sides Packet
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Script Status Card */}
        <Card className="bg-charcoal-black/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-bone-white flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Script Document
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingScript ? (
              <Skeleton className="h-16" />
            ) : hasScript ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-bone-white">{scriptData.script!.title}</p>
                  <p className="text-sm text-muted-gray">
                    {scriptData.scenes_count} scenes parsed • {scriptData.script!.format} format
                  </p>
                </div>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={openEditScript}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <FileText className="w-10 h-10 text-muted-gray mx-auto mb-2" />
                <p className="text-muted-gray mb-3">No script uploaded yet</p>
                {canEdit && (
                  <Button variant="outline" onClick={openEditScript}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Script
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Packets List */}
        {loadingPackets ? (
          <Skeleton className="h-48" />
        ) : !packets || packets.length === 0 ? (
          <Card className="bg-charcoal-black/30">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Film className="w-12 h-12 text-muted-gray mb-4" />
              <h3 className="text-xl font-semibold text-bone-white mb-2">No Sides Packets Yet</h3>
              <p className="text-muted-gray text-center max-w-md mb-4">
                Create a sides packet for a production day to generate printable script pages.
              </p>
              {canEdit && hasScript && (
                <Button onClick={() => setShowCreatePacketDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Sides Packet
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-charcoal-black/50">
            <CardHeader>
              <CardTitle className="text-lg text-bone-white">Sides Packets</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Production Day</TableHead>
                    <TableHead>Scenes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packets.map((packet) => (
                    <TableRow
                      key={packet.id}
                      className="cursor-pointer hover:bg-charcoal-black/30"
                      onClick={() => {
                        setSelectedPacketId(packet.id);
                        setViewMode('packet');
                      }}
                    >
                      <TableCell className="font-medium text-bone-white">{packet.title}</TableCell>
                      <TableCell>
                        {packet.production_day?.shoot_date ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-gray" />
                            <span>{format(new Date(packet.production_day.shoot_date), 'MMM d, yyyy')}</span>
                            {packet.production_day.day_type && (
                              <Badge variant="outline" className="text-xs">{packet.production_day.day_type}</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-gray">-</span>
                        )}
                      </TableCell>
                      <TableCell>{packet.scenes_count || 0}</TableCell>
                      <TableCell>
                        <Badge variant={packet.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                          {packet.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-gray">
                        {format(new Date(packet.updated_at), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedPacketId(packet.id);
                                  setViewMode('packet');
                                }}
                              >
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-500"
                                onClick={() => {
                                  setPacketToDelete(packet);
                                  setShowDeletePacketDialog(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Create Packet Dialog */}
        <Dialog open={showCreatePacketDialog} onOpenChange={setShowCreatePacketDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Sides Packet</DialogTitle>
              <DialogDescription>Create a new sides packet for a production day.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Production Day *</Label>
                <Select
                  value={packetForm.production_day_id}
                  onValueChange={(val) => setPacketForm((prev) => ({ ...prev, production_day_id: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select production day" />
                  </SelectTrigger>
                  <SelectContent>
                    {productionDays?.map((day) => (
                      <SelectItem key={day.id} value={day.id}>
                        {format(new Date(day.shoot_date), 'MMM d, yyyy')} - {day.day_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title *</Label>
                <Input
                  value={packetForm.title}
                  onChange={(e) => setPacketForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Day 1 Sides"
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={packetForm.notes}
                  onChange={(e) => setPacketForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes for this packet"
                  rows={2}
                />
              </div>
              <div>
                <Label>Scene Selection Mode</Label>
                <Select
                  value={packetForm.mode}
                  onValueChange={(val: 'AUTO' | 'MANUAL') => setPacketForm((prev) => ({ ...prev, mode: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUAL">Manual - Select scenes individually</SelectItem>
                    <SelectItem value="AUTO">Auto - Pull from day's schedule</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreatePacketDialog(false)}>Cancel</Button>
              <Button
                onClick={handleCreatePacket}
                disabled={!packetForm.production_day_id || !packetForm.title || createPacket.isPending}
              >
                {createPacket.isPending ? 'Creating...' : 'Create Packet'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Script Dialog */}
        <Dialog open={showScriptDialog} onOpenChange={setShowScriptDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{hasScript ? 'Edit Script' : 'Upload Script'}</DialogTitle>
              <DialogDescription>
                Paste your screenplay in Fountain format. Scenes will be automatically parsed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={scriptForm.title}
                  onChange={(e) => setScriptForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Script title"
                />
              </div>
              <div>
                <Label>Format</Label>
                <Select
                  value={scriptForm.format}
                  onValueChange={(val) => setScriptForm((prev) => ({ ...prev, format: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FOUNTAIN">Fountain (auto-parse scenes)</SelectItem>
                    <SelectItem value="PLAIN">Plain Text (single scene)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Script Text *</Label>
                <Textarea
                  value={scriptForm.raw_text}
                  onChange={(e) => setScriptForm((prev) => ({ ...prev, raw_text: e.target.value }))}
                  placeholder="Paste your Fountain-formatted screenplay here..."
                  className="font-mono text-sm"
                  rows={15}
                />
                <p className="text-xs text-muted-gray mt-1">
                  Fountain tip: Scene headings start with INT. or EXT. Characters are ALL CAPS.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowScriptDialog(false)}>Cancel</Button>
              <Button
                onClick={handleSaveScript}
                disabled={!scriptForm.title || !scriptForm.raw_text || createScript.isPending || updateScript.isPending}
              >
                {createScript.isPending || updateScript.isPending ? 'Saving...' : 'Save Script'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Packet Dialog */}
        <AlertDialog open={showDeletePacketDialog} onOpenChange={setShowDeletePacketDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Sides Packet?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{packetToDelete?.title}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeletePacket} className="bg-red-600 hover:bg-red-700">
                Delete Packet
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Packet Detail View
  if (viewMode === 'packet') {
    if (loadingPacketDetail || !packetDetail) {
      return (
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { setViewMode('list'); setSelectedPacketId(null); }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-heading text-bone-white">{packetDetail.packet.title}</h2>
                <Badge variant={packetDetail.packet.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                  {packetDetail.packet.status}
                </Badge>
              </div>
              {packetDetail.production_day && (
                <p className="text-sm text-muted-gray">
                  {format(new Date(packetDetail.production_day.shoot_date), 'EEEE, MMMM d, yyyy')} • {packetDetail.production_day.day_type}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowScenePickerDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Scenes
                </Button>
                <Button variant="outline" size="sm" onClick={handleSyncFromSchedule} disabled={syncFromSchedule.isPending}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncFromSchedule.isPending ? 'animate-spin' : ''}`} />
                  Sync from Schedule
                </Button>
                {packetDetail.packet.status === 'DRAFT' && (
                  <Button variant="outline" size="sm" onClick={handlePublish}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Publish
                  </Button>
                )}
              </>
            )}
            <Button size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print / Save as PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cast Card */}
          <Card className="bg-charcoal-black/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-bone-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Cast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Cast Working from DOOD */}
                <div>
                  <p className="text-xs font-medium text-muted-gray mb-2">Cast Working (DOOD)</p>
                  {packetDetail.cast_working.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {packetDetail.cast_working.map((cast) => (
                        <Badge key={cast.id} variant="outline">{cast.display_name}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-gray italic">No cast marked as working</p>
                  )}
                </div>

                {/* Characters from Scenes */}
                <div>
                  <p className="text-xs font-medium text-muted-gray mb-2">Characters in Scenes</p>
                  {packetDetail.characters_from_scenes.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {packetDetail.characters_from_scenes.map((char) => (
                        <Badge key={char} variant="secondary">{char}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-gray italic">No characters detected</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scenes Card */}
          <Card className="bg-charcoal-black/50 lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-bone-white flex items-center gap-2">
                  <Film className="w-5 h-5" />
                  Scenes ({packetDetail.scenes.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {packetDetail.scenes.length === 0 ? (
                <div className="text-center py-8">
                  <Film className="w-10 h-10 text-muted-gray mx-auto mb-2" />
                  <p className="text-muted-gray">No scenes added yet</p>
                  {canEdit && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowScenePickerDialog(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Scenes
                    </Button>
                  )}
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2 pr-4">
                    {packetDetail.scenes.map((scene, idx) => (
                      <Card key={scene.id} className="bg-charcoal-black/30">
                        <CardContent className="py-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono text-muted-gray">
                                  #{scene.script_scene?.scene_number}
                                </span>
                                {scene.script_scene?.time_of_day && (
                                  <Badge variant="outline" className="text-xs">
                                    {scene.script_scene.time_of_day}
                                  </Badge>
                                )}
                              </div>
                              <p className="font-medium text-bone-white text-sm">
                                {scene.script_scene?.slugline}
                              </p>
                              {scene.script_scene?.characters && scene.script_scene.characters.length > 0 && (
                                <p className="text-xs text-muted-gray mt-1">
                                  Characters: {scene.script_scene.characters.join(', ')}
                                </p>
                              )}
                              {scene.scene_notes && (
                                <p className="text-xs text-accent-yellow mt-1 italic">
                                  Note: {scene.scene_notes}
                                </p>
                              )}
                            </div>
                            {canEdit && (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={idx === 0}
                                  onClick={() => handleReorderScene(scene.id, 'UP')}
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={idx === packetDetail.scenes.length - 1}
                                  onClick={() => handleReorderScene(scene.id, 'DOWN')}
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500 hover:text-red-400"
                                  onClick={() => handleRemoveScene(scene.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Scene Picker Dialog */}
        <Dialog open={showScenePickerDialog} onOpenChange={setShowScenePickerDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Add Scenes</DialogTitle>
              <DialogDescription>Select scenes to add to this sides packet.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                <Input
                  value={sceneSearch}
                  onChange={(e) => setSceneSearch(e.target.value)}
                  placeholder="Search scenes..."
                  className="pl-9"
                />
                {sceneSearch && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
                    onClick={() => setSceneSearch('')}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[400px]">
                {loadingScenes ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
                  </div>
                ) : !scenes || scenes.length === 0 ? (
                  <p className="text-center text-muted-gray py-8">No scenes found</p>
                ) : (
                  <div className="space-y-2 pr-4">
                    {scenes.map((scene) => {
                      const isAdded = scenesInPacket.has(scene.id);
                      return (
                        <Card
                          key={scene.id}
                          className={`cursor-pointer transition-colors ${isAdded ? 'bg-accent-yellow/10 border-accent-yellow' : 'bg-charcoal-black/30 hover:bg-charcoal-black/50'}`}
                          onClick={() => !isAdded && handleAddScene(scene.id)}
                        >
                          <CardContent className="py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-mono text-muted-gray">#{scene.scene_number}</span>
                                  {scene.time_of_day && (
                                    <Badge variant="outline" className="text-xs">{scene.time_of_day}</Badge>
                                  )}
                                </div>
                                <p className="font-medium text-bone-white text-sm">{scene.slugline}</p>
                                {scene.characters && scene.characters.length > 0 && (
                                  <p className="text-xs text-muted-gray mt-1">
                                    {scene.characters.join(', ')}
                                  </p>
                                )}
                              </div>
                              {isAdded ? (
                                <Badge variant="default" className="bg-accent-yellow text-charcoal-black">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Added
                                </Badge>
                              ) : (
                                <Button variant="ghost" size="sm" onClick={() => handleAddScene(scene.id)}>
                                  <Plus className="w-4 h-4 mr-1" />
                                  Add
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowScenePickerDialog(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return null;
}
