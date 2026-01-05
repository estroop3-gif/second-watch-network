import React from 'react';
import { motion } from 'framer-motion';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const trendingOriginals = [
  {
    title: 'Serve It Up',
    description: 'Pros. Rookies. One house. Zero excuses. Pickleball gets personal.',
    imageUrl: '/images/serve-it-up.jpg',
    linkTo: '/serve-it-up',
  },
  {
    title: 'Coastal Torque',
    description: 'Street-built machines. Gulf Coast heat. Sarasota’s underground car culture, uncaged.',
    imageUrl: '/images/coastal-torque.jpg',
    linkTo: '/coastal-torque',
  },
  {
    title: 'Serving for Greece',
    description: 'One mission. One nation. Two unlikely athletes representing Greece on the world pickleball stage.',
    imageUrl: '/images/serving-for-greece.jpg',
    linkTo: '/serving-for-greece',
  },
  {
    title: 'Failure to Thrive',
    description: 'A brother’s illness. A family’s story. A documentary about love, loss, and learning to breathe through the unknown.',
    imageUrl: '/images/failure-to-thrive.jpg',
    linkTo: '/failure-to-thrive',
  },
  {
    title: "Cue'd Up",
    description: "Hustlers. Underdogs. One shot at the table. Cue’d Up is where the game gets personal.",
    imageUrl: '/images/cued-up.png',
    linkTo: '/cued-up',
  },
  {
    title: 'The Unseen',
    description: 'They came to be seen. But healing requires exposure. And grace doesn’t come without a cost.',
    imageUrl: '/images/the-unseen.png',
    linkTo: '#',
  },
];

const TrendingNowSection = () => {
  return (
    <section id="trending" className="py-20 bg-charcoal-black/90 overflow-hidden">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
          className="text-center md:text-left"
        >
          <h2 className="text-4xl md:text-6xl font-heading tracking-tighter mb-12 -rotate-1">
            <span className="font-bold">Trending</span> Now
          </h2>
        </motion.div>
        
        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-8">
            {trendingOriginals.map((item, index) => (
              <CarouselItem key={index} className="pl-8 md:basis-1/2 lg:basis-1/3">
                <Link to={item.linkTo} className={item.linkTo === '#' ? 'pointer-events-none cursor-default' : ''}>
                  <motion.div
                    className="relative group"
                    initial={{ opacity: 0, y: 20, rotate: Math.random() * 4 - 2 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ type: 'spring', stiffness: 300, delay: index * 0.1 }}
                  >
                    <div className="relative transform group-hover:rotate-[-2deg] transition-transform duration-300">
                      <div className="absolute -inset-2 bg-bone-white/10 rotate-1 z-0" />
                      <div className="relative bg-bone-white p-2 shadow-lg">
                        <img src={item.imageUrl} alt={item.title} className="w-full h-auto object-cover aspect-[16/9]" />
                        <div className="absolute inset-0 bg-charcoal-black/30 group-hover:bg-charcoal-black/10 transition-colors" />
                      </div>
                    </div>
                    <div className="mt-6 text-left">
                      <h3 className="text-2xl font-heading uppercase text-bone-white">{item.title}</h3>
                      <p className="text-gray-500 font-sans normal-case text-sm mt-1 mb-4">{item.description}</p>
                      <Button size="sm" className="bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase transform transition-transform hover:scale-105 hover:-rotate-2" tabIndex={-1}>
                        Watch Now
                      </Button>
                    </div>
                  </motion.div>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex bg-bone-white/80 text-charcoal-black hover:bg-accent-yellow -left-4" />
          <CarouselNext className="hidden md:flex bg-bone-white/80 text-charcoal-black hover:bg-accent-yellow -right-4" />
        </Carousel>
      </div>
    </section>
  );
};

export default TrendingNowSection;