/**
 * Document Uploader Component
 * Reusable file upload component for documents (ID, insurance, COI)
 */
import React, { useRef, useState } from 'react';
import { Upload, FileText, X, ExternalLink, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DocumentUploaderProps {
  accept?: string;
  existingFileUrl?: string | null;
  existingFileName?: string | null;
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  maxSizeMB?: number;
  className?: string;
}

export function DocumentUploader({
  accept = '.pdf,.jpg,.jpeg,.png',
  existingFileUrl,
  existingFileName,
  onFileSelect,
  selectedFile,
  maxSizeMB = 10,
  className,
}: DocumentUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    validateAndSetFile(file);
  };

  const validateAndSetFile = (file?: File) => {
    setError(null);

    if (!file) {
      onFileSelect(null);
      return;
    }

    // Check file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
      return;
    }

    // Check file type
    const acceptedTypes = accept.split(',').map((t) => t.trim().toLowerCase());
    const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!acceptedTypes.some((t) => t === fileExt || file.type.includes(t.replace('.', '')))) {
      setError(`Invalid file type. Accepted: ${accept}`);
      return;
    }

    onFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    validateAndSetFile(file);
  };

  const clearFile = () => {
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <Image className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  // Show selected file if there is one
  if (selectedFile) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-2 p-3 rounded-lg border border-green-500/30 bg-green-500/10">
          {getFileIcon(selectedFile.name)}
          <span className="text-sm text-bone-white truncate flex-1">
            {selectedFile.name}
          </span>
          <span className="text-xs text-muted-gray">
            {(selectedFile.size / 1024).toFixed(1)} KB
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-gray hover:text-red-400"
            onClick={clearFile}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        {existingFileUrl && (
          <p className="text-xs text-muted-gray">
            Will replace existing file on save
          </p>
        )}
      </div>
    );
  }

  // Show existing file if there is one
  if (existingFileUrl) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-2 p-3 rounded-lg border border-muted-gray/30 bg-charcoal-black/30">
          {getFileIcon(existingFileName || 'file')}
          <span className="text-sm text-bone-white truncate flex-1">
            {existingFileName || 'Document on file'}
          </span>
          <a
            href={existingFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-4 h-4 mr-2" />
          Replace File
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    );
  }

  // Show upload dropzone
  return (
    <div className={cn('space-y-2', className)}>
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer',
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-muted-gray/30 hover:border-muted-gray/50',
          error && 'border-red-500/50'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-8 h-8 mx-auto text-muted-gray mb-2" />
        <p className="text-sm text-muted-gray">
          Drop file here or <span className="text-blue-400">click to upload</span>
        </p>
        <p className="text-xs text-muted-gray mt-1">
          {accept.replace(/\./g, '').toUpperCase()} (max {maxSizeMB}MB)
        </p>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
