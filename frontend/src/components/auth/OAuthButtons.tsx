"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Github, Chrome } from "lucide-react";
import { toast } from "sonner";

const OAuthButtons = () => {
  const [loading, setLoading] = useState<null | "google" | "github">(null);

  // Get the Cognito OAuth URLs from environment variables
  const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;
  const cognitoClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  const redirectUri = `${window.location.origin}/auth/callback`;

  const handleOAuth = async (provider: "google" | "github") => {
    if (loading) return;
    setLoading(provider);

    // For AWS Cognito, we redirect to the Cognito hosted UI
    // If Cognito is configured with Google/GitHub identity providers
    if (cognitoDomain && cognitoClientId) {
      const identityProvider = provider === "google" ? "Google" : "GitHub";
      const oauthUrl = `https://${cognitoDomain}/oauth2/authorize?` +
        `identity_provider=${identityProvider}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `client_id=${cognitoClientId}&` +
        `scope=openid+email+profile`;

      window.location.href = oauthUrl;
    } else {
      toast.error("OAuth is not configured. Please use email/password login.");
      setLoading(null);
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
