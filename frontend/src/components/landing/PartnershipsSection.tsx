import React from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const PartnershipsSection = () => {
  return (
    <section id="partners" className="pt-20 pb-52 md:pb-68 bg-charcoal-black/95 scroll-mt-28">
      <div className="container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl md:text-6xl font-heading tracking-tighter mb-4 -rotate-1">Creators First. <span className="text-accent-yellow">Always.</span></h2>
          <p className="max-w-3xl mx-auto text-gray-500 mb-8 font-sans normal-case text-lg">
            We're building a new ecosystem for indie creators. We offer funding opportunities, brand partnerships, and ad placements to help you bring your vision to life. Let's build the future of streaming together.
          </p>
          <Button size="lg" asChild className="bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase px-10 py-6 text-lg transform transition-transform hover:scale-105 hover:rotate-2">
            <Link to="/partners/apply">Become a Partner</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default PartnershipsSection;