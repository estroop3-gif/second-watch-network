import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (session) {
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/landing', { replace: true });
    }
  }, [session, loading, navigate]);

  return (
    <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
      <div className="space-y-4 p-8 w-full max-w-md">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
      </div>
    </div>
  );
};

export default Index;