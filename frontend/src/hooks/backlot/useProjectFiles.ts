/**
 * useProjectFiles - Hooks for project file management with S3 upload
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// =====================================================
// Types
// =====================================================

export interface ProjectFolder {
  id: string;
  parent_id: string | null;
  name: string;
  path: string;
  sort_order: number;
  created_at: string;
}

export interface ProjectFile {
  id: string;
  folder_id: string | null;
  name: string;
  original_name: string;
  extension: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  upload_status: 'PENDING' | 'UPLOADING' | 'COMPLETE' | 'FAILED' | 'DELETED';
  tags: string[] | null;
  notes: string | null;
  uploaded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileLink {
  id: string;
  target_type: FileLinkTargetType;
  target_id: string;
  label: string | null;
  created_at: string;
}

export type FileLinkTargetType =
  | 'PROJECT'
  | 'EPISODE'
  | 'STORY'
  | 'STORYBOARD'
  | 'SIDES_PACKET'
  | 'STRIP'
  | 'PROJECT_DAY'
  | 'OTHER';

export interface UploadInitResponse {
  file_id: string;
  upload_type: 'single' | 'multipart';
  url?: string;  // For single upload
  upload_id?: string;  // For multipart
  bucket: string;
  key: string;
  part_size?: number;
  total_parts?: number;
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;  // 0-100
  status: 'pending' | 'uploading' | 'complete' | 'failed' | 'cancelled';
  error?: string;
  uploadedBytes: number;
  totalBytes: number;
}

// =====================================================
// Query Key Factory
// =====================================================

const projectFilesKeys = {
  all: ['project-files'] as const,
  folders: (projectId: string) => [...projectFilesKeys.all, 'folders', projectId] as const,
  files: (projectId: string, folderId?: string, search?: string, tag?: string, fileType?: string) =>
    [...projectFilesKeys.all, 'files', projectId, folderId, search, tag, fileType] as const,
  file: (projectId: string, fileId: string) => [...projectFilesKeys.all, 'file', projectId, fileId] as const,
  links: (projectId: string, fileId: string) => [...projectFilesKeys.all, 'links', projectId, fileId] as const,
  byTarget: (projectId: string, targetType: string, targetId: string) =>
    [...projectFilesKeys.all, 'by-target', projectId, targetType, targetId] as const,
  tags: (projectId: string) => [...projectFilesKeys.all, 'tags', projectId] as const,
};

// =====================================================
// Folder Hooks
// =====================================================

export function useProjectFolders(projectId: string | null) {
  return useQuery({
    queryKey: projectFilesKeys.folders(projectId || ''),
    queryFn: async (): Promise<{ folders: ProjectFolder[] }> => {
      if (!projectId) throw new Error('Project ID required');
      return api.get(`/api/v1/backlot/projects/${projectId}/files/folders`);
    },
    enabled: !!projectId,
    staleTime: 30000,
  });
}

export function useCreateFolder(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { parent_id?: string; name: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/files/folders`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectFilesKeys.folders(projectId || '') });
    },
  });
}

export function useUpdateFolder(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ folderId, data }: { folderId: string; data: { name?: string; parent_id?: string } }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.put(`/api/v1/backlot/projects/${projectId}/files/folders/${folderId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectFilesKeys.all });
    },
  });
}

export function useDeleteFolder(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (folderId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return api.delete(`/api/v1/backlot/projects/${projectId}/files/folders/${folderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectFilesKeys.folders(projectId || '') });
    },
  });
}

// =====================================================
// File List Hooks
// =====================================================

export function useProjectFiles(
  projectId: string | null,
  options?: {
    folderId?: string;
    search?: string;
    tag?: string;
    fileType?: string;
  }
) {
  const { folderId, search, tag, fileType } = options || {};

  return useQuery({
    queryKey: projectFilesKeys.files(projectId || '', folderId, search, tag, fileType),
    queryFn: async (): Promise<{ files: ProjectFile[] }> => {
      if (!projectId) throw new Error('Project ID required');
      const params = new URLSearchParams();
      if (folderId) params.append('folder_id', folderId);
      if (search) params.append('search', search);
      if (tag) params.append('tag', tag);
      if (fileType) params.append('file_type', fileType);
      const query = params.toString();
      return api.get(`/api/v1/backlot/projects/${projectId}/files${query ? `?${query}` : ''}`);
    },
    enabled: !!projectId,
    staleTime: 30000,
  });
}

export function useUpdateFile(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fileId,
      data,
    }: {
      fileId: string;
      data: { name?: string; folder_id?: string; notes?: string; tags?: string[] };
    }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.put(`/api/v1/backlot/projects/${projectId}/files/${fileId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectFilesKeys.all });
    },
  });
}

export function useDeleteFile(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fileId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return api.delete(`/api/v1/backlot/projects/${projectId}/files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectFilesKeys.all });
    },
  });
}

// =====================================================
// Download Hook
// =====================================================

export function useFileDownloadUrl(projectId: string | null) {
  return useMutation({
    mutationFn: async (fileId: string): Promise<{ download_url: string; mime_type: string }> => {
      if (!projectId) throw new Error('Project ID required');
      return api.get(`/api/v1/backlot/projects/${projectId}/files/${fileId}/download`);
    },
  });
}

// =====================================================
// File Links Hooks
// =====================================================

export function useFileLinks(projectId: string | null, fileId: string | null) {
  return useQuery({
    queryKey: projectFilesKeys.links(projectId || '', fileId || ''),
    queryFn: async (): Promise<{ links: FileLink[] }> => {
      if (!projectId || !fileId) throw new Error('IDs required');
      return api.get(`/api/v1/backlot/projects/${projectId}/files/${fileId}/links`);
    },
    enabled: !!projectId && !!fileId,
  });
}

export function useCreateFileLink(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fileId,
      data,
    }: {
      fileId: string;
      data: { target_type: string; target_id: string; label?: string };
    }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/files/${fileId}/links`, data);
    },
    onSuccess: (_, { fileId }) => {
      queryClient.invalidateQueries({ queryKey: projectFilesKeys.links(projectId || '', fileId) });
    },
  });
}

export function useDeleteFileLink(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fileId, linkId }: { fileId: string; linkId: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.delete(`/api/v1/backlot/projects/${projectId}/files/${fileId}/links/${linkId}`);
    },
    onSuccess: (_, { fileId }) => {
      queryClient.invalidateQueries({ queryKey: projectFilesKeys.links(projectId || '', fileId) });
    },
  });
}

// =====================================================
// Files by Target Hook
// =====================================================

export function useFilesByTarget(projectId: string | null, targetType: string, targetId: string | null) {
  return useQuery({
    queryKey: projectFilesKeys.byTarget(projectId || '', targetType, targetId || ''),
    queryFn: async (): Promise<{ files: (ProjectFile & { label?: string; link_id: string })[] }> => {
      if (!projectId || !targetId) throw new Error('IDs required');
      return api.get(`/api/v1/backlot/projects/${projectId}/files/by-target/${targetType}/${targetId}`);
    },
    enabled: !!projectId && !!targetId,
  });
}

// =====================================================
// Tags Hook
// =====================================================

export function useProjectFileTags(projectId: string | null) {
  return useQuery({
    queryKey: projectFilesKeys.tags(projectId || ''),
    queryFn: async (): Promise<{ tags: string[] }> => {
      if (!projectId) throw new Error('Project ID required');
      return api.get(`/api/v1/backlot/projects/${projectId}/files/tags`);
    },
    enabled: !!projectId,
    staleTime: 60000,
  });
}

// =====================================================
// Upload Hooks
// =====================================================

export function useInitiateUpload(projectId: string | null) {
  return useMutation({
    mutationFn: async (data: {
      folder_id?: string;
      original_name: string;
      mime_type?: string;
      size_bytes: number;
    }): Promise<UploadInitResponse> => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/files/uploads`, data);
    },
  });
}

export function useGetPartUrl(projectId: string | null) {
  return useMutation({
    mutationFn: async ({
      fileId,
      uploadId,
      partNumber,
    }: {
      fileId: string;
      uploadId: string;
      partNumber: number;
    }): Promise<{ url: string; part_number: number }> => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/files/uploads/${fileId}/part-url`, {
        upload_id: uploadId,
        part_number: partNumber,
      });
    },
  });
}

export function useCompleteUpload(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fileId,
      uploadId,
      parts,
    }: {
      fileId: string;
      uploadId: string;
      parts: { partNumber: number; etag: string }[];
    }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/files/uploads/${fileId}/complete`, {
        upload_id: uploadId,
        parts,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectFilesKeys.all });
    },
  });
}

export function useAbortUpload(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fileId, uploadId }: { fileId: string; uploadId: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/files/uploads/${fileId}/abort`, {
        upload_id: uploadId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectFilesKeys.all });
    },
  });
}

export function useFinalizeUpload(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fileId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/files/uploads/${fileId}/finalize`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectFilesKeys.all });
    },
  });
}

// =====================================================
// Upload Manager Class
// =====================================================

const PART_SIZE = 10 * 1024 * 1024; // 10MB
const CONCURRENCY = 2; // Upload 2 parts at a time

interface UploadTask {
  file: File;
  folderId?: string;
  onProgress?: (progress: UploadProgress) => void;
  abortController: AbortController;
}

export class FileUploadManager {
  private projectId: string;
  private apiBaseUrl: string;

  constructor(projectId: string) {
    this.projectId = projectId;
    this.apiBaseUrl = import.meta.env.VITE_API_URL || '';
  }

  private async getAuthHeader(): Promise<string> {
    // Get token from localStorage (matching api.ts pattern)
    const token = localStorage.getItem('access_token');
    return token ? `Bearer ${token}` : '';
  }

  async uploadFile(
    file: File,
    folderId?: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ success: boolean; fileId?: string; error?: string }> {
    const abortController = new AbortController();
    let fileId: string | undefined;

    const updateProgress = (status: UploadProgress['status'], progress: number, uploadedBytes: number, error?: string) => {
      if (onProgress) {
        onProgress({
          fileId: fileId || '',
          fileName: file.name,
          progress,
          status,
          uploadedBytes,
          totalBytes: file.size,
          error,
        });
      }
    };

    try {
      updateProgress('pending', 0, 0);

      // Initiate upload
      const authHeader = await this.getAuthHeader();
      const initResponse = await fetch(
        `${this.apiBaseUrl}/api/v1/backlot/projects/${this.projectId}/files/uploads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({
            folder_id: folderId,
            original_name: file.name,
            mime_type: file.type || 'application/octet-stream',
            size_bytes: file.size,
          }),
          signal: abortController.signal,
        }
      );

      if (!initResponse.ok) {
        const error = await initResponse.text();
        throw new Error(`Failed to initiate upload: ${error}`);
      }

      const initData: UploadInitResponse = await initResponse.json();
      fileId = initData.file_id;

      updateProgress('uploading', 0, 0);

      if (initData.upload_type === 'single') {
        // Single PUT upload
        await this.uploadSingle(file, initData.url!, fileId, updateProgress, abortController);
      } else {
        // Multipart upload
        await this.uploadMultipart(file, initData, fileId, updateProgress, abortController);
      }

      updateProgress('complete', 100, file.size);
      return { success: true, fileId };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        updateProgress('cancelled', 0, 0);
        return { success: false, error: 'Upload cancelled' };
      }
      updateProgress('failed', 0, 0, error.message);
      return { success: false, error: error.message };
    }
  }

  private async uploadSingle(
    file: File,
    url: string,
    fileId: string,
    updateProgress: (status: UploadProgress['status'], progress: number, uploadedBytes: number) => void,
    abortController: AbortController
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          updateProgress('uploading', percent, event.loaded);
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Finalize upload
          const authHeader = await this.getAuthHeader();
          await fetch(
            `${this.apiBaseUrl}/api/v1/backlot/projects/${this.projectId}/files/uploads/${fileId}/finalize`,
            {
              method: 'POST',
              headers: { 'Authorization': authHeader },
            }
          );
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.onabort = () => reject(new DOMException('Upload aborted', 'AbortError'));

      abortController.signal.addEventListener('abort', () => xhr.abort());

      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    });
  }

  private async uploadMultipart(
    file: File,
    initData: UploadInitResponse,
    fileId: string,
    updateProgress: (status: UploadProgress['status'], progress: number, uploadedBytes: number) => void,
    abortController: AbortController
  ): Promise<void> {
    const { upload_id, total_parts } = initData;
    if (!upload_id || !total_parts) throw new Error('Invalid multipart init data');

    const completedParts: { partNumber: number; etag: string }[] = [];
    let uploadedBytes = 0;

    // Upload parts with concurrency limit
    const partNumbers = Array.from({ length: total_parts }, (_, i) => i + 1);

    for (let i = 0; i < partNumbers.length; i += CONCURRENCY) {
      if (abortController.signal.aborted) {
        throw new DOMException('Upload aborted', 'AbortError');
      }

      const batch = partNumbers.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((partNumber) => this.uploadPart(file, fileId, upload_id, partNumber, abortController))
      );

      for (const result of results) {
        completedParts.push(result);
        uploadedBytes += this.getPartSize(file, result.partNumber);
        const percent = Math.round((uploadedBytes / file.size) * 100);
        updateProgress('uploading', percent, uploadedBytes);
      }
    }

    // Complete multipart upload
    const authHeader = await this.getAuthHeader();
    const completeResponse = await fetch(
      `${this.apiBaseUrl}/api/v1/backlot/projects/${this.projectId}/files/uploads/${fileId}/complete`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          upload_id,
          parts: completedParts,
        }),
        signal: abortController.signal,
      }
    );

    if (!completeResponse.ok) {
      throw new Error('Failed to complete multipart upload');
    }
  }

  private async uploadPart(
    file: File,
    fileId: string,
    uploadId: string,
    partNumber: number,
    abortController: AbortController
  ): Promise<{ partNumber: number; etag: string }> {
    // Get presigned URL for this part
    const authHeader = await this.getAuthHeader();
    const urlResponse = await fetch(
      `${this.apiBaseUrl}/api/v1/backlot/projects/${this.projectId}/files/uploads/${fileId}/part-url`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          upload_id: uploadId,
          part_number: partNumber,
        }),
        signal: abortController.signal,
      }
    );

    if (!urlResponse.ok) {
      throw new Error(`Failed to get URL for part ${partNumber}`);
    }

    const { url } = await urlResponse.json();

    // Calculate part boundaries
    const start = (partNumber - 1) * PART_SIZE;
    const end = Math.min(start + PART_SIZE, file.size);
    const blob = file.slice(start, end);

    // Upload part
    const response = await fetch(url, {
      method: 'PUT',
      body: blob,
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload part ${partNumber}`);
    }

    const etag = response.headers.get('ETag') || '';
    return { partNumber, etag: etag.replace(/"/g, '') };
  }

  private getPartSize(file: File, partNumber: number): number {
    const start = (partNumber - 1) * PART_SIZE;
    const end = Math.min(start + PART_SIZE, file.size);
    return end - start;
  }
}

// =====================================================
// Utility Functions
// =====================================================

export function getFileIcon(mimeType: string | null, extension: string | null): string {
  if (!mimeType) return 'file';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'doc';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  return 'file';
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function getFileTypeFilter(mimeType: string | null): string {
  if (!mimeType) return 'other';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('word') ||
      mimeType.includes('text/') || mimeType.includes('spreadsheet') || mimeType.includes('presentation')) {
    return 'document';
  }
  return 'other';
}

// =====================================================
// Constants
// =====================================================

export const FILE_TYPE_FILTERS = [
  { value: '', label: 'All Files' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
  { value: 'audio', label: 'Audio' },
  { value: 'document', label: 'Documents' },
  { value: 'other', label: 'Other' },
] as const;

export const LINK_TARGET_TYPES = [
  { value: 'PROJECT', label: 'Project' },
  { value: 'EPISODE', label: 'Episode' },
  { value: 'STORY', label: 'Story' },
  { value: 'STORYBOARD', label: 'Storyboard' },
  { value: 'SIDES_PACKET', label: 'Sides Packet' },
  { value: 'STRIP', label: 'Strip' },
  { value: 'PROJECT_DAY', label: 'Production Day' },
  { value: 'OTHER', label: 'Other' },
] as const;

// =====================================================
// Unified Files (All Files across tools)
// =====================================================

export type UnifiedFileSource =
  | 'project_files'
  | 'scripts'
  | 'receipts'
  | 'clearances'
  | 'dailies'
  | 'review_versions'
  | 'standalone_assets'
  | 'continuity_exports'
  | 'moodboards'
  | 'storyboards';

export interface UnifiedFile {
  id: string;
  name: string;
  source: UnifiedFileSource;
  source_label: string;
  file_url: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
  source_entity_id: string;
}

export interface UnifiedFilesFilters {
  source?: UnifiedFileSource;
  search?: string;
  file_type?: string;
  limit?: number;
  offset?: number;
}

export const UNIFIED_SOURCE_FILTERS = [
  { value: '', label: 'All Sources' },
  { value: 'project_files', label: 'Project Files' },
  { value: 'scripts', label: 'Scripts' },
  { value: 'receipts', label: 'Receipts' },
  { value: 'clearances', label: 'Clearances' },
  { value: 'dailies', label: 'Dailies' },
  { value: 'review_versions', label: 'Review' },
  { value: 'standalone_assets', label: 'Assets' },
  // continuity_exports merged into 'scripts' on backend
  { value: 'moodboards', label: 'Moodboards' },
  { value: 'storyboards', label: 'Storyboards' },
] as const;

export const SOURCE_COLORS: Record<string, string> = {
  project_files: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  scripts: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  receipts: 'bg-green-500/20 text-green-400 border-green-500/30',
  clearances: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  dailies: 'bg-red-500/20 text-red-400 border-red-500/30',
  review_versions: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  standalone_assets: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  continuity_exports: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  moodboards: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  storyboards: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
};

const unifiedFilesKeys = {
  all: ['unified-files'] as const,
  list: (projectId: string, filters: UnifiedFilesFilters) =>
    [...unifiedFilesKeys.all, projectId, filters.source, filters.search, filters.file_type, filters.limit, filters.offset] as const,
};

export function useUnifiedFiles(projectId: string | null, filters: UnifiedFilesFilters = {}) {
  const { source, search, file_type, limit = 200, offset = 0 } = filters;

  return useQuery({
    queryKey: unifiedFilesKeys.list(projectId || '', { source, search, file_type, limit, offset }),
    queryFn: async (): Promise<{ files: UnifiedFile[]; total: number; limit: number; offset: number }> => {
      if (!projectId) throw new Error('Project ID required');
      const params = new URLSearchParams();
      if (source) params.append('source', source);
      if (search) params.append('search', search);
      if (file_type) params.append('file_type', file_type);
      params.append('limit', String(limit));
      params.append('offset', String(offset));
      const query = params.toString();
      return api.get(`/api/v1/backlot/projects/${projectId}/files/all?${query}`);
    },
    enabled: !!projectId,
    staleTime: 30000,
  });
}

export function useUnifiedFileDownload(projectId: string | null) {
  return useMutation({
    mutationFn: async ({ source, sourceEntityId }: { source: string; sourceEntityId: string }): Promise<{ download_url: string; filename: string }> => {
      if (!projectId) throw new Error('Project ID required');
      return api.get(`/api/v1/backlot/projects/${projectId}/files/all/${source}/${sourceEntityId}/download`);
    },
  });
}
