/**
 * SceneDailiesTab - Footage/dailies clips for the scene
 */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SceneHubData } from '@/hooks/backlot';
import { Play, Star, Clock, Film, Plus, Video } from 'lucide-react';

interface SceneDailiesTabProps {
  hub: SceneHubData;
  canEdit: boolean;
  projectId: string;
}

export default function SceneDailiesTab({ hub, canEdit, projectId }: SceneDailiesTabProps) {
  const { dailies_clips, coverage_summary } = hub;

  // Group clips by take number
  const clipsByTake = dailies_clips.reduce((acc, clip) => {
    const key = clip.take_number || 0;
    if (!acc[key]) acc[key] = [];
    acc[key].push(clip);
    return acc;
  }, {} as Record<number, typeof dailies_clips>);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-purple-400" />
            <span className="text-2xl font-bold text-bone-white">
              {dailies_clips.length}
            </span>
            <span className="text-muted-gray">clips</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            <span className="text-2xl font-bold text-bone-white">
              {coverage_summary.circle_takes}
            </span>
            <span className="text-muted-gray">circled</span>
          </div>
        </div>
        {canEdit && (
          <Button className="bg-accent-yellow text-deep-black hover:bg-accent-yellow/90">
            <Plus className="w-4 h-4 mr-2" />
            Link Footage
          </Button>
        )}
      </div>

      {/* Clips List */}
      {dailies_clips.length === 0 ? (
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="py-12 text-center">
            <Film className="w-12 h-12 mx-auto mb-4 text-muted-gray opacity-50" />
            <p className="text-muted-gray">No footage linked to this scene yet</p>
            <p className="text-sm text-muted-gray/60 mt-1">
              Link clips from the Dailies tab
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {dailies_clips.map((clip) => (
            <Card
              key={clip.id}
              className={`bg-charcoal-black ${
                clip.is_circle_take
                  ? 'border-yellow-500/30'
                  : 'border-muted-gray/20'
              } hover:border-muted-gray/40 cursor-pointer transition-colors`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2 rounded-lg ${
                        clip.is_circle_take
                          ? 'bg-yellow-500/10'
                          : 'bg-purple-500/10'
                      }`}
                    >
                      {clip.is_circle_take ? (
                        <Star className="w-5 h-5 text-yellow-400" />
                      ) : (
                        <Play className="w-5 h-5 text-purple-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-bone-white">
                          {clip.file_name}
                        </span>
                        {clip.is_circle_take && (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            Circle Take
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-gray">
                        {clip.scene_number && (
                          <span>Scene {clip.scene_number}</span>
                        )}
                        {clip.take_number && <span>Take {clip.take_number}</span>}
                        {clip.duration_seconds && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(clip.duration_seconds)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {clip.rating !== null && clip.rating > 0 && (
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < clip.rating!
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-muted-gray'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
