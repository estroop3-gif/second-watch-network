"use client";

import { useState, useRef } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Eye, EyeOff, Loader2, ArrowLeft, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import PasswordStrengthMeter from "../PasswordStrengthMeter";

// Login schema
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

// Signup schema
const signupSchema = z.object({
  fullName: z.string().min(2, "Please enter your full name."),
  email: z.string().email("Please enter a valid email address."),
  password: z.string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number."),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type SignupFormValues = z.infer<typeof signupSchema>;

interface InlineAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
  title?: string;
  description?: string;
}

type AuthMode = "login" | "signup" | "confirm";

export function InlineAuthModal({
  isOpen,
  onClose,
  onAuthenticated,
  title = "Sign in to continue",
  description = "Create a free account or sign in to submit your content.",
}: InlineAuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [lastEmail, setLastEmail] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [savedPassword, setSavedPassword] = useState("");

  const { signIn, signUp, confirmSignUp } = useAuth();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onBlur",
  });

  const handleLogin = async (values: LoginFormValues) => {
    if (loading) return;
    setLoading(true);
    setLastEmail(values.email);

    try {
      const result = await signIn(values.email, values.password);

      if (result.success) {
        toast.success("Signed in successfully!");
        onAuthenticated();
      } else if (result.challenge?.name === "NEW_PASSWORD_REQUIRED") {
        toast.error("Please reset your password before continuing.");
        onClose();
      }
    } catch (error: any) {
      const msg = (error.message || "").toLowerCase();

      if (msg.includes("not confirmed") || msg.includes("email_not_confirmed")) {
        toast.error("Please confirm your email first, then try signing in.");
      } else if (msg.includes("invalid") || msg.includes("credentials")) {
        loginForm.setError("password", {
          type: "server",
          message: "Email or password is incorrect.",
        });
      } else {
        toast.error(error.message || "Couldn't sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (values: SignupFormValues) => {
    if (loading) return;
    setLoading(true);
    setLastEmail(values.email);
    setSavedPassword(values.password);

    try {
      const result = await signUp(values.email, values.password, values.fullName);

      if (result.needsConfirmation) {
        setMode("confirm");
        toast.info("Check your email for a confirmation code.");
      } else {
        toast.success("Account created successfully!");
        onAuthenticated();
      }
    } catch (error: any) {
      const msg = (error.message || "").toLowerCase();

      if (msg.includes("already registered") || msg.includes("already exists")) {
        signupForm.setError("email", {
          type: "server",
          message: "This email is already registered. Try signing in.",
        });
      } else if (msg.includes("password")) {
        signupForm.setError("password", {
          type: "server",
          message: "Password doesn't meet requirements.",
        });
      } else {
        toast.error(error.message || "Couldn't create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCode = async () => {
    if (!confirmationCode || isConfirming) return;
    setIsConfirming(true);

    try {
      await confirmSignUp(lastEmail, confirmationCode);

      // Now sign in the user
      await signIn(lastEmail, savedPassword);

      toast.success("Email confirmed! Welcome to Second Watch Network!");
      onAuthenticated();
    } catch (error: any) {
      toast.error(error.message || "Invalid confirmation code. Please try again.");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleResendCode = async () => {
    try {
      await api.resendConfirmation(lastEmail);
      toast.success("Confirmation code resent!");
    } catch (error: any) {
      toast.error(error.message || "Couldn't resend code. Try again.");
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    loginForm.reset();
    signupForm.reset();
  };

  const handleClose = () => {
    setMode("login");
    setConfirmationCode("");
    loginForm.reset();
    signupForm.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-charcoal-black border-muted-gray">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading text-bone-white">
            {mode === "confirm" ? "Confirm Your Email" : title}
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            {mode === "confirm"
              ? `We've sent a 6-digit code to ${lastEmail}`
              : description}
          </DialogDescription>
        </DialogHeader>

        {/* Login Form */}
        {mode === "login" && (
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-bone-white">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@email.com"
                        className="bg-charcoal-black border-muted-gray text-bone-white"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-bone-white">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="********"
                          className="bg-charcoal-black border-muted-gray text-bone-white pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-gray hover:text-bone-white"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>

              <div className="text-center pt-2">
                <p className="text-sm text-muted-gray">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="text-accent-yellow hover:text-bone-white underline"
                  >
                    Create one
                  </button>
                </p>
              </div>
            </form>
          </Form>
        )}

        {/* Signup Form */}
        {mode === "signup" && (
          <Form {...signupForm}>
            <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
              <FormField
                control={signupForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-bone-white">Full Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Doe"
                        className="bg-charcoal-black border-muted-gray text-bone-white"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={signupForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-bone-white">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@email.com"
                        className="bg-charcoal-black border-muted-gray text-bone-white"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={signupForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-bone-white">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="********"
                          className="bg-charcoal-black border-muted-gray text-bone-white pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-gray hover:text-bone-white"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                    <PasswordStrengthMeter password={field.value} />
                  </FormItem>
                )}
              />

              <FormField
                control={signupForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-bone-white">Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="********"
                          className="bg-charcoal-black border-muted-gray text-bone-white pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-gray hover:text-bone-white"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>

              <div className="text-center pt-2">
                <p className="text-sm text-muted-gray">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="text-accent-yellow hover:text-bone-white underline"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </form>
          </Form>
        )}

        {/* Confirmation Code Form */}
        {mode === "confirm" && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setMode("signup")}
              className="flex items-center text-sm text-muted-gray hover:text-bone-white"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </button>

            {/* Email sender info */}
            <div className="bg-muted-gray/10 border border-muted-gray/30 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-accent-yellow mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="text-muted-gray">Look for an email from:</p>
                  <p className="text-bone-white font-medium">Second Watch Network</p>
                  <p className="text-accent-yellow font-mono text-xs">noreply@theswn.com</p>
                  <p className="text-muted-gray text-xs mt-1">Check your spam folder if you don't see it. Code expires in 24 hours.</p>
                </div>
              </div>
            </div>

            <Input
              type="text"
              placeholder="Enter 6-digit code"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              className="text-center text-2xl tracking-widest bg-charcoal-black border-muted-gray text-bone-white"
              maxLength={6}
            />

            <Button
              onClick={handleConfirmCode}
              disabled={confirmationCode.length !== 6 || isConfirming}
              className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isConfirming ? "Confirming..." : "Confirm Email"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResendCode}
                className="text-sm text-accent-yellow hover:text-bone-white underline"
              >
                Resend code
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default InlineAuthModal;
