import React from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const HeroSection = () => {
  return (
    <section id="home" className="relative h-screen flex items-center justify-center text-center text-bone-white overflow-hidden">
      <div className="absolute inset-0 bg-charcoal-black">
        <img
          src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=2070&auto=format&fit=crop"
          alt="Behind the scenes of a film set"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-black via-charcoal-black/50 to-charcoal-black" />
      </div>
      <motion.div 
        className="relative z-10 p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <h1 className="text-5xl md:text-7xl lg:text-9xl font-spray tracking-tighter leading-none transform -rotate-2">
          The Alternative to <span className="text-accent-yellow">Hollywood.</span>
        </h1>
        <p className="mt-4 text-xl md:text-2xl font-typewriter normal-case">
          Real stories. Real creators. 24/7.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
          <Button size="lg" asChild className="bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase px-10 py-6 text-lg w-full sm:w-auto transform transition-transform hover:scale-105 hover:-rotate-1">
            <Link to="/watch-now">Watch Now</Link>
          </Button>
          <Button size="lg" asChild className="bg-transparent border-2 border-accent-yellow text-accent-yellow hover:bg-accent-yellow hover:text-charcoal-black font-bold rounded-[4px] uppercase px-10 py-6 text-lg w-full sm:w-auto transform transition-transform hover:scale-105 hover:rotate-1">
            <Link to="/submit">Submit Your Content</Link>
          </Button>
          <Button size="lg" asChild className="bg-transparent border-2 border-accent-yellow text-accent-yellow hover:bg-accent-yellow hover:text-charcoal-black font-bold rounded-[4px] uppercase px-10 py-6 text-lg w-full sm:w-auto transform transition-transform hover:scale-105 hover:rotate-1">
            <Link to="/backlot/free-trial">Start Free Trial</Link>
          </Button>
        </div>
      </motion.div>
    </section>
  );
};

export default HeroSection;