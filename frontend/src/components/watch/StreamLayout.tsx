/**
 * Stream Layout Component
 * Navigation wrapper for the /watch section
 */

import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Home,
  Search,
  Radio,
  Bookmark,
  User,
  Menu,
  X,
  Film,
} from 'lucide-react';

export function StreamLayout() {
  const location = useLocation();
  const { session } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Handle scroll for header transparency
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { path: '/watch', label: 'Home', icon: Home },
    { path: '/watch/browse', label: 'Browse', icon: Film },
    { path: '/watch/events', label: 'Events', icon: Radio },
    { path: '/watch/search', label: 'Search', icon: Search },
  ];

  const userItems = session
    ? [
        { path: '/watch/history', label: 'My List', icon: Bookmark },
        { path: '/account', label: 'Account', icon: User },
      ]
    : [{ path: '/login', label: 'Sign In', icon: User }];

  const isActive = (path: string) => {
    if (path === '/watch') {
      return location.pathname === '/watch';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Header */}
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          isScrolled
            ? 'bg-charcoal-black/95 backdrop-blur border-b border-bone-white/10'
            : 'bg-gradient-to-b from-charcoal-black/80 to-transparent'
        )}
      >
        <div className="flex items-center justify-between px-4 md:px-8 h-16">
          {/* Logo */}
          <Link to="/watch" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary-red flex items-center justify-center">
              <Film className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading text-bone-white text-lg hidden sm:inline">
              SWN Watch
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive(item.path)
                    ? 'bg-bone-white/10 text-bone-white'
                    : 'text-bone-white/70 hover:text-bone-white hover:bg-bone-white/5'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center gap-2">
            {userItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive(item.path)
                    ? 'bg-bone-white/10 text-bone-white'
                    : 'text-bone-white/70 hover:text-bone-white hover:bg-bone-white/5'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-bone-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-charcoal-black/95 backdrop-blur border-t border-bone-white/10">
            <nav className="p-4 space-y-1">
              {[...navItems, ...userItems].map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive(item.path)
                      ? 'bg-bone-white/10 text-bone-white'
                      : 'text-bone-white/70 hover:text-bone-white hover:bg-bone-white/5'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="pt-16">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-charcoal-black/95 backdrop-blur border-t border-bone-white/10 safe-area-inset-bottom">
        <div className="flex items-center justify-around h-16">
          {navItems.slice(0, 4).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 transition-colors',
                isActive(item.path)
                  ? 'text-accent-yellow'
                  : 'text-muted-gray'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          ))}
          <Link
            to={session ? '/watch/history' : '/login'}
            className={cn(
              'flex flex-col items-center gap-1 px-4 py-2 transition-colors',
              isActive('/watch/history')
                ? 'text-accent-yellow'
                : 'text-muted-gray'
            )}
          >
            <User className="w-5 h-5" />
            <span className="text-xs">{session ? 'Me' : 'Sign In'}</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

export default StreamLayout;
