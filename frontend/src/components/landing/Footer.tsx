import React from 'react';
import { Instagram, Youtube } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-charcoal-black border-t-2 border-muted-gray py-8">
      <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-center gap-4">
        <p className="text-gray-500 font-sans normal-case text-sm md:flex-1 md:text-left">
          &copy; {new Date().getFullYear()} <span className="font-spray">Second Watch</span> Network.
        </p>
        <div className="flex gap-6 font-sans text-sm order-first md:order-none">
          <Link to="/submit" className="text-gray-500 hover:text-accent-yellow uppercase">Submit Content</Link>
          <Link to="/terms" className="text-gray-500 hover:text-accent-yellow uppercase">Terms</Link>
          <Link to="/contact" className="text-gray-500 hover:text-accent-yellow uppercase">Contact</Link>
        </div>
        <div className="flex gap-4 md:flex-1 md:justify-end">
          <a href="https://www.instagram.com/secondwatchnetwork" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-gray-500 hover:text-accent-yellow">
            <Instagram className="w-6 h-6" />
          </a>
          <a href="https://www.youtube.com/@SecondWatchNetwork" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="text-gray-500 hover:text-accent-yellow">
            <Youtube className="w-6 h-6" />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;