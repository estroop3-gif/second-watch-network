import React from 'react';
import { Button } from '@/components/ui/button';
import { Heart, ShoppingCart, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const SupportCard = ({
  icon,
  title,
  children,
  buttonText,
  delay,
  to,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  buttonText: string;
  delay: number;
  to?: string;
}) => (
  <motion.div 
    className="flex flex-col items-center gap-4 bg-charcoal-black border-2 border-muted-gray p-8 text-center"
    initial={{ opacity: 0, y: 50, rotate: -10 }}
    whileInView={{ opacity: 1, y: 0, rotate: (delay * 15 - 5) }}
    viewport={{ once: true, amount: 0.5 }}
    transition={{ type: 'spring', stiffness: 120, delay }}
    whileHover={{ scale: 1.05, rotate: (delay * 15 - 7) }}
  >
    {icon}
    <h3 className="text-2xl font-heading">{title}</h3>
    <p className="text-gray-500 font-sans normal-case flex-grow">{children}</p>
    {to ? (
      <Button
        asChild
        className="bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase mt-auto w-full"
      >
        {to.startsWith("http")
          ? <a href={to} target="_blank" rel="noreferrer">{buttonText}</a>
          : <Link to={to}>{buttonText}</Link>}
      </Button>
    ) : (
      <Button className="bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase mt-auto w-full">
        {buttonText}
      </Button>
    )}
  </motion.div>
);

const SupportSection = () => {
  return (
    <section id="support" className="py-20 bg-charcoal-black/95">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-4xl md:text-6xl font-heading tracking-tighter mb-12 -rotate-1">Support the Movement</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <SupportCard
            icon={<Heart className="w-12 h-12 text-accent-yellow" />}
            title="Donate"
            buttonText="Make a Donation"
            delay={0}
            to="/donations"
          >
            Directly fund our operations and help us support more creators.
          </SupportCard>
          <SupportCard icon={<Star className="w-12 h-12 text-accent-yellow" />} title="Join Patreon" buttonText="Become a Patron" delay={0.2} to="https://patreon.com/SecondWatchNetwork?utm_medium=unknown&utm_source=join_link&utm_campaign=creatorshare_creator&utm_content=copyLink">
            Get exclusive content, behind-the-scenes access, and more.
          </SupportCard>
          <SupportCard icon={<ShoppingCart className="w-12 h-12 text-accent-yellow" />} title="Buy Merch" buttonText="Shop Now" delay={0.4} to="/shop">
            Rep the movement with our official <span className="font-spray">Second Watch</span> Network gear.
          </SupportCard>
        </div>
      </div>
    </section>
  );
};

export default SupportSection;