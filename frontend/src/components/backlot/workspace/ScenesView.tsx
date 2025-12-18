/**
 * ScenesView - Scene list and detail aggregation view
 * Displays all scenes with breakdown, shots, dailies, and coverage status
 */
import React, { useState } from 'react';
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
  Search,
  Film,
  Camera,
  CheckCircle2,
  AlertCircle,
  Play,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { useScenesList, SceneListItem } from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface ScenesViewProps {
  projectId: string;
  canEdit: boolean;
  onSelectScene: (scene: SceneListItem) => void;
}

export default function ScenesView({ projectId, canEdit, onSelectScene }: ScenesViewProps) {
  const [search, setSearch] = useState('');

  const { data: scenesData, isLoading } = useScenesList(projectId, { search: search || undefined });

  // Ensure scenes is always an array
  const scenes = Array.isArray(scenesData) ? scenesData : [];

  // Calculate summary stats
  const totalScenes = scenes.length;
  const shotScenes = scenes.filter(s => s.is_shot).length;
  const scheduledScenes = scenes.filter(s => s.is_scheduled && !s.is_shot).length;
  const needsPickupScenes = scenes.filter(s => s.needs_pickup).length;
  const totalPages = scenes.reduce((sum, s) => sum + (s.page_length || 0), 0);

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
    </div>
  );
}
