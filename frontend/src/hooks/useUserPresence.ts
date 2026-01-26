/**
 * useUserPresence - Track online status of users via WebSocket
 * Listens to user_presence_changed events and maintains online status
 */
import { useEffect, useState, useCallback } from 'react';
import { useSocket } from './useSocket';
import type { SocketEvents } from '@/context/socketContextDef';

type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

interface UseUserPresenceOptions {
  userId?: string;
}

interface UseUserPresenceReturn {
  status: PresenceStatus;
  isOnline: boolean;
}

// Global presence cache shared across hook instances
const presenceCache = new Map<string, PresenceStatus>();

export function useUserPresence({ userId }: UseUserPresenceOptions): UseUserPresenceReturn {
  const { isConnected, on, off } = useSocket();
  const [status, setStatus] = useState<PresenceStatus>(
    userId ? (presenceCache.get(userId) || 'offline') : 'offline'
  );

  // Listen for presence changes
  useEffect(() => {
    if (!isConnected || !userId || !on || !off) return;

    const handlePresenceChanged: SocketEvents['user_presence_changed'] = (data) => {
      if (data.user_id !== userId) return;

      const newStatus = data.status as PresenceStatus;
      presenceCache.set(userId, newStatus);
      setStatus(newStatus);
    };

    on('user_presence_changed', handlePresenceChanged);
    return () => off('user_presence_changed', handlePresenceChanged);
  }, [userId, isConnected, on, off]);

  // Update local state if cache changes (e.g., from another component)
  useEffect(() => {
    if (userId && presenceCache.has(userId)) {
      setStatus(presenceCache.get(userId)!);
    }
  }, [userId]);

  return {
    status,
    isOnline: status === 'online' || status === 'busy',
  };
}

/**
 * Hook to track multiple users' presence at once
 */
export function useUsersPresence(userIds: string[]): Map<string, PresenceStatus> {
  const { isConnected, on, off } = useSocket();
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceStatus>>(() => {
    const initial = new Map<string, PresenceStatus>();
    userIds.forEach(id => {
      initial.set(id, presenceCache.get(id) || 'offline');
    });
    return initial;
  });

  useEffect(() => {
    if (!isConnected || !on || !off) return;

    const handlePresenceChanged: SocketEvents['user_presence_changed'] = (data) => {
      if (!userIds.includes(data.user_id)) return;

      const newStatus = data.status as PresenceStatus;
      presenceCache.set(data.user_id, newStatus);
      setPresenceMap(prev => {
        const next = new Map(prev);
        next.set(data.user_id, newStatus);
        return next;
      });
    };

    on('user_presence_changed', handlePresenceChanged);
    return () => off('user_presence_changed', handlePresenceChanged);
  }, [userIds, isConnected, on, off]);

  return presenceMap;
}
