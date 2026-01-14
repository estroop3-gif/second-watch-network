/**
 * SceneClearancesTab - Clearances and contracts for the scene
 * Includes: releases, permits, contracts, and PDF uploads
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SceneHubData, getClearanceTypeLabel, getClearanceStatusColor } from '@/hooks/backlot';
import {
  FileCheck,
  Plus,
  MapPin,
  Building,
  Calendar,
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Upload,
  Paperclip,
  User,
} from 'lucide-react';
import { parseLocalDate } from '@/lib/dateUtils';

interface SceneClearancesTabProps {
  hub: SceneHubData;
  canEdit: boolean;
  projectId: string;
  sceneId: string;
}

type FilterType = 'all' | 'clearances' | 'contracts';

export default function SceneClearancesTab({
  hub,
  canEdit,
  projectId,
  sceneId,
}: SceneClearancesTabProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const { clearances, clearances_from_location, clearance_summary } = hub;

  // Combine all clearances for filtering
  const allDirect = clearances;
  const allInherited = clearances_from_location;

  // Filter based on type
  const filterItems = (items: typeof clearances) => {
    if (filter === 'all') return items;
    if (filter === 'contracts') {
      return items.filter((c) => c.type === 'contract' || c.type === 'talent_release');
    }
    // clearances = everything except contracts
    return items.filter((c) => c.type !== 'contract' && c.type !== 'talent_release');
  };

  const directFiltered = filterItems(allDirect);
  const inheritedFiltered = filterItems(allInherited);
  const hasItems = directFiltered.length > 0 || inheritedFiltered.length > 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total"
          value={clearance_summary.total}
          icon={<FileCheck className="w-5 h-5 text-blue-400" />}
        />
        <SummaryCard
          label="Approved"
          value={clearance_summary.approved}
          icon={<CheckCircle2 className="w-5 h-5 text-green-400" />}
        />
        <SummaryCard
          label="Pending"
          value={clearance_summary.pending}
          icon={<Clock className="w-5 h-5 text-yellow-400" />}
        />
        <SummaryCard
          label="Issues"
          value={clearance_summary.issues}
          icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
          isWarning={clearance_summary.issues > 0}
        />
      </div>

      {/* Filter Tabs & Actions */}
      <div className="flex items-center justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
          <TabsList className="bg-muted-gray/10">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="clearances">Clearances</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
          </TabsList>
        </Tabs>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Upload PDF
            </Button>
            <Button className="bg-accent-yellow text-deep-black hover:bg-accent-yellow/90" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Clearance
            </Button>
          </div>
        )}
      </div>

      {/* Direct Clearances */}
      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-bone-white flex items-center gap-2">
              <Building className="w-5 h-5 text-purple-400" />
              Scene {filter === 'contracts' ? 'Contracts' : filter === 'clearances' ? 'Clearances' : 'Clearances & Contracts'} ({directFiltered.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {directFiltered.length === 0 ? (
            <p className="text-center text-muted-gray py-6">
              No {filter === 'all' ? 'items' : filter} directly linked to this scene
            </p>
          ) : (
            <div className="space-y-3">
              {directFiltered.map((item) => (
                <ClearanceRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inherited from Location */}
      {inheritedFiltered.length > 0 && (
        <Card className="bg-charcoal-black border-cyan-500/30">
          <CardHeader>
            <CardTitle className="text-bone-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              Inherited from Location ({inheritedFiltered.length})
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 ml-2">
                Read-only
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inheritedFiltered.map((item) => (
                <ClearanceRow key={item.id} item={item} isInherited />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!hasItems && (
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="py-12 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-muted-gray opacity-50" />
            <p className="text-muted-gray">
              No {filter === 'all' ? 'clearances or contracts' : filter} for this scene
            </p>
            <p className="text-sm text-muted-gray/60 mt-1">
              Add clearances, releases, or upload contract PDFs
            </p>
            {canEdit && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload PDF
                </Button>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Clearance
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Note */}
      {hub.locations.length > 0 && (
        <Card className="bg-cyan-500/5 border-cyan-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-cyan-400">
              Clearances linked to this scene's location are shown as inherited and read-only.
              To edit them, go to the location's clearances section.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  isWarning = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  isWarning?: boolean;
}) {
  return (
    <Card className={`bg-charcoal-black ${isWarning && value > 0 ? 'border-red-500/30' : 'border-muted-gray/20'}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isWarning && value > 0 ? 'bg-red-500/10' : 'bg-muted-gray/10'}`}>
            {icon}
          </div>
          <div>
            <p className={`text-2xl font-bold ${isWarning && value > 0 ? 'text-red-400' : 'text-bone-white'}`}>
              {value}
            </p>
            <p className="text-xs text-muted-gray">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClearanceRow({
  item,
  isInherited = false,
}: {
  item: {
    id: string;
    type: string;
    title: string;
    status: string;
    party_name: string | null;
    expiration_date: string | null;
    has_document: boolean;
  };
  isInherited?: boolean;
}) {
  const typeLabel = getClearanceTypeLabel(item.type);
  const statusColor = getClearanceStatusColor(item.status);
  const isExpiringSoon = item.expiration_date &&
    parseLocalDate(item.expiration_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const getTypeIcon = () => {
    switch (item.type) {
      case 'contract':
      case 'talent_release':
        return <User className="w-4 h-4" />;
      case 'location_permit':
        return <MapPin className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div
      className={`p-3 rounded-lg border ${
        isInherited
          ? 'bg-cyan-500/5 border-cyan-500/20'
          : 'bg-muted-gray/5 border-muted-gray/20'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            item.type === 'contract' || item.type === 'talent_release'
              ? 'bg-purple-500/10 text-purple-400'
              : 'bg-blue-500/10 text-blue-400'
          }`}>
            {getTypeIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-bone-white">{item.title}</p>
              {item.has_document && (
                <Paperclip className="w-4 h-4 text-muted-gray" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {typeLabel}
              </Badge>
              {item.party_name && (
                <span className="text-sm text-muted-gray">{item.party_name}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {item.expiration_date && (
            <div className={`flex items-center gap-1 text-xs ${
              isExpiringSoon ? 'text-orange-400' : 'text-muted-gray'
            }`}>
              <Calendar className="w-3 h-3" />
              {parseLocalDate(item.expiration_date).toLocaleDateString()}
              {isExpiringSoon && (
                <AlertTriangle className="w-3 h-3 text-orange-400" />
              )}
            </div>
          )}
          <Badge className={statusColor}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1).replace('_', ' ')}
          </Badge>
        </div>
      </div>
    </div>
  );
}
