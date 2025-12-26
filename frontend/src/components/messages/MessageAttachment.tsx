/**
 * MessageAttachment - Display component for message attachments
 * Supports images with lightbox, audio/video players, and file downloads
 */
import React, { useState, useCallback } from 'react';
import { FileText, Image, Film, Music, Download, X, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface MessageAttachmentData {
  id: string;
  filename: string;
  original_filename: string;
  url: string;
  content_type: string;
  size: number;
  type: 'image' | 'video' | 'audio' | 'file';
}

interface MessageAttachmentProps {
  attachment: MessageAttachmentData;
  compact?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  switch (type) {
    case 'image': return Image;
    case 'video': return Film;
    case 'audio': return Music;
    default: return FileText;
  }
}

export function MessageAttachment({ attachment, compact = false }: MessageAttachmentProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const IconComponent = getFileIcon(attachment.type);

  const handleDownload = useCallback(() => {
    window.open(attachment.url, '_blank');
  }, [attachment.url]);

  const handleImageClick = useCallback(() => {
    setLightboxOpen(true);
  }, []);

  // Image attachment
  if (attachment.type === 'image' && !imageError) {
    return (
      <>
        <div
          className={`cursor-pointer group relative ${compact ? 'max-w-[150px]' : 'max-w-[300px]'}`}
          onClick={handleImageClick}
        >
          <img
            src={attachment.url}
            alt={attachment.original_filename}
            className="rounded-md max-h-[200px] object-contain"
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-md" />
        </div>

        {/* Image Lightbox */}
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-black/90 border-none">
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <button
                onClick={() => setLightboxOpen(false)}
                className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={attachment.url}
                alt={attachment.original_filename}
                className="max-w-full max-h-[85vh] object-contain"
              />
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-black/50 rounded px-3 py-2">
                <span className="text-white text-sm truncate">
                  {attachment.original_filename}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="text-white hover:bg-white/20"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Audio attachment
  if (attachment.type === 'audio') {
    return (
      <div className={`${compact ? 'w-[200px]' : 'w-[300px]'} bg-muted rounded-md p-3`}>
        <div className="flex items-center gap-2 mb-2">
          <Music className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium truncate flex-1">
            {attachment.original_filename}
          </span>
        </div>
        <audio
          controls
          className="w-full h-8"
          preload="metadata"
        >
          <source src={attachment.url} type={attachment.content_type} />
          Your browser does not support audio playback.
        </audio>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>{formatFileSize(attachment.size)}</span>
          <button onClick={handleDownload} className="hover:text-foreground">
            <Download className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  // Video attachment
  if (attachment.type === 'video') {
    return (
      <div className={`${compact ? 'max-w-[200px]' : 'max-w-[400px]'} bg-muted rounded-md overflow-hidden`}>
        <video
          controls
          className="w-full max-h-[300px]"
          preload="metadata"
        >
          <source src={attachment.url} type={attachment.content_type} />
          Your browser does not support video playback.
        </video>
        <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
          <span className="truncate flex-1">{attachment.original_filename}</span>
          <div className="flex items-center gap-2">
            <span>{formatFileSize(attachment.size)}</span>
            <button onClick={handleDownload} className="hover:text-foreground">
              <Download className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // File attachment (default)
  return (
    <div
      className={`flex items-center gap-3 p-3 bg-muted rounded-md hover:bg-muted/80 cursor-pointer group ${compact ? 'max-w-[180px]' : 'max-w-[280px]'}`}
      onClick={handleDownload}
    >
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-background rounded">
        <IconComponent className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {attachment.original_filename}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(attachment.size)}
        </p>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </div>
  );
}

interface MessageAttachmentsProps {
  attachments: MessageAttachmentData[];
  compact?: boolean;
}

export function MessageAttachments({ attachments, compact = false }: MessageAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null;

  // For single image, show it directly
  if (attachments.length === 1 && attachments[0].type === 'image') {
    return <MessageAttachment attachment={attachments[0]} compact={compact} />;
  }

  // For multiple images, show a grid
  const images = attachments.filter(a => a.type === 'image');
  const others = attachments.filter(a => a.type !== 'image');

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className={`grid gap-1 ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {images.map(img => (
            <MessageAttachment key={img.id} attachment={img} compact={images.length > 1} />
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {others.map(attachment => (
            <MessageAttachment key={attachment.id} attachment={attachment} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
}
