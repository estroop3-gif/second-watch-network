/**
 * SceneCallSheetsTab - Call sheets that include this scene
 */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SceneHubData } from '@/hooks/backlot';
import { Calendar, CheckCircle2, Clock, FileText } from 'lucide-react';

interface SceneCallSheetsTabProps {
  hub: SceneHubData;
  canEdit: boolean;
  projectId: string;
}

export default function SceneCallSheetsTab({ hub, canEdit, projectId }: SceneCallSheetsTabProps) {
  const { call_sheet_links } = hub;

  return (
    <div className="space-y-4">
      {call_sheet_links.length === 0 ? (
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-gray opacity-50" />
            <p className="text-muted-gray">This scene is not on any call sheets yet</p>
            <p className="text-sm text-muted-gray/60 mt-1">
              Add this scene to a call sheet from the Schedule tab
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {call_sheet_links.map((link) => (
            <Card
              key={link.id}
              className="bg-charcoal-black border-muted-gray/20 hover:border-muted-gray/40 cursor-pointer transition-colors"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                      <FileText className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="font-medium text-bone-white">
                        {link.call_sheet_title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="w-4 h-4 text-muted-gray" />
                        <span className="text-sm text-muted-gray">
                          {link.call_sheet_date}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={link.status} />
                    {link.is_published ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Published
                      </Badge>
                    ) : (
                      <Badge className="bg-muted-gray/20 text-muted-gray border-muted-gray/30">
                        <Clock className="w-3 h-3 mr-1" />
                        Draft
                      </Badge>
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

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    scheduled: {
      label: 'Scheduled',
      className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    },
    in_progress: {
      label: 'In Progress',
      className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    },
    completed: {
      label: 'Completed',
      className: 'bg-green-500/20 text-green-400 border-green-500/30',
    },
    moved: {
      label: 'Moved',
      className: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    },
    cut: {
      label: 'Cut',
      className: 'bg-red-500/20 text-red-400 border-red-500/30',
    },
  };

  const config = configs[status] || configs.scheduled;

  return <Badge className={config.className}>{config.label}</Badge>;
}
