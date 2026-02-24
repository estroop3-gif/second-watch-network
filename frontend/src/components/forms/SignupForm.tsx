"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button as UIButton } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useState, useMemo, useRef } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import PasswordStrengthMeter from "../PasswordStrengthMeter";
import { useSettings } from "@/context/SettingsContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { track } from "@/utils/telemetry";
import { Separator } from "@/components/ui/separator";
import OAuthButtons from "@/components/auth/OAuthButtons";
import { getAuthErrorMessage } from "@/utils/authErrors";
import { useAuth } from "@/context/AuthContext";

const baseSchema = z.object({
  fullName: z.string(),
  displayName: z.string().optional(),
  email: z.string().email("Please enter a valid email address."),
  password: z.string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number."),
  confirmPassword: z.string(),
});

export function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [openLoading, setOpenLoading] = useState(false);
  const [openEmailInUse, setOpenEmailInUse] = useState(false);
  const [openConfirmSent, setOpenConfirmSent] = useState(false);
  const [openGenericError, setOpenGenericError] = useState(false);
  const [resendDisabledUntil, setResendDisabledUntil] = useState<number | null>(null);
  const [lastEmail, setLastEmail] = useState("");
  const [genericErrorMsg, setGenericErrorMsg] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const ariaLiveMsgRef = useRef<string>("");
  const correlationIdRef = useRef<string>(crypto.randomUUID());

  const { signUp, confirmSignUp, signIn } = useAuth();
  const navigate = useNavigate();
  const { settings } = useSettings();

  const formSchema = useMemo(() => {
    let schema = baseSchema;
    if (settings?.required_signup_fields?.includes('fullName')) {
      schema = schema.extend({
        fullName: z.string().min(2, "Please enter your full name."),
      });
    }
    return schema.refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    });
  }, [settings]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      displayName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onBlur",
  });

  async function handleResend() {
    if (!lastEmail) return;
    const now = Date.now();
    if (resendDisabledUntil && now < resendDisabledUntil) return;

    // Rate-limit UI layer: 10s between clicks
    setResendDisabledUntil(now + 10_000);

    track("signup_resend_request", { email: lastEmail }, correlationIdRef.current);
    try {
      await api.resendConfirmation(lastEmail);
      track("signup_resend_success", { email: lastEmail }, correlationIdRef.current);
      toast.success("Resent!");
    } catch (error: any) {
      toast.error(error.message || "Couldn't resend. Try again.");
    }
  }

  function mapAuthErrorToUI(error: any) {
    const status = error?.status;
    const msg = error?.message?.toLowerCase?.() || "";
    if (msg.includes("already registered") || msg.includes("already exists")) {
      track("signup_email_already_used", { email: lastEmail }, correlationIdRef.current);
      setOpenEmailInUse(true);
      // Focus email after close
      setTimeout(() => emailInputRef.current?.focus(), 0);
      return;
    }
    if (status === 429 || msg.includes("rate")) {
      toast.error("Too many attempts, please wait a minute.");
      return;
    }
    // Generic fallback
    const humanMsg = getAuthErrorMessage(error);
    setGenericErrorMsg(`${humanMsg}\nRequest ID: ${correlationIdRef.current}`);
    track("signup_error", { message: error?.message }, correlationIdRef.current);
    setOpenGenericError(true);
  }

  async function handleConfirmCode() {
    if (!confirmationCode || isConfirming) return;
    setIsConfirming(true);

    try {
      await confirmSignUp(lastEmail, confirmationCode);
      track("signup_confirm_success", { email: lastEmail }, correlationIdRef.current);

      // Now sign in the user
      await signIn(lastEmail, form.getValues("password"));

      setOpenConfirmSent(false);
      toast.success("Email confirmed! Welcome to Second Watch Network!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Invalid confirmation code. Please try again.");
      track("signup_confirm_error", { email: lastEmail, error: error.message }, correlationIdRef.current);
    } finally {
      setIsConfirming(false);
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (isLoading) return;
    correlationIdRef.current = crypto.randomUUID();
    track("signup_submit", { email: values.email }, correlationIdRef.current);
    setIsLoading(true);
    setLastEmail(values.email);
    ariaLiveMsgRef.current = "Creating your account…";
    setOpenLoading(true);

    try {
      const result = await signUp(values.email, values.password, values.fullName);

      setIsLoading(false);
      setOpenLoading(false);

      // Check if Cognito requires email confirmation
      if (result.needsConfirmation) {
        track("signup_needs_confirmation", { email: values.email }, correlationIdRef.current);
        setOpenConfirmSent(true);
        return;
      }

      // Success: redirect to dashboard or show welcome message
      toast.success("Account created successfully!");
      ariaLiveMsgRef.current = "Account created successfully.";
      track("signup_success", { email: values.email }, correlationIdRef.current);
      navigate("/dashboard");
    } catch (error: any) {
      setIsLoading(false);
      setOpenLoading(false);

      // Inline error mapping for common cases
      if (error.message?.toLowerCase?.().includes("invalid email")) {
        form.setError("email", { type: "server", message: "Invalid email address." });
      }
      if (error.message?.toLowerCase?.().includes("password")) {
        form.setError("password", { type: "server", message: "Password not strong enough." });
      }
      mapAuthErrorToUI(error);
    }
  }

  return (
    <>
      {/* aria-live region for SR */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {ariaLiveMsgRef.current}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-heading uppercase text-bone-white">Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} className="bg-charcoal-black border-muted-gray focus:border-accent-yellow" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-heading uppercase text-bone-white">Display Name (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Display name" {...field} className="bg-charcoal-black border-muted-gray focus:border-accent-yellow" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-heading uppercase text-bone-white">Email</FormLabel>
                <FormControl>
                  <Input ref={emailInputRef} type="email" placeholder="you@email.com" {...field} className="bg-charcoal-black border-muted-gray focus:border-accent-yellow" />
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
                <FormLabel className="font-heading uppercase text-bone-white">Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...field}
                      className="bg-charcoal-black border-muted-gray focus:border-accent-yellow pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-gray hover:text-accent-yellow"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
                <PasswordStrengthMeter password={field.value} />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-heading uppercase text-bone-white">Confirm Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...field}
                      className="bg-charcoal-black border-muted-gray focus:border-accent-yellow pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-gray hover:text-accent-yellow"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <UIButton type="submit" size="lg" className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase px-10 py-6 text-lg transform transition-transform hover:scale-105 hover:-rotate-2 disabled:opacity-60" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />}
            <span>{isLoading ? "Creating your account…" : "Sign Up"}</span>
          </UIButton>
          <div className="py-2">
            <div className="flex items-center gap-3 my-4">
              <Separator className="bg-muted-gray/50" />
              <span className="text-xs uppercase tracking-wider text-muted-gray">Or continue with</span>
              <Separator className="bg-muted-gray/50" />
            </div>
            <OAuthButtons />
          </div>
          <div className="text-center pt-2">
              <p className="text-sm font-sans normal-case text-muted-gray">
                  Already have an account?{' '}
                  <Link to="/login" className="text-accent-yellow hover:text-bone-white underline">
                      Log in
                  </Link>
              </p>
          </div>
        </form>
      </Form>

      {/* 1) Creating your account — non-dismissible while loading */}
      <Dialog open={openLoading} onOpenChange={(o) => { /* hard-block while loading */ }}>
        <DialogContent aria-describedby="creating-desc" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Creating your account…
            </DialogTitle>
            <DialogDescription id="creating-desc">
              Please wait while we set things up.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* 2) Email already in use */}
      <Dialog open={openEmailInUse} onOpenChange={setOpenEmailInUse}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Email already in use</DialogTitle>
            <DialogDescription>
              That email is already associated with an account. Try signing in or use a different email.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-between">
            <UIButton autoFocus onClick={() => navigate('/login')} className="bg-accent-yellow text-charcoal-black">Sign In</UIButton>
            <UIButton variant="outline" onClick={() => { setOpenEmailInUse(false); setTimeout(() => emailInputRef.current?.focus(), 0); }}>
              Use another email
            </UIButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3) Check your inbox to confirm */}
      <Dialog open={openConfirmSent} onOpenChange={setOpenConfirmSent}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Check Your Email</DialogTitle>
            <DialogDescription>
              We've sent a 6-digit confirmation code to <strong className="text-bone-white">{lastEmail}</strong>
            </DialogDescription>
          </DialogHeader>

          {/* Email sender info */}
          <div className="bg-muted-gray/10 border border-muted-gray/30 rounded-lg p-3 text-sm">
            <p className="text-muted-gray mb-1">Look for an email from:</p>
            <p className="text-bone-white font-medium">Second Watch Network</p>
            <p className="text-accent-yellow font-mono text-xs">noreply@theswn.com</p>
            <p className="text-muted-gray text-xs mt-2">The code expires in 24 hours.</p>
          </div>

          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Enter 6-digit code"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              className="text-center text-2xl tracking-widest"
              maxLength={6}
            />
            <UIButton
              onClick={handleConfirmCode}
              disabled={confirmationCode.length !== 6 || isConfirming}
              className="w-full bg-accent-yellow text-charcoal-black"
            >
              {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isConfirming ? "Confirming..." : "Confirm Email"}
            </UIButton>
          </div>
          <div className="space-y-3 text-sm pt-4">
            <button
              className="underline text-accent-yellow"
              onClick={handleResend}
              disabled={!!resendDisabledUntil && Date.now() < resendDisabledUntil}
            >
              Resend code
            </button>
            <details>
              <summary className="cursor-pointer text-muted-gray">Didn't get it?</summary>
              <ul className="list-disc pl-6 mt-2 text-muted-gray">
                <li>Check your spam or junk folder.</li>
                <li>Look for an email from <span className="text-bone-white">noreply@theswn.com</span></li>
                <li>Wait a minute and try "Resend code".</li>
                <li>Make sure you entered the correct email address.</li>
              </ul>
            </details>
          </div>
          <DialogFooter>
            <UIButton variant="outline" onClick={() => {
              setOpenConfirmSent(false);
              navigate('/confirm-email', { state: { email: lastEmail, password: form.getValues('password') } });
            }}>Cancel</UIButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5) Generic Error */}
      <Dialog open={openGenericError} onOpenChange={setOpenGenericError}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Something went wrong</DialogTitle>
            <DialogDescription>{genericErrorMsg || "Please try again."}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <UIButton autoFocus onClick={() => setOpenGenericError(false)} className="bg-accent-yellow text-charcoal-black">Try again</UIButton>
            <Link to="/contact" className="underline ml-auto">Contact support</Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}