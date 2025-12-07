/**
 * ScriptImportModal - Import scripts from FDX or PDF files
 */
import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  FileText,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  File,
} from 'lucide-react';
import { useImportScript, useScripts } from '@/hooks/backlot';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ScriptImportModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ImportStep = 'upload' | 'details' | 'importing' | 'complete' | 'error';

const ScriptImportModal: React.FC<ScriptImportModalProps> = ({
  projectId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState<ImportStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<{
    scenesCreated: number;
    message: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const importScript = useImportScript();
  const { createScript } = useScripts({ projectId });

  const resetState = () => {
    setStep('upload');
    setSelectedFile(null);
    setTitle('');
    setVersion('');
    setImportResult(null);
    setErrorMessage('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    const validTypes = [
      'application/pdf',
      'text/xml',
      'application/xml',
      '.fdx',
    ];
    const extension = file.name.toLowerCase().split('.').pop();

    if (
      !validTypes.includes(file.type) &&
      extension !== 'fdx' &&
      extension !== 'pdf'
    ) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a Final Draft (.fdx) or PDF file.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    // Auto-fill title from filename
    const fileName = file.name.replace(/\.(fdx|pdf)$/i, '');
    setTitle(fileName);
    setStep('details');
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setStep('importing');

    try {
      const result = await importScript.mutateAsync({
        projectId,
        file: selectedFile,
        title: title || selectedFile.name,
        version: version || undefined,
      });

      setImportResult({
        scenesCreated: result.scenes_created,
        message: result.message,
      });
      setStep('complete');

      toast({
        title: 'Script Imported',
        description: `Successfully imported ${result.scenes_created} scenes.`,
      });

      onSuccess?.();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to import script');
      setStep('error');
    }
  };

  const handleManualCreate = async () => {
    if (!title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a script title.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createScript.mutateAsync({
        projectId,
        title: title.trim(),
        version: version || null,
        file_type: 'manual',
      });

      toast({
        title: 'Script Created',
        description: 'Empty script created. You can now add scenes manually.',
      });

      handleClose();
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create script',
        variant: 'destructive',
      });
    }
  };

  const getFileIcon = () => {
    if (!selectedFile) return <Upload className="w-12 h-12" />;
    const extension = selectedFile.name.toLowerCase().split('.').pop();
    if (extension === 'fdx') return <FileCode className="w-12 h-12" />;
    return <FileText className="w-12 h-12" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 'upload' && 'Import Script'}
            {step === 'details' && 'Script Details'}
            {step === 'importing' && 'Importing Script...'}
            {step === 'complete' && 'Import Complete'}
            {step === 'error' && 'Import Failed'}
          </DialogTitle>
          {step === 'upload' && (
            <DialogDescription>
              Upload a Final Draft (.fdx) or PDF script to automatically extract scenes.
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            {/* Drop Zone */}
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                isDragging
                  ? 'border-accent-yellow bg-accent-yellow/10'
                  : 'border-muted-gray/30 hover:border-muted-gray/50'
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-muted-gray/20 text-muted-gray">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-bone-white font-medium">
                    Drop your script file here
                  </p>
                  <p className="text-sm text-muted-gray mt-1">
                    or click to browse
                  </p>
                </div>
                <input
                  type="file"
                  accept=".fdx,.pdf,application/pdf,text/xml,application/xml"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Supported Formats */}
            <div className="flex items-center justify-center gap-6 text-sm text-muted-gray">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4" />
                <span>Final Draft (.fdx)</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>PDF</span>
              </div>
            </div>

            {/* Manual Option */}
            <div className="pt-4 border-t border-muted-gray/20">
              <p className="text-sm text-muted-gray mb-3 text-center">
                Or create an empty script and add scenes manually
              </p>
              <div className="space-y-3">
                <Input
                  placeholder="Script title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-charcoal-black border-muted-gray/20"
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleManualCreate}
                  disabled={!title.trim() || createScript.isPending}
                >
                  {createScript.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  Create Empty Script
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 'details' && selectedFile && (
          <div className="space-y-6">
            {/* File Preview */}
            <div className="flex items-center gap-4 p-4 bg-muted-gray/10 rounded-lg">
              <div className="p-3 rounded-lg bg-accent-yellow/20 text-accent-yellow">
                {getFileIcon()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-bone-white truncate">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-muted-gray">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSelectedFile(null);
                  setStep('upload');
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Script Title *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter script title..."
                  className="bg-charcoal-black border-muted-gray/20"
                />
              </div>

              <div className="space-y-2">
                <Label>Version / Draft</Label>
                <Input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="e.g., Revision 3, Blue Pages, Final Draft"
                  className="bg-charcoal-black border-muted-gray/20"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSelectedFile(null);
                  setStep('upload');
                }}
              >
                Back
              </Button>
              <Button
                className="flex-1 bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                onClick={handleImport}
                disabled={!title.trim()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Script
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && (
          <div className="py-8 text-center space-y-6">
            <div className="flex justify-center">
              <Loader2 className="w-12 h-12 text-accent-yellow animate-spin" />
            </div>
            <div>
              <p className="text-bone-white font-medium">Processing script...</p>
              <p className="text-sm text-muted-gray mt-1">
                Extracting scenes and analyzing structure
              </p>
            </div>
            <Progress value={66} className="h-2" />
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && importResult && (
          <div className="py-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-green-500/20">
                <CheckCircle2 className="w-12 h-12 text-green-400" />
              </div>
            </div>
            <div>
              <p className="text-bone-white font-medium text-lg">
                Script Imported Successfully!
              </p>
              <p className="text-muted-gray mt-2">
                {importResult.scenesCreated} scenes were extracted from your script.
              </p>
            </div>
            <Button
              onClick={handleClose}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              View Script
            </Button>
          </div>
        )}

        {/* Step 5: Error */}
        {step === 'error' && (
          <div className="py-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-red-500/20">
                <AlertCircle className="w-12 h-12 text-red-400" />
              </div>
            </div>
            <div>
              <p className="text-bone-white font-medium text-lg">Import Failed</p>
              <p className="text-muted-gray mt-2">{errorMessage}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setStep('details');
                  setErrorMessage('');
                }}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ScriptImportModal;
