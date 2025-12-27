"use client";

import { useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";

const schema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type FormValues = z.infer<typeof schema>;

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_ATTEMPTS = 10;

const LoginForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resendCooldownUntil, setResendCooldownUntil] = useState<number | null>(null);
  const [lastTriedEmail, setLastTriedEmail] = useState<string>("");

  const attemptsRef = useRef<{ timestamps: number[] }>({ timestamps: [] });
  const ariaLiveRef = useRef<string>("");

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const returnTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const r = params.get("returnTo");
    if (!r) return null;
    // Only allow same-site relative redirects
    return r.startsWith("/") ? r : null;
  }, [location.search]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  function checkRateLimitNow() {
    const now = Date.now();
    const winStart = now - RATE_LIMIT_WINDOW_MS;
    attemptsRef.current.timestamps = attemptsRef.current.timestamps.filter(t => t > winStart);
    if (attemptsRef.current.timestamps.length >= RATE_LIMIT_MAX_ATTEMPTS) {
      return true;
    }
    attemptsRef.current.timestamps.push(now);
    return false;
  }

  async function handleResend() {
    if (!lastTriedEmail) return;
    const now = Date.now();
    if (resendCooldownUntil && now < resendCooldownUntil) return;

    // UI cooldown: 10s
    setResendCooldownUntil(now + 10_000);

    try {
      await api.resendConfirmation(lastTriedEmail);
      toast.success("Confirmation email resent.");
    } catch (error: any) {
      toast.error(error.message || "Couldn't resend confirmation. Try again.");
    }
  }

  const onSubmit = async (values: FormValues) => {
    setLastTriedEmail(values.email);
    if (loading) return;

    // Friendly client-side rate limit
    const limited = checkRateLimitNow();
    if (limited) {
      toast.error("Too many attempts. Please wait a moment.");
      return;
    }

    setLoading(true);
    ariaLiveRef.current = "Signing you in…";

    try {
      await signIn(values.email, values.password);
      setLoading(false);

      // Success: send user to intended page or defaults
      // Note: We'll need to check user role after authentication
      navigate(returnTo || "/dashboard", { replace: true });
    } catch (error: any) {
      setLoading(false);
      const msg = (error.message || "").toLowerCase();

      if (msg.includes("invalid login credentials") || msg.includes("invalid") || msg.includes("credentials")) {
        form.setError("password", { type: "server", message: "Email or password is incorrect." });
        ariaLiveRef.current = "Email or password is incorrect.";
        return;
      }
      if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed")) {
        setConfirmOpen(true);
        ariaLiveRef.current = "Please confirm your email to continue.";
        return;
      }
      if (msg.includes("429") || msg.includes("rate")) {
        toast.error("Too many attempts. Please wait a moment.");
        return;
      }
      // Fallback
      toast.error(error.message || "Couldn't sign in. Please try again.");
    }
  };

  return (
    <>
      {/* aria-live for SR */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {ariaLiveRef.current}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="you@email.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...field}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center justify-between">
            <Link to="/reset-password" className="text-sm underline text-accent-yellow hover:text-bone-white">
              Forgot password?
            </Link>
            <Link to="/signup" className="text-sm underline text-muted-foreground hover:text-foreground">
              Create account
            </Link>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Sign in
          </Button>
        </form>
      </Form>

      {/* Confirm your email modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm your email to continue</DialogTitle>
            <DialogDescription>
              We sent a verification link to {lastTriedEmail || "your email"}. Click the link to activate your account, then sign in.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Didn’t get it? Check your spam folder or resend below.
          </div>
          <DialogFooter className="flex gap-2">
            <Button onClick={() => setConfirmOpen(false)} variant="outline">Close</Button>
            <Button
              onClick={handleResend}
              disabled={!!resendCooldownUntil && Date.now() < resendCooldownUntil}
              className="bg-accent-yellow text-charcoal-black"
            >
              Resend confirmation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LoginForm;