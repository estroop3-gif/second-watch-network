/**
 * BacklotSection Component
 * Landing page section showcasing the Backlot production management hub
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Users,
  DollarSign,
  FileCheck,
  MapPin,
  Clipboard,
  Clapperboard,
} from 'lucide-react';

const features = [
  {
    icon: Calendar,
    title: 'Call Sheets',
    description: 'Professional call sheets with crew notifications and weather integration.',
  },
  {
    icon: Users,
    title: 'Casting & Crew',
    description: 'Manage talent, crew assignments, and availability all in one place.',
  },
  {
    icon: DollarSign,
    title: 'Budgets & Invoices',
    description: 'Track expenses, generate invoices, and manage production finances.',
  },
  {
    icon: FileCheck,
    title: 'Clearances',
    description: 'Track music rights, location permits, and talent releases.',
  },
  {
    icon: MapPin,
    title: 'Locations',
    description: 'Scout, organize, and share location details with your team.',
  },
  {
    icon: Clipboard,
    title: 'Shot Lists',
    description: 'Plan your shots, track coverage, and stay organized on set.',
  },
];

export const BacklotSection: React.FC = () => {
  return (
    <section id="backlot" className="py-24 px-4 md:px-8 bg-gradient-to-b from-charcoal-black to-charcoal-black/95 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent-yellow/5 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Clapperboard className="h-8 w-8 text-accent-yellow" />
            <span className="text-accent-yellow uppercase tracking-wider text-sm font-semibold">Production Tools</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-bone-white mb-4">
            The <span className="text-accent-yellow">Backlot</span>
          </h2>
          <p className="text-xl text-bone-white/80 max-w-2xl mx-auto">
            Your All-in-One Production Hub
          </p>
          <p className="text-muted-gray mt-4 max-w-xl mx-auto">
            Forget spreadsheet chaos. Professional tools for call sheets, budgets, casting, clearances — all in one place.
          </p>
        </motion.div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="group relative"
              initial={{ opacity: 0, y: 30, rotate: -2 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, type: 'spring', stiffness: 100 }}
            >
              <motion.div
                className="bg-charcoal-black border-2 border-muted-gray/30 rounded-lg p-6 h-full transition-colors hover:border-accent-yellow/50"
                whileHover={{ y: -8, rotate: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <div className="w-14 h-14 rounded-lg bg-accent-yellow/10 border border-accent-yellow/30 flex items-center justify-center mb-4 group-hover:bg-accent-yellow/20 transition-colors">
                  <feature.icon className="h-7 w-7 text-accent-yellow" />
                </div>
                <h3 className="font-heading text-xl font-bold text-bone-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-gray text-sm">
                  {feature.description}
                </p>
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
        >
          <Button
            asChild
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase px-10 py-6 text-lg transform transition-transform hover:scale-105 hover:-rotate-2"
          >
            <Link to="/backlot">
              <Clapperboard className="h-5 w-5 mr-2" />
              Start Your Production
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default BacklotSection;
