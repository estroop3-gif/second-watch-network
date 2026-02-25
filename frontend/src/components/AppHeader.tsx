import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserNav } from '@/components/UserNav';
import { Button } from './ui/button';
import { SearchBar } from './SearchBar';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Menu } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { UserNavMenuItems } from './UserNavMenuItems';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { CartIcon } from '@/components/gear/cart';

const AppHeader = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

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

  return (
    <header className="fixed top-0 left-0 w-full h-20 bg-charcoal-black/80 backdrop-blur-sm px-4 z-50 flex items-center justify-between">
      <Link to="/" className="text-xl md:text-2xl font-bold text-bone-white tracking-widest flex-shrink-0 mr-auto flex items-center gap-2">
        <span>
          <span className="font-spray">Second Watch</span>
          <span className="hidden sm:inline"> Network</span>
        </span>
        <span className="text-[10px] font-medium tracking-wide text-accent-yellow bg-accent-yellow/15 px-1.5 py-0.5 rounded">beta</span>
      </Link>
      
      {/* Desktop Nav */}
      <div className="hidden md:flex items-center gap-6">
        <nav className="flex items-center gap-6 font-heading text-sm">
          <SearchBar className="w-64 lg:w-80" />
          <Link to="/shop" className="text-bone-white hover:text-accent-yellow">Shop</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild className="bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase">
            <Link to="/watch-now">Watch Now</Link>
          </Button>
          <CartIcon />
          <NotificationBell />
          <UserNav />
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="md:hidden flex items-center gap-2">
        <CartIcon />
        <NotificationBell />
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="border-muted-gray bg-transparent hover:bg-muted-gray flex-shrink-0">
              <Menu className="h-5 w-5 text-bone-white" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-charcoal-black border-l-muted-gray w-[300px] p-6 flex flex-col">
            <div className="flex-shrink-0">
              <Button 
                size="lg" 
                asChild 
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase w-full"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Link to="/watch-now">Watch Now</Link>
              </Button>
              <div className="mt-6">
                <SearchBar onSearch={() => setIsMobileMenuOpen(false)} />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <CartIcon />
                <span className="text-bone-white text-sm">Shopping Cart</span>
              </div>
              <div className="h-[1px] bg-muted-gray my-4" />
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden pb-6 no-scrollbar">
              <UserNavMenuItems onLinkClick={() => setIsMobileMenuOpen(false)} handleLogout={handleLogout} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default AppHeader;