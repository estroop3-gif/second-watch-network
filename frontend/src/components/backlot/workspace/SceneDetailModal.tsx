/**
 * SceneDetailModal - View and edit scene details with breakdown items
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  MapPin,
  Clock,
  Camera,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Users,
  Package,
  Shirt,
  Sparkles,
  Car,
  Dog,
  Trees,
  Wrench,
  Volume2,
  Music,
  Zap,
  DollarSign,
  Loader2,
  ChevronDown,
  Sun,
  Moon,
} from 'lucide-react';
import {
  useScene,
  useSceneMutations,
  useBreakdownItems,
  useBreakdownItemMutations,
  useProjectLocations,
} from '@/hooks/backlot';
import {
  BacklotScene,
  BacklotBreakdownItem,
  BacklotSceneCoverageStatus,
  BacklotBreakdownItemType,
  BacklotIntExt,
  BacklotTimeOfDay,
  BreakdownItemInput,
  BREAKDOWN_ITEM_TYPE_LABELS,
  BREAKDOWN_ITEM_TYPE_COLORS,
  SCENE_COVERAGE_STATUS_LABELS,
} from '@/types/backlot';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface SceneDetailModalProps {
  scene: BacklotScene | null;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  canEdit: boolean;
}

// Breakdown type icons
const BREAKDOWN_TYPE_ICONS: Record<BacklotBreakdownItemType, React.ReactNode> = {
  cast: <Users className="w-4 h-4" />,
  background: <Users className="w-4 h-4" />,
  stunt: <Zap className="w-4 h-4" />,
  location: <MapPin className="w-4 h-4" />,
  prop: <Package className="w-4 h-4" />,
  set_dressing: <Package className="w-4 h-4" />,
  wardrobe: <Shirt className="w-4 h-4" />,
  makeup: <Sparkles className="w-4 h-4" />,
  sfx: <Zap className="w-4 h-4" />,
  vfx: <Sparkles className="w-4 h-4" />,
  vehicle: <Car className="w-4 h-4" />,
  animal: <Dog className="w-4 h-4" />,
  greenery: <Trees className="w-4 h-4" />,
  special_equipment: <Wrench className="w-4 h-4" />,
  sound: <Volume2 className="w-4 h-4" />,
  music: <Music className="w-4 h-4" />,
};

// Breakdown Item Card
const BreakdownItemCard: React.FC<{
  item: BacklotBreakdownItem;
  canEdit: boolean;
  onEdit: (item: BacklotBreakdownItem) => void;
  onDelete: (id: string) => void;
}> = ({ item, canEdit, onEdit, onDelete }) => {
  const typeColor = BREAKDOWN_ITEM_TYPE_COLORS[item.item_type] || 'gray';

  return (
    <div className="flex items-start gap-3 p-3 bg-charcoal-black border border-muted-gray/20 rounded-lg hover:border-muted-gray/40 transition-colors">
      <div
        className={cn(
          'p-2 rounded-lg shrink-0',
          `bg-${typeColor}-500/20 text-${typeColor}-400`
        )}
        style={{
          backgroundColor: `color-mix(in srgb, ${typeColor === 'red' ? '#ef4444' : typeColor === 'orange' ? '#f97316' : typeColor === 'amber' ? '#f59e0b' : typeColor === 'yellow' ? '#eab308' : typeColor === 'lime' ? '#84cc16' : typeColor === 'green' ? '#22c55e' : typeColor === 'emerald' ? '#10b981' : typeColor === 'cyan' ? '#06b6d4' : typeColor === 'sky' ? '#0ea5e9' : typeColor === 'blue' ? '#3b82f6' : typeColor === 'indigo' ? '#6366f1' : typeColor === 'violet' ? '#8b5cf6' : typeColor === 'purple' ? '#a855f7' : typeColor === 'fuchsia' ? '#d946ef' : typeColor === 'pink' ? '#ec4899' : typeColor === 'slate' ? '#64748b' : '#9ca3af'} 20%, transparent)`
        }}
      >
        {BREAKDOWN_TYPE_ICONS[item.item_type]}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-medium text-bone-white">{item.name}</h4>
            <p className="text-xs text-muted-gray">
              {BREAKDOWN_ITEM_TYPE_LABELS[item.item_type]}
              {item.quantity > 1 && ` (x${item.quantity})`}
            </p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onEdit(item)}
              >
                <Edit className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-400 hover:text-red-300"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {item.description && (
          <p className="text-xs text-muted-gray mt-1 line-clamp-2">{item.description}</p>
        )}

        {item.budget_estimate && item.budget_estimate > 0 && (
          <div className="flex items-center gap-1 mt-2 text-xs text-green-400">
            <DollarSign className="w-3 h-3" />
            <span>${item.budget_estimate.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Add/Edit Breakdown Item Form
const BreakdownItemForm: React.FC<{
  item?: BacklotBreakdownItem | null;
  sceneId: string;
  onSave: (input: BreakdownItemInput) => void;
  onCancel: () => void;
  isSaving: boolean;
}> = ({ item, sceneId, onSave, onCancel, isSaving }) => {
  const [formData, setFormData] = useState<BreakdownItemInput>({
    item_type: item?.item_type || 'prop',
    name: item?.name || '',
    description: item?.description || '',
    quantity: item?.quantity || 1,
    notes: item?.notes || '',
    budget_estimate: item?.budget_estimate || undefined,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-muted-gray/10 rounded-lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={formData.item_type}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, item_type: value as BacklotBreakdownItemType }))
            }
          >
            <SelectTrigger className="bg-charcoal-black border-muted-gray/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(BREAKDOWN_ITEM_TYPE_LABELS).map(([type, label]) => (
                <SelectItem key={type} value={type}>
                  <span className="flex items-center gap-2">
                    {BREAKDOWN_TYPE_ICONS[type as BacklotBreakdownItemType]}
                    {label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Quantity</Label>
          <Input
            type="number"
            min={1}
            value={formData.quantity}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))
            }
            className="bg-charcoal-black border-muted-gray/20"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Name *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Hero's sword, Background extras, Fog machine"
          className="bg-charcoal-black border-muted-gray/20"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={formData.description || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Additional details..."
          className="bg-charcoal-black border-muted-gray/20 min-h-[60px]"
        />
      </div>

      <div className="space-y-2">
        <Label>Budget Estimate ($)</Label>
        <Input
          type="number"
          min={0}
          value={formData.budget_estimate || ''}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              budget_estimate: e.target.value ? parseFloat(e.target.value) : undefined,
            }))
          }
          placeholder="0.00"
          className="bg-charcoal-black border-muted-gray/20"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!formData.name.trim() || isSaving}
          className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {item ? 'Update' : 'Add Item'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

// Main Component
const SceneDetailModal: React.FC<SceneDetailModalProps> = ({
  scene: initialScene,
  projectId,
  isOpen,
  onClose,
  canEdit,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'details' | 'breakdown'>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<BacklotBreakdownItem | null>(null);

  // Fetch full scene data
  const { data: scene, isLoading: sceneLoading } = useScene(initialScene?.id || null);
  const { items: breakdownItems, isLoading: itemsLoading } = useBreakdownItems(
    initialScene?.id || null
  );
  const { updateScene, updateCoverage, deleteScene } = useSceneMutations();
  const { createItem, updateItem, deleteItem } = useBreakdownItemMutations();
  const { data: projectLocations } = useProjectLocations(projectId);

  // Form state for editing
  const [formData, setFormData] = useState({
    scene_number: '',
    int_ext: '' as BacklotIntExt | '',
    time_of_day: '' as BacklotTimeOfDay | '',
    set_name: '',
    synopsis: '',
    notes: '',
    page_count: '',
    location_id: '',
  });

  // Initialize form when scene loads
  useEffect(() => {
    if (scene) {
      setFormData({
        scene_number: scene.scene_number || '',
        int_ext: scene.int_ext || '',
        time_of_day: (scene.time_of_day as BacklotTimeOfDay) || '',
        set_name: scene.set_name || '',
        synopsis: scene.synopsis || '',
        notes: scene.notes || '',
        page_count: scene.page_count || '',
        location_id: scene.location_id || '',
      });
    }
  }, [scene]);

  const handleSaveScene = async () => {
    if (!scene) return;

    try {
      await updateScene.mutateAsync({
        id: scene.id,
        scene_number: formData.scene_number,
        int_ext: formData.int_ext || null,
        time_of_day: formData.time_of_day || null,
        set_name: formData.set_name || null,
        synopsis: formData.synopsis || null,
        notes: formData.notes || null,
        page_count: formData.page_count || null,
        location_id: formData.location_id || null,
      });
      setIsEditing(false);
      toast({ title: 'Scene Updated', description: 'Scene details have been saved.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update scene', variant: 'destructive' });
    }
  };

  const handleCoverageChange = async (status: BacklotSceneCoverageStatus) => {
    if (!scene) return;

    try {
      await updateCoverage.mutateAsync({ id: scene.id, coverage_status: status });
      toast({
        title: 'Coverage Updated',
        description: `Scene marked as ${SCENE_COVERAGE_STATUS_LABELS[status]}`,
      });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update coverage', variant: 'destructive' });
    }
  };

  const handleAddBreakdownItem = async (input: BreakdownItemInput) => {
    if (!scene) return;

    try {
      await createItem.mutateAsync({ sceneId: scene.id, ...input });
      setShowAddItem(false);
      toast({ title: 'Item Added', description: 'Breakdown item has been added.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add item', variant: 'destructive' });
    }
  };

  const handleUpdateBreakdownItem = async (input: BreakdownItemInput) => {
    if (!editingItem) return;

    try {
      await updateItem.mutateAsync({ id: editingItem.id, ...input });
      setEditingItem(null);
      toast({ title: 'Item Updated', description: 'Breakdown item has been updated.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update item', variant: 'destructive' });
    }
  };

  const handleDeleteBreakdownItem = async (id: string) => {
    if (!confirm('Delete this breakdown item?')) return;

    try {
      await deleteItem.mutateAsync(id);
      toast({ title: 'Item Deleted', description: 'Breakdown item has been removed.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete item', variant: 'destructive' });
    }
  };

  // Group breakdown items by type
  const itemsByType = breakdownItems.reduce(
    (acc, item) => {
      if (!acc[item.item_type]) acc[item.item_type] = [];
      acc[item.item_type].push(item);
      return acc;
    },
    {} as Record<BacklotBreakdownItemType, BacklotBreakdownItem[]>
  );

  const displayScene = scene || initialScene;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-2xl font-bold">{displayScene?.scene_number}</span>
            {displayScene?.int_ext && (
              <Badge variant="outline">{displayScene.int_ext}</Badge>
            )}
            {displayScene?.time_of_day && (
              <Badge variant="outline" className="capitalize">
                {displayScene.time_of_day === 'day' && <Sun className="w-3 h-3 mr-1" />}
                {displayScene.time_of_day === 'night' && <Moon className="w-3 h-3 mr-1" />}
                {displayScene.time_of_day.replace('_', ' ')}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="bg-charcoal-black border border-muted-gray/20 shrink-0">
            <TabsTrigger value="details">Scene Details</TabsTrigger>
            <TabsTrigger value="breakdown">
              Breakdown
              {breakdownItems.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {breakdownItems.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* Details Tab */}
            <TabsContent value="details" className="mt-0 space-y-6">
              {/* Coverage Status */}
              <Card className="bg-charcoal-black border-muted-gray/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Coverage Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={displayScene?.coverage_status || 'not_scheduled'}
                    onValueChange={(v) => handleCoverageChange(v as BacklotSceneCoverageStatus)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="bg-charcoal-black border-muted-gray/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SCENE_COVERAGE_STATUS_LABELS).map(([status, label]) => (
                        <SelectItem key={status} value={status}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Scene Info */}
              <Card className="bg-charcoal-black border-muted-gray/20">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium">Scene Information</CardTitle>
                  {canEdit && !isEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditing ? (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Scene #</Label>
                          <Input
                            value={formData.scene_number}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, scene_number: e.target.value }))
                            }
                            className="bg-charcoal-black border-muted-gray/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>INT/EXT</Label>
                          <Select
                            value={formData.int_ext}
                            onValueChange={(v) =>
                              setFormData((prev) => ({ ...prev, int_ext: v as BacklotIntExt }))
                            }
                          >
                            <SelectTrigger className="bg-charcoal-black border-muted-gray/20">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="INT">INT</SelectItem>
                              <SelectItem value="EXT">EXT</SelectItem>
                              <SelectItem value="INT/EXT">INT/EXT</SelectItem>
                              <SelectItem value="EXT/INT">EXT/INT</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Time of Day</Label>
                          <Select
                            value={formData.time_of_day}
                            onValueChange={(v) =>
                              setFormData((prev) => ({ ...prev, time_of_day: v as BacklotTimeOfDay }))
                            }
                          >
                            <SelectTrigger className="bg-charcoal-black border-muted-gray/20">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="day">Day</SelectItem>
                              <SelectItem value="night">Night</SelectItem>
                              <SelectItem value="dawn">Dawn</SelectItem>
                              <SelectItem value="dusk">Dusk</SelectItem>
                              <SelectItem value="golden_hour">Golden Hour</SelectItem>
                              <SelectItem value="morning">Morning</SelectItem>
                              <SelectItem value="afternoon">Afternoon</SelectItem>
                              <SelectItem value="evening">Evening</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Set Name</Label>
                          <Input
                            value={formData.set_name}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, set_name: e.target.value }))
                            }
                            placeholder="e.g., John's Apartment - Living Room"
                            className="bg-charcoal-black border-muted-gray/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Page Count</Label>
                          <Input
                            value={formData.page_count}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, page_count: e.target.value }))
                            }
                            placeholder="e.g., 2 3/8"
                            className="bg-charcoal-black border-muted-gray/20"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Location</Label>
                        <Select
                          value={formData.location_id}
                          onValueChange={(v) =>
                            setFormData((prev) => ({ ...prev, location_id: v }))
                          }
                        >
                          <SelectTrigger className="bg-charcoal-black border-muted-gray/20">
                            <SelectValue placeholder="Select location..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No location assigned</SelectItem>
                            {projectLocations?.map((loc) => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {loc.location?.name || loc.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Synopsis</Label>
                        <Textarea
                          value={formData.synopsis}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, synopsis: e.target.value }))
                          }
                          placeholder="Brief description of what happens in this scene..."
                          className="bg-charcoal-black border-muted-gray/20 min-h-[80px]"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={formData.notes}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, notes: e.target.value }))
                          }
                          placeholder="Production notes, special requirements..."
                          className="bg-charcoal-black border-muted-gray/20 min-h-[60px]"
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsEditing(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveScene}
                          disabled={updateScene.isPending}
                          className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                        >
                          {updateScene.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Save Changes
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {displayScene?.set_name && (
                        <div>
                          <Label className="text-muted-gray">Set Name</Label>
                          <p className="text-bone-white">{displayScene.set_name}</p>
                        </div>
                      )}
                      {displayScene?.page_count && (
                        <div>
                          <Label className="text-muted-gray">Page Count</Label>
                          <p className="text-bone-white">{displayScene.page_count} pages</p>
                        </div>
                      )}
                      {displayScene?.location && (
                        <div>
                          <Label className="text-muted-gray">Location</Label>
                          <p className="text-bone-white flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {displayScene.location.name}
                          </p>
                        </div>
                      )}
                      {displayScene?.synopsis && (
                        <div>
                          <Label className="text-muted-gray">Synopsis</Label>
                          <p className="text-bone-white">{displayScene.synopsis}</p>
                        </div>
                      )}
                      {displayScene?.notes && (
                        <div>
                          <Label className="text-muted-gray">Notes</Label>
                          <p className="text-bone-white">{displayScene.notes}</p>
                        </div>
                      )}
                      {!displayScene?.set_name &&
                        !displayScene?.synopsis &&
                        !displayScene?.location && (
                          <p className="text-muted-gray text-sm">
                            No additional details. Click Edit to add information.
                          </p>
                        )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Breakdown Tab */}
            <TabsContent value="breakdown" className="mt-0 space-y-4">
              {/* Add Item Button */}
              {canEdit && !showAddItem && !editingItem && (
                <Button
                  onClick={() => setShowAddItem(true)}
                  className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Breakdown Item
                </Button>
              )}

              {/* Add/Edit Form */}
              {showAddItem && (
                <BreakdownItemForm
                  sceneId={displayScene?.id || ''}
                  onSave={handleAddBreakdownItem}
                  onCancel={() => setShowAddItem(false)}
                  isSaving={createItem.isPending}
                />
              )}

              {editingItem && (
                <BreakdownItemForm
                  item={editingItem}
                  sceneId={displayScene?.id || ''}
                  onSave={handleUpdateBreakdownItem}
                  onCancel={() => setEditingItem(null)}
                  isSaving={updateItem.isPending}
                />
              )}

              {/* Breakdown Items by Type */}
              {itemsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 bg-muted-gray/10 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : breakdownItems.length === 0 ? (
                <div className="text-center py-8 text-muted-gray">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-40" />
                  <p>No breakdown items yet</p>
                  <p className="text-sm">Add items to track props, wardrobe, VFX, and more</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(itemsByType).map(([type, items]) => (
                    <div key={type}>
                      <h3 className="text-sm font-medium text-bone-white flex items-center gap-2 mb-3">
                        {BREAKDOWN_TYPE_ICONS[type as BacklotBreakdownItemType]}
                        {BREAKDOWN_ITEM_TYPE_LABELS[type as BacklotBreakdownItemType]}
                        <Badge variant="outline" className="text-xs">
                          {items.length}
                        </Badge>
                      </h3>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <BreakdownItemCard
                            key={item.id}
                            item={item}
                            canEdit={canEdit}
                            onEdit={setEditingItem}
                            onDelete={handleDeleteBreakdownItem}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SceneDetailModal;
