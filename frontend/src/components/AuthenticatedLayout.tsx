import { useAuth } from "@/context/AuthContext";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/landing/Footer";
import { AlphaTrackingProvider } from "@/context/AlphaTrackingContext";
import AlphaTesterBanner from "@/components/alpha/AlphaTesterBanner";
import { CartDrawer } from "@/components/gear/cart";
import { Skeleton } from "@/components/ui/skeleton";

const AuthenticatedLayout = () => {
  const { user, loading, bootstrapError, retryBootstrap } = useAuth();
  const location = useLocation();
  const hideFooter = location.pathname.startsWith('/crm');

  if (loading) {
    return (
      <div className="bg-charcoal-black min-h-screen flex flex-col">
        {/* Header skeleton */}
        <div className="fixed top-0 left-0 w-full h-20 bg-charcoal-black/80 backdrop-blur-sm px-4 z-50 flex items-center justify-between">
          <div className="text-xl md:text-2xl font-bold text-bone-white tracking-widest">
            <span className="font-spray animate-pulse opacity-60">Second Watch</span>
            <span className="hidden sm:inline animate-pulse opacity-60"> Network</span>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-20 bg-muted-gray/20" />
            <Skeleton className="h-8 w-8 rounded-full bg-muted-gray/20" />
          </div>
        </div>

        {/* Main content skeleton */}
        <main className="flex-grow pt-24 px-4 md:px-8 max-w-7xl mx-auto w-full">
          {/* Title bar skeleton */}
          <div className="mb-6">
            <Skeleton className="h-8 w-48 mb-2 bg-muted-gray/20" />
            <Skeleton className="h-4 w-72 bg-muted-gray/20" />
          </div>

          {/* Content card skeletons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-muted-gray/20 p-4 space-y-3">
                <Skeleton className="h-4 w-3/4 bg-muted-gray/20" />
                <Skeleton className="h-20 w-full bg-muted-gray/20" />
                <Skeleton className="h-4 w-1/2 bg-muted-gray/20" />
              </div>
            ))}
          </div>

          {/* Status text */}
          {bootstrapError && (
            <div className="mt-8 text-center">
              <p className="text-muted-gray text-sm mb-2">{bootstrapError}</p>
              {bootstrapError.includes('Unable to connect') && (
                <button
                  onClick={() => retryBootstrap()}
                  className="text-primary-red hover:text-primary-red/80 text-sm font-medium transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          )}
          {!bootstrapError && (
            <p className="mt-8 text-center text-muted-gray text-sm animate-pulse">
              Connecting...
            </p>
          )}
        </main>
      </div>
    );
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
        {!hideFooter && <Footer />}
        <AlphaTesterBanner />
        <CartDrawer />
      </div>
    </AlphaTrackingProvider>
  );
};

export default AuthenticatedLayout;
