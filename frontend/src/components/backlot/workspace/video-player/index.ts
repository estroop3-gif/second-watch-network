/**
 * Video Player Components
 * Professional video player with Frame.io-style features
 */

// Main component
export { default as VideoPlayer } from './VideoPlayer';

// Context
export {
  VideoPlayerProvider,
  useVideoPlayer,
  type VideoPlayerState,
  type VideoPlayerActions,
} from './VideoPlayerContext';

// Sub-components
export { default as VideoControls } from './VideoControls';
export { default as PlaybackControls } from './PlaybackControls';
export { default as VolumeControl } from './VolumeControl';
export { default as TimecodeDisplay } from './TimecodeDisplay';
export { default as TimelineControl } from './TimelineControl';
export { default as FullscreenButton } from './FullscreenButton';
export { default as ShortcutOverlay } from './ShortcutOverlay';

// Hooks
export { useKeyboardShortcuts, SHORTCUTS } from './hooks/useKeyboardShortcuts';
