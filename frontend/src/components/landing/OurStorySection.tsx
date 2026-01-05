import React from 'react';
import { motion } from 'framer-motion';

const OurStorySection = () => {
  return (
    <section id="story" className="pt-20 pb-52 md:pb-68 bg-charcoal-black overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-5 gap-12 items-center">
          <motion.div 
            className="md:col-span-3 text-center md:text-left"
            initial={{ opacity: 0, x: -50, rotate: 0 }}
            whileInView={{ opacity: 1, x: 0, rotate: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-6xl font-heading tracking-tighter mb-4">Built from <span className="text-accent-yellow">Scratch.</span></h2>
            <p className="text-gray-500 leading-relaxed font-sans normal-case text-lg">
              <span className="font-spray">Second Watch</span> Network wasn't born in a boardroom. It was built in a garage by a filmmaker who was tired of the gatekeepers. We believe in the power of raw, unfiltered storytelling and the creators who are brave enough to tell those stories. This is more than a network; it's a movement.
            </p>
          </motion.div>
          <motion.div
            className="md:col-span-2"
            initial={{ opacity: 0, x: 50, rotate: 0 }}
            whileInView={{ opacity: 1, x: 0, rotate: -3 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
          >
            <div className="bg-bone-white p-2 transform hover:rotate-[-5deg] transition-transform duration-300">
              <img 
                src="/images/filmmaker-at-work.jpeg" 
                alt="Filmmaker at work"
                className="w-full"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default OurStorySection;