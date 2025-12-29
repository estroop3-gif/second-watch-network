import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface ShowPlaceholderProps {
  title: string;
  tagline: React.ReactNode;
  imageUrl: string;
  linkTo?: string;
}

const ShowPlaceholder = ({ title, tagline, imageUrl, linkTo }: ShowPlaceholderProps) => {
  const content = (
    <motion.div
      className="relative group h-full flex flex-col"
      whileHover={{ y: -10 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <div className="relative transform -rotate-3 group-hover:rotate-[-5deg] transition-transform duration-300">
        <div className="absolute -inset-2 bg-bone-white/10 rotate-1 z-0" />
        <div className="relative bg-bone-white p-2 shadow-lg">
          <img src={imageUrl} alt={`Placeholder for ${title}`} className="w-full h-auto object-cover aspect-[4/5] grayscale group-hover:grayscale-0 transition-all duration-300" />
          <div className="absolute inset-0 bg-charcoal-black/20" />
        </div>
        <div className="absolute top-4 -right-4 bg-accent-yellow text-charcoal-black px-4 py-1 transform rotate-6">
          <span className="font-spray text-lg">Coming Soon</span>
        </div>
      </div>
      <div className="mt-6 text-center flex-grow flex flex-col justify-center">
        <h3 className="text-2xl font-heading uppercase">{title}</h3>
        <p className="text-muted-gray font-typewriter normal-case text-sm mt-1">"{tagline}"</p>
      </div>
    </motion.div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="h-full block">
        {content}
      </Link>
    );
  }

  return content;
};

export default ShowPlaceholder;