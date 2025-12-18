import React, { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { UserNav } from '@/components/UserNav';
import { useAuth } from '@/context/AuthContext';
import { SearchBar } from '@/components/SearchBar';
import { NotificationBell } from '@/components/NotificationBell';
import { UserNavMenuItems } from '../UserNavMenuItems';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type TargetKey = 'originals' | 'partners' | 'submit';

const MOBILE_BREAKPOINT = 1024; // lg

const LandingHeader = () => {
  const { session } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const scrollingRef = useRef(false);

  const isDesktop = () => typeof window !== 'undefined' && window.innerWidth >= MOBILE_BREAKPOINT;

  const handleLogout = async () => {
    try {
      await api.signOut();
      navigate('/');
    } catch (error: any) {
      if (error.message !== 'Auth session missing!') {
        toast.error("Failed to log out: " + error.message);
      } else {
        navigate('/');
      }
    }
  };

  const closeMenu = () => setIsMobileMenuOpen(false);

  const dedicatedRouteFor = (target: TargetKey) => {
    switch (target) {
      case 'originals': return '/originals';
      case 'partners': return '/partners/apply';
      case 'submit': return '/submit';
    }
  };

  const scrollToSection = (target: TargetKey) => {
    if (scrollingRef.current) return;
    scrollingRef.current = true;
    const el = document.getElementById(target);
    if (!el) {
      scrollingRef.current = false;
      return;
    }
    const header = document.querySelector('header') as HTMLElement | null;
    const offset = header?.offsetHeight ?? 80;
    const top = el.getBoundingClientRect().top + window.scrollY - offset - 8;
    window.scrollTo({ top, behavior: 'smooth' });
    // Update hash without full navigation
    const newUrl = `/landing#${target}`;
    window.history.replaceState({}, '', newUrl);
    // A11y focus
    const heading = el.querySelector('h2, h3') as HTMLElement | null;
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      setTimeout(() => {
        heading.focus();
        scrollingRef.current = false;
      }, 350);
    } else {
      setTimeout(() => { scrollingRef.current = false; }, 350);
    }
  };

  const handleNav = useCallback((target: TargetKey) => {
    if (isDesktop()) {
      // Desktop behavior
      if (location.pathname === '/landing') {
        scrollToSection(target);
      } else {
        navigate(`/landing#${target}`);
      }
    } else {
      // Mobile behavior: go to dedicated page and close drawer
      closeMenu();
      navigate(dedicatedRouteFor(target));
    }
  }, [location.pathname, navigate]);

  const handleLinkClick = () => {
    closeMenu();
  };

  const PublicDesktopNav = () => (
    <>
      <button
        type="button"
        className="text-bone-white hover:text-accent-yellow focus:outline-none focus:ring-2 focus:ring-accent-yellow/60 rounded-sm"
        onClick={() => handleNav('originals')}
        aria-label="Go to Originals section"
      >
        Originals
      </button>
      <button
        type="button"
        className="text-bone-white hover:text-accent-yellow focus:outline-none focus:ring-2 focus:ring-accent-yellow/60 rounded-sm"
        onClick={() => handleNav('submit')}
        aria-label="Go to Submit Content section"
      >
        Submit Content
      </button>
      <button
        type="button"
        className="text-bone-white hover:text-accent-yellow focus:outline-none focus:ring-2 focus:ring-accent-yellow/60 rounded-sm"
        onClick={() => handleNav('partners')}
        aria-label="Go to Partners section"
      >
        Partners
      </button>
      <Link to="/shop" className="text-bone-white hover:text-accent-yellow">
        Shop
      </Link>
    </>
  );

  const PublicMobileNav = () => (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => handleNav('originals')}
        className="flex items-center p-2 -mx-2 rounded-md text-base font-medium text-bone-white hover:bg-muted-gray/50 focus:bg-muted-gray/50"
        aria-label="Open Originals page"
      >
        Originals
      </button>
      <button
        type="button"
        onClick={() => handleNav('submit')}
        className="flex items-center p-2 -mx-2 rounded-md text-base font-medium text-bone-white hover:bg-muted-gray/50 focus:bg-muted-gray/50"
        aria-label="Open Submit Content page"
      >
        Submit Content
      </button>
      <button
        type="button"
        onClick={() => handleNav('partners')}
        className="flex items-center p-2 -mx-2 rounded-md text-base font-medium text-bone-white hover:bg-muted-gray/50 focus:bg-muted-gray/50"
        aria-label="Open Partners page"
      >
        Partners
      </button>
      <Link
        to="/shop"
        onClick={handleLinkClick}
        className="flex items-center p-2 -mx-2 rounded-md text-base font-medium text-bone-white hover:bg-muted-gray/50 focus:bg-muted-gray/50"
      >
        Shop
      </Link>
    </div>
  );

  return (
    <header className="fixed top-0 left-0 w-full bg-charcoal-black/80 backdrop-blur-sm px-4 py-3 sm:p-4 z-50 flex items-center justify-between">
      <Link to="/landing" className="text-xl md:text-2xl font-bold text-bone-white tracking-widest flex-shrink-0 mr-auto">
        <span className="font-spray">Second Watch</span>
        <span className="hidden sm:inline"> Network</span>
      </Link>
      
      {/* Desktop Nav */}
      <div className="hidden md:flex items-center gap-6">
        <nav className="flex items-center gap-6 font-heading text-sm">
          {session ? <SearchBar className="w-64 lg:w-80" /> : <PublicDesktopNav />}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild className="bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase">
            <Link to="/watch-now">Watch Now</Link>
          </Button>
          {session && <NotificationBell />}
          <UserNav />
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="md:hidden flex items-center gap-2">
        {session && <NotificationBell />}
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="border-muted-gray bg-transparent hover:bg-muted-gray flex-shrink-0"
              aria-haspopup="dialog"
              aria-expanded={isMobileMenuOpen}
              aria-controls="landing-mobile-menu"
            >
              <Menu className="h-5 w-5 text-bone-white" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            id="landing-mobile-menu"
            side="right"
            className="bg-charcoal-black border-l-muted-gray w-[300px] p-6 flex flex-col"
          >
            <div className="flex-shrink-0">
              <Button 
                size="lg" 
                asChild 
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase w-full"
                onClick={closeMenu}
              >
                <Link to="/watch-now">Watch Now</Link>
              </Button>
              <div className="h-[1px] bg-muted-gray my-4" />
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden pb-6 no-scrollbar">
              {session ? (
                <div className="flex flex-col gap-4">
                  <SearchBar onSearch={closeMenu} />
                  <div className="h-[1px] bg-muted-gray" />
                  <UserNavMenuItems onLinkClick={closeMenu} handleLogout={handleLogout} />
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <PublicMobileNav />
                  <div className="h-[1px] bg-muted-gray" />
                  <Button asChild className="w-full" onClick={closeMenu}>
                    <Link to="/login">Log In</Link>
                  </Button>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default LandingHeader;