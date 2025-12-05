import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
      // 1) If we have a code param, exchange it for a session
      const code = params.get('code');
      const type = params.get('type');
      const returnTo = params.get('returnTo') || '/dashboard';
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setOpenError(true);
          return;
        }
      }

      // 2) Confirm we have a session now
      const { data: sessionResp } = await supabase.auth.getSession();
      const session = sessionResp?.session;
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      // Ensure a profile row exists
      const { data, error } = await supabase.rpc('ensure_profile');
      if (error) {
        track("profile_create_error", { message: error.message });
        setOpenError(true);
        return;
      }

      const newlyCreated = Array.isArray(data) ? (data[0]?.newly_created === true) : (data as any)?.newly_created === true;
      const email = session.user.email || '';
      const displayName = (session.user.user_metadata?.display_name as string) || (session.user.user_metadata?.full_name as string) || undefined;

      // If this was an email confirmation flow, let the user know.
      if (type === 'signup') {
        toast.success('Your email is confirmed.');
      }

      if (newlyCreated) {
        // Fire non-blocking email (best effort)
        supabase.functions.invoke('send-profile-created-email', { body: { email, displayName } })
          .then(() => {
            // no-op
          })
          .catch(() => {
            // ignore
          });
        track("profile_created", { email });
        toast.success('Your profile is set up.');
      }

      // Ensure client JWT is fully up to date with roles after verification
      try { await supabase.auth.refreshSession(); } catch {}

      // 3) Redirect to intended destination (if provided), else dashboard
      navigate(returnTo, { replace: true });
    })();

    return () => { mounted = false; };
  }, [navigate, params]);

  async function retryEnsureProfile() {
    setRetrying(true);
    const { data, error } = await supabase.rpc('ensure_profile');
    setRetrying(false);
    if (error) {
      toast.error("Still couldn't set up your profile.");
      return;
    }
    toast.success("Your profile is set up.");
    setOpenError(false);
    const returnTo = params.get('returnTo') || '/dashboard';
    navigate(returnTo, { replace: true });
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