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
import { Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { api } from "@/lib/api";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { performanceMetrics } from "@/lib/performanceMetrics";

const schema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const newPasswordSchema = z.object({
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[!@#$%^&*]/, "Password must contain at least one special character (!@#$%^&*)"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormValues = z.infer<typeof schema>;
type NewPasswordFormValues = z.infer<typeof newPasswordSchema>;

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_ATTEMPTS = 10;

const LoginForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newPasswordOpen, setNewPasswordOpen] = useState(false);
  const [newPasswordLoading, setNewPasswordLoading] = useState(false);
  const [resendCooldownUntil, setResendCooldownUntil] = useState<number | null>(null);
  const [lastTriedEmail, setLastTriedEmail] = useState<string>("");
  const [challengeSession, setChallengeSession] = useState<string>("");

  const attemptsRef = useRef<{ timestamps: number[] }>({ timestamps: [] });
  const ariaLiveRef = useRef<string>("");

  const { signIn, completeNewPassword } = useAuth();
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

  const newPasswordForm = useForm<NewPasswordFormValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
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
      performanceMetrics.incrementRetry();
      return;
    }

    // Performance: mark login button clicked (starts login timing)
    performanceMetrics.markLoginClicked();

    setLoading(true);
    ariaLiveRef.current = "Signing you in…";

    try {
      const result = await signIn(values.email, values.password);
      setLoading(false);

      // Check if there's a challenge (e.g., NEW_PASSWORD_REQUIRED)
      if (!result.success && result.challenge?.name === 'NEW_PASSWORD_REQUIRED') {
        setChallengeSession(result.challenge.session);
        setNewPasswordOpen(true);
        ariaLiveRef.current = "Please set a new password.";
        return;
      }

      // Success: send user to intended page or defaults
      // Note: We'll need to check user role after authentication
      navigate(returnTo || "/dashboard", { replace: true });
    } catch (error: any) {
      setLoading(false);
      performanceMetrics.incrementRetry();
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

  const onNewPasswordSubmit = async (values: NewPasswordFormValues) => {
    if (newPasswordLoading) return;

    setNewPasswordLoading(true);

    try {
      await completeNewPassword(lastTriedEmail, values.newPassword, challengeSession);
      setNewPasswordLoading(false);
      setNewPasswordOpen(false);
      toast.success("Password updated successfully!");
      navigate(returnTo || "/dashboard", { replace: true });
    } catch (error: any) {
      setNewPasswordLoading(false);
      const msg = (error.message || "").toLowerCase();

      if (msg.includes("password") && msg.includes("policy")) {
        newPasswordForm.setError("newPassword", {
          type: "server",
          message: "Password doesn't meet requirements. Try a different password.",
        });
      } else {
        toast.error(error.message || "Couldn't update password. Please try again.");
      }
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

      {/* Set new password modal (first-time login) */}
      <Dialog open={newPasswordOpen} onOpenChange={setNewPasswordOpen}>
        <DialogContent className="sm:max-w-md bg-charcoal-black border-muted-gray">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-accent-yellow/20">
                <KeyRound className="h-6 w-6 text-accent-yellow" />
              </div>
              <DialogTitle className="text-bone-white">Set Your New Password</DialogTitle>
            </div>
            <DialogDescription className="text-muted-gray">
              Welcome! For security, you need to create a new password before continuing.
            </DialogDescription>
          </DialogHeader>

          <Form {...newPasswordForm}>
            <form onSubmit={newPasswordForm.handleSubmit(onNewPasswordSubmit)} className="space-y-4">
              <FormField
                control={newPasswordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-bone-white">New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Enter your new password"
                          className="bg-charcoal-black border-muted-gray text-bone-white pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-gray hover:text-bone-white"
                          aria-label={showNewPassword ? "Hide password" : "Show password"}
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={newPasswordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-bone-white">Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm your new password"
                          className="bg-charcoal-black border-muted-gray text-bone-white pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-gray hover:text-bone-white"
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="text-xs text-muted-gray space-y-1 p-3 bg-muted-gray/10 rounded border border-muted-gray/20">
                <p className="font-medium text-bone-white mb-1">Password requirements:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>At least 8 characters</li>
                  <li>One uppercase letter (A-Z)</li>
                  <li>One lowercase letter (a-z)</li>
                  <li>One number (0-9)</li>
                  <li>One special character (!@#$%^&*)</li>
                </ul>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="submit"
                  disabled={newPasswordLoading}
                  className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
                >
                  {newPasswordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  Set Password & Continue
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LoginForm;