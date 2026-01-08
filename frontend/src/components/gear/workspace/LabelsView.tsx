/**
 * Labels View - Enhanced Label Management Hub
 * Features: Assets/Kits tabs, print queue, templates, history with analytics
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  QrCode,
  Printer,
  Download,
  Search,
  Loader2,
  Package,
  History,
  ListPlus,
  Trash2,
  Settings2,
  Filter,
  ChevronDown,
  ChevronRight,
  Copy,
  RefreshCw,
  BarChart3,
  Plus,
  Minus,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

import {
  useGearAssets,
  useGearLabels,
  useGearCategories,
  useGearKitInstances,
  useGearLabelTemplates,
  useGearPrintQueue,
  useGearPrintHistory,
  useGearPrintHistoryStats,
  useGearReprint,
} from '@/hooks/gear';
import type {
  GearAsset,
  GearKitInstance,
  GearCategory,
  GearLabelTemplate,
  GearPrintQueueItem,
  GearPrintHistoryEntry,
  LabelSize,
  CodeType,
  PrintMode,
  PrinterType,
} from '@/types/gear';
import { cn } from '@/lib/utils';
import { downloadFile } from '@/lib/utils';

interface LabelsViewProps {
  orgId: string;
}

export function LabelsView({ orgId }: LabelsViewProps) {
  const [activeTab, setActiveTab] = useState('assets');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [selectedKits, setSelectedKits] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [barcodeFilter, setBarcodeFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [queueOpen, setQueueOpen] = useState(false);

  // Label customization settings (populated from template, can be overridden)
  const [labelSize, setLabelSize] = useState<LabelSize>('2x1');
  const [codeType, setCodeType] = useState<CodeType>('both');
  const [printMode, setPrintMode] = useState<PrintMode>('sheet');
  const [printerType, setPrinterType] = useState<PrinterType>('generic');
  const [sheetRows, setSheetRows] = useState(10);
  const [sheetColumns, setSheetColumns] = useState(3);
  const [customWidthMm, setCustomWidthMm] = useState<number | undefined>();
  const [customHeightMm, setCustomHeightMm] = useState<number | undefined>();

  // Content field toggles
  const [includeName, setIncludeName] = useState(true);
  const [includeCategory, setIncludeCategory] = useState(true);
  const [includeInternalId, setIncludeInternalId] = useState(true);
  const [includeSerialNumber, setIncludeSerialNumber] = useState(false);
  const [includeManufacturer, setIncludeManufacturer] = useState(false);
  const [includeModel, setIncludeModel] = useState(false);
  const [includePurchaseDate, setIncludePurchaseDate] = useState(false);
  const [includeLogo, setIncludeLogo] = useState(false);
  const [colorCodingEnabled, setColorCodingEnabled] = useState(false);

  // Panel state
  const [settingsExpanded, setSettingsExpanded] = useState(true);

  // Data hooks
  const { assets, isLoading: assetsLoading } = useGearAssets({
    orgId,
    search: searchTerm || undefined,
    limit: 200,
  });

  const { instances: kits, isLoading: kitsLoading } = useGearKitInstances(orgId);
  const { categories } = useGearCategories(orgId);
  const { templates } = useGearLabelTemplates(orgId);
  const { generateBatch, generateCodes } = useGearLabels(orgId);

  const {
    queue,
    count: queueCount,
    addToQueue,
    updateQueueItem,
    removeFromQueue,
    clearQueue,
    printQueue,
  } = useGearPrintQueue(orgId);

  const { history, total: historyTotal, isLoading: historyLoading } = useGearPrintHistory({ orgId });
  const { data: stats, isLoading: statsLoading } = useGearPrintHistoryStats(orgId);
  const reprint = useGearReprint(orgId);

  // Group assets by category
  const assetsByCategory = useMemo(() => {
    const groups: Record<string, GearAsset[]> = {};
    const filteredAssets = assets.filter((asset) => {
      // Category filter
      if (selectedCategories.size > 0 && asset.category_id && !selectedCategories.has(asset.category_id)) {
        return false;
      }
      // Barcode filter
      if (barcodeFilter === 'yes' && !asset.barcode) return false;
      if (barcodeFilter === 'no' && asset.barcode) return false;
      return true;
    });

    filteredAssets.forEach((asset) => {
      const categoryName = asset.category_name || 'Uncategorized';
      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }
      groups[categoryName].push(asset);
    });

    return groups;
  }, [assets, selectedCategories, barcodeFilter]);

  // Filtered kits
  const filteredKits = useMemo(() => {
    return kits.filter((kit) => {
      if (!searchTerm) return true;
      return (
        kit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kit.internal_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [kits, searchTerm]);

  // Template selection
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Populate controls from selected template
  useEffect(() => {
    if (selectedTemplateId && selectedTemplateId !== '_default') {
      const template = templates.find((t) => t.id === selectedTemplateId);
      if (template) {
        setLabelSize(template.label_size || '2x1');
        setCodeType(template.code_type || 'both');
        setPrintMode(template.print_mode || 'sheet');
        setPrinterType(template.printer_type || 'generic');
        setSheetRows(template.sheet_rows || 10);
        setSheetColumns(template.sheet_columns || 3);
        setIncludeName(template.include_name ?? true);
        setIncludeCategory(template.include_category ?? true);
        setIncludeInternalId(template.include_internal_id ?? true);
        setIncludeSerialNumber(template.include_serial_number ?? false);
        setIncludeManufacturer(template.include_manufacturer ?? false);
        setIncludeModel(template.include_model ?? false);
        setIncludePurchaseDate(template.include_purchase_date ?? false);
        setIncludeLogo(template.include_logo ?? false);
        setColorCodingEnabled(template.color_coding_enabled ?? false);
        if (template.label_size === 'custom') {
          setCustomWidthMm(template.custom_width_mm);
          setCustomHeightMm(template.custom_height_mm);
        }
      }
    } else {
      // Reset to defaults when no template selected
      setLabelSize('2x1');
      setCodeType('both');
      setPrintMode('sheet');
      setPrinterType('generic');
      setSheetRows(10);
      setSheetColumns(3);
      setIncludeName(true);
      setIncludeCategory(true);
      setIncludeInternalId(true);
      setIncludeSerialNumber(false);
      setIncludeManufacturer(false);
      setIncludeModel(false);
      setIncludePurchaseDate(false);
      setIncludeLogo(false);
      setColorCodingEnabled(false);
      setCustomWidthMm(undefined);
      setCustomHeightMm(undefined);
    }
  }, [selectedTemplateId, templates]);

  // Toggle functions
  const toggleAsset = (assetId: string) => {
    const newSelected = new Set(selectedAssets);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedAssets(newSelected);
  };

  const toggleKit = (kitId: string) => {
    const newSelected = new Set(selectedKits);
    if (newSelected.has(kitId)) {
      newSelected.delete(kitId);
    } else {
      newSelected.add(kitId);
    }
    setSelectedKits(newSelected);
  };

  const toggleCategory = (categoryId: string) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId);
    } else {
      newSelected.add(categoryId);
    }
    setSelectedCategories(newSelected);
  };

  const toggleCategoryExpand = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  const selectAllInCategory = (categoryAssets: GearAsset[]) => {
    const newSelected = new Set(selectedAssets);
    categoryAssets.forEach((a) => newSelected.add(a.id));
    setSelectedAssets(newSelected);
  };

  // Add to queue
  const handleAddToQueue = async () => {
    const assetIds = Array.from(selectedAssets);
    const kitIds = Array.from(selectedKits);

    if (assetIds.length === 0 && kitIds.length === 0) {
      toast.error('Select items to add to queue');
      return;
    }

    await addToQueue.mutateAsync({
      asset_ids: assetIds.length > 0 ? assetIds : undefined,
      kit_ids: kitIds.length > 0 ? kitIds : undefined,
      quantity: 1,
      template_id: selectedTemplateId,
    });

    setSelectedAssets(new Set());
    setSelectedKits(new Set());
    toast.success(`Added ${assetIds.length + kitIds.length} items to print queue`);
  };

  // Print queue
  const handlePrintQueue = async (format: 'html' | 'zpl') => {
    try {
      const result = await printQueue.mutateAsync({
        templateId: selectedTemplateId,
        outputFormat: format,
        autoGenerateCodes: true,
        labelSettings: {
          label_type: codeType,
          label_size: labelSize,
          print_mode: printMode,
          printer_type: printerType,
          sheet_rows: printMode === 'sheet' ? sheetRows : undefined,
          sheet_columns: printMode === 'sheet' ? sheetColumns : undefined,
          custom_width_mm: labelSize === 'custom' ? customWidthMm : undefined,
          custom_height_mm: labelSize === 'custom' ? customHeightMm : undefined,
          include_name: includeName,
          include_category: includeCategory,
          include_internal_id: includeInternalId,
          include_serial_number: includeSerialNumber,
          include_manufacturer: includeManufacturer,
          include_model: includeModel,
          include_purchase_date: includePurchaseDate,
          include_logo: includeLogo,
          color_coding_enabled: colorCodingEnabled,
        },
      });

      if (format === 'zpl') {
        downloadFile(result, `labels-${Date.now()}.zpl`, 'text/plain');
        toast.success('ZPL file downloaded');
      } else {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(result);
          printWindow.document.close();
          printWindow.focus();
        }
      }
    } catch (error) {
      toast.error('Failed to print queue');
    }
  };

  // Reprint from history
  const handleReprint = async (entry: GearPrintHistoryEntry, format: 'html' | 'zpl') => {
    try {
      const result = await reprint.mutateAsync({
        historyId: entry.id,
        outputFormat: format,
      });

      if (format === 'zpl') {
        downloadFile(result, `reprint-${entry.item_internal_id || entry.id}.zpl`, 'text/plain');
        toast.success('ZPL file downloaded');
      } else {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(result);
          printWindow.document.close();
          printWindow.focus();
        }
      }
    } catch (error) {
      toast.error('Failed to reprint');
    }
  };

  // Quick print selected
  const handleQuickPrint = async (format: 'html' | 'zpl') => {
    const assetIds = Array.from(selectedAssets);
    const kitIds = Array.from(selectedKits);
    if (assetIds.length === 0 && kitIds.length === 0) {
      toast.error('Select items to print');
      return;
    }

    try {
      const result = await generateBatch.mutateAsync({
        asset_ids: assetIds,
        kit_ids: kitIds.length > 0 ? kitIds : undefined,
        label_type: codeType,
        label_size: labelSize,
        print_mode: printMode,
        printer_type: printerType,
        sheet_rows: printMode === 'sheet' ? sheetRows : undefined,
        sheet_columns: printMode === 'sheet' ? sheetColumns : undefined,
        custom_width_mm: labelSize === 'custom' ? customWidthMm : undefined,
        custom_height_mm: labelSize === 'custom' ? customHeightMm : undefined,
        include_name: includeName,
        include_category: includeCategory,
        include_internal_id: includeInternalId,
        include_serial_number: includeSerialNumber,
        include_manufacturer: includeManufacturer,
        include_model: includeModel,
        include_purchase_date: includePurchaseDate,
        include_logo: includeLogo,
        color_coding_enabled: colorCodingEnabled,
      });

      if (format === 'zpl') {
        downloadFile(result, `labels-${Date.now()}.zpl`, 'text/plain');
        toast.success('ZPL file downloaded');
      } else {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(result);
          printWindow.document.close();
          printWindow.focus();
        }
      }
      setSelectedAssets(new Set());
      setSelectedKits(new Set());
    } catch (error) {
      toast.error('Failed to generate labels');
    }
  };

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 space-y-4 pr-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-bone-white">Label Management</h2>
            <p className="text-muted-gray">Generate and print labels for assets and kits</p>
          </div>

          <div className="flex gap-2 items-center">
            {/* Template selector */}
            <Select value={selectedTemplateId || '_default'} onValueChange={(v) => setSelectedTemplateId(v === '_default' ? undefined : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Default settings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_default">Default settings</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} {t.user_id === null && <span className="text-muted-gray">(Shared)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Queue toggle */}
            <Sheet open={queueOpen} onOpenChange={setQueueOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative">
                  <ListPlus className="w-4 h-4 mr-2" />
                  Queue
                  {queueCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 bg-accent-yellow text-charcoal-black px-1.5 py-0.5 text-xs">
                      {queueCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-96 bg-charcoal-black border-muted-gray/30">
                <SheetHeader>
                  <SheetTitle className="flex items-center justify-between text-bone-white">
                    Print Queue ({queueCount})
                    {queueCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => clearQueue.mutate()}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-200px)] mt-4">
                  {queue.length === 0 ? (
                    <div className="text-center py-8 text-muted-gray">
                      <ListPlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Queue is empty</p>
                      <p className="text-sm">Select items and add to queue</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {queue.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-charcoal-black/50 rounded-lg border border-muted-gray/30"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {item.kit_id && <Package className="w-4 h-4 text-accent-yellow" />}
                              <span className="font-medium text-bone-white truncate">
                                {item.asset_name || item.kit_name}
                              </span>
                            </div>
                            <div className="text-xs text-muted-gray">
                              {item.asset_internal_id || item.kit_internal_id}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  updateQueueItem.mutate({
                                    itemId: item.id,
                                    quantity: Math.max(1, item.quantity - 1),
                                  })
                                }
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-6 text-center text-sm">{item.quantity}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  updateQueueItem.mutate({
                                    itemId: item.id,
                                    quantity: item.quantity + 1,
                                  })
                                }
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-red-400 hover:text-red-300"
                              onClick={() => removeFromQueue.mutate(item.id)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                {queueCount > 0 && (
                  <div className="mt-4 space-y-2">
                    <Button className="w-full" onClick={() => handlePrintQueue('html')}>
                      <Printer className="w-4 h-4 mr-2" />
                      Print Queue ({queue.reduce((sum, item) => sum + item.quantity, 0)} labels)
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => handlePrintQueue('zpl')}>
                      <Download className="w-4 h-4 mr-2" />
                      Download ZPL
                    </Button>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Label Settings Panel */}
        <Collapsible open={settingsExpanded} onOpenChange={setSettingsExpanded}>
          <Card className="bg-charcoal-black/50 border-muted-gray/30">
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer hover:bg-charcoal-black/30 transition-colors">
                <CardTitle className="text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    Label Settings
                  </div>
                  {settingsExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                {/* Print Settings Row 1 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-gray">Label Size</Label>
                    <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSize)}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2x1">2" × 1" (Standard)</SelectItem>
                        <SelectItem value="1.5x0.5">1.5" × 0.5" (Small)</SelectItem>
                        <SelectItem value="3x2">3" × 2" (Large)</SelectItem>
                        <SelectItem value="custom">Custom Size</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-gray">Code Type</Label>
                    <Select value={codeType} onValueChange={(v) => setCodeType(v as CodeType)}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">Barcode + QR</SelectItem>
                        <SelectItem value="barcode">Barcode Only</SelectItem>
                        <SelectItem value="qr">QR Code Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-gray">Print Mode</Label>
                    <Select value={printMode} onValueChange={(v) => setPrintMode(v as PrintMode)}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sheet">Sheet (Grid)</SelectItem>
                        <SelectItem value="roll">Roll (Continuous)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-gray">Printer Type</Label>
                    <Select value={printerType} onValueChange={(v) => setPrinterType(v as PrinterType)}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="generic">Generic (Browser)</SelectItem>
                        <SelectItem value="zebra">Zebra (ZPL)</SelectItem>
                        <SelectItem value="dymo">DYMO</SelectItem>
                        <SelectItem value="brother">Brother</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Conditional: Sheet Layout */}
                {printMode === 'sheet' && (
                  <div className="flex items-center gap-4">
                    <Label className="text-xs text-muted-gray">Sheet Layout:</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={sheetRows}
                        onChange={(e) => setSheetRows(parseInt(e.target.value) || 10)}
                        className="w-16 h-8"
                      />
                      <span className="text-muted-gray">rows</span>
                      <span className="text-muted-gray">×</span>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={sheetColumns}
                        onChange={(e) => setSheetColumns(parseInt(e.target.value) || 3)}
                        className="w-16 h-8"
                      />
                      <span className="text-muted-gray">columns</span>
                    </div>
                  </div>
                )}

                {/* Conditional: Custom Size */}
                {labelSize === 'custom' && (
                  <div className="flex items-center gap-4">
                    <Label className="text-xs text-muted-gray">Custom Size:</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={10}
                        max={200}
                        value={customWidthMm || ''}
                        onChange={(e) => setCustomWidthMm(parseInt(e.target.value) || undefined)}
                        placeholder="Width"
                        className="w-20 h-8"
                      />
                      <span className="text-muted-gray">mm</span>
                      <span className="text-muted-gray">×</span>
                      <Input
                        type="number"
                        min={10}
                        max={200}
                        value={customHeightMm || ''}
                        onChange={(e) => setCustomHeightMm(parseInt(e.target.value) || undefined)}
                        placeholder="Height"
                        className="w-20 h-8"
                      />
                      <span className="text-muted-gray">mm</span>
                    </div>
                  </div>
                )}

                {/* Content Fields */}
                <div className="border-t border-muted-gray/30 pt-4">
                  <Label className="text-xs text-muted-gray mb-3 block">Content Fields</Label>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="include-name"
                        checked={includeName}
                        onCheckedChange={(c) => setIncludeName(!!c)}
                      />
                      <Label htmlFor="include-name" className="text-sm cursor-pointer">Name</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="include-category"
                        checked={includeCategory}
                        onCheckedChange={(c) => setIncludeCategory(!!c)}
                      />
                      <Label htmlFor="include-category" className="text-sm cursor-pointer">Category</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="include-internal-id"
                        checked={includeInternalId}
                        onCheckedChange={(c) => setIncludeInternalId(!!c)}
                      />
                      <Label htmlFor="include-internal-id" className="text-sm cursor-pointer">Internal ID</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="include-serial"
                        checked={includeSerialNumber}
                        onCheckedChange={(c) => setIncludeSerialNumber(!!c)}
                      />
                      <Label htmlFor="include-serial" className="text-sm cursor-pointer">Serial #</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="include-manufacturer"
                        checked={includeManufacturer}
                        onCheckedChange={(c) => setIncludeManufacturer(!!c)}
                      />
                      <Label htmlFor="include-manufacturer" className="text-sm cursor-pointer">Manufacturer</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="include-model"
                        checked={includeModel}
                        onCheckedChange={(c) => setIncludeModel(!!c)}
                      />
                      <Label htmlFor="include-model" className="text-sm cursor-pointer">Model</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="include-purchase-date"
                        checked={includePurchaseDate}
                        onCheckedChange={(c) => setIncludePurchaseDate(!!c)}
                      />
                      <Label htmlFor="include-purchase-date" className="text-sm cursor-pointer">Purchase Date</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="include-logo"
                        checked={includeLogo}
                        onCheckedChange={(c) => setIncludeLogo(!!c)}
                      />
                      <Label htmlFor="include-logo" className="text-sm cursor-pointer">Logo</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="color-coding"
                        checked={colorCodingEnabled}
                        onCheckedChange={(c) => setColorCodingEnabled(!!c)}
                      />
                      <Label htmlFor="color-coding" className="text-sm cursor-pointer">Color Coding</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-charcoal-black/50 border border-muted-gray/30">
            <TabsTrigger value="assets" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
              Assets
            </TabsTrigger>
            <TabsTrigger value="kits" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
              <Package className="w-4 h-4 mr-1" />
              Kits
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
              <History className="w-4 h-4 mr-1" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Assets Tab */}
          <TabsContent value="assets" className="space-y-4">
            <div className="flex gap-4">
              {/* Filters sidebar */}
              <Card className="w-56 bg-charcoal-black/50 border-muted-gray/30 shrink-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filters
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Category filter */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-gray">Category</Label>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {categories.map((cat) => (
                        <div key={cat.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`cat-${cat.id}`}
                            checked={selectedCategories.has(cat.id)}
                            onCheckedChange={() => toggleCategory(cat.id)}
                          />
                          <Label htmlFor={`cat-${cat.id}`} className="text-sm cursor-pointer">
                            {cat.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {selectedCategories.size > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => setSelectedCategories(new Set())}
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>

                  {/* Barcode filter */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-gray">Has Barcode</Label>
                    <Select value={barcodeFilter} onValueChange={(v) => setBarcodeFilter(v as 'all' | 'yes' | 'no')}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Assets list */}
              <div className="flex-1 space-y-4">
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

                {/* Selection toolbar */}
                {selectedAssets.size > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-accent-yellow/10 rounded-lg border border-accent-yellow/30">
                    <span className="text-sm text-bone-white">
                      {selectedAssets.size} selected
                    </span>
                    <div className="flex-1" />
                    <Button size="sm" variant="outline" onClick={handleAddToQueue}>
                      <ListPlus className="w-4 h-4 mr-1" />
                      Add to Queue
                    </Button>
                    <Button size="sm" onClick={() => handleQuickPrint('html')}>
                      <Printer className="w-4 h-4 mr-1" />
                      Print Now
                    </Button>
                  </div>
                )}

                {/* Assets by category */}
                {assetsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(assetsByCategory).map(([categoryName, categoryAssets]) => (
                      <Collapsible
                        key={categoryName}
                        open={expandedCategories.has(categoryName)}
                        onOpenChange={() => toggleCategoryExpand(categoryName)}
                      >
                        <Card className="bg-charcoal-black/50 border-muted-gray/30">
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted-gray/10">
                              <div className="flex items-center gap-2">
                                {expandedCategories.has(categoryName) ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                                <span className="font-medium text-bone-white">{categoryName}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {categoryAssets.length}
                                </Badge>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectAllInCategory(categoryAssets);
                                }}
                              >
                                Select All
                              </Button>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <Table>
                              <TableHeader>
                                <TableRow className="border-muted-gray/30 hover:bg-transparent">
                                  <TableHead className="w-10" />
                                  <TableHead>Name</TableHead>
                                  <TableHead>Internal ID</TableHead>
                                  <TableHead>Barcode</TableHead>
                                  <TableHead>QR</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {categoryAssets.map((asset) => (
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
                                    <TableCell className="font-medium text-bone-white">
                                      {asset.name}
                                    </TableCell>
                                    <TableCell>
                                      <code className="text-xs bg-muted-gray/20 px-2 py-1 rounded">
                                        {asset.internal_id}
                                      </code>
                                    </TableCell>
                                    <TableCell>
                                      {asset.barcode ? (
                                        <Badge className="bg-green-500/20 text-green-400 text-xs">
                                          {asset.barcode}
                                        </Badge>
                                      ) : (
                                        <span className="text-muted-gray">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {asset.qr_code ? (
                                        <QrCode className="w-4 h-4 text-blue-400" />
                                      ) : (
                                        <span className="text-muted-gray">-</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Kits Tab */}
          <TabsContent value="kits" className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
              <Input
                placeholder="Search kits..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Selection toolbar */}
            {selectedKits.size > 0 && (
              <div className="flex items-center gap-2 p-2 bg-accent-yellow/10 rounded-lg border border-accent-yellow/30">
                <span className="text-sm text-bone-white">
                  {selectedKits.size} kits selected
                </span>
                <div className="flex-1" />
                <Button size="sm" variant="outline" onClick={handleAddToQueue}>
                  <ListPlus className="w-4 h-4 mr-1" />
                  Add to Queue
                </Button>
              </div>
            )}

            {/* Kits table */}
            <Card className="bg-charcoal-black/50 border-muted-gray/30">
              <Table>
                <TableHeader>
                  <TableRow className="border-muted-gray/30 hover:bg-transparent">
                    <TableHead className="w-10" />
                    <TableHead>Kit Name</TableHead>
                    <TableHead>Internal ID</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead>QR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKits.map((kit) => (
                    <TableRow
                      key={kit.id}
                      className={cn(
                        'border-muted-gray/30 cursor-pointer',
                        selectedKits.has(kit.id)
                          ? 'bg-accent-yellow/10 hover:bg-accent-yellow/20'
                          : 'hover:bg-charcoal-black/30'
                      )}
                      onClick={() => toggleKit(kit.id)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedKits.has(kit.id)}
                          onCheckedChange={() => toggleKit(kit.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-accent-yellow" />
                          <span className="font-medium text-bone-white">{kit.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted-gray/20 px-2 py-1 rounded">
                          {kit.internal_id}
                        </code>
                      </TableCell>
                      <TableCell className="text-muted-gray">
                        {kit.template_name || '-'}
                      </TableCell>
                      <TableCell>
                        {kit.barcode ? (
                          <Badge className="bg-green-500/20 text-green-400 text-xs">
                            {kit.barcode}
                          </Badge>
                        ) : (
                          <span className="text-muted-gray">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {kit.qr_code ? (
                          <QrCode className="w-4 h-4 text-blue-400" />
                        ) : (
                          <span className="text-muted-gray">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-charcoal-black/50 border-muted-gray/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-gray">This Month</p>
                        <p className="text-2xl font-bold text-accent-yellow">
                          {stats.this_month?.labels || 0}
                        </p>
                        <p className="text-xs text-muted-gray">labels printed</p>
                      </div>
                      <BarChart3 className="w-8 h-8 text-accent-yellow opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-charcoal-black/50 border-muted-gray/30">
                  <CardContent className="pt-4">
                    <div>
                      <p className="text-xs text-muted-gray">Total Labels</p>
                      <p className="text-2xl font-bold text-bone-white">
                        {stats.total_labels || 0}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-charcoal-black/50 border-muted-gray/30">
                  <CardContent className="pt-4">
                    <div>
                      <p className="text-xs text-muted-gray">Assets Printed</p>
                      <p className="text-2xl font-bold text-bone-white">
                        {stats.unique_assets_printed || 0}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-charcoal-black/50 border-muted-gray/30">
                  <CardContent className="pt-4">
                    <div>
                      <p className="text-xs text-muted-gray">Kits Printed</p>
                      <p className="text-2xl font-bold text-bone-white">
                        {stats.unique_kits_printed || 0}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Most printed */}
            {stats?.most_printed_assets && stats.most_printed_assets.length > 0 && (
              <Card className="bg-charcoal-black/50 border-muted-gray/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Most Printed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {stats.most_printed_assets.slice(0, 5).map((item) => (
                      <Badge key={item.id} variant="secondary">
                        {item.name} ({item.label_count})
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* History table */}
            <Card className="bg-charcoal-black/50 border-muted-gray/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Print History</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow className="border-muted-gray/30 hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((entry) => (
                    <TableRow key={entry.id} className="border-muted-gray/30">
                      <TableCell className="text-sm">
                        {new Date(entry.printed_at).toLocaleDateString()}
                        <br />
                        <span className="text-xs text-muted-gray">
                          {new Date(entry.printed_at).toLocaleTimeString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {entry.item_type === 'kit' && <Package className="w-4 h-4 text-accent-yellow" />}
                          <div>
                            <span className="font-medium text-bone-white">{entry.item_name}</span>
                            <br />
                            <code className="text-xs text-muted-gray">{entry.item_internal_id}</code>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {entry.code_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{entry.quantity}</TableCell>
                      <TableCell className="text-sm text-muted-gray">
                        {entry.printed_by_name || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleReprint(entry, 'html')}
                            disabled={reprint.isPending}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleReprint(entry, 'zpl')}
                            disabled={reprint.isPending}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
