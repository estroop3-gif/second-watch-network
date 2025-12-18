/**
 * SceneLocationsTab - Location attachments for the scene
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SceneHubData } from '@/hooks/backlot';
import { MapPin, Plus, Phone, Mail, Car, Zap, Building } from 'lucide-react';

interface SceneLocationsTabProps {
  hub: SceneHubData;
  canEdit: boolean;
  projectId: string;
  sceneId: string;
}

export default function SceneLocationsTab({
  hub,
  canEdit,
  projectId,
  sceneId,
}: SceneLocationsTabProps) {
  const { locations, scene } = hub;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-bone-white">Scene Location</h3>
          <p className="text-sm text-muted-gray">
            Attach a filming location to this scene
          </p>
        </div>
        {canEdit && (
          <Button className="bg-accent-yellow text-deep-black hover:bg-accent-yellow/90">
            <Plus className="w-4 h-4 mr-2" />
            Attach Location
          </Button>
        )}
      </div>

      {/* Location Hint */}
      {scene.location_hint && (
        <Card className="bg-muted-gray/5 border-muted-gray/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-gray">
              <Building className="w-4 h-4" />
              <span className="text-sm">Location from script:</span>
              <span className="text-bone-white font-medium">{scene.location_hint}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attached Locations */}
      {locations.length === 0 ? (
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-gray opacity-50" />
            <p className="text-muted-gray">No location attached to this scene</p>
            {canEdit && (
              <Button variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Attach from Project Locations
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {locations.map((location) => (
            <Card
              key={location.id}
              className={`bg-charcoal-black ${
                location.is_primary
                  ? 'border-cyan-500/30'
                  : 'border-muted-gray/20'
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-bone-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-cyan-400" />
                    {location.name}
                  </CardTitle>
                  {location.is_primary && (
                    <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                      Primary
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {location.address && (
                  <div className="text-sm text-muted-gray">{location.address}</div>
                )}
                {location.type && (
                  <Badge variant="outline" className="text-xs">
                    {location.type}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info about inherited items */}
      {locations.length > 0 && (
        <Card className="bg-cyan-500/5 border-cyan-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-cyan-400">
              Budget items, receipts, and clearances linked to this location will also
              appear in this scene's hub.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
