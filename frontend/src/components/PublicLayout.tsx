import LandingHeader from '@/components/landing/LandingHeader';
import Footer from '@/components/landing/Footer';
import { Outlet } from 'react-router-dom';

const PublicLayout = () => {
  return (
    <div className="bg-charcoal-black text-white min-h-screen flex flex-col">
      <LandingHeader />
      <main className="flex-grow pt-20">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default PublicLayout;