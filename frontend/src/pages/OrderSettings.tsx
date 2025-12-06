/**
 * Order Settings Page
 * Allows Order members to configure their Order profile visibility settings
 * Route: /account/order-settings
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ArrowLeft,
  Loader2,
  Shield,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { OrderSettingsForm } from '@/components/profile/OrderSettingsForm';
import { OrderProfileSettings } from '@/lib/api/order';
import { getOrderProfileSettings } from '@/lib/api/orderSettings';
import { orderAPI } from '@/lib/api/order';

export default function OrderSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOrderMember, isLoading: profileLoading } = useEnrichedProfile();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<OrderProfileSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=/account/order-settings');
      return;
    }

    if (!profileLoading) {
      loadSettings();
    }
  }, [user, profileLoading]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Verify user is an Order member
      const profile = await orderAPI.getMyProfile();
      if (!profile) {
        // Not an Order member
        setLoading(false);
        return;
      }

      // Load settings (creates default if none exist)
      const settingsData = await getOrderProfileSettings();
      setSettings(settingsData);
    } catch (err) {
      console.error('Failed to load order settings:', err);
      setError('Failed to load settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaved = () => {
    // Could optionally refresh or navigate
  };

  // Loading state
  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Not an Order member
  if (!isOrderMember && !settings) {
    return (
      <div className="container mx-auto px-4 max-w-2xl py-8 md:py-12">
        {/* Back Link */}
        <Button
          asChild
          variant="ghost"
          className="mb-6 text-muted-gray hover:text-bone-white"
        >
          <Link to="/my-profile">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Link>
        </Button>

        <Card className="bg-charcoal-black/50 border-muted-gray">
          <CardContent className="p-8 text-center">
            <div className="p-4 bg-emerald-600/20 rounded-full w-fit mx-auto mb-4">
              <Shield className="h-12 w-12 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-bone-white mb-2">
              Order Settings
            </h1>
            <p className="text-muted-gray mb-6 max-w-md mx-auto">
              You are not in The Second Watch Order. Join The Order to unlock these settings
              and connect with fellow Christian filmmakers.
            </p>
            <Button
              asChild
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Link to="/order">
                Learn About The Order
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 max-w-2xl py-8 md:py-12">
        <Button
          asChild
          variant="ghost"
          className="mb-6 text-muted-gray hover:text-bone-white"
        >
          <Link to="/my-profile">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Link>
        </Button>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>

        <Button onClick={loadSettings} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  // Main settings form
  return (
    <div className="container mx-auto px-4 max-w-2xl py-8 md:py-12">
      {/* Back Link */}
      <Button
        asChild
        variant="ghost"
        className="mb-6 text-muted-gray hover:text-bone-white"
      >
        <Link to="/my-profile">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Profile
        </Link>
      </Button>

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-600/20 rounded-lg">
            <Shield className="h-6 w-6 text-emerald-400" />
          </div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-bone-white">
            Order Profile Settings
          </h1>
        </div>
        <p className="text-muted-gray">
          Control what Order information appears on your profile and who can see it.
        </p>
      </div>

      {/* Settings Form */}
      {settings && (
        <OrderSettingsForm
          initialSettings={settings}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
