/**
 * SceneDetailView - Comprehensive scene overview with all aggregated data
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  Film,
  FileText,
  Camera,
  MapPin,
  Play,
  MessageSquare,
  CheckSquare,
  Users,
  Package,
  Car,
  Shirt,
  Sparkles,
  Palette,
  Dog,
  Zap,
  ExternalLink,
} from 'lucide-react';
import { useSceneOverview, getBreakdownTypeInfo, BREAKDOWN_TYPES } from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface SceneDetailViewProps {
  projectId: string;
  sceneId: string;
  canEdit: boolean;
  onBack: () => void;
}

const BREAKDOWN_ICONS: Record<string, React.ElementType> = {
  cast: Users,
  background: Users,
  stunt: Zap,
  prop: Package,
  vehicle: Car,
  wardrobe: Shirt,
  makeup: Palette,
  sfx: Sparkles,
  vfx: Sparkles,
  animal: Dog,
  location: MapPin,
  other: Package,
};

export default function SceneDetailView({ projectId, sceneId, canEdit, onBack }: SceneDetailViewProps) {
  const { data: overview, isLoading } = useSceneOverview(projectId, sceneId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-gray mb-4">Scene not found</p>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Scenes
        </Button>
      </div>
    );
  }

  const { scene, breakdown_items, breakdown_by_type, shots, locations, dailies_clips, review_notes, tasks, coverage_summary } = overview;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-heading text-bone-white flex items-center gap-2">
              <Film className="w-6 h-6 text-accent-yellow" />
              Scene {scene.scene_number}
            </h2>
            {scene.needs_pickup ? (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Needs Pickup</Badge>
            ) : scene.is_shot ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Shot</Badge>
            ) : scene.is_scheduled ? (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Scheduled</Badge>
            ) : (
              <Badge className="bg-muted-gray/20 text-muted-gray border-muted-gray/30">Planning</Badge>
            )}
            {scene.int_ext && (
              <Badge variant="outline" className="border-muted-gray/30 text-muted-gray">{scene.int_ext}</Badge>
            )}
            {scene.day_night && (
              <Badge variant="outline" className="border-muted-gray/30 text-muted-gray">{scene.day_night}</Badge>
            )}
          </div>
          {scene.slugline && (
            <p className="text-lg text-muted-gray mt-1">{scene.slugline}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-gray">
            {scene.page_length && (
              <span>{scene.page_length.toFixed(1)} pages</span>
            )}
            {scene.page_start && scene.page_end && (
              <span>Pages {scene.page_start}-{scene.page_end}</span>
            )}
          </div>
        </div>
      </div>

      {/* Coverage Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-bone-white">{coverage_summary.total_shots}</p>
            <p className="text-xs text-muted-gray">Shots Planned</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{coverage_summary.covered_shots}</p>
            <p className="text-xs text-muted-gray">Shots Covered</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-accent-yellow">{coverage_summary.coverage_percent}%</p>
            <p className="text-xs text-muted-gray">Coverage</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">{coverage_summary.total_clips}</p>
            <p className="text-xs text-muted-gray">Dailies Clips</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{coverage_summary.circle_takes}</p>
            <p className="text-xs text-muted-gray">Circle Takes</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="breakdown" className="w-full">
        <TabsList className="bg-charcoal-black border border-muted-gray/20">
          <TabsTrigger value="breakdown">Breakdown ({breakdown_items.length})</TabsTrigger>
          <TabsTrigger value="shots">Shots ({shots.length})</TabsTrigger>
          <TabsTrigger value="dailies">Dailies ({dailies_clips.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="locations">Locations ({locations.length})</TabsTrigger>
        </TabsList>

        {/* Breakdown Tab */}
        <TabsContent value="breakdown" className="mt-4">
          {Object.keys(breakdown_by_type).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {BREAKDOWN_TYPES.map(type => {
                const items = breakdown_by_type[type.value] || [];
                if (items.length === 0) return null;
                const Icon = BREAKDOWN_ICONS[type.value] || Package;
                return (
                  <Card key={type.value} className="bg-charcoal-black border-muted-gray/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <div className={cn('p-1.5 rounded', type.color + '/20')}>
                          <Icon className={cn('w-4 h-4', type.color.replace('bg-', 'text-'))} />
                        </div>
                        {type.label}
                        <Badge variant="outline" className="ml-auto border-muted-gray/30 text-muted-gray">
                          {items.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-32">
                        <ul className="space-y-1">
                          {items.map(item => (
                            <li key={item.id} className="text-sm text-muted-gray flex items-center justify-between">
                              <span>{item.name}</span>
                              {item.quantity && item.quantity > 1 && (
                                <Badge variant="outline" className="text-xs border-muted-gray/30">
                                  x{item.quantity}
                                </Badge>
                              )}
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardContent className="py-12 text-center text-muted-gray">
                No breakdown items for this scene
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Shots Tab */}
        <TabsContent value="shots" className="mt-4">
          {shots.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shots.map(shot => (
                <Card key={shot.id} className="bg-charcoal-black border-muted-gray/20">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Camera className="w-4 h-4 text-blue-400" />
                        <span className="font-medium text-bone-white">{shot.shot_number}</span>
                      </div>
                      {shot.is_covered && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Covered</Badge>
                      )}
                    </div>
                    {shot.description && (
                      <p className="text-sm text-muted-gray mt-2 line-clamp-2">{shot.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-gray">
                      {shot.frame_size && <span>{shot.frame_size}</span>}
                      {shot.camera_movement && <span>&middot; {shot.camera_movement}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardContent className="py-12 text-center text-muted-gray">
                No shots planned for this scene
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Dailies Tab */}
        <TabsContent value="dailies" className="mt-4">
          {dailies_clips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dailies_clips.map(clip => (
                <Card key={clip.id} className="bg-charcoal-black border-muted-gray/20">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Play className="w-4 h-4 text-purple-400" />
                        <span className="font-medium text-bone-white truncate max-w-[200px]">
                          {clip.file_name}
                        </span>
                      </div>
                      {clip.is_circle_take && (
                        <Badge className="bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30">Circle</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-gray">
                      {clip.take_number && <span>Take {clip.take_number}</span>}
                      {clip.duration_seconds && (
                        <span>{Math.floor(clip.duration_seconds / 60)}:{String(Math.floor(clip.duration_seconds % 60)).padStart(2, '0')}</span>
                      )}
                      {clip.rating && (
                        <Badge variant="outline" className="border-muted-gray/30">
                          ★ {clip.rating}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardContent className="py-12 text-center text-muted-gray">
                No dailies clips for this scene yet
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-4">
          {tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.map(task => (
                <Card key={task.id} className="bg-charcoal-black border-muted-gray/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckSquare className={cn(
                          'w-4 h-4',
                          task.status === 'completed' ? 'text-green-400' : 'text-muted-gray'
                        )} />
                        <span className={cn(
                          'font-medium',
                          task.status === 'completed' ? 'text-muted-gray line-through' : 'text-bone-white'
                        )}>
                          {task.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.priority && (
                          <Badge variant="outline" className={cn(
                            'border-muted-gray/30',
                            task.priority === 'urgent' && 'border-red-500/30 text-red-400',
                            task.priority === 'high' && 'border-orange-500/30 text-orange-400'
                          )}>
                            {task.priority}
                          </Badge>
                        )}
                        {task.assigned_to_name && (
                          <span className="text-sm text-muted-gray">{task.assigned_to_name}</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardContent className="py-12 text-center text-muted-gray">
                No tasks linked to this scene
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations" className="mt-4">
          {locations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {locations.map(loc => (
                <Card key={loc.id} className="bg-charcoal-black border-muted-gray/20">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-cyan-400" />
                        <span className="font-medium text-bone-white">{loc.name}</span>
                      </div>
                      {loc.is_primary && (
                        <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Primary</Badge>
                      )}
                    </div>
                    {loc.address && (
                      <p className="text-sm text-muted-gray mt-2">{loc.address}</p>
                    )}
                    {loc.type && (
                      <Badge variant="outline" className="mt-2 border-muted-gray/30 text-muted-gray">
                        {loc.type}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardContent className="py-12 text-center text-muted-gray">
                No locations assigned to this scene
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
