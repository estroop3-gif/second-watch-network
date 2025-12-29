import React, { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';

// This tells TypeScript that Plyr is available on the window object
declare const Plyr: any;

const DashboardFree = () => {
  const playerRef = useRef<any>(null);

  useEffect(() => {
    // Ensure Plyr is loaded
    if (typeof Plyr !== 'undefined') {
      const player = new Plyr('#player', {
        autoplay: true,
        controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
        hideControls: false,
        youtube: {
          rel: 0,
          showinfo: 0,
        },
      });
      playerRef.current = player;
    }

    // Cleanup on component unmount
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  const videoId = 'jfKfPfyJRdk';
  // Use window.location.origin for the domain to work on localhost and production
  const videoSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&origin=${window.location.origin}&rel=0&showinfo=0&iv_load_policy=3&modestbranding=1`;

  return (
    <div className="bg-charcoal-black min-h-screen w-full">
      <main className="pt-24 md:pt-28 px-4 flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="w-full max-w-screen-2xl aspect-video relative">
           <div className="absolute top-4 right-4 z-10">
            <Badge variant="free">Free Tier</Badge>
          </div>
          <div id="player" className="plyr__video-embed">
            <iframe
              src={videoSrc}
              allowFullScreen
              // @ts-expect-error allowtransparency is a valid HTML attribute
              allowtransparency="true"
              allow="autoplay"
            ></iframe>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardFree;