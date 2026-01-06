/**
 * Labels View
 * Generate and print barcode/QR labels
 */
import React, { useState } from 'react';
import {
  QrCode,
  Printer,
  Download,
  Search,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useGearAssets, useGearLabels } from '@/hooks/gear';
import type { GearAsset } from '@/types/gear';
import { cn } from '@/lib/utils';

interface LabelsViewProps {
  orgId: string;
}

export function LabelsView({ orgId }: LabelsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [labelType, setLabelType] = useState<'barcode' | 'qr' | 'both'>('both');
  const [includeName, setIncludeName] = useState(true);
  const [includeCategory, setIncludeCategory] = useState(true);

  const { assets, isLoading } = useGearAssets({
    orgId,
    search: searchTerm || undefined,
    limit: 100,
  });

  const { generateBatch, generateCodes } = useGearLabels(orgId);

  const toggleAsset = (assetId: string) => {
    const newSelected = new Set(selectedAssets);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedAssets(newSelected);
  };

  const toggleAll = () => {
    if (selectedAssets.size === assets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(assets.map((a) => a.id)));
    }
  };

  const handleGenerateLabels = async () => {
    if (selectedAssets.size === 0) return;

    const result = await generateBatch.mutateAsync({
      asset_ids: Array.from(selectedAssets),
      label_type: labelType,
      include_name: includeName,
      include_category: includeCategory,
    });

    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(result);
      printWindow.document.close();
      printWindow.focus();
    }
  };

  const handleGenerateCodes = async () => {
    if (selectedAssets.size === 0) return;
    await generateCodes.mutateAsync(Array.from(selectedAssets));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-bone-white">Label Generator</h2>
          <p className="text-muted-gray">Generate barcode and QR code labels for your assets</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleGenerateCodes}
            disabled={selectedAssets.size === 0 || generateCodes.isPending}
          >
            {generateCodes.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Generate Codes
          </Button>
          <Button
            onClick={handleGenerateLabels}
            disabled={selectedAssets.size === 0 || generateBatch.isPending}
          >
            {generateBatch.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Printer className="w-4 h-4 mr-2" />
            Print Labels ({selectedAssets.size})
          </Button>
        </div>
      </div>

      {/* Options */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base">Label Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            <div className="space-y-2">
              <Label>Label Type</Label>
              <Select value={labelType} onValueChange={(v) => setLabelType(v as 'barcode' | 'qr' | 'both')}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="barcode">Barcode Only</SelectItem>
                  <SelectItem value="qr">QR Code Only</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeName"
                checked={includeName}
                onCheckedChange={(checked) => setIncludeName(!!checked)}
              />
              <Label htmlFor="includeName" className="cursor-pointer">
                Include Name
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeCategory"
                checked={includeCategory}
                onCheckedChange={(checked) => setIncludeCategory(!!checked)}
              />
              <Label htmlFor="includeCategory" className="cursor-pointer">
                Include Category
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
        <Input
          placeholder="Search assets..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Assets Table */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <Table>
          <TableHeader>
            <TableRow className="border-muted-gray/30 hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedAssets.size === assets.length && assets.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Internal ID</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>QR Code</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((asset) => (
              <TableRow
                key={asset.id}
                className={cn(
                  'border-muted-gray/30 cursor-pointer',
                  selectedAssets.has(asset.id)
                    ? 'bg-accent-yellow/10 hover:bg-accent-yellow/20'
                    : 'hover:bg-charcoal-black/30'
                )}
                onClick={() => toggleAsset(asset.id)}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedAssets.has(asset.id)}
                    onCheckedChange={() => toggleAsset(asset.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableCell>
                <TableCell>
                  <span className="font-medium text-bone-white">{asset.name}</span>
                </TableCell>
                <TableCell>
                  <code className="text-sm bg-muted-gray/20 px-2 py-1 rounded">
                    {asset.internal_id}
                  </code>
                </TableCell>
                <TableCell>
                  <span className="text-muted-gray">{asset.category_name || '—'}</span>
                </TableCell>
                <TableCell>
                  {asset.barcode ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">
                      {asset.barcode}
                    </Badge>
                  ) : (
                    <span className="text-muted-gray">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {asset.qr_code ? (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 border">
                      <QrCode className="w-3 h-3 mr-1" />
                      Set
                    </Badge>
                  ) : (
                    <span className="text-muted-gray">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Preview section */}
      {selectedAssets.size > 0 && (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-white p-4 rounded-lg inline-block">
              <div className="text-black text-center">
                <p className="font-bold text-sm">Sample Label</p>
                <div className="flex items-center justify-center gap-2 my-2">
                  {(labelType === 'barcode' || labelType === 'both') && (
                    <div className="border p-2">
                      <div className="h-8 w-32 bg-gray-200 flex items-center justify-center">
                        <span className="text-xs text-gray-500">Barcode</span>
                      </div>
                    </div>
                  )}
                  {(labelType === 'qr' || labelType === 'both') && (
                    <div className="border p-2">
                      <div className="h-12 w-12 bg-gray-200 flex items-center justify-center">
                        <QrCode className="w-8 h-8 text-gray-500" />
                      </div>
                    </div>
                  )}
                </div>
                {includeName && <p className="text-sm font-medium">Asset Name</p>}
                <p className="text-xs font-mono">GH-XXXXX</p>
                {includeCategory && <p className="text-xs text-gray-500">Category</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
