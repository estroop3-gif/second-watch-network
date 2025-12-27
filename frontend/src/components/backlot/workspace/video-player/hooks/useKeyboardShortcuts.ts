/**
 * useKeyboardShortcuts - Centralized keyboard shortcut handling for video player
 */
import { useEffect, useCallback } from 'react';
import { useVideoPlayer } from '../VideoPlayerContext';

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  onAddNote?: () => void;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { enabled = true, onAddNote } = options;
  const { state, actions } = useVideoPlayer();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't handle if typing in an input or textarea
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    // Don't handle if modifier keys are pressed (except Shift for some shortcuts)
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const key = event.code;
    const isShiftPressed = event.shiftKey;

    switch (key) {
      // Play/Pause
      case 'Space':
      case 'KeyK':
        event.preventDefault();
        if (key === 'KeyK' && state.shuttleSpeed !== 0) {
          // K in shuttle mode resets shuttle
          actions.jklShuttle('k');
        } else {
          actions.togglePlayPause();
        }
        break;

      // Seek
      case 'ArrowLeft':
        event.preventDefault();
        if (state.isPlaying) {
          // Seek backward 5 seconds
          actions.seekRelative(-5);
        } else if (isShiftPressed) {
          // Step 10 frames backward
          actions.stepFrames(-10);
        } else {
          // Step 1 frame backward
          actions.stepFrame(-1);
        }
        break;

      case 'ArrowRight':
        event.preventDefault();
        if (state.isPlaying) {
          // Seek forward 5 seconds
          actions.seekRelative(5);
        } else if (isShiftPressed) {
          // Step 10 frames forward
          actions.stepFrames(10);
        } else {
          // Step 1 frame forward
          actions.stepFrame(1);
        }
        break;

      // JKL Shuttle
      case 'KeyJ':
        event.preventDefault();
        actions.jklShuttle('j');
        break;

      case 'KeyL':
        event.preventDefault();
        actions.jklShuttle('l');
        break;

      // Fullscreen
      case 'KeyF':
        event.preventDefault();
        actions.toggleFullscreen();
        break;

      // Mute
      case 'KeyM':
        event.preventDefault();
        actions.toggleMute();
        break;

      // In/Out points
      case 'KeyI':
        event.preventDefault();
        actions.setInPoint();
        break;

      case 'KeyO':
        event.preventDefault();
        actions.setOutPoint();
        break;

      // Clear in/out points
      case 'Backslash':
        event.preventDefault();
        actions.clearInOutPoints();
        break;

      // Loop
      case 'KeyR':
        event.preventDefault();
        actions.toggleLoop();
        break;

      // Shortcut overlay
      case 'Slash':
        if (isShiftPressed) {
          // ? key (Shift + /)
          event.preventDefault();
          actions.setShowShortcutOverlay(!state.showShortcutOverlay);
        }
        break;

      // Escape
      case 'Escape':
        event.preventDefault();
        if (state.showShortcutOverlay) {
          actions.setShowShortcutOverlay(false);
        } else if (state.isFullscreen) {
          actions.toggleFullscreen();
        }
        break;

      // Add note (N key)
      case 'KeyN':
        if (onAddNote) {
          event.preventDefault();
          onAddNote();
        }
        break;

      // Playback speed shortcuts (0-9 for quick speed)
      case 'Digit1':
        event.preventDefault();
        actions.setPlaybackRate(1);
        break;
      case 'Digit2':
        event.preventDefault();
        actions.setPlaybackRate(2);
        break;

      default:
        break;
    }
  }, [state, actions, onAddNote]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  return {
    shortcuts: SHORTCUTS,
  };
}

// Shortcut reference for the overlay
export const SHORTCUTS = [
  { key: 'Space / K', action: 'Play/Pause' },
  { key: '← / →', action: 'Seek ±5 seconds' },
  { key: '← / → (paused)', action: 'Step ±1 frame' },
  { key: 'Shift + ← / →', action: 'Step ±10 frames' },
  { key: 'J', action: 'Shuttle rewind (2x→4x→8x)' },
  { key: 'L', action: 'Shuttle forward (2x→4x→8x)' },
  { key: 'F', action: 'Toggle fullscreen' },
  { key: 'M', action: 'Toggle mute' },
  { key: 'I', action: 'Set in point' },
  { key: 'O', action: 'Set out point' },
  { key: '\\', action: 'Clear in/out points' },
  { key: 'R', action: 'Toggle loop' },
  { key: '?', action: 'Show/hide shortcuts' },
  { key: 'Esc', action: 'Exit fullscreen / Close overlay' },
  { key: '1', action: 'Normal speed (1x)' },
  { key: '2', action: 'Double speed (2x)' },
];

export default useKeyboardShortcuts;
