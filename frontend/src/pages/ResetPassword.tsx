import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

const requestSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

const resetSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

function useRecoveryPresent() {
  const location = useLocation();
  return useMemo(() => {
    // Supabase sends either:
    // - query param: ?code=...&type=recovery
    // - or hash fragment: #access_token=...&type=recovery
    const search = new URLSearchParams(location.search);
    const type = search.get("type");
    const code = search.get("code");
    if (type === "recovery" && code) return true;

    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const hType = hash.get("type");
    const access = hash.get("access_token");
    return !!(hType === "recovery" && access);
  }, [location.hash, location.search]);
}

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [loading, setLoading] = useState(false);

  const isRecovery = useRecoveryPresent();

  // If query param `code` exists, exchange it for a session (PKCE flow).
  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const code = search.get("code");
    const type = search.get("type");
    if (type === "recovery" && code) {
      // Fire-and-forget; the session will be established if valid
      supabase.auth.exchangeCodeForSession(code).catch(() => {});
    }
  }, [location.search]);

  // REQUEST FORM
  const requestForm = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: "" },
    mode: "onBlur",
  });

  const sendResetEmail = async (values: z.infer<typeof requestSchema>) => {
    if (loading) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: "https://www.secondwatchnetwork.com/reset-password",
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || "Couldn’t send reset link. Try again.");
      return;
    }
    toast.success("Check your email for a reset link.");
  };

  // RESET FORM
  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onBlur",
  });

  const updatePassword = async (values: z.infer<typeof resetSchema>) => {
    if (loading) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    setLoading(false);
    if (error) {
      toast.error(error.message || "Couldn’t update password. Try again.");
      return;
    }
    toast.success("Password updated. You can sign in now.");
    navigate("/signin", { replace: true });
  };

  if (!isRecovery) {
    // Request form (no token yet)
    return (
      <div className="flex-grow flex items-center justify-center px-4">
        <div className="w-full max-w-md border-2 border-dashed border-muted-gray p-8 bg-charcoal-black">
          <h1 className="text-3xl font-heading mb-6">Reset your password</h1>
          <Form {...requestForm}>
            <form onSubmit={requestForm.handleSubmit(sendResetEmail)} className="space-y-5">
              <FormField
                control={requestForm.control}
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
              <Button type="submit" disabled={loading} className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Send reset link
              </Button>
            </form>
          </Form>
        </div>
      </div>
    );
  }

  // Recovery present: allow setting new password
  return (
    <div className="flex-grow flex items-center justify-center px-4">
      <div className="w-full max-w-md border-2 border-dashed border-muted-gray p-8 bg-charcoal-black">
        <h1 className="text-3xl font-heading mb-6">Set a new password</h1>
        <Form {...resetForm}>
          <form onSubmit={resetForm.handleSubmit(updatePassword)} className="space-y-5">
            <FormField
              control={resetForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPw ? "text" : "password"} placeholder="••••••••" {...field} className="pr-10" />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      >
                        {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={resetForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPw2 ? "text" : "password"} placeholder="••••••••" {...field} className="pr-10" />
                      <button
                        type="button"
                        onClick={() => setShowPw2(!showPw2)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      >
                        {showPw2 ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={loading} className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Update password
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default ResetPassword;