import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { track } from '@/utils/telemetry';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [openError, setOpenError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // 1) If we have a code param, exchange it for tokens via API
      const code = params.get('code');
      const type = params.get('type');
      const returnTo = params.get('returnTo') || '/dashboard';

      if (code) {
        try {
          // Exchange OAuth code for tokens
          const redirectUri = `${window.location.origin}/auth/callback`;
          await api.oauthCallback(code, redirectUri);
        } catch (error) {
          console.error('OAuth code exchange error:', error);
          setOpenError(true);
          return;
        }
      }

      // 2) Confirm we have a token now
      const token = api.getToken();
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      // Ensure a profile row exists
      try {
        const result = await api.ensureProfile();
        const newlyCreated = result?.newly_created === true;

        // If this was an email confirmation flow, let the user know.
        if (type === 'signup') {
          toast.success('Your email is confirmed.');
        }

        if (newlyCreated) {
          track("profile_created", { email: result?.profile?.email });
          toast.success('Your profile is set up.');
        }
      } catch (error) {
        console.error('Profile ensure error:', error);
        track("profile_create_error", { message: String(error) });
        setOpenError(true);
        return;
      }

      // 3) Try to refresh token to get latest claims
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          await api.refreshToken(refreshToken);
        }
      } catch {
        // Non-blocking, token refresh is optional
      }

      // 4) Redirect to intended destination (if provided), else dashboard
      if (mounted) {
        navigate(returnTo, { replace: true });
      }
    })();

    return () => { mounted = false; };
  }, [navigate, params]);

  async function retryEnsureProfile() {
    setRetrying(true);
    try {
      await api.ensureProfile();
      toast.success("Your profile is set up.");
      setOpenError(false);
      const returnTo = params.get('returnTo') || '/dashboard';
      navigate(returnTo, { replace: true });
    } catch (error) {
      toast.error("Still couldn't set up your profile.");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span>Finalizing sign-in…</span>
        </div>
      </div>
      <Dialog open={openError} onOpenChange={setOpenError}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>We couldn't set up your profile</DialogTitle>
            <DialogDescription>
              You can retry now, or continue and set it up later from Account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => { setOpenError(false); navigate('/dashboard', { replace: true }); }}>
              Continue without profile
            </Button>
            <Button onClick={retryEnsureProfile} disabled={retrying} className="bg-accent-yellow text-charcoal-black">
              {retrying && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Retry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AuthCallback;
