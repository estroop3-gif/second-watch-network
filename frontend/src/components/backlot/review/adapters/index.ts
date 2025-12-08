/**
 * Review Player Adapters
 *
 * Factory for creating video player adapters based on provider type.
 * Currently only supports the placeholder (HTML5) adapter.
 * When Vimeo integration is ready, add VimeoPlayerAdapter here.
 */

import { ReviewPlayerAdapter, VideoProvider } from '@/types/backlot';
import { PlaceholderPlayerAdapter } from './PlaceholderPlayerAdapter';

export { PlaceholderPlayerAdapter };

/**
 * Create a player adapter for the given video provider
 */
export function createPlayerAdapter(provider: VideoProvider): ReviewPlayerAdapter {
  switch (provider) {
    case 'vimeo':
      // TODO: When Vimeo SDK is integrated, create VimeoPlayerAdapter
      console.warn('Vimeo adapter not yet implemented, using placeholder');
      return new PlaceholderPlayerAdapter();

    case 'youtube':
      // TODO: When YouTube integration is needed, create YouTubePlayerAdapter
      console.warn('YouTube adapter not yet implemented, using placeholder');
      return new PlaceholderPlayerAdapter();

    case 'placeholder':
    default:
      return new PlaceholderPlayerAdapter();
  }
}

export default createPlayerAdapter;
