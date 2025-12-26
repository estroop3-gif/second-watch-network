/**
 * ResumeSelector - Select from uploaded resumes or upload a new one
 */
import React, { useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Upload,
  Loader2,
  Trash2,
  Star,
  Check,
  ExternalLink,
  File,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

import {
  useUserResumes,
  useUploadResume,
  useDeleteResume,
  useSetDefaultResume,
} from '@/hooks/applications';
import type { UserResume } from '@/types/applications';

interface ResumeSelectorProps {
  selectedResumeId: string | null;
  onChange: (resumeId: string | null) => void;
  required?: boolean;
}

// Format file size
const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Get file type icon/label
const getFileTypeLabel = (type: string): string => {
  if (type.includes('pdf')) return 'PDF';
  if (type.includes('word') || type.includes('doc')) return 'DOC';
  return 'File';
};

const ResumeSelector: React.FC<ResumeSelectorProps> = ({
  selectedResumeId,
  onChange,
  required = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadName, setUploadName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const { data: resumes, isLoading } = useUserResumes();
  const uploadResume = useUploadResume();
  const deleteResume = useDeleteResume();
  const setDefaultResume = useSetDefaultResume();

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PDF or Word document');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadResume.mutateAsync({
        file,
        name: uploadName || file.name,
        isDefault: !resumes?.length, // Set as default if first resume
      });

      toast.success('Resume uploaded successfully');
      onChange(result.id); // Auto-select the new resume
      setUploadName('');

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload resume');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle delete
  const handleDelete = async (e: React.MouseEvent, resumeId: string) => {
    e.stopPropagation();

    if (!confirm('Delete this resume?')) return;

    try {
      await deleteResume.mutateAsync(resumeId);
      toast.success('Resume deleted');
      if (selectedResumeId === resumeId) {
        onChange(null);
      }
    } catch (error) {
      toast.error('Failed to delete resume');
    }
  };

  // Handle set default
  const handleSetDefault = async (e: React.MouseEvent, resumeId: string) => {
    e.stopPropagation();

    try {
      await setDefaultResume.mutateAsync(resumeId);
      toast.success('Default resume updated');
    } catch (error) {
      toast.error('Failed to set default');
    }
  };

  // Selected resume
  const selectedResume = resumes?.find((r) => r.id === selectedResumeId);

  // Sort resumes - default first, then by date
  const sortedResumes = [...(resumes || [])].sort((a, b) => {
    if (a.is_default && !b.is_default) return -1;
    if (!a.is_default && b.is_default) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-3">
      <Label className="text-bone-white flex items-center gap-2">
        <FileText className="w-4 h-4 text-accent-yellow" />
        Resume
        {required && <span className="text-red-400">*</span>}
      </Label>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-gray" />
        </div>
      )}

      {/* Resume List */}
      {!isLoading && sortedResumes.length > 0 && (
        <div className="space-y-2">
          {sortedResumes.map((resume) => (
            <div
              key={resume.id}
              onClick={() => onChange(resume.id === selectedResumeId ? null : resume.id)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all',
                'border bg-charcoal-black/30',
                selectedResumeId === resume.id
                  ? 'border-accent-yellow bg-accent-yellow/10'
                  : 'border-muted-gray/20 hover:border-muted-gray/40'
              )}
            >
              {/* Selection indicator */}
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                  selectedResumeId === resume.id
                    ? 'border-accent-yellow bg-accent-yellow'
                    : 'border-muted-gray/50'
                )}
              >
                {selectedResumeId === resume.id && (
                  <Check className="w-3 h-3 text-charcoal-black" />
                )}
              </div>

              {/* File icon */}
              <div className="w-10 h-10 rounded bg-charcoal-black/50 flex items-center justify-center flex-shrink-0">
                <File className="w-5 h-5 text-blue-400" />
              </div>

              {/* Resume info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-bone-white truncate">
                    {resume.name}
                  </span>
                  {resume.is_default && (
                    <Badge className="bg-amber-600/20 text-amber-400 text-[10px] px-1.5 py-0">
                      <Star className="w-2.5 h-2.5 mr-0.5 fill-amber-400" />
                      Default
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-gray">
                  <span>{getFileTypeLabel(resume.file_type)}</span>
                  {resume.file_size && (
                    <>
                      <span>•</span>
                      <span>{formatFileSize(resume.file_size)}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{formatDistanceToNow(new Date(resume.created_at), { addSuffix: true })}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <a
                  href={resume.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 text-muted-gray hover:text-blue-400 transition-colors"
                  title="View resume"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                {!resume.is_default && (
                  <button
                    type="button"
                    onClick={(e) => handleSetDefault(e, resume.id)}
                    className="p-1.5 text-muted-gray hover:text-amber-400 transition-colors"
                    title="Set as default"
                    disabled={setDefaultResume.isPending}
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, resume.id)}
                  className="p-1.5 text-muted-gray hover:text-red-400 transition-colors"
                  title="Delete resume"
                  disabled={deleteResume.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Section */}
      <div className="border border-dashed border-muted-gray/30 rounded-lg p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Input
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="Resume name (optional)"
              className="flex-1 bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray h-9"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="border-accent-yellow/50 text-accent-yellow hover:bg-accent-yellow hover:text-charcoal-black"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Resume
                </>
              )}
            </Button>
          </div>

          <p className="text-[11px] text-muted-gray text-center">
            Accepted formats: PDF, DOC, DOCX (max 10MB)
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Empty State */}
      {!isLoading && sortedResumes.length === 0 && (
        <p className="text-xs text-muted-gray text-center py-2">
          No resumes uploaded yet. Upload your first resume above.
        </p>
      )}
    </div>
  );
};

export default ResumeSelector;
