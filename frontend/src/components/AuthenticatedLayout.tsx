import { useAuth } from "@/context/AuthContext";
import { Navigate, Outlet } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/landing/Footer";
import { AlphaTrackingProvider } from "@/context/AlphaTrackingContext";
import AlphaTesterBanner from "@/components/alpha/AlphaTesterBanner";
import { CartDrawer } from "@/components/gear/cart";

const AuthenticatedLayout = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="bg-charcoal-black min-h-screen" />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <AlphaTrackingProvider>
      <div className="bg-charcoal-black text-bone-white min-h-screen flex flex-col">
        <AppHeader />
        <main className="flex-grow pt-20 flex flex-col">
          <Outlet />
        </main>
        <Footer />
        <AlphaTesterBanner />
        <CartDrawer />
      </div>
    </AlphaTrackingProvider>
  );
};

export default AuthenticatedLayout;