import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const featuredOriginals = [
  {
    title: 'Serve It Up',
    tagline: 'Pros. Rookies. One house. Zero excuses. Pickleball gets personal.',
    imageUrl: '/images/serve-it-up.jpg',
    linkTo: '/serve-it-up',
  },
  {
    title: 'Coastal Torque',
    tagline: 'Street-built machines. Gulf Coast heat. Sarasota’s underground car culture, uncaged.',
    imageUrl: '/images/coastal-torque.jpg',
    linkTo: '/coastal-torque',
  },
  {
    title: 'Failure to Thrive',
    tagline: 'A brother’s illness. A family’s story. A documentary about love, loss, and learning to breathe through the unknown.',
    imageUrl: '/images/failure-to-thrive.jpg',
    linkTo: '/failure-to-thrive',
  },
];

const OriginalsSection = () => {
  return (
    <section id="originals" className="pt-20 pb-52 md:pb-68 bg-charcoal-black scroll-mt-28">
      <div className="container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl md:text-6xl font-heading tracking-tighter mb-16 -rotate-1">
            <span className="font-spray">Second Watch</span> Originals
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-16 mb-16">
          {featuredOriginals.map((show, index) => (
            <Link to={show.linkTo || '#'} key={show.title} className="block h-full">
              <motion.div
                className="relative group h-full flex flex-col"
                initial={{ opacity: 0, y: 20, rotate: (Math.random() - 0.5) * 10 }}
                whileInView={{ opacity: 1, y: 0, rotate: (index - 1) * -3 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ type: 'spring', stiffness: 100, delay: index * 0.1 }}
                whileHover={{ y: -10, rotate: (index - 1) * -3 - 2 }}
              >
                <div className="relative transform transition-transform duration-300">
                  <div className="absolute -inset-2 bg-bone-white/10 rotate-1 z-0" />
                  <div className="relative bg-bone-white p-2 shadow-lg">
                    <img src={show.imageUrl} alt={`Placeholder for ${show.title}`} className="w-full h-auto object-cover aspect-[4/5] grayscale group-hover:grayscale-0 transition-all duration-300" />
                    <div className="absolute inset-0 bg-charcoal-black/20" />
                  </div>
                  <div className="absolute top-4 -right-4 bg-accent-yellow text-charcoal-black px-4 py-1 transform rotate-6">
                    <span className="font-spray text-lg">Coming Soon</span>
                  </div>
                </div>
                <div className="mt-6 text-center flex-grow flex flex-col justify-center">
                  <h3 className="text-2xl font-heading uppercase">{show.title}</h3>
                  <p className="text-muted-gray font-typewriter normal-case text-sm mt-1">"{show.tagline}"</p>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 0.5 }}
        >
          <Button size="lg" asChild className="bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase px-10 py-6 text-lg transform transition-transform hover:scale-105 hover:-rotate-2">
            <Link to="/originals">See All Originals</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default OriginalsSection;