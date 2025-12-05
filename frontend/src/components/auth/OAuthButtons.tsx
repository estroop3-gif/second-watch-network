"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Github, Chrome } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const OAuthButtons = () => {
  const [loading, setLoading] = useState<null | "google" | "github">(null);

  const redirectTo = `https://www.secondwatchnetwork.com/auth/callback`;

  const handleOAuth = async (provider: "google" | "github") => {
    if (loading) return;
    setLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    setLoading(null);
    if (error) {
      toast.error(error.message || "Failed to start OAuth flow.");
    } else {
      // Supabase will redirect; no success toast necessary.
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Button
        variant="outline"
        onClick={() => handleOAuth("google")}
        disabled={loading !== null}
        className="w-full"
      >
        <Chrome className="h-4 w-4 mr-2" aria-hidden="true" />
        Continue with Google
      </Button>
      <Button
        variant="outline"
        onClick={() => handleOAuth("github")}
        disabled={loading !== null}
        className="w-full"
      >
        <Github className="h-4 w-4 mr-2" aria-hidden="true" />
        Continue with GitHub
      </Button>
    </div>
  );
};

export default OAuthButtons;