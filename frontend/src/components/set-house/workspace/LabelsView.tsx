/**
 * Labels View
 * Manage label templates and print queue for Set House
 */
import React, { useState } from 'react';
import {
  QrCode,
  Plus,
  Search,
  Printer,
  Trash2,
  Home,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { cn } from '@/lib/utils';

interface LabelsViewProps {
  orgId: string;
}

export function LabelsView({ orgId }: LabelsViewProps) {
  const [activeTab, setActiveTab] = useState<'queue' | 'templates'>('queue');
  const [searchTerm, setSearchTerm] = useState('');

  // Placeholder data - would come from hooks
  const printQueue: Array<{ id: string; space_name: string; added_at: string }> = [];
  const templates: Array<{ id: string; name: string; description?: string }> = [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {activeTab === 'queue' && printQueue.length > 0 && (
          <Button>
            <Printer className="w-4 h-4 mr-2" />
            Print All
          </Button>
        )}
        {activeTab === 'templates' && (
          <Button variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'queue' | 'templates')}>
        <TabsList className="bg-charcoal-black/50 border border-muted-gray/30">
          <TabsTrigger value="queue">
            <Printer className="w-4 h-4 mr-2" />
            Print Queue ({printQueue.length})
          </TabsTrigger>
          <TabsTrigger value="templates">
            <QrCode className="w-4 h-4 mr-2" />
            Templates ({templates.length})
          </TabsTrigger>
        </TabsList>

        {/* Print Queue Tab */}
        <TabsContent value="queue" className="mt-6">
          {printQueue.length === 0 ? (
            <EmptyState
              icon={<Printer className="w-12 h-12" />}
              title="Print Queue Empty"
              description="Add spaces to the print queue to generate labels"
            />
          ) : (
            <Card className="bg-charcoal-black/50 border-muted-gray/30">
              <Table>
                <TableHeader>
                  <TableRow className="border-muted-gray/30 hover:bg-transparent">
                    <TableHead>Space</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {printQueue.map((item) => (
                    <TableRow key={item.id} className="border-muted-gray/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Home className="w-4 h-4 text-muted-gray" />
                          <span className="text-bone-white">{item.space_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-gray">{item.added_at}</span>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-6">
          {templates.length === 0 ? (
            <EmptyState
              icon={<QrCode className="w-12 h-12" />}
              title="No Label Templates"
              description="Create templates for generating space labels and QR codes"
              action={
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="bg-charcoal-black/50 border-muted-gray/30">
                  <CardHeader>
                    <CardTitle className="text-base text-bone-white">{template.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-gray">
                      {template.description || 'No description'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="text-muted-gray mb-4">{icon}</div>
        <h3 className="text-lg font-medium text-bone-white mb-2">{title}</h3>
        <p className="text-muted-gray text-center max-w-md mb-4">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}
