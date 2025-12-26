/**
 * LocalBrowser - Component for browsing linked drives from the desktop helper
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  HardDrive,
  Folder,
  File,
  Film,
  Image,
  ChevronRight,
  ChevronLeft,
  ArrowUp,
  Play,
  Loader2,
  RefreshCw,
  Circle,
} from 'lucide-react';
import { useDesktopHelper, LinkedDrive, LocalFile } from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface LocalBrowserProps {
  projectId: string;
  onSelectClip?: (file: LocalFile, driveName: string) => void;
  onPlayFile?: (streamUrl: string, fileName: string) => void;
}

const formatBytes = (bytes: number | undefined): string => {
  if (!bytes) return '--';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const LocalBrowser: React.FC<LocalBrowserProps> = ({
  projectId,
  onSelectClip,
  onPlayFile,
}) => {
  const {
    isConnected,
    listLinkedDrives,
    browseLinkedDrive,
    getLinkedDriveStreamUrl,
  } = useDesktopHelper();

  // State
  const [linkedDrives, setLinkedDrives] = useState<LinkedDrive[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<LinkedDrive | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Breadcrumb paths
  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];

  // Load linked drives
  const loadDrives = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const drives = await listLinkedDrives();
      setLinkedDrives(drives);
    } catch (err) {
      setError('Failed to load linked drives');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, listLinkedDrives]);

  // Load files in current directory
  const loadFiles = useCallback(async () => {
    if (!isConnected || !selectedDrive) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await browseLinkedDrive(selectedDrive.name, currentPath);
      setFiles(result);
    } catch (err) {
      setError('Failed to load directory contents');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, selectedDrive, currentPath, browseLinkedDrive]);

  // Load drives on mount
  useEffect(() => {
    loadDrives();
  }, [loadDrives]);

  // Load files when drive or path changes
  useEffect(() => {
    if (selectedDrive) {
      loadFiles();
    }
  }, [selectedDrive, currentPath, loadFiles]);

  // Navigate to a directory
  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSelectedFiles(new Set());
  };

  // Navigate up one level
  const navigateUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join('/'));
    setSelectedFiles(new Set());
  };

  // Handle file click
  const handleFileClick = (file: LocalFile) => {
    if (file.isDirectory) {
      navigateTo(file.relativePath || file.path);
    } else if (file.isVideo && selectedDrive && onPlayFile) {
      const streamUrl = getLinkedDriveStreamUrl(selectedDrive.name, file.relativePath || '');
      onPlayFile(streamUrl, file.name);
    }
  };

  // Toggle file selection
  const toggleFileSelection = (file: LocalFile, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = file.relativePath || file.path;
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }
    setSelectedFiles(newSelection);
  };

  // Get icon for file type
  const getFileIcon = (file: LocalFile) => {
    if (file.isDirectory) return Folder;
    if (file.isVideo) return Film;
    if (file.isImage) return Image;
    return File;
  };

  // Render drive selection view
  if (!selectedDrive) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-bone-white">Linked Drives</h3>
            <p className="text-sm text-muted-gray">
              Select a drive to browse local footage
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadDrives}
            disabled={isLoading}
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-muted-gray animate-spin" />
          </div>
        ) : linkedDrives.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {linkedDrives.map((drive) => (
              <button
                key={drive.name}
                onClick={() => drive.available && setSelectedDrive(drive)}
                disabled={!drive.available}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-lg border transition-colors text-left',
                  drive.available
                    ? 'border-muted-gray/20 bg-charcoal-black/30 hover:border-accent-yellow/50 cursor-pointer'
                    : 'border-muted-gray/10 bg-charcoal-black/10 cursor-not-allowed opacity-50'
                )}
              >
                <div className="relative">
                  <HardDrive className="w-8 h-8 text-muted-gray" />
                  <div
                    className={cn(
                      'absolute -top-1 -right-1 w-3 h-3 rounded-full',
                      drive.available ? 'bg-green-500' : 'bg-red-500'
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-bone-white truncate">{drive.name}</p>
                  <p className="text-xs text-muted-gray truncate">{drive.path}</p>
                  {drive.available && drive.freeBytes !== undefined && (
                    <p className="text-xs text-muted-gray mt-1">
                      {formatBytes(drive.freeBytes)} free of {formatBytes(drive.totalBytes)}
                    </p>
                  )}
                  {!drive.available && (
                    <Badge variant="outline" className="mt-1 text-red-400 border-red-400/30">
                      Offline
                    </Badge>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-muted-gray/50 flex-shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-charcoal-black/30 rounded-lg border border-muted-gray/20">
            <HardDrive className="w-12 h-12 text-muted-gray/30 mx-auto mb-3" />
            <p className="text-muted-gray mb-2">No linked drives</p>
            <p className="text-xs text-muted-gray/70">
              Link drives in the Desktop Helper app to browse footage here.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Render file browser view
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedDrive(null);
              setCurrentPath('');
              setFiles([]);
              setSelectedFiles(new Set());
            }}
            className="text-muted-gray hover:text-bone-white"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Drives
          </Button>
          <span className="text-muted-gray">/</span>
          <span className="text-bone-white font-medium">{selectedDrive.name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadFiles}
          disabled={isLoading}
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </Button>
      </div>

      {/* Breadcrumbs */}
      {pathParts.length > 0 && (
        <div className="flex items-center gap-1 text-sm overflow-x-auto pb-2">
          <button
            onClick={() => navigateTo('')}
            className="text-muted-gray hover:text-accent-yellow"
          >
            Root
          </button>
          {pathParts.map((part, index) => (
            <React.Fragment key={index}>
              <ChevronRight className="w-3 h-3 text-muted-gray/50 flex-shrink-0" />
              <button
                onClick={() => navigateTo(pathParts.slice(0, index + 1).join('/'))}
                className={cn(
                  'truncate max-w-[150px]',
                  index === pathParts.length - 1
                    ? 'text-bone-white'
                    : 'text-muted-gray hover:text-accent-yellow'
                )}
              >
                {part}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* File list */}
      <ScrollArea className="h-[400px] border border-muted-gray/20 rounded-lg">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-muted-gray animate-spin" />
          </div>
        ) : files.length > 0 ? (
          <div className="divide-y divide-muted-gray/10">
            {/* Up navigation */}
            {currentPath && (
              <button
                onClick={navigateUp}
                className="flex items-center gap-3 w-full p-3 hover:bg-charcoal-black/30 transition-colors"
              >
                <ArrowUp className="w-5 h-5 text-muted-gray" />
                <span className="text-muted-gray">..</span>
              </button>
            )}

            {/* Files and folders */}
            {files.map((file) => {
              const Icon = getFileIcon(file);
              const isSelected = selectedFiles.has(file.relativePath || file.path);

              return (
                <div
                  key={file.path}
                  onClick={() => handleFileClick(file)}
                  className={cn(
                    'flex items-center gap-3 w-full p-3 hover:bg-charcoal-black/30 transition-colors cursor-pointer',
                    isSelected && 'bg-accent-yellow/10'
                  )}
                >
                  {/* Selection checkbox for media files */}
                  {(file.isVideo || file.isImage) && onSelectClip && (
                    <button
                      onClick={(e) => toggleFileSelection(file, e)}
                      className={cn(
                        'w-5 h-5 rounded border flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-accent-yellow border-accent-yellow'
                          : 'border-muted-gray/30 hover:border-accent-yellow/50'
                      )}
                    >
                      {isSelected && <Circle className="w-3 h-3 text-charcoal-black" fill="currentColor" />}
                    </button>
                  )}

                  {/* Icon */}
                  <Icon
                    className={cn(
                      'w-5 h-5 flex-shrink-0',
                      file.isDirectory ? 'text-accent-yellow' : 'text-muted-gray'
                    )}
                  />

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-bone-white truncate">{file.name}</p>
                  </div>

                  {/* Size */}
                  {!file.isDirectory && file.size !== undefined && (
                    <span className="text-xs text-muted-gray flex-shrink-0">
                      {formatBytes(file.size)}
                    </span>
                  )}

                  {/* Play button for videos */}
                  {file.isVideo && onPlayFile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        const streamUrl = getLinkedDriveStreamUrl(
                          selectedDrive.name,
                          file.relativePath || ''
                        );
                        onPlayFile(streamUrl, file.name);
                      }}
                      className="text-accent-yellow hover:bg-accent-yellow/20"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  )}

                  {/* Chevron for directories */}
                  {file.isDirectory && (
                    <ChevronRight className="w-4 h-4 text-muted-gray/50 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-muted-gray">
            <Folder className="w-8 h-8 opacity-30 mr-3" />
            Empty directory
          </div>
        )}
      </ScrollArea>

      {/* Actions for selected files */}
      {selectedFiles.size > 0 && onSelectClip && (
        <div className="flex items-center justify-between p-3 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg">
          <span className="text-sm text-bone-white">
            {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
          </span>
          <Button
            size="sm"
            onClick={() => {
              const selectedFilesList = files.filter(
                (f) => selectedFiles.has(f.relativePath || f.path) && (f.isVideo || f.isImage)
              );
              selectedFilesList.forEach((file) => {
                onSelectClip(file, selectedDrive.name);
              });
              setSelectedFiles(new Set());
            }}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            Add to Dailies
          </Button>
        </div>
      )}
    </div>
  );
};

export default LocalBrowser;
