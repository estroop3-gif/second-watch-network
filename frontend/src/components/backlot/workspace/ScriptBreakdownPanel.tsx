/**
 * ScriptBreakdownPanel - Displays breakdown items organized by scene with filtering
 * Shows items from all scenes with ability to filter by type, department, and scene
 */
import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Filter,
  Download,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  FileText,
  Users,
  MapPin,
  Package,
  Shirt,
  Palette,
  Sparkles,
  Car,
  Dog,
  TreePine,
  Camera,
  Music,
  Volume2,
  Clapperboard,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertCircle,
  Navigation,
  Film,
  Eye,
} from "lucide-react";
import {
  useProjectBreakdown,
  useBreakdownSummary,
  useBreakdownMutations,
  useBreakdownPdfExport,
} from "@/hooks/backlot";
import {
  BacklotSceneBreakdownItem,
  BacklotBreakdownItemType,
  BacklotBreakdownDepartment,
  BacklotScene,
  BREAKDOWN_TYPE_LABELS,
  BREAKDOWN_DEPARTMENT_LABELS,
  BREAKDOWN_HIGHLIGHT_COLORS,
  BREAKDOWN_ITEM_TYPES,
  BREAKDOWN_DEPARTMENTS,
  BreakdownItemInput,
} from "@/types/backlot";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ScriptBreakdownPanelProps {
  projectId: string;
  canEdit: boolean;
  onSceneClick?: (sceneId: string) => void;
  onViewHighlight?: (highlightId: string) => void;
}

// Type icon mapping
const TYPE_ICONS: Record<BacklotBreakdownItemType, React.ReactNode> = {
  cast: <Users className="w-4 h-4" />,
  background: <Users className="w-4 h-4" />,
  stunt: <Clapperboard className="w-4 h-4" />,
  location: <MapPin className="w-4 h-4" />,
  prop: <Package className="w-4 h-4" />,
  set_dressing: <Package className="w-4 h-4" />,
  wardrobe: <Shirt className="w-4 h-4" />,
  makeup: <Palette className="w-4 h-4" />,
  sfx: <Sparkles className="w-4 h-4" />,
  vfx: <Sparkles className="w-4 h-4" />,
  vehicle: <Car className="w-4 h-4" />,
  animal: <Dog className="w-4 h-4" />,
  greenery: <TreePine className="w-4 h-4" />,
  special_equipment: <Camera className="w-4 h-4" />,
  sound: <Volume2 className="w-4 h-4" />,
  music: <Music className="w-4 h-4" />,
  other: <FileText className="w-4 h-4" />,
};

// Breakdown Item Card - Expandable with full details
const BreakdownItemCard: React.FC<{
  item: BacklotSceneBreakdownItem;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onViewInScript?: (highlightId: string) => void;
}> = ({ item, canEdit, onEdit, onDelete, isExpanded = false, onToggleExpand, onViewInScript }) => {
  const color = BREAKDOWN_HIGHLIGHT_COLORS[item.type] || "#999";
  const icon = TYPE_ICONS[item.type] || <FileText className="w-4 h-4" />;

  return (
    <div className="bg-charcoal-gray/30 rounded-lg border border-muted-gray/10 hover:border-muted-gray/30 transition-colors">
      {/* Main row - clickable to expand */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div
          className="w-8 h-8 rounded flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-soft-white truncate">
              {item.label}
            </span>
            {item.quantity > 1 && (
              <Badge variant="secondary" className="text-xs">
                x{item.quantity}
              </Badge>
            )}
          </div>
          {/* Show truncated notes only when collapsed */}
          {item.notes && !isExpanded && (
            <p className="text-xs text-muted-gray truncate mt-0.5">{item.notes}</p>
          )}
        </div>

        {/* Expand indicator */}
        <ChevronDown
          className={`w-4 h-4 text-muted-gray transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />

        {/* Actions menu (stop propagation) */}
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-400">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Expanded detail section */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-muted-gray/10 space-y-3">
          {/* Full notes */}
          {item.notes && (
            <div>
              <span className="text-xs text-muted-gray">Notes</span>
              <p className="text-sm text-bone-white mt-1 whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}

          {/* Department */}
          {item.department && (
            <div>
              <span className="text-xs text-muted-gray">Department</span>
              <p className="text-sm text-bone-white mt-1">
                {BREAKDOWN_DEPARTMENT_LABELS[item.department]}
              </p>
            </div>
          )}

          {/* Quantity */}
          {item.quantity > 1 && (
            <div>
              <span className="text-xs text-muted-gray">Quantity</span>
              <p className="text-sm text-bone-white mt-1">{item.quantity}</p>
            </div>
          )}

          {/* Linked highlights */}
          {item.highlight_ids && item.highlight_ids.length > 0 && (
            <div>
              <span className="text-xs text-muted-gray">Script Highlights</span>
              <p className="text-sm text-bone-white mt-1">
                {item.highlight_ids.length} linked highlight{item.highlight_ids.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Quick actions in expanded view */}
          <div className="flex gap-2 pt-2 border-t border-muted-gray/10 flex-wrap">
            {/* View in Script button - shown if there are linked highlights */}
            {item.highlight_ids && item.highlight_ids.length > 0 && onViewInScript && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewInScript(item.highlight_ids![0])}
                className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
              >
                <Eye className="w-3 h-3 mr-1" />
                View in Script
              </Button>
            )}
            {canEdit && (
              <>
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={onDelete}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Scene Breakdown Section
const SceneBreakdownSection: React.FC<{
  scene: BacklotScene;
  items: BacklotSceneBreakdownItem[];
  canEdit: boolean;
  expanded: boolean;
  onToggle: () => void;
  onEdit: (item: BacklotSceneBreakdownItem) => void;
  onDelete: (item: BacklotSceneBreakdownItem) => void;
  onAddItem: (sceneId: string) => void;
  onSceneClick?: (sceneId: string) => void;
  expandedItems: Set<string>;
  onToggleItemExpand: (itemId: string) => void;
  onViewInScript?: (highlightId: string) => void;
}> = ({
  scene,
  items,
  canEdit,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddItem,
  onSceneClick,
  expandedItems,
  onToggleItemExpand,
  onViewInScript,
}) => {
  // Group items by type
  const groupedItems = useMemo(() => {
    const groups: Record<string, BacklotSceneBreakdownItem[]> = {};
    items.forEach((item) => {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    });
    return groups;
  }, [items]);

  return (
    <Card className="bg-charcoal-gray/50 border-muted-gray/20">
      <CardHeader
        className="cursor-pointer py-3 px-4"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChevronRight
              className={cn(
                "w-4 h-4 transition-transform",
                expanded && "rotate-90"
              )}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-lg">
                  {scene.scene_number}
                </span>
                <Badge variant="outline" className="text-xs">
                  {items.length} items
                </Badge>
              </div>
              {scene.slugline && (
                <p className="text-sm text-muted-gray truncate max-w-md">
                  {scene.slugline}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onSceneClick && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onSceneClick(scene.id);
                }}
              >
                View in Script
              </Button>
            )}
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddItem(scene.id);
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 px-4 pb-4">
          {Object.keys(groupedItems).length === 0 ? (
            <div className="text-center py-6 text-muted-gray">
              No breakdown items for this scene
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedItems).map(([type, typeItems]) => (
                <div key={type}>
                  <div
                    className="flex items-center gap-2 mb-2 pb-1 border-b border-muted-gray/20"
                    style={{
                      borderColor:
                        BREAKDOWN_HIGHLIGHT_COLORS[
                          type as BacklotBreakdownItemType
                        ] + "40",
                    }}
                  >
                    {TYPE_ICONS[type as BacklotBreakdownItemType]}
                    <span
                      className="text-sm font-medium"
                      style={{
                        color:
                          BREAKDOWN_HIGHLIGHT_COLORS[
                            type as BacklotBreakdownItemType
                          ],
                      }}
                    >
                      {BREAKDOWN_TYPE_LABELS[type as BacklotBreakdownItemType]}
                    </span>
                    <Badge variant="secondary" className="text-xs ml-auto">
                      {typeItems.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {typeItems.map((item) => (
                      <BreakdownItemCard
                        key={item.id}
                        item={item}
                        canEdit={canEdit}
                        onEdit={() => onEdit(item)}
                        onDelete={() => onDelete(item)}
                        isExpanded={expandedItems.has(item.id)}
                        onToggleExpand={() => onToggleItemExpand(item.id)}
                        onViewInScript={onViewInScript}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

// Add/Edit Item Dialog
const BreakdownItemDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  item?: BacklotSceneBreakdownItem;
  sceneId: string;
  scenes?: BacklotScene[];
  onSave: (input: BreakdownItemInput) => void;
  isLoading: boolean;
}> = ({ open, onClose, item, sceneId, scenes = [], onSave, isLoading }) => {
  const [type, setType] = useState<BacklotBreakdownItemType>(
    item?.type || "prop"
  );
  const [label, setLabel] = useState(item?.label || "");
  const [quantity, setQuantity] = useState(item?.quantity || 1);
  const [notes, setNotes] = useState(item?.notes || "");
  const [department, setDepartment] = useState<BacklotBreakdownDepartment | "">(
    item?.department || ""
  );
  const [selectedSceneId, setSelectedSceneId] = useState<string>(sceneId);

  React.useEffect(() => {
    if (item) {
      setType(item.type);
      setLabel(item.label);
      setQuantity(item.quantity);
      setNotes(item.notes || "");
      setDepartment(item.department || "");
      setSelectedSceneId(item.scene_id);
    } else {
      setType("prop");
      setLabel("");
      setQuantity(1);
      setNotes("");
      setDepartment("");
      setSelectedSceneId(sceneId);
    }
  }, [item, open, sceneId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    onSave({
      type,
      label: label.trim(),
      quantity,
      notes: notes.trim() || undefined,
      department: department || undefined,
      // Only include scene_id if editing and scene changed
      scene_id: item && selectedSceneId !== item.scene_id ? selectedSceneId : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {item ? "Edit Breakdown Item" : "Add Breakdown Item"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as BacklotBreakdownItemType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BREAKDOWN_ITEM_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: BREAKDOWN_HIGHLIGHT_COLORS[t] }}
                      />
                      {BREAKDOWN_TYPE_LABELS[t]}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Hero Watch, Police Car #1"
              required
            />
          </div>

          {/* Scene selector - only show when editing an existing item */}
          {item && scenes.length > 0 && (
            <div className="space-y-2">
              <Label>Scene</Label>
              <Select
                value={selectedSceneId}
                onValueChange={setSelectedSceneId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select scene" />
                </SelectTrigger>
                <SelectContent>
                  {scenes.map((scene) => (
                    <SelectItem key={scene.id} value={scene.id}>
                      Scene {scene.scene_number}{scene.slugline ? ` - ${scene.slugline}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Move this breakdown item to a different scene
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={department || "none"}
                onValueChange={(v) =>
                  setDepartment(v === "none" ? "" : (v as BacklotBreakdownDepartment))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {BREAKDOWN_DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {BREAKDOWN_DEPARTMENT_LABELS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!label.trim() || isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {item ? "Update" : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Main Component
export default function ScriptBreakdownPanel({
  projectId,
  canEdit,
  onSceneClick,
  onViewHighlight,
}: ScriptBreakdownPanelProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<BacklotBreakdownItemType | "all">(
    "all"
  );
  const [departmentFilter, setDepartmentFilter] = useState<
    BacklotBreakdownDepartment | "all"
  >("all");
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Refs for scene sections (for quick navigation scrolling)
  const sceneRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<
    BacklotSceneBreakdownItem | undefined
  >();
  const [activeSceneId, setActiveSceneId] = useState<string>("");

  // Data fetching
  const {
    data,
    breakdownItems,
    scenes,
    groupedByScene,
    isLoading,
    error,
    refetch,
  } = useProjectBreakdown({
    projectId,
    typeFilter: typeFilter !== "all" ? typeFilter : undefined,
    departmentFilter: departmentFilter !== "all" ? departmentFilter : undefined,
  });

  const { totalItems, byType, byDepartment, scenesWithBreakdown, totalScenes } =
    useBreakdownSummary({ projectId });

  const mutations = useBreakdownMutations({
    projectId,
    onSuccess: () => {
      setDialogOpen(false);
      setEditingItem(undefined);
      refetch();
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const { exportProjectBreakdown, isExporting } = useBreakdownPdfExport({
    projectId,
  });

  // Filter items by search
  const filteredScenes = useMemo(() => {
    if (!searchQuery.trim()) return scenes;

    const query = searchQuery.toLowerCase();
    return scenes.filter((scene) => {
      // Check scene fields
      if (
        scene.scene_number?.toLowerCase().includes(query) ||
        scene.slugline?.toLowerCase().includes(query)
      ) {
        return true;
      }

      // Check items in scene
      const sceneData = groupedByScene[scene.id];
      if (sceneData?.items) {
        return sceneData.items.some(
          (item) =>
            item.label.toLowerCase().includes(query) ||
            item.notes?.toLowerCase().includes(query)
        );
      }

      return false;
    });
  }, [scenes, groupedByScene, searchQuery]);

  // Toggle scene expansion
  const toggleScene = (sceneId: string) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  };

  // Toggle breakdown item expansion
  const toggleItemExpand = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Expand all scenes with items
  const expandAll = () => {
    setExpandedScenes(new Set(Object.keys(groupedByScene)));
  };

  // Collapse all
  const collapseAll = () => {
    setExpandedScenes(new Set());
  };

  // Navigate to a specific scene
  const navigateToScene = (sceneId: string) => {
    // Expand the scene
    setExpandedScenes((prev) => new Set([...prev, sceneId]));
    // Scroll to it after a short delay (to allow expansion)
    setTimeout(() => {
      const sceneEl = sceneRefs.current.get(sceneId);
      if (sceneEl) {
        sceneEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Handle add item
  const handleAddItem = (sceneId: string) => {
    setActiveSceneId(sceneId);
    setEditingItem(undefined);
    setDialogOpen(true);
  };

  // Handle edit item
  const handleEditItem = (item: BacklotSceneBreakdownItem) => {
    setActiveSceneId(item.scene_id);
    setEditingItem(item);
    setDialogOpen(true);
  };

  // Handle delete item
  const handleDeleteItem = (item: BacklotSceneBreakdownItem) => {
    if (confirm(`Delete "${item.label}"?`)) {
      mutations.deleteItem.mutate(item.id);
    }
  };

  // Handle save item
  const handleSaveItem = (input: BreakdownItemInput) => {
    if (editingItem) {
      mutations.updateItem.mutate({ itemId: editingItem.id, input });
    } else {
      mutations.createItem.mutate({ sceneId: activeSceneId, input });
    }
  };

  // Handle PDF export
  const handleExport = (includeNotes: boolean) => {
    exportProjectBreakdown.mutate(
      {
        typeFilter: typeFilter !== "all" ? typeFilter : undefined,
        departmentFilter:
          departmentFilter !== "all" ? departmentFilter : undefined,
        includeNotes,
      },
      {
        onSuccess: () => {
          toast({
            title: "PDF Downloaded",
            description: `Breakdown sheet ${includeNotes ? "with notes" : "without notes"} has been downloaded`,
          });
        },
        onError: (err) => {
          toast({
            title: "Export Failed",
            description: err.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h3 className="text-lg font-medium">Failed to load breakdown</h3>
        <p className="text-muted-gray text-sm mt-1">
          {(error as Error).message}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-charcoal-gray/50 border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{totalItems}</div>
            <div className="text-sm text-muted-gray">Total Items</div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-gray/50 border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{scenesWithBreakdown}</div>
            <div className="text-sm text-muted-gray">Scenes with Items</div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-gray/50 border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {Object.keys(byType).length}
            </div>
            <div className="text-sm text-muted-gray">Element Types</div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-gray/50 border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {Object.keys(byDepartment).filter((d) => d !== "unassigned")
                .length}
            </div>
            <div className="text-sm text-muted-gray">Departments</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Scene Navigation */}
      {scenes.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-charcoal-gray/30 rounded-lg border border-muted-gray/20">
          <Film className="w-5 h-5 text-accent-yellow" />
          <span className="text-sm font-medium text-bone-white">Jump to Scene:</span>
          <Select
            value=""
            onValueChange={(sceneId) => {
              if (sceneId) navigateToScene(sceneId);
            }}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a scene..." />
            </SelectTrigger>
            <SelectContent>
              {scenes.map((scene) => {
                const sceneData = groupedByScene[scene.id];
                const itemCount = sceneData?.items?.length || 0;
                return (
                  <SelectItem key={scene.id} value={scene.id}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span className="font-mono font-bold">Sc. {scene.scene_number}</span>
                      <span className="text-muted-gray truncate max-w-[150px]">
                        {scene.slugline || 'No slugline'}
                      </span>
                      {itemCount > 0 && (
                        <Badge variant="secondary" className="text-xs ml-auto">
                          {itemCount}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-gray">
            {scenesWithBreakdown} of {totalScenes} scenes have items
          </span>
        </div>
      )}

      {/* Filters & Actions */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search scenes or items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={typeFilter}
          onValueChange={(v) =>
            setTypeFilter(v as BacklotBreakdownItemType | "all")
          }
        >
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {BREAKDOWN_ITEM_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: BREAKDOWN_HIGHLIGHT_COLORS[t] }}
                  />
                  {BREAKDOWN_TYPE_LABELS[t]}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={departmentFilter}
          onValueChange={(v) =>
            setDepartmentFilter(v as BacklotBreakdownDepartment | "all")
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by dept" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {BREAKDOWN_DEPARTMENTS.map((d) => (
              <SelectItem key={d} value={d}>
                {BREAKDOWN_DEPARTMENT_LABELS[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="ghost" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isExporting || totalItems === 0}
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export PDF
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport(true)}>
                <FileText className="w-4 h-4 mr-2" />
                With Notes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport(false)}>
                <FileText className="w-4 h-4 mr-2" />
                Without Notes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Scene List */}
      {filteredScenes.length === 0 ? (
        <div className="text-center py-12 text-muted-gray">
          {searchQuery
            ? "No scenes match your search"
            : "No breakdown items yet. Add items from the Viewer tab by highlighting text."}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredScenes.map((scene) => {
            const sceneData = groupedByScene[scene.id];
            const items = sceneData?.items || [];

            return (
              <div
                key={scene.id}
                ref={(el) => {
                  if (el) sceneRefs.current.set(scene.id, el);
                }}
              >
                <SceneBreakdownSection
                  scene={scene}
                  items={items}
                  canEdit={canEdit}
                  expanded={expandedScenes.has(scene.id)}
                  onToggle={() => toggleScene(scene.id)}
                  onEdit={handleEditItem}
                  onDelete={handleDeleteItem}
                  onAddItem={handleAddItem}
                  onSceneClick={onSceneClick}
                  expandedItems={expandedItems}
                  onToggleItemExpand={toggleItemExpand}
                  onViewInScript={onViewHighlight}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <BreakdownItemDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingItem(undefined);
        }}
        item={editingItem}
        sceneId={activeSceneId}
        scenes={scenes}
        onSave={handleSaveItem}
        isLoading={
          mutations.createItem.isPending || mutations.updateItem.isPending
        }
      />
    </div>
  );
}
