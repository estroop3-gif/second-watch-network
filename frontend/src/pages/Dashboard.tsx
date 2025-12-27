import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { motion } from 'framer-motion';

// This tells TypeScript that Plyr is available on the window object
declare const Plyr: any;

// Mock Data for UI
const continueWatchingData = [
  { imageUrl: '/images/serve-it-up.jpg', title: 'Serve It Up', creator: 'Second Watch Originals', linkTo: '/serve-it-up' },
  { imageUrl: '/images/coastal-torque.jpg', title: 'Coastal Torque', creator: 'Second Watch Originals', linkTo: '/coastal-torque' },
];

const savedForLaterData = [
  { imageUrl: '/images/failure-to-thrive.jpg', title: 'Failure to Thrive', creator: 'Second Watch Originals', linkTo: '/failure-to-thrive' },
  { imageUrl: '/images/serving-for-greece.jpg', title: 'Serving for Greece', creator: 'Second Watch Originals', linkTo: '/serving-for-greece' },
  { imageUrl: '/images/cued-up.png', title: "Cue'd Up", creator: 'Second Watch Originals', linkTo: '/cued-up' },
];

const comingSoonData = [
  { imageUrl: '/images/the-unseen.png', title: 'The Unseen', creator: 'Second Watch Originals', stamp: 'coming-soon' as const },
];

const featuredArtistsData = [
    { imageUrl: '/images/filmmaker-at-work.jpeg', title: 'The Last Frame', creator: 'Jane Doe' },
    { imageUrl: 'https://images.unsplash.com/photo-1528892952291-009c663ce843?w=500&auto=format&fit=crop', title: 'City Rhythms', creator: 'Alex Smith' },
];

const zinePicksData = [
  { imageUrl: 'https://images.unsplash.com/photo-1505628346881-b72b27e84530?w=500&auto=format&fit=crop', title: 'Stray Signals', creator: 'Anonymous', stamp: 'zine-pick' as const },
  { imageUrl: 'https://images.unsplash.com/photo-1517976487-976359A85225?w=500&auto=format&fit=crop', title: 'Midnight Diner', creator: 'The Collective', stamp: 'zine-pick' as const },
];

const undiscoveredHeatData = [
  { imageUrl: 'https://images.unsplash.com/photo-1542729249-598342b81772?w=500&auto=format&fit=crop', title: 'Concrete Bloom', creator: 'User_404', tagline: "Nobody's watching — and that’s a mistake." },
  { imageUrl: 'https://images.unsplash.com/photo-1531306754768-356e288add53?w=500&auto=format&fit=crop', title: 'Static Dreams', creator: 'GlitchArt', tagline: "Nobody's watching — and that’s a mistake." },
];


const Dashboard = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!loading && !session) {
      navigate('/login');
    }
  }, [session, loading, navigate]);

  useEffect(() => {
    if (typeof Plyr !== 'undefined') {
      const player = new Plyr('#dashboard-player', {
        autoplay: true,
        controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
        hideControls: false,
      });
      playerRef.current = player;
    }
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, []);

  const videoId = 'jfKfPfyJRdk';
  const videoSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&origin=${window.location.origin}&rel=0&showinfo=0&iv_load_policy=3&modestbranding=1`;

  if (loading || !session) {
    return (
        <div className="bg-charcoal-black min-h-screen w-full flex items-center justify-center">
            <p className="text-accent-yellow font-spray text-2xl animate-pulse">Loading Your Space...</p>
        </div>
    );
  }

  const titleContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const titleItem = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 },
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div 
        className="text-center mb-16 md:mb-20"
        variants={titleContainer}
        initial="hidden"
        animate="show"
      >
        <motion.h1 variants={titleItem} className="text-4xl md:text-6xl font-heading tracking-tighter mb-4 -rotate-1">
          Your Space on <span className="font-spray">Second Watch</span>
        </motion.h1>
        <motion.p variants={titleItem} className="text-muted-gray font-sans normal-case text-lg">
          Built for rebels, creators, and story-finders.
        </motion.p>
      </motion.div>

      {/* Livestream Section */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-16"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="lg:col-span-3">
          <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }}>
            <div id="dashboard-player" className="plyr__video-embed aspect-video">
              <iframe
                src={videoSrc}
                allowFullScreen
                // @ts-expect-error allowtransparency is a valid HTML attribute
                allowtransparency="true"
                allow="autoplay"
              ></iframe>
            </div>
          </motion.div>
        </div>
        <div className="lg:col-span-2 flex items-center p-6 bg-charcoal-black border-2 border-dashed border-muted-gray transform -rotate-1">
          <p className="text-muted-gray font-sans normal-case leading-relaxed">
            Streaming 24/7 — real stories, raw voices, no algorithms. This is the heartbeat of Second Watch Network. Featuring a rotating lineup of independent films, original series, shorts, and music videos submitted by creators around the world.
          </p>
        </div>
      </motion.div>

      <hr className="border-dashed border-muted-gray my-8" />

      <DashboardSection title="Continue Watching">
        {continueWatchingData.map(item => <DashboardCard key={item.title} {...item} />)}
      </DashboardSection>

      <hr className="border-dashed border-muted-gray my-8" />

      <DashboardSection title="Saved For Later">
        {savedForLaterData.map(item => <DashboardCard key={item.title} {...item} />)}
      </DashboardSection>

      <hr className="border-dashed border-muted-gray my-8" />

      <DashboardSection title="Coming Soon">
        {comingSoonData.map(item => <DashboardCard key={item.title} {...item} />)}
      </DashboardSection>

      <hr className="border-dashed border-muted-gray my-8" />

      <DashboardSection title="Featured Artists">
        {featuredArtistsData.map(item => <DashboardCard key={item.title} {...item} />)}
      </DashboardSection>

      <hr className="border-dashed border-muted-gray my-8" />

      <DashboardSection title="Zine Picks">
        {zinePicksData.map(item => <DashboardCard key={item.title} {...item} />)}
      </DashboardSection>

      <hr className="border-dashed border-muted-gray my-8" />

      <DashboardSection title="Undiscovered Heat">
        {undiscoveredHeatData.map(item => <DashboardCard key={item.title} {...item} />)}
      </DashboardSection>

    </div>
  );
};

export default Dashboard;