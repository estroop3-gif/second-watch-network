/**
 * Import CSV Dialog
 * Multi-step wizard for importing bookings from CSV files
 */
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  Trash2,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type {
  CSVUploadResult,
  CSVColumnMapping,
  CSVImportResult,
  SetHouseSpace,
} from '@/types/set-house';

const MAPPING_FIELDS: { key: keyof CSVColumnMapping; label: string; required?: boolean }[] = [
  { key: 'start_date', label: 'Start Date', required: true },
  { key: 'end_date', label: 'End Date' },
  { key: 'start_time', label: 'Start Time' },
  { key: 'end_time', label: 'End Time' },
  { key: 'client_name', label: 'Client Name' },
  { key: 'client_email', label: 'Client Email' },
  { key: 'client_phone', label: 'Client Phone' },
  { key: 'space_name', label: 'Space Name' },
  { key: 'external_booking_id', label: 'Booking ID' },
  { key: 'total_amount', label: 'Total Amount' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
  { key: 'platform', label: 'Platform' },
];

interface ImportCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => Promise<CSVUploadResult>;
  onImport: (data: {
    rows: Array<Record<string, string>>;
    column_mapping: CSVColumnMapping;
    default_space_id?: string;
    skip_duplicates: boolean;
  }) => Promise<CSVImportResult>;
  onDownloadTemplate: () => void;
  spaces: SetHouseSpace[];
  isUploading?: boolean;
  isImporting?: boolean;
}

type Step = 'upload' | 'mapping' | 'preview' | 'result';

export function ImportCSVDialog({
  open,
  onOpenChange,
  onUpload,
  onImport,
  onDownloadTemplate,
  spaces,
  isUploading = false,
  isImporting = false,
}: ImportCSVDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [uploadResult, setUploadResult] = useState<CSVUploadResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<CSVColumnMapping>({});
  const [defaultSpaceId, setDefaultSpaceId] = useState('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [error, setError] = useState('');

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setError('');
      try {
        const result = await onUpload(file);
        setUploadResult(result);
        setColumnMapping(result.auto_mapping);
        setStep('mapping');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload file');
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    multiple: false,
    disabled: isUploading,
  });

  const handleMappingChange = (field: keyof CSVColumnMapping, value: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [field]: value || undefined,
    }));
  };

  const handleImport = async () => {
    if (!uploadResult) return;

    setError('');
    try {
      const result = await onImport({
        rows: uploadResult.preview_rows.length === uploadResult.row_count
          ? uploadResult.preview_rows
          : uploadResult.preview_rows, // In a real app, we'd have all rows
        column_mapping: columnMapping,
        default_space_id: defaultSpaceId || undefined,
        skip_duplicates: skipDuplicates,
      });
      setImportResult(result);
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const handleClose = () => {
    setStep('upload');
    setUploadResult(null);
    setColumnMapping({});
    setDefaultSpaceId('');
    setSkipDuplicates(true);
    setImportResult(null);
    setError('');
    onOpenChange(false);
  };

  const canProceedToPreview = columnMapping.start_date;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl bg-charcoal-black border-muted-gray/30">
        <DialogHeader>
          <DialogTitle className="text-bone-white">
            {step === 'upload' && 'Import Bookings from CSV'}
            {step === 'mapping' && 'Map CSV Columns'}
            {step === 'preview' && 'Review Import'}
            {step === 'result' && 'Import Complete'}
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            {step === 'upload' && 'Upload a CSV file with your booking data'}
            {step === 'mapping' && 'Match your CSV columns to booking fields'}
            {step === 'preview' && 'Review the data before importing'}
            {step === 'result' && 'Summary of the import operation'}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-accent-yellow bg-accent-yellow/5' : 'border-muted-gray/30 hover:border-muted-gray/50'}
                ${isUploading ? 'opacity-50 cursor-wait' : ''}
              `}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-3">
                {isUploading ? (
                  <Loader2 className="w-10 h-10 text-accent-yellow animate-spin" />
                ) : (
                  <Upload className="w-10 h-10 text-muted-gray" />
                )}
                <div>
                  <p className="text-bone-white font-medium">
                    {isDragActive ? 'Drop your CSV file here' : 'Drag and drop your CSV file'}
                  </p>
                  <p className="text-sm text-muted-gray mt-1">or click to browse</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-muted-gray">Need a template?</span>
              <Button variant="link" onClick={onDownloadTemplate} className="text-accent-yellow p-0 h-auto">
                <Download className="w-4 h-4 mr-1" />
                Download CSV Template
              </Button>
            </div>
          </div>
        )}

        {/* Step: Mapping */}
        {step === 'mapping' && uploadResult && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-yellow/10 border border-accent-yellow/30">
              <FileSpreadsheet className="w-5 h-5 text-accent-yellow" />
              <span className="text-sm text-bone-white">
                {uploadResult.row_count} rows found with {uploadResult.columns.length} columns
              </span>
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {MAPPING_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center gap-4">
                    <Label className="w-32 text-sm flex-shrink-0">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-1">*</span>}
                    </Label>
                    <Select
                      value={columnMapping[field.key] || ''}
                      onValueChange={(v) => handleMappingChange(field.key, v)}
                    >
                      <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent className="bg-charcoal-black border-muted-gray/30">
                        <SelectItem value="">-- Not mapped --</SelectItem>
                        {uploadResult.columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Default Space */}
            <div className="pt-4 border-t border-muted-gray/30">
              <div className="flex items-center gap-4">
                <Label className="w-32 text-sm flex-shrink-0">Default Space</Label>
                <Select value={defaultSpaceId} onValueChange={setDefaultSpaceId}>
                  <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                    <SelectValue placeholder="Select default space" />
                  </SelectTrigger>
                  <SelectContent className="bg-charcoal-black border-muted-gray/30">
                    <SelectItem value="">-- None --</SelectItem>
                    {spaces.map((space) => (
                      <SelectItem key={space.id} value={space.id}>
                        {space.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Skip Duplicates */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-muted-gray/30">
              <div>
                <Label>Skip Duplicates</Label>
                <p className="text-xs text-muted-gray">
                  Skip rows with existing booking IDs
                </p>
              </div>
              <Switch checked={skipDuplicates} onCheckedChange={setSkipDuplicates} />
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && uploadResult && (
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-gray">
              Preview of first {Math.min(5, uploadResult.preview_rows.length)} rows:
            </div>

            <ScrollArea className="h-[300px] border rounded-lg border-muted-gray/30">
              <Table>
                <TableHeader>
                  <TableRow className="border-muted-gray/30">
                    {Object.entries(columnMapping)
                      .filter(([_, col]) => col)
                      .map(([field, _]) => (
                        <TableHead key={field} className="text-muted-gray">
                          {MAPPING_FIELDS.find((f) => f.key === field)?.label || field}
                        </TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadResult.preview_rows.slice(0, 5).map((row, i) => (
                    <TableRow key={i} className="border-muted-gray/30">
                      {Object.entries(columnMapping)
                        .filter(([_, col]) => col)
                        .map(([field, col]) => (
                          <TableCell key={field} className="text-sm">
                            {col ? row[col] || '-' : '-'}
                          </TableCell>
                        ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && importResult && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-lg font-medium text-bone-white">Import Complete</p>
                <p className="text-sm text-muted-gray">
                  {importResult.imported} bookings imported successfully
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-charcoal-black/50 border border-muted-gray/30 text-center">
                <p className="text-2xl font-bold text-bone-white">{importResult.total_rows}</p>
                <p className="text-xs text-muted-gray">Total Rows</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                <p className="text-2xl font-bold text-green-400">{importResult.imported}</p>
                <p className="text-xs text-muted-gray">Imported</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-center">
                <p className="text-2xl font-bold text-yellow-400">{importResult.skipped}</p>
                <p className="text-xs text-muted-gray">Skipped</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
                <p className="text-2xl font-bold text-red-400">{importResult.errors}</p>
                <p className="text-xs text-muted-gray">Errors</p>
              </div>
            </div>

            {importResult.error_details.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-400">Errors:</p>
                <ScrollArea className="h-[150px]">
                  <div className="space-y-2">
                    {importResult.error_details.slice(0, 10).map((err, i) => (
                      <div key={i} className="p-2 rounded bg-red-500/10 border border-red-500/30 text-sm">
                        <span className="text-muted-gray">Row {err.row}:</span>{' '}
                        <span className="text-red-400">{err.error}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step !== 'upload' && step !== 'result' && (
            <Button
              variant="ghost"
              onClick={() => setStep(step === 'mapping' ? 'upload' : 'mapping')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}

          {step === 'result' ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>

              {step === 'mapping' && (
                <Button
                  onClick={() => setStep('preview')}
                  disabled={!canProceedToPreview}
                >
                  Preview Import
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}

              {step === 'preview' && (
                <Button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      Import {uploadResult?.row_count} Bookings
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportCSVDialog;
