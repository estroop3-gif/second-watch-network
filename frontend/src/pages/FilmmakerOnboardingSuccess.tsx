import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';

const FilmmakerOnboardingSuccess = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, refetch } = useProfile();
  const [countdown, setCountdown] = useState(5);

  const username = profile?.username || user?.user_metadata?.username || user?.email?.split('@')[0];

  // Refetch profile on mount to get updated data
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Countdown and auto-redirect
  useEffect(() => {
    if (countdown <= 0) {
      navigate(`/profile/${username}`);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, navigate, username]);

  const handleViewProfile = () => {
    navigate(`/profile/${username}`);
  };

  return (
    <div className="min-h-screen bg-charcoal-black text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg mx-auto text-center">
        <div className="mb-8 animate-bounce">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-500/20 mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-heading tracking-tighter mb-4">
          <span className="text-accent-yellow">Welcome</span> to the Community!
        </h1>

        <p className="text-xl text-muted-gray mb-8">
          Your filmmaker profile has been created successfully.
        </p>

        <Card className="bg-charcoal-black/50 border-muted-gray/20 mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2 text-accent-yellow mb-4">
              <Sparkles className="w-5 h-5" />
              <span className="font-semibold">What's Next?</span>
              <Sparkles className="w-5 h-5" />
            </div>
            <ul className="text-left space-y-3 text-sm text-muted-gray">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Your profile is now visible in the Filmmaker Directory</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Connect with other filmmakers in The Backlot</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Submit your projects for distribution</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Set your availability to get hired for projects</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Button
          size="lg"
          onClick={handleViewProfile}
          className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 font-bold"
        >
          View My Profile
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>

        <p className="text-sm text-muted-gray mt-6">
          Redirecting to your profile in {countdown} seconds...
        </p>
      </div>
    </div>
  );
};

export default FilmmakerOnboardingSuccess;
