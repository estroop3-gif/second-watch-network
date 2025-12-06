import React, { useEffect, useRef } from 'react';

// This tells TypeScript that Plyr is available on the window object
declare const Plyr: any;

const CoastalTorque = () => {
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof Plyr !== 'undefined') {
      const player = new Plyr('#sizzle-player', {
        controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
        hideControls: false,
        youtube: {
          rel: 0,
          showinfo: 0,
        },
      });
      playerRef.current = player;
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, []);

  const videoId = 'Sp1pf_KV6NE';
  const videoSrc = `https://www.youtube.com/embed/${videoId}?origin=${window.location.origin}&rel=0&showinfo=0&iv_load_policy=3&modestbranding=1`;

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Title and Subheading */}
      <div className="text-center mb-16">
        <h1 className="text-5xl md:text-7xl font-heading tracking-tighter mb-4 -rotate-1">
          Coastal Torque
        </h1>
        <p className="max-w-2xl mx-auto text-muted-gray font-sans normal-case text-xl">
          Inside Sarasota’s underground car culture — where torque meets storytelling.
        </p>
      </div>

      {/* Hero Section Placeholder */}
      <div className="mb-20 p-4 bg-bone-white border-4 border-charcoal-black shadow-lg transform -rotate-2">
        <div className="flex items-center justify-center h-64 md:h-96 bg-charcoal-black border-2 border-muted-gray">
          <span className="font-spray text-6xl md:text-9xl text-accent-yellow transform rotate-[-5deg]">
            COMING SOON
          </span>
        </div>
      </div>
      
      <hr className="border-dashed border-muted-gray my-20" />

      <div className="grid md:grid-cols-2 gap-16 items-start">
        {/* Additional Content Section */}
        <div className="text-center md:text-left">
          <h2 className="text-4xl font-heading mb-6 -rotate-2">What’s Coming</h2>
          <p className="text-muted-gray font-sans normal-case leading-relaxed text-lg">
            Full builds, driver profiles, local races, and deep dives into what makes Sarasota’s scene one of the rawest in Florida.
          </p>
        </div>

        {/* Sizzle Reel Section */}
        <div>
          <h2 className="text-4xl font-heading mb-6 text-center md:text-left -rotate-2">Watch the Sizzle</h2>
          <div className="w-full aspect-video bg-black border-2 border-muted-gray p-2">
            <div id="sizzle-player" className="plyr__video-embed">
              <iframe
                src={videoSrc}
                allowFullScreen
                // @ts-expect-error allowtransparency is a valid HTML attribute
                allowtransparency="true"
                allow="autoplay"
              ></iframe>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default CoastalTorque;