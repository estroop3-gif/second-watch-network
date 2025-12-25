/**
 * SceneInfoTab - Basic scene metadata and breakdown
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SceneHubData, BREAKDOWN_TYPES, getBreakdownTypeInfo, useSceneMutations } from '@/hooks/backlot';
import { FileText, Clock, MapPin, Users, Package, Pencil, Check, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface SceneInfoTabProps {
  hub: SceneHubData;
  canEdit: boolean;
  projectId: string;
}

export default function SceneInfoTab({ hub, canEdit, projectId }: SceneInfoTabProps) {
  const { scene, breakdown_items, breakdown_by_type, tasks } = hub;
  const [isEditingPageLength, setIsEditingPageLength] = useState(false);
  const [pageLengthInput, setPageLengthInput] = useState(scene.page_length?.toString() || '');
  const { updateScene } = useSceneMutations();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSavePageLength = async () => {
    const parsed = parseFloat(pageLengthInput);
    const pageLength = isNaN(parsed) ? null : parsed;

    try {
      await updateScene.mutateAsync({
        id: scene.id,
        page_length: pageLength,
      });
      // Invalidate hub data to refresh
      queryClient.invalidateQueries({ queryKey: ['backlot', 'scenes', projectId, scene.id, 'hub'] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'scenes-list'] });
      setIsEditingPageLength(false);
      toast({ title: 'Page length updated' });
    } catch (err) {
      toast({ title: 'Failed to update page length', variant: 'destructive' });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Scene Details */}
      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardHeader>
          <CardTitle className="text-bone-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Scene Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Scene Number" value={scene.scene_number} />
            <InfoRow label="Int/Ext" value={scene.int_ext?.toUpperCase() || '--'} />
            <InfoRow label="Time of Day" value={scene.day_night?.toUpperCase() || '--'} />
            <div>
              <p className="text-xs text-muted-gray">Page Length</p>
              {isEditingPageLength && canEdit ? (
                <div className="flex items-center gap-1 mt-1">
                  <Input
                    type="number"
                    step="0.125"
                    min="0"
                    value={pageLengthInput}
                    onChange={(e) => setPageLengthInput(e.target.value)}
                    className="w-20 h-7 text-sm bg-deep-black border-muted-gray/30"
                    placeholder="e.g. 2.5"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-green-400 hover:text-green-300"
                    onClick={handleSavePageLength}
                    disabled={updateScene.isPending}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                    onClick={() => {
                      setIsEditingPageLength(false);
                      setPageLengthInput(scene.page_length?.toString() || '');
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-bone-white">
                    {scene.page_length ? `${scene.page_length} pages` : '--'}
                  </p>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-gray hover:text-bone-white"
                      onClick={() => setIsEditingPageLength(true)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            <InfoRow
              label="Pages"
              value={scene.page_start && scene.page_end
                ? `${scene.page_start}-${scene.page_end}`
                : scene.page_start
                  ? String(scene.page_start)
                  : '--'
              }
            />
            <InfoRow label="Set/Location Hint" value={scene.location_hint || '--'} />
          </div>

          {scene.slugline && (
            <div className="pt-4 border-t border-muted-gray/20">
              <p className="text-xs text-muted-gray mb-1">Slugline</p>
              <p className="text-bone-white font-medium">{scene.slugline}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Status */}
      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardHeader>
          <CardTitle className="text-bone-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            Schedule Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label="Scheduled"
              isActive={scene.is_scheduled}
              activeColor="blue"
            />
            <StatusBadge
              label="Shot"
              isActive={scene.is_shot}
              activeColor="green"
            />
            <StatusBadge
              label="Needs Pickup"
              isActive={scene.needs_pickup}
              activeColor="red"
            />
          </div>

          {hub.call_sheet_links.length > 0 && (
            <div className="pt-4 border-t border-muted-gray/20">
              <p className="text-xs text-muted-gray mb-2">Scheduled On</p>
              <div className="space-y-2">
                {hub.call_sheet_links.slice(0, 3).map((link) => (
                  <div key={link.id} className="flex items-center justify-between text-sm">
                    <span className="text-bone-white">{link.call_sheet_title}</span>
                    <span className="text-muted-gray">{link.call_sheet_date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tasks.length > 0 && (
            <div className="pt-4 border-t border-muted-gray/20">
              <p className="text-xs text-muted-gray mb-2">Related Tasks ({tasks.length})</p>
              <div className="space-y-2">
                {tasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="flex items-center justify-between text-sm">
                    <span className="text-bone-white truncate max-w-[200px]">{task.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {task.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breakdown */}
      <Card className="bg-charcoal-black border-muted-gray/20 lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-bone-white flex items-center gap-2">
            <Package className="w-5 h-5 text-green-400" />
            Breakdown ({breakdown_items.length} items)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {breakdown_items.length === 0 ? (
            <p className="text-muted-gray text-center py-8">
              No breakdown items for this scene
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(breakdown_by_type).map(([type, items]) => {
                const typeInfo = getBreakdownTypeInfo(type);
                return (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${typeInfo.color}`} />
                      <span className="text-sm font-medium text-bone-white">
                        {typeInfo.label} ({items.length})
                      </span>
                    </div>
                    <div className="pl-5 space-y-1">
                      {items.slice(0, 5).map((item) => (
                        <p key={item.id} className="text-sm text-muted-gray">
                          {item.name}
                          {item.quantity && item.quantity > 1 && (
                            <span className="text-xs ml-1">x{item.quantity}</span>
                          )}
                        </p>
                      ))}
                      {items.length > 5 && (
                        <p className="text-xs text-muted-gray/60">
                          +{items.length - 5} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-gray">{label}</p>
      <p className="text-bone-white">{value}</p>
    </div>
  );
}

function StatusBadge({
  label,
  isActive,
  activeColor,
}: {
  label: string;
  isActive: boolean;
  activeColor: 'blue' | 'green' | 'red';
}) {
  const colors = {
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <Badge
      className={
        isActive
          ? colors[activeColor]
          : 'bg-muted-gray/10 text-muted-gray border-muted-gray/30'
      }
    >
      {label}
    </Badge>
  );
}
