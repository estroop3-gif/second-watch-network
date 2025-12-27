import React from 'react';
import { motion } from 'framer-motion';

interface DashboardSectionProps {
  title: string;
  children: React.ReactNode;
}

const sectionVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

export const DashboardSection = ({ title, children }: DashboardSectionProps) => {
  return (
    <section className="py-12 md:py-16">
      <motion.div
        initial={{ opacity: 0, x: -20, rotate: -2 }}
        whileInView={{ opacity: 1, x: 0, rotate: -2 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-4xl md:text-5xl font-heading tracking-tighter mb-8 inline-block bg-charcoal-black pr-4">
          {title}
        </h2>
      </motion.div>
      <motion.div 
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12"
        variants={sectionVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
      >
        {children}
      </motion.div>
    </section>
  );
};