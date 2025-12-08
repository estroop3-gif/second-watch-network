/**
 * PlaceholderPlayerAdapter - HTML5 video player implementation
 *
 * This is a placeholder adapter that uses the native HTML5 video element.
 * It implements the ReviewPlayerAdapter interface and can be swapped
 * with a Vimeo adapter when the SDK integration is ready.
 */

import { ReviewPlayerAdapter } from '@/types/backlot';

export class PlaceholderPlayerAdapter implements ReviewPlayerAdapter {
  private video: HTMLVideoElement | null = null;
  private container: HTMLElement | null = null;

  // Callback storage
  private timeUpdateCallbacks: ((currentTime: number) => void)[] = [];
  private playCallbacks: (() => void)[] = [];
  private pauseCallbacks: (() => void)[] = [];
  private seekedCallbacks: ((currentTime: number) => void)[] = [];
  private durationChangeCallbacks: ((duration: number) => void)[] = [];
  private endedCallbacks: (() => void)[] = [];

  async initialize(container: HTMLElement, videoUrl: string): Promise<void> {
    this.container = container;

    // Create video element
    this.video = document.createElement('video');
    this.video.src = videoUrl;
    this.video.controls = false; // We'll provide custom controls
    this.video.preload = 'metadata';
    this.video.style.width = '100%';
    this.video.style.height = '100%';
    this.video.style.objectFit = 'contain';
    this.video.style.backgroundColor = '#000';

    // Add event listeners
    this.video.addEventListener('timeupdate', this.handleTimeUpdate);
    this.video.addEventListener('play', this.handlePlay);
    this.video.addEventListener('pause', this.handlePause);
    this.video.addEventListener('seeked', this.handleSeeked);
    this.video.addEventListener('durationchange', this.handleDurationChange);
    this.video.addEventListener('ended', this.handleEnded);

    // Append to container
    container.innerHTML = '';
    container.appendChild(this.video);

    // Wait for metadata to load
    return new Promise((resolve, reject) => {
      if (!this.video) {
        reject(new Error('Video element not created'));
        return;
      }

      const handleLoadedMetadata = () => {
        this.video?.removeEventListener('loadedmetadata', handleLoadedMetadata);
        resolve();
      };

      const handleError = () => {
        this.video?.removeEventListener('error', handleError);
        reject(new Error('Failed to load video'));
      };

      // Check if already loaded
      if (this.video.readyState >= 1) {
        resolve();
      } else {
        this.video.addEventListener('loadedmetadata', handleLoadedMetadata);
        this.video.addEventListener('error', handleError);
      }
    });
  }

  destroy(): void {
    if (this.video) {
      this.video.removeEventListener('timeupdate', this.handleTimeUpdate);
      this.video.removeEventListener('play', this.handlePlay);
      this.video.removeEventListener('pause', this.handlePause);
      this.video.removeEventListener('seeked', this.handleSeeked);
      this.video.removeEventListener('durationchange', this.handleDurationChange);
      this.video.removeEventListener('ended', this.handleEnded);

      this.video.pause();
      this.video.src = '';
      this.video.remove();
      this.video = null;
    }

    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }

    // Clear callbacks
    this.timeUpdateCallbacks = [];
    this.playCallbacks = [];
    this.pauseCallbacks = [];
    this.seekedCallbacks = [];
    this.durationChangeCallbacks = [];
    this.endedCallbacks = [];
  }

  play(): void {
    this.video?.play();
  }

  pause(): void {
    this.video?.pause();
  }

  seekTo(seconds: number): void {
    if (this.video) {
      this.video.currentTime = Math.max(0, Math.min(seconds, this.getDuration()));
    }
  }

  getCurrentTime(): number {
    return this.video?.currentTime ?? 0;
  }

  getDuration(): number {
    return this.video?.duration ?? 0;
  }

  isPaused(): boolean {
    return this.video?.paused ?? true;
  }

  onTimeUpdate(callback: (currentTime: number) => void): void {
    this.timeUpdateCallbacks.push(callback);
  }

  onPlay(callback: () => void): void {
    this.playCallbacks.push(callback);
  }

  onPause(callback: () => void): void {
    this.pauseCallbacks.push(callback);
  }

  onSeeked(callback: (currentTime: number) => void): void {
    this.seekedCallbacks.push(callback);
  }

  onDurationChange(callback: (duration: number) => void): void {
    this.durationChangeCallbacks.push(callback);
  }

  onEnded(callback: () => void): void {
    this.endedCallbacks.push(callback);
  }

  // Event handlers
  private handleTimeUpdate = () => {
    const currentTime = this.getCurrentTime();
    this.timeUpdateCallbacks.forEach(cb => cb(currentTime));
  };

  private handlePlay = () => {
    this.playCallbacks.forEach(cb => cb());
  };

  private handlePause = () => {
    this.pauseCallbacks.forEach(cb => cb());
  };

  private handleSeeked = () => {
    const currentTime = this.getCurrentTime();
    this.seekedCallbacks.forEach(cb => cb(currentTime));
  };

  private handleDurationChange = () => {
    const duration = this.getDuration();
    this.durationChangeCallbacks.forEach(cb => cb(duration));
  };

  private handleEnded = () => {
    this.endedCallbacks.forEach(cb => cb());
  };

  // Additional methods for the placeholder player
  getVideoElement(): HTMLVideoElement | null {
    return this.video;
  }

  setVolume(volume: number): void {
    if (this.video) {
      this.video.volume = Math.max(0, Math.min(1, volume));
    }
  }

  getVolume(): number {
    return this.video?.volume ?? 1;
  }

  setMuted(muted: boolean): void {
    if (this.video) {
      this.video.muted = muted;
    }
  }

  isMuted(): boolean {
    return this.video?.muted ?? false;
  }

  setPlaybackRate(rate: number): void {
    if (this.video) {
      this.video.playbackRate = rate;
    }
  }

  getPlaybackRate(): number {
    return this.video?.playbackRate ?? 1;
  }
}

export default PlaceholderPlayerAdapter;
