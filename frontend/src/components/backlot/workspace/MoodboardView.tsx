/**
 * MoodboardView - Visual reference board tool
 *
 * Features:
 * - Multiple moodboards per project
 * - Sections to organize items
 * - Item tiles with image, title, tags, notes
 * - Reorder items and sections with up/down buttons
 * - Search by title and notes
 * - Filter by tag
 * - Export CSV and Print view
 */
import React, { useState, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Palette,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  Download,
  MoreVertical,
  Pencil,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  X,
  Search,
  Tag,
  ExternalLink,
  FolderOpen,
  Link2,
  List,
  LayoutGrid,
  Grid3X3,
  Star,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useMoodboards,
  useMoodboard,
  useCreateMoodboard,
  useUpdateMoodboard,
  useDeleteMoodboard,
  useCreateMoodboardSection,
  useUpdateMoodboardSection,
  useDeleteMoodboardSection,
  useReorderMoodboardSections,
  useCreateMoodboardItem,
  useUpdateMoodboardItem,
  useDeleteMoodboardItem,
  useReorderMoodboardItems,
  useMoodboardItemImageUpload,
  getMoodboardExportUrl,
  getMoodboardPdfExportUrl,
  getSectionPdfExportUrl,
  Moodboard,
  MoodboardSection,
  MoodboardItem,
  MOODBOARD_CATEGORIES,
  type MoodboardCategory,
  type AspectRatio,
} from '@/hooks/backlot';
import {
  MoodboardItemUploader,
  MoodboardGridView,
  MoodboardListView,
  MoodboardMasonryView,
} from './moodboard';
import { analyzeImage } from '@/lib/colorExtraction';

interface MoodboardViewProps {
  projectId: string;
  canEdit: boolean;
}

// Item Card Component
function ItemCard({
  item,
  index,
  canEdit,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onMoveToSection,
  isFirst,
  isLast,
  sections,
}: {
  item: MoodboardItem;
  index: number;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveToSection: (sectionId: string | null) => void;
  isFirst: boolean;
  isLast: boolean;
  sections: MoodboardSection[];
}) {
  return (
    <Card className="bg-white/5 border-white/10 group hover:border-white/20 transition-colors overflow-hidden">
      {/* Image */}
      <div className="aspect-video bg-white/10 relative overflow-hidden">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.title || `Item ${index + 1}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-muted-gray" />
          </div>
        )}
        {/* Action overlay */}
        {canEdit && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="secondary"
              className="h-7 w-7 bg-black/60"
              onClick={onEdit}
            >
              <Pencil className="w-3 h-3" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7 bg-black/60"
                >
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onMoveUp} disabled={isFirst}>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Move Up
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onMoveDown} disabled={isLast}>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Move Down
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onMoveToSection(null)}>
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Move to Unsorted
                </DropdownMenuItem>
                {sections.map((section) => (
                  <DropdownMenuItem
                    key={section.id}
                    onClick={() => onMoveToSection(section.id)}
                    disabled={section.id === item.section_id}
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Move to {section.title}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-red-400">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-3">
        {item.title && (
          <h4 className="font-medium text-bone-white truncate text-sm mb-1">
            {item.title}
          </h4>
        )}
        {item.notes && (
          <p className="text-xs text-muted-gray line-clamp-2 mb-2">{item.notes}</p>
        )}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent-yellow hover:underline mt-2"
          >
            <ExternalLink className="w-3 h-3" />
            Source
          </a>
        )}
      </CardContent>
    </Card>
  );
}

export function MoodboardView({ projectId, canEdit }: MoodboardViewProps) {
  // State
  const [selectedMoodboardId, setSelectedMoodboardId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCreateSectionDialog, setShowCreateSectionDialog] = useState(false);
  const [showEditSectionDialog, setShowEditSectionDialog] = useState(false);
  const [showDeleteSectionConfirm, setShowDeleteSectionConfirm] = useState(false);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [showDeleteItemConfirm, setShowDeleteItemConfirm] = useState(false);
  const [editingSection, setEditingSection] = useState<MoodboardSection | null>(null);
  const [editingItem, setEditingItem] = useState<MoodboardItem | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // View mode for items
  type ItemViewMode = 'grid' | 'list' | 'masonry';
  const [itemViewMode, setItemViewMode] = useState<ItemViewMode>('grid');

  // Image input mode (url or upload)
  const [imageInputMode, setImageInputMode] = useState<'url' | 'upload'>('url');

  // Staged upload data (for when creating new item via upload)
  const [stagedUpload, setStagedUpload] = useState<{
    file: File;
    previewUrl: string;
    colorPalette: string[];
    aspectRatio: AspectRatio;
  } | null>(null);

  // Form states
  const [formData, setFormData] = useState({ title: '', description: '' });
  const [sectionFormData, setSectionFormData] = useState({ title: '' });
  const [itemFormData, setItemFormData] = useState({
    section_id: null as string | null,
    image_url: '',
    source_url: '',
    title: '',
    notes: '',
    tags: '',
    category: null as MoodboardCategory | null,
    rating: null as number | null,
    color_palette: [] as string[],
    aspect_ratio: null as AspectRatio | null,
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string | null>(null);

  // Queries
  const { data: moodboards, isLoading: loadingList, refetch: refetchList } = useMoodboards(projectId);
  const { data: moodboard, isLoading: loadingDetail, refetch: refetchDetail } = useMoodboard(
    projectId,
    selectedMoodboardId
  );

  // Mutations
  const createMoodboard = useCreateMoodboard(projectId);
  const updateMoodboard = useUpdateMoodboard(projectId);
  const deleteMoodboard = useDeleteMoodboard(projectId);
  const createSection = useCreateMoodboardSection(projectId, selectedMoodboardId);
  const updateSection = useUpdateMoodboardSection(projectId, selectedMoodboardId);
  const deleteSection = useDeleteMoodboardSection(projectId, selectedMoodboardId);
  const reorderSections = useReorderMoodboardSections(projectId, selectedMoodboardId);
  const createItem = useCreateMoodboardItem(projectId, selectedMoodboardId);
  const updateItem = useUpdateMoodboardItem(projectId, selectedMoodboardId);
  const deleteItem = useDeleteMoodboardItem(projectId, selectedMoodboardId);
  const reorderItems = useReorderMoodboardItems(projectId, selectedMoodboardId);
  const getItemUploadUrl = useMoodboardItemImageUpload(projectId, selectedMoodboardId);

  // Filtered items
  const filteredItems = useMemo(() => {
    if (!moodboard) return { unsorted: [], sections: [] };

    const filterItems = (items: MoodboardItem[]) => {
      return items.filter((item) => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesTitle = item.title?.toLowerCase().includes(query);
          const matchesNotes = item.notes?.toLowerCase().includes(query);
          if (!matchesTitle && !matchesNotes) return false;
        }
        // Tag filter
        if (tagFilter && (!item.tags || !item.tags.includes(tagFilter))) {
          return false;
        }
        return true;
      });
    };

    // Filter unsorted items
    const unsorted = filterItems(moodboard.unsorted_items || []);

    // Filter section items
    const sections = (moodboard.sections || []).map((section) => ({
      ...section,
      items: filterItems(section.items || []),
    }));

    return { unsorted, sections };
  }, [moodboard, searchQuery, tagFilter]);

  // Handlers
  const handleCreateMoodboard = useCallback(async () => {
    try {
      const result = await createMoodboard.mutateAsync({
        title: formData.title,
        description: formData.description || undefined,
      });
      setShowCreateDialog(false);
      setFormData({ title: '', description: '' });
      setSelectedMoodboardId(result.id);
      toast.success('Moodboard created');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create moodboard');
    }
  }, [createMoodboard, formData]);

  const handleUpdateMoodboard = useCallback(async () => {
    if (!selectedMoodboardId) return;
    try {
      await updateMoodboard.mutateAsync({
        moodboardId: selectedMoodboardId,
        data: {
          title: formData.title,
          description: formData.description || undefined,
        },
      });
      setShowEditDialog(false);
      toast.success('Moodboard updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update moodboard');
    }
  }, [updateMoodboard, selectedMoodboardId, formData]);

  const handleDeleteMoodboard = useCallback(async () => {
    if (!selectedMoodboardId) return;
    try {
      await deleteMoodboard.mutateAsync(selectedMoodboardId);
      setShowDeleteConfirm(false);
      setSelectedMoodboardId(null);
      toast.success('Moodboard deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete moodboard');
    }
  }, [deleteMoodboard, selectedMoodboardId]);

  const handleCreateSection = useCallback(async () => {
    try {
      await createSection.mutateAsync({ title: sectionFormData.title });
      setShowCreateSectionDialog(false);
      setSectionFormData({ title: '' });
      toast.success('Section created');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create section');
    }
  }, [createSection, sectionFormData]);

  const handleUpdateSection = useCallback(async () => {
    if (!editingSection) return;
    try {
      await updateSection.mutateAsync({
        sectionId: editingSection.id,
        data: { title: sectionFormData.title },
      });
      setShowEditSectionDialog(false);
      setEditingSection(null);
      setSectionFormData({ title: '' });
      toast.success('Section updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update section');
    }
  }, [updateSection, editingSection, sectionFormData]);

  const handleDeleteSection = useCallback(async () => {
    if (!editingSection) return;
    try {
      await deleteSection.mutateAsync(editingSection.id);
      setShowDeleteSectionConfirm(false);
      setEditingSection(null);
      toast.success('Section deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete section');
    }
  }, [deleteSection, editingSection]);

  const handleReorderSection = useCallback(
    async (sectionId: string, direction: 'UP' | 'DOWN') => {
      try {
        await reorderSections.mutateAsync({ section_id: sectionId, direction });
      } catch (err: any) {
        toast.error(err.message || 'Failed to reorder section');
      }
    },
    [reorderSections]
  );

  const handleCreateItem = useCallback(async () => {
    try {
      const tags = itemFormData.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t);

      let finalImageUrl = itemFormData.image_url;
      const colorPalette = stagedUpload?.colorPalette || itemFormData.color_palette;
      const aspectRatio = stagedUpload?.aspectRatio || itemFormData.aspect_ratio;

      // If we have a staged file upload, upload it to S3 first
      if (stagedUpload) {
        try {
          // Get presigned URL from backend
          const { upload_url, file_url } = await getItemUploadUrl.mutateAsync({
            file_name: stagedUpload.file.name,
            content_type: stagedUpload.file.type || 'image/jpeg',
            file_size: stagedUpload.file.size,
          });

          // Upload file to S3
          const uploadResponse = await fetch(upload_url, {
            method: 'PUT',
            body: stagedUpload.file,
            headers: {
              'Content-Type': stagedUpload.file.type || 'image/jpeg',
            },
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload image to storage');
          }

          finalImageUrl = file_url;
        } catch (uploadErr: any) {
          toast.error(uploadErr.message || 'Failed to upload image');
          return;
        }
      }

      // Validate we have an image URL
      if (!finalImageUrl || !finalImageUrl.startsWith('http')) {
        toast.error('Please provide a valid image URL or upload an image');
        return;
      }

      // Validate source_url if provided
      if (itemFormData.source_url && !itemFormData.source_url.startsWith('http')) {
        toast.error('Source URL must start with http:// or https://');
        return;
      }

      const itemData = {
        section_id: itemFormData.section_id,
        image_url: finalImageUrl,
        source_url: itemFormData.source_url || undefined,
        title: itemFormData.title || undefined,
        notes: itemFormData.notes || undefined,
        tags: tags.length > 0 ? tags : undefined,
        category: itemFormData.category || undefined,
        rating: itemFormData.rating || undefined,
        color_palette: colorPalette.length > 0 ? colorPalette : undefined,
        aspect_ratio: aspectRatio || undefined,
      };
      console.log('[Moodboard] Creating item with data:', itemData);
      await createItem.mutateAsync(itemData);
      setShowItemDialog(false);
      setStagedUpload(null);
      setImageInputMode('url');
      setItemFormData({
        section_id: null,
        image_url: '',
        source_url: '',
        title: '',
        notes: '',
        tags: '',
        category: null,
        rating: null,
        color_palette: [],
        aspect_ratio: null,
      });
      toast.success('Item added');
    } catch (err: any) {
      console.error('Create item error:', err);
      // Extract validation error details if present
      let errorMsg = 'Failed to add item';
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          errorMsg = detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join(', ');
        } else if (typeof detail === 'string') {
          errorMsg = detail;
        }
      } else if (err.message) {
        errorMsg = err.message;
      }
      toast.error(errorMsg);
    }
  }, [createItem, itemFormData, stagedUpload, getItemUploadUrl]);

  const handleUpdateItem = useCallback(async () => {
    if (!editingItem) return;
    try {
      const tags = itemFormData.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t);

      let finalImageUrl = itemFormData.image_url;
      const colorPalette = stagedUpload?.colorPalette || itemFormData.color_palette;
      const aspectRatio = stagedUpload?.aspectRatio || itemFormData.aspect_ratio;

      // If we have a staged file upload, upload it to S3 first
      if (stagedUpload) {
        try {
          // Get presigned URL from backend
          const { upload_url, file_url } = await getItemUploadUrl.mutateAsync({
            file_name: stagedUpload.file.name,
            content_type: stagedUpload.file.type || 'image/jpeg',
            file_size: stagedUpload.file.size,
          });

          // Upload file to S3
          const uploadResponse = await fetch(upload_url, {
            method: 'PUT',
            body: stagedUpload.file,
            headers: {
              'Content-Type': stagedUpload.file.type || 'image/jpeg',
            },
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload image to storage');
          }

          finalImageUrl = file_url;
        } catch (uploadErr: any) {
          toast.error(uploadErr.message || 'Failed to upload image');
          return;
        }
      }

      // Validate we have an image URL
      if (!finalImageUrl || !finalImageUrl.startsWith('http')) {
        toast.error('Please provide a valid image URL or upload an image');
        return;
      }

      // Validate source_url if provided
      if (itemFormData.source_url && !itemFormData.source_url.startsWith('http')) {
        toast.error('Source URL must start with http:// or https://');
        return;
      }

      await updateItem.mutateAsync({
        itemId: editingItem.id,
        data: {
          section_id: itemFormData.section_id,
          image_url: finalImageUrl,
          source_url: itemFormData.source_url || undefined,
          title: itemFormData.title || undefined,
          notes: itemFormData.notes || undefined,
          tags: tags,
          category: itemFormData.category,
          rating: itemFormData.rating,
          color_palette: colorPalette,
          aspect_ratio: aspectRatio,
        },
      });
      setShowItemDialog(false);
      setEditingItem(null);
      setStagedUpload(null);
      setImageInputMode('url');
      setItemFormData({
        section_id: null,
        image_url: '',
        source_url: '',
        title: '',
        notes: '',
        tags: '',
        category: null,
        rating: null,
        color_palette: [],
        aspect_ratio: null,
      });
      toast.success('Item updated');
    } catch (err: any) {
      console.error('Update item error:', err);
      // Extract validation error details if present
      let errorMsg = 'Failed to update item';
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          errorMsg = detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join(', ');
        } else if (typeof detail === 'string') {
          errorMsg = detail;
        }
      } else if (err.message) {
        errorMsg = err.message;
      }
      toast.error(errorMsg);
    }
  }, [updateItem, editingItem, itemFormData, stagedUpload, getItemUploadUrl]);

  const handleDeleteItem = useCallback(async () => {
    if (!deletingItemId) return;
    try {
      await deleteItem.mutateAsync(deletingItemId);
      setShowDeleteItemConfirm(false);
      setDeletingItemId(null);
      toast.success('Item deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete item');
    }
  }, [deleteItem, deletingItemId]);

  const handleReorderItem = useCallback(
    async (itemId: string, direction: 'UP' | 'DOWN') => {
      try {
        await reorderItems.mutateAsync({ item_id: itemId, direction });
      } catch (err: any) {
        toast.error(err.message || 'Failed to reorder item');
      }
    },
    [reorderItems]
  );

  const handleMoveItemToSection = useCallback(
    async (itemId: string, sectionId: string | null) => {
      try {
        await updateItem.mutateAsync({
          itemId,
          data: { section_id: sectionId },
        });
        toast.success('Item moved');
      } catch (err: any) {
        toast.error(err.message || 'Failed to move item');
      }
    },
    [updateItem]
  );

  const openEditItem = (item: MoodboardItem) => {
    setEditingItem(item);
    setItemFormData({
      section_id: item.section_id,
      image_url: item.image_url,
      source_url: item.source_url || '',
      title: item.title || '',
      notes: item.notes || '',
      tags: (item.tags || []).join(', '),
      category: item.category as MoodboardCategory | null,
      rating: item.rating,
      color_palette: item.color_palette || [],
      aspect_ratio: item.aspect_ratio as AspectRatio | null,
    });
    setStagedUpload(null);
    setImageInputMode('url');
    setShowItemDialog(true);
  };

  const openEditSection = (section: MoodboardSection) => {
    setEditingSection(section);
    setSectionFormData({ title: section.title });
    setShowEditSectionDialog(true);
  };

  const handleExportCSV = async () => {
    if (!selectedMoodboardId) return;
    toast.info('Exporting CSV...');

    try {
      const token = api.getToken();
      const response = await fetch(getMoodboardExportUrl(projectId, selectedMoodboardId), {
        method: 'GET',
        headers: {
          'Accept': 'text/csv',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export CSV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${moodboard?.title || 'moodboard'}_export.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('CSV downloaded');
    } catch (error) {
      console.error('CSV export error:', error);
      toast.error('Failed to export CSV');
    }
  };

  const handleExportPDF = async () => {
    if (!selectedMoodboardId) return;
    toast.info('Generating PDF...', { description: 'This may take a moment for large moodboards.' });

    try {
      const token = api.getToken();
      const response = await fetch(getMoodboardPdfExportUrl(projectId, selectedMoodboardId), {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Create blob URL and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${moodboard?.title || 'moodboard'}_export.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('PDF downloaded');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    }
  };

  const handleExportSectionPDF = async (sectionId: string) => {
    if (!selectedMoodboardId) return;
    toast.info('Generating section PDF...');

    try {
      const section = moodboard?.sections?.find(s => s.id === sectionId);
      const token = api.getToken();
      const response = await fetch(getSectionPdfExportUrl(projectId, selectedMoodboardId, sectionId), {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate section PDF');
      }

      // Create blob URL and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${section?.title || 'section'}_export.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Section PDF downloaded');
    } catch (error) {
      console.error('Section PDF export error:', error);
      toast.error('Failed to export section PDF');
    }
  };

  // Render moodboard list
  if (!selectedMoodboardId) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-heading text-bone-white">Moodboards</h2>
            <p className="text-sm text-muted-gray">
              Visual reference boards for look, feel, and inspiration
            </p>
          </div>
          {canEdit && (
            <Button
              onClick={() => {
                setFormData({ title: '', description: '' });
                setShowCreateDialog(true);
              }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New Moodboard
            </Button>
          )}
        </div>

        {/* List */}
        {loadingList ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 bg-muted-gray/20" />
            ))}
          </div>
        ) : !moodboards || moodboards.length === 0 ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Palette className="w-12 h-12 text-muted-gray mb-4" />
              <h3 className="text-lg font-medium text-bone-white mb-2">No moodboards yet</h3>
              <p className="text-sm text-muted-gray mb-4">
                Create a moodboard to collect visual references
              </p>
              {canEdit && (
                <Button
                  onClick={() => {
                    setFormData({ title: '', description: '' });
                    setShowCreateDialog(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Moodboard
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {moodboards.map((mb) => (
              <Card
                key={mb.id}
                className="bg-white/5 border-white/10 hover:border-white/20 cursor-pointer transition-colors"
                onClick={() => setSelectedMoodboardId(mb.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{mb.title}</CardTitle>
                  {mb.description && (
                    <CardDescription className="line-clamp-2">
                      {mb.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-sm text-muted-gray">
                    <span>{mb.section_count || 0} sections</span>
                    <span>{mb.item_count || 0} items</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Moodboard</DialogTitle>
              <DialogDescription>
                Create a new visual reference board
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., Visual Style References"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What is this moodboard for?"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateMoodboard}
                disabled={!formData.title || createMoodboard.isPending}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Render moodboard editor
  if (loadingDetail) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex gap-6">
          <Skeleton className="h-[600px] w-64" />
          <Skeleton className="h-[600px] flex-1" />
        </div>
      </div>
    );
  }

  if (!moodboard) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-bone-white mb-2">Moodboard not found</h3>
        <Button variant="outline" onClick={() => setSelectedMoodboardId(null)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to list
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedMoodboardId(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-heading text-bone-white">{moodboard.title}</h2>
            {moodboard.description && (
              <p className="text-sm text-muted-gray">{moodboard.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFormData({
                    title: moodboard.title,
                    description: moodboard.description || '',
                  });
                  setShowEditDialog(true);
                }}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCreateSectionDialog(true);
                  setSectionFormData({ title: '' });
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Section
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setStagedUpload(null);
                  setImageInputMode('url');
                  setItemFormData({
                    section_id: selectedSectionFilter,
                    image_url: '',
                    source_url: '',
                    title: '',
                    notes: '',
                    tags: '',
                    category: null,
                    rating: null,
                    color_palette: [],
                    aspect_ratio: null,
                  });
                  setShowItemDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Item
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-400 border-red-400/30"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search title or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={tagFilter || '__all__'} onValueChange={(v) => setTagFilter(v === '__all__' ? null : v)}>
          <SelectTrigger className="w-40">
            <Tag className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All tags</SelectItem>
            {(moodboard.all_tags || []).map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(searchQuery || tagFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setTagFilter(null);
            }}
          >
            <X className="w-4 h-4 mr-2" />
            Clear
          </Button>
        )}

        {/* View Mode Toggle */}
        <div className="ml-auto">
          <Tabs value={itemViewMode} onValueChange={(v) => setItemViewMode(v as ItemViewMode)}>
            <TabsList className="h-9">
              <TabsTrigger value="grid" className="px-3">
                <Grid3X3 className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="list" className="px-3">
                <List className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="masonry" className="px-3">
                <LayoutGrid className="w-4 h-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Sections Rail */}
        <div className="w-56 shrink-0 space-y-2">
          {/* Unsorted Section */}
          <div
            className={cn(
              'p-3 rounded-lg cursor-pointer transition-colors',
              selectedSectionFilter === null
                ? 'bg-accent-yellow/10 border border-accent-yellow/30'
                : 'bg-white/5 hover:bg-white/10'
            )}
            onClick={() => setSelectedSectionFilter(null)}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-bone-white">Unsorted</span>
              <Badge variant="outline" className="text-xs">
                {filteredItems.unsorted.length}
              </Badge>
            </div>
          </div>

          {/* Sections */}
          {(moodboard.sections || []).map((section, idx) => (
            <div
              key={section.id}
              className={cn(
                'p-3 rounded-lg cursor-pointer transition-colors group',
                selectedSectionFilter === section.id
                  ? 'bg-accent-yellow/10 border border-accent-yellow/30'
                  : 'bg-white/5 hover:bg-white/10'
              )}
              onClick={() => setSelectedSectionFilter(section.id)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-bone-white truncate flex-1">
                  {section.title}
                </span>
                <Badge variant="outline" className="text-xs ml-2">
                  {filteredItems.sections.find((s) => s.id === section.id)?.items.length || 0}
                </Badge>
              </div>
              <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* PDF Export - available to all viewers */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  title="Export section as PDF"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExportSectionPDF(section.id);
                  }}
                >
                  <Download className="w-3 h-3" />
                </Button>
                {canEdit && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorderSection(section.id, 'UP');
                      }}
                      disabled={idx === 0}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorderSection(section.id, 'DOWN');
                      }}
                      disabled={idx === (moodboard.sections?.length || 0) - 1}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditSection(section);
                      }}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSection(section);
                        setShowDeleteSectionConfirm(true);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Add Section Button */}
          {canEdit && (
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-gray"
              onClick={() => {
                setSectionFormData({ title: '' });
                setShowCreateSectionDialog(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Section
            </Button>
          )}
        </div>

        {/* Items Grid */}
        <div className="flex-1">
          {/* Show items for selected section or all */}
          {(() => {
            const itemsToShow =
              selectedSectionFilter === null
                ? filteredItems.unsorted
                : filteredItems.sections.find((s) => s.id === selectedSectionFilter)?.items || [];

            if (itemsToShow.length === 0) {
              return (
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ImageIcon className="w-12 h-12 text-muted-gray mb-4" />
                    <h3 className="text-lg font-medium text-bone-white mb-2">No items</h3>
                    <p className="text-sm text-muted-gray mb-4">
                      {searchQuery || tagFilter
                        ? 'No items match your filters'
                        : 'Add visual references to this section'}
                    </p>
                    {canEdit && !searchQuery && !tagFilter && (
                      <Button
                        onClick={() => {
                          setEditingItem(null);
                          setStagedUpload(null);
                          setImageInputMode('url');
                          setItemFormData({
                            section_id: selectedSectionFilter,
                            image_url: '',
                            source_url: '',
                            title: '',
                            notes: '',
                            tags: '',
                            category: null,
                            rating: null,
                            color_palette: [],
                            aspect_ratio: null,
                          });
                          setShowItemDialog(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Item
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            }

            // Render based on view mode
            if (itemViewMode === 'list') {
              return (
                <MoodboardListView
                  items={itemsToShow}
                  onItemClick={openEditItem}
                  canEdit={canEdit}
                />
              );
            }

            if (itemViewMode === 'masonry') {
              return (
                <MoodboardMasonryView
                  items={itemsToShow}
                  onItemClick={openEditItem}
                  canEdit={canEdit}
                />
              );
            }

            // Default grid view with ItemCard (includes edit controls)
            return (
              <MoodboardGridView
                items={itemsToShow}
                onItemClick={openEditItem}
                canEdit={canEdit}
              />
            );
          })()}
        </div>
      </div>

      {/* Edit Moodboard Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Moodboard</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateMoodboard}
              disabled={!formData.title || updateMoodboard.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Moodboard Confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Moodboard?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the moodboard and all its items. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMoodboard}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Section Dialog */}
      <Dialog open={showCreateSectionDialog} onOpenChange={setShowCreateSectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={sectionFormData.title}
                onChange={(e) => setSectionFormData({ title: e.target.value })}
                placeholder="e.g., Color Palette, Wardrobe, Lighting"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSectionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSection}
              disabled={!sectionFormData.title || createSection.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Section Dialog */}
      <Dialog open={showEditSectionDialog} onOpenChange={setShowEditSectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={sectionFormData.title}
                onChange={(e) => setSectionFormData({ title: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditSectionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateSection}
              disabled={!sectionFormData.title || updateSection.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Section Confirm */}
      <AlertDialog open={showDeleteSectionConfirm} onOpenChange={setShowDeleteSectionConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section?</AlertDialogTitle>
            <AlertDialogDescription>
              Items in this section will be moved to Unsorted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSection}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Item Dialog (Create/Edit) */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add Item'}</DialogTitle>
            <DialogDescription>
              {editingItem
                ? 'Update the item details'
                : 'Add a visual reference to the moodboard'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Image Input - URL or Upload tabs */}
            <div className="space-y-2">
              <Label>Image *</Label>
              <Tabs value={imageInputMode} onValueChange={(v) => setImageInputMode(v as 'url' | 'upload')}>
                <TabsList className="w-full">
                  <TabsTrigger value="url" className="flex-1 gap-2">
                    <Link2 className="w-4 h-4" />
                    URL
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1 gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Upload
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="url" className="mt-3">
                  <Input
                    value={itemFormData.image_url}
                    onChange={async (e) => {
                      const url = e.target.value;
                      setItemFormData((f) => ({ ...f, image_url: url }));
                      // Auto-analyze image when URL is valid
                      if (url.startsWith('http')) {
                        try {
                          const result = await analyzeImage(url);
                          setItemFormData((f) => ({
                            ...f,
                            color_palette: result.colorPalette,
                            aspect_ratio: result.aspectRatio,
                          }));
                        } catch (err) {
                          // Clear color/aspect if analysis fails (e.g., CORS blocked)
                          console.warn('Image analysis failed:', err);
                          setItemFormData((f) => ({
                            ...f,
                            color_palette: [],
                            aspect_ratio: null,
                          }));
                        }
                      }
                    }}
                    placeholder="https://..."
                  />
                  {itemFormData.image_url &&
                    itemFormData.image_url.startsWith('http') && (
                      <div className="aspect-video bg-white/10 rounded overflow-hidden mt-2">
                        <img
                          src={itemFormData.image_url}
                          alt="Preview"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                </TabsContent>
                <TabsContent value="upload" className="mt-3">
                  <MoodboardItemUploader
                    onFileStaged={(result) => {
                      if (result) {
                        setStagedUpload({
                          file: result.file,
                          previewUrl: result.previewUrl,
                          colorPalette: result.colorPalette,
                          aspectRatio: result.aspectRatio,
                        });
                        setItemFormData((f) => ({
                          ...f,
                          image_url: result.previewUrl,
                          color_palette: result.colorPalette,
                          aspect_ratio: result.aspectRatio,
                        }));
                      } else {
                        setStagedUpload(null);
                        setItemFormData((f) => ({
                          ...f,
                          image_url: '',
                          color_palette: [],
                          aspect_ratio: null,
                        }));
                      }
                    }}
                    stagedPreviewUrl={stagedUpload?.previewUrl}
                  />
                  {stagedUpload && (
                    <div className="mt-3 p-2 bg-green-500/10 border border-green-500/30 rounded text-sm text-green-400 flex items-center justify-between">
                      <span>Image ready: {stagedUpload.file.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setStagedUpload(null);
                          setItemFormData((f) => ({
                            ...f,
                            image_url: '',
                            color_palette: [],
                            aspect_ratio: null,
                          }));
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Section */}
            <div className="space-y-2">
              <Label>Section</Label>
              <Select
                value={itemFormData.section_id || '__none__'}
                onValueChange={(v) =>
                  setItemFormData((f) => ({ ...f, section_id: v === '__none__' ? null : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unsorted" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unsorted</SelectItem>
                  {(moodboard.sections || []).map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={itemFormData.title}
                onChange={(e) => setItemFormData((f) => ({ ...f, title: e.target.value }))}
                placeholder="Optional title"
              />
            </div>

            {/* Category and Rating row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={itemFormData.category || '__none__'}
                  onValueChange={(v) =>
                    setItemFormData((f) => ({
                      ...f,
                      category: v === '__none__' ? null : (v as MoodboardCategory),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No category</SelectItem>
                    {MOODBOARD_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Rating</Label>
                <div className="flex items-center gap-1 h-10">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() =>
                        setItemFormData((f) => ({
                          ...f,
                          rating: f.rating === star ? null : star,
                        }))
                      }
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={cn(
                          'w-5 h-5',
                          itemFormData.rating !== null && star <= itemFormData.rating
                            ? 'fill-accent-yellow text-accent-yellow'
                            : 'text-muted-gray hover:text-accent-yellow/50'
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Color Palette (auto-extracted, read-only display) */}
            {itemFormData.color_palette.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Color Palette
                  <Badge variant="outline" className="text-xs font-normal">
                    Auto-extracted
                  </Badge>
                </Label>
                <div className="flex items-center gap-2">
                  {itemFormData.color_palette.map((color, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded border border-white/20"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Aspect Ratio (auto-detected, read-only) */}
            {itemFormData.aspect_ratio && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Aspect Ratio
                  <Badge variant="outline" className="text-xs font-normal">
                    Auto-detected
                  </Badge>
                </Label>
                <Badge className="capitalize">{itemFormData.aspect_ratio}</Badge>
              </div>
            )}

            {/* Source URL */}
            <div className="space-y-2">
              <Label>Source URL</Label>
              <Input
                value={itemFormData.source_url}
                onChange={(e) =>
                  setItemFormData((f) => ({ ...f, source_url: e.target.value }))
                }
                placeholder="https://... (where did you find this?)"
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input
                value={itemFormData.tags}
                onChange={(e) => setItemFormData((f) => ({ ...f, tags: e.target.value }))}
                placeholder="Comma-separated: color, lighting, mood"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={itemFormData.notes}
                onChange={(e) => setItemFormData((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Additional notes about this reference"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={editingItem ? handleUpdateItem : handleCreateItem}
              disabled={
                (!itemFormData.image_url && !stagedUpload) ||
                (itemFormData.image_url && !itemFormData.image_url.startsWith('http') && !stagedUpload) ||
                createItem.isPending ||
                updateItem.isPending
              }
            >
              {editingItem ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirm */}
      <AlertDialog open={showDeleteItemConfirm} onOpenChange={setShowDeleteItemConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default MoodboardView;
