/**
 * GreenRoomSection Component
 * Landing page section showcasing the Green Room community voting feature
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Send,
  Vote,
  Ticket,
  Trophy,
  Users,
} from 'lucide-react';

const steps = [
  {
    icon: Send,
    title: 'Submit Your Vision',
    description: 'Filmmakers pitch their projects with trailers, budgets, and production plans.',
  },
  {
    icon: Ticket,
    title: 'Buy Voting Tickets',
    description: 'Community members purchase tickets to cast votes for their favorite projects.',
  },
  {
    icon: Users,
    title: 'Rally Your Supporters',
    description: 'Spread the word and build momentum behind the projects you believe in.',
  },
  {
    icon: Trophy,
    title: 'Winners Get Greenlit',
    description: 'Top-voted projects earn funding and move into production.',
  },
];

export const GreenRoomSection: React.FC = () => {
  return (
    <section id="greenroom" className="py-24 px-4 md:px-8 bg-charcoal-black relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-600/5 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Project Preview Mockup */}
          <motion.div
            className="order-2 lg:order-1"
            initial={{ opacity: 0, x: -50, rotate: -3 }}
            whileInView={{ opacity: 1, x: 0, rotate: -2 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 80, delay: 0.2 }}
          >
            <div className="relative">
              {/* Main project card */}
              <motion.div
                className="bg-gradient-to-br from-emerald-900/30 to-charcoal-black border-2 border-emerald-600/40 rounded-lg p-6 shadow-2xl"
                whileHover={{ scale: 1.02, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                {/* Thumbnail placeholder */}
                <div className="aspect-video bg-gradient-to-br from-emerald-800/40 to-emerald-900/60 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10" />
                  <Sparkles className="h-16 w-16 text-emerald-400/60" />
                  <div className="absolute bottom-2 right-2 bg-charcoal-black/80 px-2 py-1 rounded text-xs text-bone-white">
                    2:34
                  </div>
                </div>

                {/* Project info */}
                <h3 className="font-heading text-xl text-bone-white mb-1">Sample Project Title</h3>
                <p className="text-muted-gray text-sm mb-4">by Independent Filmmaker</p>

                {/* Vote progress bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-emerald-400 font-semibold">847 Votes</span>
                    <span className="text-muted-gray">Goal: 1,000</span>
                  </div>
                  <div className="h-3 bg-muted-gray/30 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                      initial={{ width: 0 }}
                      whileInView={{ width: '85%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.5, ease: 'easeOut', delay: 0.5 }}
                    />
                  </div>
                </div>

                {/* Funding amount */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-accent-yellow font-bold text-lg">$8,470</span>
                    <span className="text-muted-gray text-sm ml-2">raised</span>
                  </div>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Vote className="h-4 w-4 mr-1" />
                    Vote
                  </Button>
                </div>
              </motion.div>

              {/* Decorative cards behind */}
              <div className="absolute -bottom-4 -right-4 w-full h-full bg-emerald-900/20 border border-emerald-600/20 rounded-lg -z-10 transform rotate-3" />
              <div className="absolute -bottom-8 -right-8 w-full h-full bg-emerald-900/10 border border-emerald-600/10 rounded-lg -z-20 transform rotate-6" />
            </div>
          </motion.div>

          {/* Right: Header and Steps */}
          <div className="order-1 lg:order-2">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="h-8 w-8 text-emerald-400" />
                <span className="text-emerald-400 uppercase tracking-wider text-sm font-semibold">Community Powered</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-heading font-bold text-bone-white mb-4">
                The <span className="text-emerald-400">Green Room</span>
              </h2>
              <p className="text-xl text-bone-white/80 mb-8">
                Where the Community Decides What Gets Made
              </p>
            </motion.div>

            {/* How it works steps */}
            <div className="space-y-4">
              {steps.map((step, index) => (
                <motion.div
                  key={step.title}
                  className="flex items-start gap-4 group"
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 + 0.3, type: 'spring', stiffness: 100 }}
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center group-hover:bg-emerald-600/30 transition-colors">
                    <step.icon className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-bone-white mb-1">{step.title}</h3>
                    <p className="text-muted-gray text-sm">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* CTAs */}
            <motion.div
              className="flex flex-wrap gap-4 mt-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.7 }}
            >
              <Button
                asChild
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-[4px] uppercase px-8 py-6 text-lg transform transition-transform hover:scale-105"
              >
                <Link to="/greenroom">
                  <Vote className="h-5 w-5 mr-2" />
                  Explore Projects
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-2 border-emerald-600 text-emerald-400 hover:bg-emerald-600 hover:text-white font-bold rounded-[4px] uppercase px-8 py-6 text-lg transform transition-transform hover:scale-105"
              >
                <Link to="/greenroom/submit">
                  <Send className="h-5 w-5 mr-2" />
                  Submit Your Vision
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default GreenRoomSection;
