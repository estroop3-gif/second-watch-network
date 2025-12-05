import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface DashboardCardProps {
  imageUrl: string;
  title: string;
  creator?: string;
  stamp?: 'zine-pick' | 'coming-soon';
  tagline?: string;
  linkTo?: string;
}

const cardVariants = {
  hidden: { y: 20, opacity: 0, rotate: -5 },
  show: { y: 0, opacity: 1, rotate: 0, transition: { type: 'spring', stiffness: 100 } },
};

export const DashboardCard = ({ imageUrl, title, creator, stamp, tagline, linkTo = '#' }: DashboardCardProps) => {
  const Stamp = () => {
    if (!stamp) return null;
    if (stamp === 'coming-soon') {
      return (
        <div className="absolute top-4 -right-4 bg-accent-yellow text-charcoal-black px-4 py-1 transform rotate-6 z-10">
          <span className="font-spray text-lg">Coming Soon</span>
        </div>
      );
    }
    // Note: This assumes an image exists at this path.
    if (stamp === 'zine-pick') {
      return (
        <div className="absolute -top-4 -left-4 w-20 h-20 bg-contain bg-no-repeat z-10" style={{ backgroundImage: "url('/images/zine-pick-stamp.png')" }} />
      );
    }
    return null;
  };

  return (
    <motion.div variants={cardVariants}>
      <Link to={linkTo}>
        <motion.div
          className="relative group flex flex-col h-full"
          whileHover={{ y: -10, rotate: -3, scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <div className="relative bg-bone-white p-2 shadow-lg transform -rotate-2 group-hover:rotate-[-4deg] transition-transform">
            <div className="absolute -inset-1 bg-muted-gray/50 rotate-1 z-0" />
            <div className="relative aspect-video bg-charcoal-black">
              <img src={imageUrl} alt={title} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300" />
              <div className="absolute inset-0 bg-charcoal-black/20" />
            </div>
            <Stamp />
          </div>
          <div className="mt-4 text-left">
            <h4 className="font-heading text-xl uppercase text-bone-white">{title}</h4>
            {creator && <p className="text-sm font-sans normal-case text-muted-gray">by {creator}</p>}
            {tagline && <p className="text-sm font-typewriter normal-case text-accent-yellow mt-1">"{tagline}"</p>}
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
};