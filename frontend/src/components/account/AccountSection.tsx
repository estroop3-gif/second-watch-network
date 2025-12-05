import React from 'react';
import { motion } from 'framer-motion';

interface AccountSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const AccountSection = ({ title, children, className }: AccountSectionProps) => {
  return (
    <div className={`py-8 md:py-12 border-b-2 border-dashed border-muted-gray last:border-b-0 ${className}`}>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl md:text-4xl font-heading tracking-tighter mb-8 -rotate-1 inline-block">
          {title}
        </h2>
      </motion.div>
      <div className="relative">{children}</div>
    </div>
  );
};