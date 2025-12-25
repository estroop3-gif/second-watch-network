/**
 * ScenesView - Scene list and detail aggregation view
 * Displays all scenes with breakdown, shots, dailies, and coverage status
 */
import React, { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Film,
  Camera,
  CheckCircle2,
  AlertCircle,
  Play,
  FileText,
  ChevronRight,
  Lightbulb,
  Layers,
  ListChecks,
  Package,
  Clapperboard,
  Download,
  Loader2,
} from 'lucide-react';
import { useScenesList, SceneListItem } from '@/hooks/backlot';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ScenesViewProps {
  projectId: string;
  canEdit: boolean;
  onSelectScene: (scene: SceneListItem) => void;
}

export default function ScenesView({ projectId, canEdit, onSelectScene }: ScenesViewProps) {
  const [search, setSearch] = useState('');
  const [showTipsPanel, setShowTipsPanel] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const { data: scenesData, isLoading } = useScenesList(projectId);

  // Ensure scenes is always an array and apply frontend search filter
  const allScenes = Array.isArray(scenesData) ? scenesData : [];
  const scenes = search
    ? allScenes.filter(s =>
        s.scene_number.toLowerCase().includes(search.toLowerCase()) ||
        (s.slugline && s.slugline.toLowerCase().includes(search.toLowerCase())) ||
        (s.int_ext && s.int_ext.toLowerCase().includes(search.toLowerCase())) ||
        (s.day_night && s.day_night.toLowerCase().includes(search.toLowerCase()))
      )
    : allScenes;

  // Calculate summary stats (from all scenes, not filtered)
  const totalScenes = allScenes.length;
  const shotScenes = scenes.filter(s => s.is_shot).length;
  const scheduledScenes = scenes.filter(s => s.is_scheduled && !s.is_shot).length;
  const needsPickupScenes = scenes.filter(s => s.needs_pickup).length;
  const totalPages = scenes.reduce((sum, s) => sum + (s.page_length || 0), 0);

  // Helper to format page length as fraction
  const formatPageLength = (pageLength: number | null | undefined): string => {
    if (!pageLength) return '--';
    const wholePages = Math.floor(pageLength);
    const fraction = pageLength - wholePages;
    let fractionStr = '';
    if (fraction > 0) {
      const eighths = Math.round(fraction * 8);
      if (eighths === 8) return (wholePages + 1).toString();
      else if (eighths === 4) fractionStr = '1/2';
      else if (eighths === 2) fractionStr = '1/4';
      else if (eighths === 6) fractionStr = '3/4';
      else if (eighths === 1) fractionStr = '1/8';
      else if (eighths === 3) fractionStr = '3/8';
      else if (eighths === 5) fractionStr = '5/8';
      else if (eighths === 7) fractionStr = '7/8';
    }
    if (wholePages > 0 && fractionStr) return `${wholePages} ${fractionStr}`;
    else if (wholePages > 0) return wholePages.toString();
    else if (fractionStr) return fractionStr;
    return '--';
  };

  // Get scene status label
  const getStatusLabel = (scene: SceneListItem): string => {
    if (scene.needs_pickup) return 'Needs Pickup';
    if (scene.is_shot) return 'Shot';
    if (scene.is_scheduled) return 'Scheduled';
    return 'Planning';
  };

  // Export scenes to PDF
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const dateStr = new Date().toLocaleDateString();

      // Title
      doc.setFontSize(18);
      doc.text('Scene List', 14, 22);

      // Date
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${dateStr}`, 14, 30);

      // Summary stats
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text('Summary', 14, 42);
      doc.setFontSize(10);
      doc.text(`Total Scenes: ${totalScenes}`, 14, 50);
      doc.text(`Total Pages: ${totalPages.toFixed(1)}`, 14, 56);
      doc.text(`Shot: ${shotScenes}`, 80, 50);
      doc.text(`Scheduled: ${scheduledScenes}`, 80, 56);
      doc.text(`Needs Pickup: ${needsPickupScenes}`, 140, 50);

      // Scene table
      const tableData = scenes.map((scene) => [
        scene.scene_number,
        scene.slugline?.substring(0, 35) || '--',
        formatPageLength(scene.page_length),
        scene.shot_count > 0 ? String(scene.shot_count) : '--',
        scene.breakdown_item_count > 0 ? String(scene.breakdown_item_count) : '--',
        getStatusLabel(scene),
      ]);

      autoTable(doc, {
        startY: 65,
        head: [['Scene #', 'Slugline', 'Pages', 'Shots', 'Breakdown', 'Status']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [51, 51, 51], textColor: 255 },
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0] },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 70 },
          2: { cellWidth: 18 },
          3: { cellWidth: 18 },
          4: { cellWidth: 22 },
          5: { cellWidth: 28 },
        },
      });

      doc.save(`scene-list-${new Date().toISOString().split('T')[0]}.pdf`);
      toast({ title: 'Scene list exported as PDF' });
    } catch (err) {
      console.error('PDF export error:', err);
      toast({ title: 'Failed to export PDF', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Scenes</h2>
          <p className="text-sm text-muted-gray">
            {totalScenes} scenes &middot; {totalPages.toFixed(1)} pages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTipsPanel(true)}
            className="border-muted-gray/30"
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            Tips
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={isExporting || scenes.length === 0}
            className="border-muted-gray/30"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            PDF
          </Button>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
            <Input
              placeholder="Search scenes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-charcoal-black border-muted-gray/30"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-bone-white">{totalScenes}</p>
                <p className="text-xs text-muted-gray">Total Scenes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-bone-white">{shotScenes}</p>
                <p className="text-xs text-muted-gray">Shot</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent-yellow/10">
                <Camera className="w-5 h-5 text-accent-yellow" />
              </div>
              <div>
                <p className="text-2xl font-bold text-bone-white">{scheduledScenes}</p>
                <p className="text-xs text-muted-gray">Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-bone-white">{needsPickupScenes}</p>
                <p className="text-xs text-muted-gray">Needs Pickup</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scenes Table */}
      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-muted-gray/20 hover:bg-transparent">
                <TableHead className="text-muted-gray">Scene</TableHead>
                <TableHead className="text-muted-gray">Slugline</TableHead>
                <TableHead className="text-muted-gray text-center">Pages</TableHead>
                <TableHead className="text-muted-gray text-center">Shots</TableHead>
                <TableHead className="text-muted-gray text-center">Dailies</TableHead>
                <TableHead className="text-muted-gray text-center">Breakdown</TableHead>
                <TableHead className="text-muted-gray text-center">Status</TableHead>
                <TableHead className="text-muted-gray w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scenes?.map((scene) => (
                <TableRow
                  key={scene.id}
                  className="border-muted-gray/20 cursor-pointer hover:bg-muted-gray/5"
                  onClick={() => onSelectScene(scene)}
                >
                  <TableCell className="font-medium text-bone-white">
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-muted-gray" />
                      {scene.scene_number}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate text-muted-gray">
                      {scene.slugline || '--'}
                    </div>
                    {(scene.int_ext || scene.day_night) && (
                      <div className="flex items-center gap-1 mt-0.5">
                        {scene.int_ext && (
                          <Badge variant="outline" className="text-xs px-1 py-0 border-muted-gray/30 text-muted-gray">
                            {scene.int_ext}
                          </Badge>
                        )}
                        {scene.day_night && (
                          <Badge variant="outline" className="text-xs px-1 py-0 border-muted-gray/30 text-muted-gray">
                            {scene.day_night}
                          </Badge>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-muted-gray">
                    {scene.page_length ? scene.page_length.toFixed(1) : '--'}
                  </TableCell>
                  <TableCell className="text-center">
                    {scene.shot_count > 0 ? (
                      <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                        {scene.shot_count}
                      </Badge>
                    ) : (
                      <span className="text-muted-gray">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {scene.dailies_clip_count > 0 ? (
                      <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                        <Play className="w-3 h-3 mr-1" />
                        {scene.dailies_clip_count}
                      </Badge>
                    ) : (
                      <span className="text-muted-gray">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {scene.breakdown_item_count > 0 ? (
                      <Badge variant="outline" className="border-green-500/30 text-green-400">
                        {scene.breakdown_item_count}
                      </Badge>
                    ) : (
                      <span className="text-muted-gray">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {scene.needs_pickup ? (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        Pickup
                      </Badge>
                    ) : scene.is_shot ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        Shot
                      </Badge>
                    ) : scene.is_scheduled ? (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        Scheduled
                      </Badge>
                    ) : (
                      <Badge className="bg-muted-gray/20 text-muted-gray border-muted-gray/30">
                        Planning
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="w-4 h-4 text-muted-gray" />
                  </TableCell>
                </TableRow>
              ))}
              {(!scenes || scenes.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-gray">
                    {search ? 'No scenes match your search' : 'No scenes found. Import a script to get started.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tips & Tricks Panel */}
      <Dialog open={showTipsPanel} onOpenChange={setShowTipsPanel}>
        <DialogContent className="max-w-2xl bg-charcoal-black border-muted-gray/20 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-bone-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-accent-yellow" />
              Scene Management Tips
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Overview */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-accent-yellow flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Understanding Scenes
              </h3>
              <div className="grid gap-2 text-sm">
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <Film className="w-5 h-5 text-muted-gray shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Scene = Production Unit</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Each scene represents a single dramatic unit at one location and time. Scenes are the building blocks for scheduling, breakdown, and coverage tracking.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <FileText className="w-5 h-5 text-muted-gray shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Page Length</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Page lengths are shown in eighths (1/8, 1/4, 3/8, etc.) - the industry standard. They're used to estimate shooting time and schedule days.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Columns Explained */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-accent-yellow flex items-center gap-2">
                <ListChecks className="w-4 h-4" />
                Table Columns
              </h3>
              <div className="grid gap-2 text-sm">
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <Camera className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Shots</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Number of planned shots from your Shot Lists assigned to this scene.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <Play className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Dailies</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Number of dailies clips linked to this scene for review.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <Package className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Breakdown</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Count of breakdown items (cast, props, wardrobe, etc.) needed for this scene.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Scene Statuses */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-accent-yellow flex items-center gap-2">
                <Clapperboard className="w-4 h-4" />
                Scene Status
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3 p-2 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <Badge className="bg-muted-gray/20 text-muted-gray border-muted-gray/30">Planning</Badge>
                  <p className="text-muted-gray">Scene is being prepped but not yet scheduled</p>
                </div>
                <div className="flex items-center gap-3 p-2 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Scheduled</Badge>
                  <p className="text-muted-gray">Scene is on the shooting schedule</p>
                </div>
                <div className="flex items-center gap-3 p-2 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Shot</Badge>
                  <p className="text-muted-gray">Scene has been filmed</p>
                </div>
                <div className="flex items-center gap-3 p-2 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Pickup</Badge>
                  <p className="text-muted-gray">Scene needs additional coverage or reshoots</p>
                </div>
              </div>
            </div>

            {/* Quick Tip */}
            <div className="p-3 bg-accent-yellow/5 rounded-lg border border-accent-yellow/20 text-sm">
              <p className="text-muted-gray">
                <span className="text-accent-yellow font-medium">Tip:</span> Click any scene row to open its detail view where you can manage breakdown items, view linked shots, and update scene information.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
