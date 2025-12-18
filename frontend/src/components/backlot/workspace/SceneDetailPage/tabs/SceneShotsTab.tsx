/**
 * SceneShotsTab - Shot list for the scene
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SceneHubData } from '@/hooks/backlot';
import { Camera, Plus, CheckCircle2, Circle, Video } from 'lucide-react';

interface SceneShotsTabProps {
  hub: SceneHubData;
  canEdit: boolean;
  projectId: string;
  sceneId: string;
}

export default function SceneShotsTab({ hub, canEdit, projectId, sceneId }: SceneShotsTabProps) {
  const { shots, coverage_summary } = hub;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-bone-white">
            <span className="text-2xl font-bold">{shots.length}</span>
            <span className="text-muted-gray ml-2">shots planned</span>
          </div>
          <div className="text-green-400">
            <span className="text-2xl font-bold">{coverage_summary.covered_shots}</span>
            <span className="text-muted-gray ml-2">covered</span>
          </div>
          <Badge
            className={
              coverage_summary.coverage_percent === 100
                ? 'bg-green-500/20 text-green-400'
                : coverage_summary.coverage_percent > 0
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-muted-gray/20 text-muted-gray'
            }
          >
            {coverage_summary.coverage_percent}% coverage
          </Badge>
        </div>
        {canEdit && (
          <Button className="bg-accent-yellow text-deep-black hover:bg-accent-yellow/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Shot
          </Button>
        )}
      </div>

      {/* Shot List */}
      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardContent className="p-0">
          {shots.length === 0 ? (
            <div className="text-center py-12 text-muted-gray">
              <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No shots added to this scene yet</p>
              {canEdit && (
                <Button variant="outline" className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Shot List
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-muted-gray/20">
              {shots.map((shot) => (
                <div
                  key={shot.id}
                  className="p-4 hover:bg-muted-gray/5 flex items-center gap-4"
                >
                  <div className="flex-shrink-0">
                    {shot.is_covered ? (
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                    ) : (
                      <Circle className="w-6 h-6 text-muted-gray" />
                    )}
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-bone-white">
                        Shot {shot.shot_number}
                      </span>
                      {shot.frame_size && (
                        <Badge variant="outline" className="text-xs">
                          {shot.frame_size}
                        </Badge>
                      )}
                      {shot.camera_movement && (
                        <Badge variant="outline" className="text-xs">
                          {shot.camera_movement}
                        </Badge>
                      )}
                    </div>
                    {shot.description && (
                      <p className="text-sm text-muted-gray mt-1">{shot.description}</p>
                    )}
                  </div>
                  {shot.circle_take_count > 0 && (
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                      <Video className="w-3 h-3 mr-1" />
                      {shot.circle_take_count} takes
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
