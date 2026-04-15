import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { reportWarning } from "@/lib/errorReporter";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    reportWarning(new Error(`404: ${location.pathname}`), { source: 'NotFound' });
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-charcoal-black">
      <div className="text-center px-6">
        <p className="text-6xl font-heading text-accent-yellow mb-4">404</p>
        <h1 className="text-2xl font-heading text-bone-white mb-3">Page not found</h1>
        <p className="text-muted-gray mb-8">
          The page at <span className="font-mono text-sm text-bone-white/60">{location.pathname}</span> doesn't exist.
        </p>
        <div className="flex gap-3 justify-center">
          <a
            href="/"
            className="bg-accent-yellow text-charcoal-black font-semibold px-5 py-2 rounded-md hover:bg-accent-yellow/90 transition-colors"
          >
            Go home
          </a>
          <a
            href="/dashboard"
            className="border border-muted-gray text-bone-white font-semibold px-5 py-2 rounded-md hover:bg-muted-gray/20 transition-colors"
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
