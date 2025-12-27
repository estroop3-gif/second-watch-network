import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CommunityProfile } from '@/types';
import CommunityCard from './CommunityCard';

type Props = {
  items: CommunityProfile[];
};

const CommunityGrid: React.FC<Props> = ({ items }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
      <AnimatePresence initial={false}>
        {items.map((p) => (
          <motion.div
            key={p.profile_id}
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <CommunityCard profile={p} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default CommunityGrid;