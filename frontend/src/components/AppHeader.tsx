import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserNav } from '@/components/UserNav';
import { Button } from './ui/button';
import { SearchBar } from './SearchBar';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Menu } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { UserNavMenuItems } from './UserNavMenuItems';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AppHeader = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error && error.message !== 'Auth session missing!') {
      toast.error("Failed to log out: " + error.message);
    } else {
      navigate('/');
    }
  };

  return (
    <header className="fixed top-0 left-0 w-full h-20 bg-charcoal-black/80 backdrop-blur-sm px-4 z-50 flex items-center justify-between">
      <Link to="/" className="text-xl md:text-2xl font-bold text-bone-white tracking-widest flex-shrink-0 mr-auto">
        <span className="font-spray">Second Watch</span>
        <span className="hidden sm:inline"> Network</span>
      </Link>
      
      {/* Desktop Nav */}
      <div className="hidden md:flex items-center gap-6">
        <nav className="flex items-center gap-6 font-heading text-sm">
          <SearchBar className="w-64 lg:w-80" />
          <Link to="/greenroom" className="text-bone-white hover:text-accent-yellow">Green Room</Link>
          <Link to="/order" className="text-bone-white hover:text-accent-yellow">The Order</Link>
          <Link to="/shop" className="text-bone-white hover:text-accent-yellow">Shop</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild className="bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase">
            <Link to="/watch-now">Watch Now</Link>
          </Button>
          <NotificationBell />
          <UserNav />
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="md:hidden flex items-center gap-2">
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