import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { api } from "@/lib/api";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

const requestSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

const resetSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  confirmationCode: z.string().min(6, "Please enter the 6-digit code."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  // REQUEST FORM
  const requestForm = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: "" },
    mode: "onBlur",
  });

  const sendResetCode = async (values: z.infer<typeof requestSchema>) => {
    if (loading) return;
    setLoading(true);
    try {
      await api.forgotPassword(values.email);
      setSentEmail(values.email);
      setCodeSent(true);
      toast.success("Check your email for a reset code.");
    } catch (error: any) {
      toast.error(error.message || "Couldn't send reset code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // RESET FORM
  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: sentEmail, confirmationCode: "", password: "", confirmPassword: "" },
    mode: "onBlur",
  });

  // Update email in reset form when sentEmail changes
  useEffect(() => {
    if (sentEmail) {
      resetForm.setValue("email", sentEmail);
    }
  }, [sentEmail, resetForm]);

  const updatePassword = async (values: z.infer<typeof resetSchema>) => {
    if (loading) return;
    setLoading(true);
    try {
      await api.resetPassword(values.email, values.confirmationCode, values.password);
      toast.success("Password updated. You can sign in now.");
      navigate("/login", { replace: true });
    } catch (error: any) {
      toast.error(error.message || "Couldn't update password. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!codeSent) {
    // Request form (no code sent yet)
    return (
      <div className="flex-grow flex items-center justify-center px-4">
        <div className="w-full max-w-md border-2 border-dashed border-muted-gray p-8 bg-charcoal-black">
          <h1 className="text-3xl font-heading mb-6">Reset your password</h1>
          <Form {...requestForm}>
            <form onSubmit={requestForm.handleSubmit(sendResetCode)} className="space-y-5">
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
                Send reset code
              </Button>
            </form>
          </Form>
        </div>
      </div>
    );
  }

  // Code sent: allow entering code and setting new password
  return (
    <div className="flex-grow flex items-center justify-center px-4">
      <div className="w-full max-w-md border-2 border-dashed border-muted-gray p-8 bg-charcoal-black">
        <h1 className="text-3xl font-heading mb-6">Set a new password</h1>
        <p className="text-muted-gray mb-4">Enter the 6-digit code sent to {sentEmail}</p>
        <Form {...resetForm}>
          <form onSubmit={resetForm.handleSubmit(updatePassword)} className="space-y-5">
            <FormField
              control={resetForm.control}
              name="confirmationCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmation Code</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="123456" maxLength={6} {...field} className="text-center text-2xl tracking-widest" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
        <button
          onClick={() => { setCodeSent(false); setSentEmail(""); }}
          className="mt-4 text-sm text-accent-yellow underline"
        >
          Use a different email
        </button>
      </div>
    </div>
  );
};

export default ResetPassword;
