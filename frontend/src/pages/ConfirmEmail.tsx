import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { track } from "@/utils/telemetry";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

const ConfirmEmail = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [resendCooldownUntil, setResendCooldownUntil] = useState<number | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { confirmSignUp, signIn } = useAuth();

  const email = location.state?.email;
  const password = location.state?.password;

  useEffect(() => {
    if (!email) {
      navigate("/signup");
    }
  }, [email, navigate]);

  const handleResendEmail = async () => {
    if (!email) {
      toast.error("No email address found. Please sign up again.");
      return;
    }

    const now = Date.now();
    if (resendCooldownUntil && now < resendCooldownUntil) return;
    setResendCooldownUntil(now + 10_000);

    setIsLoading(true);
    track("signup_resend_request", { email });
    try {
      const { api } = await import("@/lib/api");
      await api.resendConfirmation(email);
      track("signup_resend_success", { email });
      toast.success("Confirmation code resent!");
    } catch (error: any) {
      toast.error(error?.message || "Failed to resend confirmation code");
    }
    setIsLoading(false);
  };

  const handleConfirmCode = async () => {
    if (!confirmationCode || confirmationCode.length !== 6 || isConfirming) return;
    setIsConfirming(true);

    try {
      await confirmSignUp(email, confirmationCode);
      track("confirm_email_success", { email });

      // Auto sign-in if we have the password
      if (password) {
        try {
          await signIn(email, password);
          toast.success("Email confirmed! Welcome to Second Watch Network!");
          navigate("/dashboard", { replace: true });
          return;
        } catch {
          // Sign-in failed, redirect to login
        }
      }

      toast.success("Email confirmed! Please sign in.");
      navigate("/login", { replace: true });
    } catch (error: any) {
      toast.error(error?.message || "Invalid confirmation code. Please try again.");
      track("confirm_email_error", { email, error: error?.message });
    } finally {
      setIsConfirming(false);
    }
  };

  if (!email) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-charcoal-black p-4">
      <div className="w-full max-w-md text-center space-y-6 border-2 border-muted-gray p-8 bg-charcoal-black/50">
        <h1 className="text-4xl font-heading text-accent-yellow uppercase">
          Verify Your Email
        </h1>
        <p className="text-bone-white font-sans text-lg">
          We've sent a 6-digit confirmation code to <span className="font-bold text-accent-yellow">{email}</span>.
        </p>
        <p className="text-muted-gray font-sans">
          Enter the code below to activate your Second Watch Network account.
        </p>

        {/* Code input */}
        <div className="space-y-4 pt-2">
          <Input
            type="text"
            placeholder="Enter 6-digit code"
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-2xl tracking-widest bg-charcoal-black border-muted-gray focus:border-accent-yellow"
            maxLength={6}
            autoFocus
          />
          <Button
            onClick={handleConfirmCode}
            size="lg"
            className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase px-10 py-6 text-lg transform transition-transform hover:scale-105 hover:-rotate-2"
            disabled={confirmationCode.length !== 6 || isConfirming}
          >
            {isConfirming && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            {isConfirming ? "Confirming..." : "Confirm Email"}
          </Button>
        </div>

        {/* Resend */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleResendEmail}
            disabled={isLoading || (!!resendCooldownUntil && Date.now() < resendCooldownUntil)}
            className="underline text-accent-yellow hover:text-bone-white text-sm disabled:opacity-50"
          >
            {isLoading ? "Sending..." : "Resend code"}
          </button>

          {/* Troubleshooting */}
          <details className="text-left">
            <summary className="cursor-pointer text-sm text-muted-gray">Didn't get it?</summary>
            <ul className="list-disc pl-6 mt-2 text-sm text-muted-gray space-y-1">
              <li>Check your spam or junk folder.</li>
              <li>Look for an email from <span className="text-bone-white">noreply@theswn.com</span></li>
              <li>Wait a minute and try "Resend code".</li>
              <li>Make sure you entered the correct email address.</li>
            </ul>
          </details>
        </div>

        <div className="pt-2">
          <p className="text-sm font-sans normal-case text-muted-gray">
            Already confirmed?{' '}
            <Link to="/login" className="text-accent-yellow hover:text-bone-white underline">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConfirmEmail;
