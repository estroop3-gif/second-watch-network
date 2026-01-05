import React from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { Link } from 'react-router-dom';

const LiveStreamSection = () => {
  return (
    <section id="watch" className="pt-20 pb-52 md:pb-68 bg-charcoal-black overflow-hidden">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl md:text-6xl font-heading tracking-tighter mb-4 -rotate-1">Streaming Now</h2>
          <p className="max-w-3xl text-gray-500 mb-12 font-sans normal-case">
            Our 24/7 stream features a curated selection of the best indie content from creators around the world. Tune in anytime for something new and authentic.
          </p>
        </motion.div>
        
        <motion.div
          className="relative max-w-5xl mx-auto"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ type: 'spring', stiffness: 100, delay: 0.2 }}
        >
          <Link to="/watch-now">
            <div className="relative transform -rotate-2">
              <div className="relative bg-bone-white p-3 md:p-4 border-2 border-black/10 shadow-2xl">
                <div className="bg-charcoal-black py-1 px-4 mb-3 transform rotate-1 shadow-md">
                  <p className="text-accent-yellow text-center tracking-wider align-baseline">
                    <span className="font-spray text-sm md:text-base">Second Watch</span> <span className="font-heading uppercase text-xs md:text-sm">Network</span>
                  </p>
                </div>

                <div className="relative aspect-video bg-black border-2 border-black">
                  <div className="absolute inset-0 flex items-center justify-center bg-charcoal-black/30 cursor-pointer group">
                    <div className="relative flex items-center justify-center w-24 h-24 md:w-32 md:h-32">
                      <div className="absolute inset-0 bg-accent-yellow rounded-full blur-xl opacity-50 group-hover:opacity-70 transition-opacity"></div>
                      <div className="relative flex items-center justify-center w-20 h-20 md:w-28 md:h-28 bg-accent-yellow rounded-full shadow-lg transform group-hover:scale-110 transition-transform">
                        <Play className="w-10 h-10 md:w-14 md:h-14 text-charcoal-black fill-current" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-right mt-3">
                  <p className="inline-block font-typewriter text-charcoal-black text-xs md:text-sm bg-white/50 p-1">
                    <span className="font-bold text-primary-red">NOW PLAYING:</span> 24/7 INDIE SHOWCASE
                  </p>
                </div>
              </div>

              <div className="absolute -top-4 -left-4 w-24 h-12 bg-accent-yellow/20 transform -rotate-[35deg] backdrop-blur-sm z-20"></div>
              <div className="absolute -top-5 -right-3 w-24 h-12 bg-accent-yellow/20 transform rotate-[25deg] backdrop-blur-sm z-20"></div>
              <div className="absolute -bottom-4 -left-3 w-24 h-12 bg-accent-yellow/20 transform rotate-[40deg] backdrop-blur-sm z-20"></div>
              <div className="absolute -bottom-5 -right-4 w-24 h-12 bg-accent-yellow/20 transform -rotate-[30deg] backdrop-blur-sm z-20"></div>
            </div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default LiveStreamSection;