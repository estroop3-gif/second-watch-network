/**
 * Socket hooks for accessing Socket.IO connection
 * Separated from SocketContext for Fast Refresh compatibility
 */
import { useContext } from 'react';
import { SocketContext } from '@/context/socketContextDef';

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

// Optional hook that returns null instead of throwing if not in provider
export function useSocketOptional() {
  return useContext(SocketContext);
}
