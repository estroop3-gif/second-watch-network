import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { track } from "@/utils/telemetry";

export default function BillingReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const status = params.get("status");
    const context = params.get("context") || undefined;
    const returnTo = params.get("returnTo") || "/dashboard";
    const resume = params.get("resume") === "1";

    async function handle() {
      if (status === "success") {
        try {
          track("gate_checkout_success", { context, returnTo, resume });
          track("upgrade_success_return", { context, returnTo, resume: true });
        } catch {}
        // Refresh session to pick up new roles from webhook update
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          try {
            await api.refreshToken(refreshToken);
          } catch {
            // Token refresh is optional
          }
        }
        toast.success("Premium activated! Enjoy your new features.");

        // Ensure auto-resume flags make it to the target page
        const separator = returnTo.includes("?") ? "&" : "?";
        const target = `${returnTo}${separator}resume=1${context ? `&context=${encodeURIComponent(context)}` : ""}`;

        navigate(target, { replace: true });
      } else if (status === "cancel") {
        try {
          track("gate_cancel", { context, returnTo });
        } catch {}
        toast.message("Checkout canceled");
        navigate(returnTo, { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }

    handle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
