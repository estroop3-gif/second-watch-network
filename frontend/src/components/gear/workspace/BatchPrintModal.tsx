/**
 * Batch Print Modal
 * Modal for batch printing labels with configurable options
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Printer,
  Barcode,
  QrCode,
  Package,
  X,
  Download,
  Copy,
  Loader2,
  Settings2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { LabelSize, PrintMode, PrinterType, CodeType } from '@/types/gear';

interface BatchPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  selectedAssetIds: string[];
}

const LABEL_SIZE_OPTIONS: { value: LabelSize; label: string }[] = [
  { value: '2x1', label: '2" x 1" (Standard)' },
  { value: '1.5x0.5', label: '1.5" x 0.5" (Small)' },
  { value: '3x2', label: '3" x 2" (Large)' },
  { value: 'custom', label: 'Custom Size' },
];

const PRINTER_OPTIONS: { value: PrinterType; label: string; description: string }[] = [
  { value: 'generic', label: 'Generic (Browser Print)', description: 'Print via browser dialog' },
  { value: 'zebra', label: 'Zebra ZPL', description: 'Generate ZPL commands' },
  { value: 'dymo', label: 'DYMO', description: 'DYMO label printers' },
  { value: 'brother', label: 'Brother', description: 'Brother P-touch printers' },
];

export function BatchPrintModal({
  isOpen,
  onClose,
  orgId,
  selectedAssetIds,
}: BatchPrintModalProps) {
  const { session } = useAuth();

  // Print settings
  const [codeType, setCodeType] = useState<CodeType>('both');
  const [labelSize, setLabelSize] = useState<LabelSize>('2x1');
  const [printMode, setPrintMode] = useState<PrintMode>('sheet');
  const [printerType, setPrinterType] = useState<PrinterType>('generic');
  const [includeName, setIncludeName] = useState(true);
  const [includeCategory, setIncludeCategory] = useState(true);

  // Sheet mode settings
  const [sheetRows, setSheetRows] = useState(10);
  const [sheetColumns, setSheetColumns] = useState(3);

  // Custom size settings (in mm)
  const [customWidthMm, setCustomWidthMm] = useState<number>(50);
  const [customHeightMm, setCustomHeightMm] = useState<number>(25);

  // Loading state
  const [isPrinting, setIsPrinting] = useState(false);

  // ZPL output state
  const [zplContent, setZplContent] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCodeType('both');
      setLabelSize('2x1');
      setPrintMode('sheet');
      setPrinterType('generic');
      setIncludeName(true);
      setIncludeCategory(true);
      setSheetRows(10);
      setSheetColumns(3);
      setZplContent(null);
    }
  }, [isOpen]);

  const handlePrint = async () => {
    if (selectedAssetIds.length === 0) return;

    setIsPrinting(true);

    try {
      const requestBody = {
        asset_ids: selectedAssetIds,
        label_type: codeType,
        include_name: includeName,
        include_category: includeCategory,
        label_size: labelSize,
        print_mode: printMode,
        printer_type: printerType,
        sheet_rows: printMode === 'sheet' ? sheetRows : undefined,
        sheet_columns: printMode === 'sheet' ? sheetColumns : undefined,
        custom_width_mm: labelSize === 'custom' ? customWidthMm : undefined,
        custom_height_mm: labelSize === 'custom' ? customHeightMm : undefined,
      };

      if (printerType === 'zebra') {
        // Fetch ZPL content
        const response = await fetch(`/api/v1/gear/labels/${orgId}/batch/zpl`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error('Failed to generate ZPL');
        }

        const content = await response.text();
        setZplContent(content);
        setIsPrinting(false);
        return; // Don't close modal - show ZPL output
      } else {
        // Fetch HTML for browser printing
        const response = await fetch(`/api/v1/gear/labels/${orgId}/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error('Failed to generate labels');
        }

        const html = await response.text();

        // Open print window
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.onload = () => {
            printWindow.print();
          };
        }
      }

      onClose();
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to generate labels');
    } finally {
      setIsPrinting(false);
    }
  };

  // ZPL action handlers
  const handleCopyZpl = async () => {
    if (!zplContent) return;
    await navigator.clipboard.writeText(zplContent);
    toast.success('ZPL copied to clipboard');
  };

  const handleDownloadZpl = () => {
    if (!zplContent) return;
    downloadFile(zplContent, `labels-${Date.now()}.zpl`, 'text/plain');
    toast.success('ZPL file downloaded');
  };

  // Helper to download file
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            {zplContent ? 'ZPL Output' : `Print Labels (${selectedAssetIds.length} selected)`}
          </DialogTitle>
          <DialogDescription>
            {zplContent ? 'Copy or download the generated ZPL commands' : 'Configure label printing options'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6">
          {zplContent ? (
            /* ZPL Output View */
            <div className="space-y-4 pb-4">
              <div className="bg-charcoal-black/50 rounded-lg border border-muted-gray/30">
                <pre className="p-4 text-xs text-bone-white overflow-x-auto max-h-[40vh] overflow-y-auto font-mono whitespace-pre">
                  {zplContent}
                </pre>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCopyZpl} className="flex-1">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy to Clipboard
                </Button>
                <Button onClick={handleDownloadZpl} variant="outline" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Download .zpl File
                </Button>
              </div>
            </div>
          ) : (
          <div className="space-y-6 pb-4">
          {/* Code Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Code Type</Label>
            <RadioGroup
              value={codeType}
              onValueChange={(v) => setCodeType(v as CodeType)}
              className="flex flex-col space-y-2"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="barcode" id="barcode" />
                <Label htmlFor="barcode" className="flex items-center gap-2 cursor-pointer">
                  <Barcode className="w-4 h-4" />
                  Barcode only
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="qr" id="qr" />
                <Label htmlFor="qr" className="flex items-center gap-2 cursor-pointer">
                  <QrCode className="w-4 h-4" />
                  QR code only
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="both" id="both" />
                <Label htmlFor="both" className="flex items-center gap-2 cursor-pointer">
                  <Package className="w-4 h-4" />
                  Both
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Label Size */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Label Size</Label>
            <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSize)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LABEL_SIZE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Custom Size Inputs */}
            {labelSize === 'custom' && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <Label htmlFor="customWidth" className="text-xs text-muted-gray">Width (mm)</Label>
                  <Input
                    id="customWidth"
                    type="number"
                    min={10}
                    max={200}
                    value={customWidthMm}
                    onChange={(e) => setCustomWidthMm(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="customHeight" className="text-xs text-muted-gray">Height (mm)</Label>
                  <Input
                    id="customHeight"
                    type="number"
                    min={10}
                    max={200}
                    value={customHeightMm}
                    onChange={(e) => setCustomHeightMm(Number(e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Include Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Include on Label</Label>
            <div className="flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeName"
                  checked={includeName}
                  onCheckedChange={(checked) => setIncludeName(!!checked)}
                />
                <Label htmlFor="includeName" className="cursor-pointer">Asset name</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeCategory"
                  checked={includeCategory}
                  onCheckedChange={(checked) => setIncludeCategory(!!checked)}
                />
                <Label htmlFor="includeCategory" className="cursor-pointer">Category</Label>
              </div>
            </div>
          </div>

          {/* Print Mode */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Print Mode</Label>
            <Tabs value={printMode} onValueChange={(v) => setPrintMode(v as PrintMode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sheet">Sheet</TabsTrigger>
                <TabsTrigger value="roll">Roll</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-gray">
              {printMode === 'sheet'
                ? 'For office/laser printers with label sheets'
                : 'For thermal label printers (one label at a time)'}
            </p>

            {/* Sheet Layout */}
            {printMode === 'sheet' && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <Label htmlFor="rows" className="text-xs text-muted-gray">Rows per page</Label>
                  <Input
                    id="rows"
                    type="number"
                    min={1}
                    max={20}
                    value={sheetRows}
                    onChange={(e) => setSheetRows(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="cols" className="text-xs text-muted-gray">Columns per page</Label>
                  <Input
                    id="cols"
                    type="number"
                    min={1}
                    max={10}
                    value={sheetColumns}
                    onChange={(e) => setSheetColumns(Number(e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Printer Type */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Printer</Label>
            <Select value={printerType} onValueChange={(v) => setPrinterType(v as PrinterType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRINTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      <span className="text-xs text-muted-gray">{opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {printerType === 'zebra' && (
              <p className="text-xs text-muted-gray">
                ZPL commands will be generated. Copy to clipboard or download as .zpl file.
              </p>
            )}
          </div>

          {/* Preview Placeholder */}
          <div className="border border-muted-gray/30 rounded-lg p-4 bg-charcoal-black/30">
            <Label className="text-sm font-medium mb-2 block">Preview</Label>
            <div className="bg-white rounded p-3 text-black">
              <div className="flex gap-3 items-start">
                {/* Code preview */}
                <div className="flex-1">
                  {(codeType === 'barcode' || codeType === 'both') && (
                    <div className="h-8 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500 mb-2">
                      {codeType === 'both' ? 'Barcode' : 'Barcode'}
                    </div>
                  )}
                  {includeName && (
                    <p className="font-bold text-sm truncate">Asset Name</p>
                  )}
                  <p className="font-mono text-xs text-gray-600">GH-XXX-001</p>
                  {includeCategory && (
                    <p className="text-xs text-gray-500">Category</p>
                  )}
                </div>
                {(codeType === 'qr' || codeType === 'both') && (
                  <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">
                    QR
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-gray mt-2 text-center">
              {LABEL_SIZE_OPTIONS.find(o => o.value === labelSize)?.label || 'Custom'} label
            </p>
          </div>
          </div>
          )}
        </div>

        <DialogFooter className="p-6 pt-4 border-t border-muted-gray/30">
          {zplContent ? (
            <>
              <Button variant="outline" onClick={() => setZplContent(null)}>
                Back
              </Button>
              <Button onClick={onClose}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handlePrint} disabled={isPrinting || selectedAssetIds.length === 0}>
                {isPrinting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : printerType === 'zebra' ? (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Generate ZPL
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4 mr-2" />
                    Print Labels
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
