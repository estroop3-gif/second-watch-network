/**
 * useDesktopHelper - Hook for connecting to the SWN Desktop Helper app
 *
 * The desktop helper runs a local HTTP server on port 47284 that allows
 * the web UI to browse and stream files from local drives.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const HELPER_PORT = 47284;
const HELPER_URL = `http://localhost:${HELPER_PORT}`;
const POLL_INTERVAL = 5000; // 5 seconds

export interface HelperStatus {
  connected: boolean;
  version?: string;
  platform?: string;
  projectId?: string;
}

export interface LocalDrive {
  name: string;
  path: string;
  type: 'removable' | 'fixed' | 'network';
  freeSpace?: number;
  totalSpace?: number;
}

export interface LocalFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: string;
  isVideo?: boolean;
  isImage?: boolean;
  relativePath?: string;
}

export interface LinkedDrive {
  name: string;
  path: string;
  available: boolean;
  freeBytes?: number;
  totalBytes?: number;
  usedBytes?: number;
}

/**
 * Hook for connecting to and interacting with the desktop helper app
 */
export function useDesktopHelper() {
  const [status, setStatus] = useState<HelperStatus>({ connected: false });
  const [isChecking, setIsChecking] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Check helper connection status
  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      const response = await fetch(`${HELPER_URL}/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        setStatus({
          connected: true,
          version: data.version,
          platform: data.platform,
          projectId: data.projectId,
        });
      } else {
        setStatus({ connected: false });
      }
    } catch {
      setStatus({ connected: false });
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Start polling for connection
  useEffect(() => {
    // Initial check
    checkConnection();

    // Poll every 5 seconds
    pollRef.current = setInterval(checkConnection, POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [checkConnection]);

  // List available drives
  const listDrives = useCallback(async (): Promise<LocalDrive[]> => {
    if (!status.connected) return [];

    try {
      const response = await fetch(`${HELPER_URL}/drives`);
      if (response.ok) {
        const data = await response.json();
        return data.drives || [];
      }
    } catch (error) {
      console.error('Failed to list drives:', error);
    }
    return [];
  }, [status.connected]);

  // Browse a directory
  const browseDirectory = useCallback(async (path: string): Promise<LocalFile[]> => {
    if (!status.connected) return [];

    try {
      const response = await fetch(`${HELPER_URL}/browse?path=${encodeURIComponent(path)}`);
      if (response.ok) {
        const data = await response.json();
        return data.files || [];
      }
    } catch (error) {
      console.error('Failed to browse directory:', error);
    }
    return [];
  }, [status.connected]);

  // Get streaming URL for a local file
  const getStreamUrl = useCallback((path: string): string => {
    return `${HELPER_URL}/file?path=${encodeURIComponent(path)}`;
  }, []);

  // Get thumbnail URL for a video file
  const getThumbnailUrl = useCallback((path: string): string => {
    return `${HELPER_URL}/thumbnail?path=${encodeURIComponent(path)}`;
  }, []);

  // Request checksum calculation for a file
  const calculateChecksum = useCallback(async (path: string): Promise<string | null> => {
    if (!status.connected) return null;

    try {
      const response = await fetch(`${HELPER_URL}/checksum?path=${encodeURIComponent(path)}`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        return data.checksum;
      }
    } catch (error) {
      console.error('Failed to calculate checksum:', error);
    }
    return null;
  }, [status.connected]);

  // List linked drives
  const listLinkedDrives = useCallback(async (): Promise<LinkedDrive[]> => {
    if (!status.connected) return [];

    try {
      const response = await fetch(`${HELPER_URL}/linked-drives`);
      if (response.ok) {
        const data = await response.json();
        return data.drives || [];
      }
    } catch (error) {
      console.error('Failed to list linked drives:', error);
    }
    return [];
  }, [status.connected]);

  // Browse a linked drive
  const browseLinkedDrive = useCallback(async (driveName: string, path: string = ''): Promise<LocalFile[]> => {
    if (!status.connected) return [];

    try {
      const url = path
        ? `${HELPER_URL}/linked-drives/${encodeURIComponent(driveName)}/browse?path=${encodeURIComponent(path)}`
        : `${HELPER_URL}/linked-drives/${encodeURIComponent(driveName)}/browse`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return data.files || [];
      }
    } catch (error) {
      console.error('Failed to browse linked drive:', error);
    }
    return [];
  }, [status.connected]);

  // Get streaming URL for a file on a linked drive
  const getLinkedDriveStreamUrl = useCallback((driveName: string, relativePath: string): string => {
    return `${HELPER_URL}/linked-drives/${encodeURIComponent(driveName)}/file?path=${encodeURIComponent(relativePath)}`;
  }, []);

  return {
    status,
    isChecking,
    isConnected: status.connected,
    checkConnection,
    listDrives,
    browseDirectory,
    getStreamUrl,
    getThumbnailUrl,
    calculateChecksum,
    // Linked drives
    listLinkedDrives,
    browseLinkedDrive,
    getLinkedDriveStreamUrl,
  };
}

// =====================================================
// Desktop API Key Management
// =====================================================

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface DesktopApiKey {
  id: string;
  project_id: string;
  user_id: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  is_revoked: boolean;
  created_at: string;
}

export interface CreateApiKeyResponse {
  success: boolean;
  api_key: string;  // Full key - only shown once!
  key_id: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  expires_at: string | null;
  message: string;
}

/**
 * Hook for managing desktop API keys for a project
 */
export function useDesktopApiKeys(projectId: string | null) {
  const queryClient = useQueryClient();

  // List API keys
  const query = useQuery({
    queryKey: ['backlot', 'desktop-keys', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/desktop-keys`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch API keys' }));
        throw new Error(typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail));
      }

      const data = await response.json();
      return (data.keys || []) as DesktopApiKey[];
    },
    enabled: !!projectId,
  });

  // Create API key
  const createKey = useMutation({
    mutationFn: async (input: { name?: string; expires_in_days?: number }): Promise<CreateApiKeyResponse> => {
      if (!projectId) throw new Error('Project ID required');

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/desktop-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: input.name || 'Desktop App',
          scopes: ['dailies:write', 'dailies:read'],
          expires_in_days: input.expires_in_days,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create API key' }));
        throw new Error(typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail));
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'desktop-keys', projectId] });
    },
  });

  // Revoke API key
  const revokeKey = useMutation({
    mutationFn: async (keyId: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/desktop-keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to revoke API key' }));
        throw new Error(typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail));
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'desktop-keys', projectId] });
    },
  });

  return {
    keys: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    createKey,
    revokeKey,
  };
}
