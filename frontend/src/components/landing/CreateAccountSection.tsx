import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const CreateAccountSection = () => {
  return (
    <section id="create-account" className="py-20 bg-charcoal-black scroll-mt-28">
      <div className="container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl md:text-6xl font-heading tracking-tighter mb-4">
            Join the Community — It's <span className="text-accent-yellow">Free</span>
          </h2>
          <p className="max-w-3xl mx-auto text-gray-500 mb-10 font-sans normal-case text-lg">
            The Green Room, discussions, events, filmmaker profiles, the job board, and more — all completely free.
            Create your account and start connecting with filmmakers today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              asChild
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase px-10 py-6 text-lg transform transition-transform hover:scale-105 hover:-rotate-2"
            >
              <Link to="/signup">Sign Up</Link>
            </Button>
            <Button
              size="lg"
              asChild
              variant="outline"
              className="border-bone-white text-bone-white hover:bg-bone-white/10 font-bold rounded-[4px] uppercase px-10 py-6 text-lg transform transition-transform hover:scale-105 hover:rotate-2"
            >
              <Link to="/login">Log In</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CreateAccountSection;
