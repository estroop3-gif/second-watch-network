import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import LoginForm from '@/components/forms/LoginForm';

const Login = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for auth check to complete before redirecting
    // This prevents false redirects from stale/invalid tokens
    if (!loading && session) {
      navigate('/dashboard');
    }
  }, [session, loading, navigate]);

  return (
    <div className="flex-grow flex items-center justify-center px-4">
      <div className="w-full max-w-md relative">
          <div className="absolute -inset-x-10 -top-8 -bottom-8 z-0 flex items-center justify-center overflow-hidden">
              <span className="font-spray text-8xl md:text-9xl text-muted-gray/10 -rotate-12 select-none whitespace-nowrap">
                  Welcome Back
              </span>
          </div>
          <div className="relative z-10 border-2 border-dashed border-muted-gray p-8 transform -rotate-1 bg-charcoal-black">
              <h1 className="text-4xl md:text-5xl font-heading tracking-tighter mb-8 text-center">
                  Log In
              </h1>
              <LoginForm />
          </div>
      </div>
    </div>
  );
};

export default Login;