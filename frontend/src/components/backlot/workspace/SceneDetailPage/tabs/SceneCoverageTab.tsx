/**
 * SceneCoverageTab - Coverage tracking and status
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SceneHubData } from '@/hooks/backlot';
import { Clapperboard, CheckCircle2, AlertCircle, Video, Star } from 'lucide-react';

interface SceneCoverageTabProps {
  hub: SceneHubData;
  canEdit: boolean;
}

export default function SceneCoverageTab({ hub, canEdit }: SceneCoverageTabProps) {
  const { coverage_summary, shots, dailies_clips } = hub;

  return (
    <div className="space-y-6">
      {/* Coverage Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-gray">Shot Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-bone-white">
                  {coverage_summary.coverage_percent}%
                </span>
                <Badge
                  className={
                    coverage_summary.coverage_percent === 100
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }
                >
                  {coverage_summary.covered_shots}/{coverage_summary.total_shots} shots
                </Badge>
              </div>
              <Progress
                value={coverage_summary.coverage_percent}
                className="h-2 bg-muted-gray/20"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-gray">Footage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Video className="w-8 h-8 text-purple-400" />
              <div>
                <p className="text-2xl font-bold text-bone-white">
                  {coverage_summary.total_clips}
                </p>
                <p className="text-sm text-muted-gray">Total clips</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-gray">Circle Takes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Star className="w-8 h-8 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold text-bone-white">
                  {coverage_summary.circle_takes}
                </p>
                <p className="text-sm text-muted-gray">Selected takes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Indicators */}
      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardHeader>
          <CardTitle className="text-bone-white flex items-center gap-2">
            <Clapperboard className="w-5 h-5 text-cyan-400" />
            Scene Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <StatusIndicator
              label="Scene Shot"
              isActive={coverage_summary.is_shot}
              icon={<CheckCircle2 className="w-5 h-5" />}
            />
            <StatusIndicator
              label="Needs Pickup"
              isActive={coverage_summary.needs_pickup}
              icon={<AlertCircle className="w-5 h-5" />}
              isWarning
            />
          </div>

          {coverage_summary.needs_pickup && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 font-medium">Pickup Required</p>
              <p className="text-sm text-muted-gray mt-1">
                This scene has been marked as needing additional coverage or reshoots.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coverage by Shot */}
      {shots.length > 0 && (
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardHeader>
            <CardTitle className="text-bone-white">Coverage by Shot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {shots.map((shot) => (
                <div
                  key={shot.id}
                  className={`p-3 rounded-lg border ${
                    shot.is_covered
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-muted-gray/10 border-muted-gray/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-bone-white">
                      {shot.shot_number}
                    </span>
                    {shot.is_covered ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-muted-gray" />
                    )}
                  </div>
                  {shot.frame_size && (
                    <p className="text-xs text-muted-gray mt-1">{shot.frame_size}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusIndicator({
  label,
  isActive,
  icon,
  isWarning = false,
}: {
  label: string;
  isActive: boolean;
  icon: React.ReactNode;
  isWarning?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
        isActive
          ? isWarning
            ? 'bg-red-500/20 text-red-400'
            : 'bg-green-500/20 text-green-400'
          : 'bg-muted-gray/10 text-muted-gray'
      }`}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}
