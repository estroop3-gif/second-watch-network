import React from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const SubmitContentSection = () => {
  return (
    <section id="submit" className="pt-20 pb-52 md:pb-68 bg-charcoal-black scroll-mt-28">
      <div className="container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl md:text-6xl font-heading tracking-tighter mb-4 -rotate-1">
            Got a Story to Tell?
          </h2>
          <p className="max-w-3xl mx-auto text-muted-gray mb-8 font-sans normal-case text-lg">
            Have a short film, doc, series, or raw original piece? We’re building a network for creators who don’t fit the mold. Submit your content and, if selected, it’ll be featured on our 24/7 stream and across our curated platform.
          </p>
          <Button size="lg" asChild className="bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase px-10 py-6 text-lg transform transition-transform hover:scale-105 hover:-rotate-2">
            <Link to="/submit">Submit Now</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default SubmitContentSection;