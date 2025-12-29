import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { track } from "@/utils/telemetry";

const ConfirmEmail = () => {
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      // If the user lands here without an email, send them to sign up
      navigate("/signup");
    }
  }, [email, navigate]);

  const handleResendEmail = async () => {
    if (!email) {
      toast.error("No email address found. Please sign up again.");
      return;
    }
    setIsLoading(true);
    track("signup_resend_request", { email });
    try {
      await api.resendConfirmation(email);
      track("signup_resend_success", { email });
      toast.success("Confirmation email sent!");
    } catch (error: any) {
      toast.error(error?.message || "Failed to resend confirmation email");
    }
    setIsLoading(false);
  };

  if (!email) {
    return null; // Render nothing while redirecting
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-charcoal-black p-4">
      <div className="w-full max-w-md text-center space-y-6 border-2 border-muted-gray p-8 bg-charcoal-black/50">
        <h1 className="text-4xl font-heading text-accent-yellow uppercase">
          Check Your Inbox
        </h1>
        <p className="text-bone-white font-sans text-lg">
          We've sent a confirmation link to <span className="font-bold text-accent-yellow">{email}</span>.
        </p>
        <p className="text-muted-gray font-sans">
          Please click the link in the email to activate your Second Watch Network account.
        </p>
        <div className="space-y-4 pt-4">
          <Button
            onClick={handleResendEmail}
            size="lg"
            className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase px-10 py-6 text-lg transform transition-transform hover:scale-105 hover:-rotate-2"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Resend Confirmation Email"}
          </Button>
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
