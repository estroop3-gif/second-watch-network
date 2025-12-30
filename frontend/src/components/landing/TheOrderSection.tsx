/**
 * TheOrderSection Component
 * Landing page section showcasing The Order professional filmmaker guild
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Shield,
  Briefcase,
  MapPin,
  Hammer,
  ChevronRight,
} from 'lucide-react';

const benefits = [
  {
    icon: Briefcase,
    title: 'Exclusive Jobs',
    subtitle: 'First Access',
    description: 'Get priority access to film industry gigs before they go public.',
  },
  {
    icon: MapPin,
    title: 'Local Lodges',
    subtitle: 'City-Based',
    description: 'Join your local chapter for in-person networking and collaboration.',
  },
  {
    icon: Hammer,
    title: 'Craft Houses',
    subtitle: 'Department Guilds',
    description: 'Connect with specialists in your craft — camera, sound, production, and more.',
  },
];

export const TheOrderSection: React.FC = () => {
  return (
    <section id="the-order" className="py-24 px-4 md:px-8 bg-charcoal-black relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-5" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent-yellow/3 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto relative">
        {/* Shield Icon and Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Shield Icon */}
          <motion.div
            className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-accent-yellow/20 to-accent-yellow/5 border-2 border-accent-yellow/40 mb-6"
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
            whileHover={{ scale: 1.1, rotate: 5 }}
          >
            <Shield className="h-12 w-12 text-accent-yellow" />
          </motion.div>

          <h2 className="text-4xl md:text-5xl font-heading font-bold text-bone-white mb-4">
            The <span className="font-spray text-accent-yellow">Order</span>
          </h2>
          <p className="text-xl text-bone-white/80 max-w-2xl mx-auto">
            A Professional Guild for Purpose-Driven Filmmakers
          </p>
          <p className="text-muted-gray mt-4 max-w-xl mx-auto">
            Join a community of vetted industry professionals committed to excellence, integrity, and meaningful work.
          </p>
        </motion.div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              className="text-center group"
              initial={{ opacity: 0, y: 40, rotate: -3 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 + 0.3, type: 'spring', stiffness: 100 }}
            >
              <motion.div
                className="bg-charcoal-black border-2 border-muted-gray/30 rounded-lg p-8 h-full transition-colors hover:border-accent-yellow/40"
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                {/* Icon */}
                <div className="w-16 h-16 rounded-full bg-accent-yellow/10 border border-accent-yellow/30 flex items-center justify-center mx-auto mb-4 group-hover:bg-accent-yellow/20 transition-colors">
                  <benefit.icon className="h-8 w-8 text-accent-yellow" />
                </div>

                {/* Subtitle badge */}
                <span className="inline-block px-3 py-1 bg-muted-gray/20 rounded-full text-xs uppercase tracking-wider text-muted-gray mb-3">
                  {benefit.subtitle}
                </span>

                {/* Title */}
                <h3 className="font-heading text-xl font-bold text-bone-white mb-2">
                  {benefit.title}
                </h3>

                {/* Description */}
                <p className="text-muted-gray text-sm">
                  {benefit.description}
                </p>
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.7 }}
        >
          <Button
            asChild
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase px-10 py-6 text-lg transform transition-transform hover:scale-105 hover:-rotate-2"
          >
            <Link to="/order/apply">
              <Shield className="h-5 w-5 mr-2" />
              Apply for Membership
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-2 border-muted-gray text-bone-white hover:bg-muted-gray/20 hover:border-bone-white font-bold rounded-[4px] uppercase px-8 py-6 text-lg transform transition-transform hover:scale-105"
          >
            <Link to="/order">
              Learn More
              <ChevronRight className="h-5 w-5 ml-1" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default TheOrderSection;
