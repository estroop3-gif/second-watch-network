import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MessageSquare, Briefcase, Users, Camera } from 'lucide-react';

const features = [
  {
    icon: MessageSquare,
    title: 'Discussions',
    description:
      'Join conversations with filmmakers, share ideas, and get feedback on your projects.',
  },
  {
    icon: Briefcase,
    title: 'Job Board',
    description:
      'Find gigs, post opportunities, and connect with productions looking for crew.',
  },
  {
    icon: Users,
    title: 'Connections',
    description:
      'Build your network with fellow filmmakers and industry professionals.',
  },
  {
    icon: Camera,
    title: 'Gear Marketplace',
    description:
      'Buy, sell, and rent equipment from the community.',
  },
];

const CommunityFeaturesSection = () => {
  return (
    <section id="community" className="py-24 px-4 md:px-8 bg-charcoal-black scroll-mt-28">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-bone-white mb-4">
            Everything You Need — All <span className="text-accent-yellow">Free</span>
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto font-sans normal-case text-lg">
            No subscription required. Jump in and start building your filmmaking career.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="group relative"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, type: 'spring', stiffness: 100 }}
            >
              <div className="bg-charcoal-black border-2 border-muted-gray/30 rounded-lg p-6 h-full transition-colors hover:border-accent-yellow/50">
                <div className="w-14 h-14 rounded-lg bg-accent-yellow/10 border border-accent-yellow/30 flex items-center justify-center mb-4 group-hover:bg-accent-yellow/20 transition-colors">
                  <feature.icon className="h-7 w-7 text-accent-yellow" />
                </div>
                <h3 className="font-heading text-xl font-bold text-bone-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-500 text-sm font-sans normal-case">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <Button
            size="lg"
            asChild
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase px-10 py-6 text-lg transform transition-transform hover:scale-105 hover:-rotate-2"
          >
            <Link to="/signup">Sign Up — It's Free</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default CommunityFeaturesSection;
