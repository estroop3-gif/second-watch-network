/**
 * FeaturePostToggle - Toggle to feature a post (paid option)
 * When enabled, triggers Stripe checkout flow
 */
import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Star, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeaturePostToggleProps {
  value: boolean;
  onChange: (featured: boolean) => void;
  onFeatureRequest?: () => Promise<void>;
  disabled?: boolean;
  showPaymentInfo?: boolean;
  price?: string;
}

const FeaturePostToggle: React.FC<FeaturePostToggleProps> = ({
  value,
  onChange,
  onFeatureRequest,
  disabled = false,
  showPaymentInfo = true,
  price = '$9.99',
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async (checked: boolean) => {
    if (checked && onFeatureRequest) {
      // When enabling, trigger payment flow
      setIsLoading(true);
      try {
        await onFeatureRequest();
        // Don't change the toggle state here - let the payment callback handle it
      } catch (error) {
        console.error('Feature request failed:', error);
      } finally {
        setIsLoading(false);
      }
    } else {
      // When disabling, just update the state
      onChange(checked);
    }
  };

  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-colors',
        value
          ? 'border-accent-yellow bg-accent-yellow/10'
          : 'border-muted-gray/30 bg-charcoal-black/30'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'p-2 rounded-full',
              value ? 'bg-accent-yellow/20' : 'bg-muted-gray/20'
            )}
          >
            {isLoading ? (
              <Loader2 className={cn('w-5 h-5 animate-spin', value ? 'text-accent-yellow' : 'text-muted-gray')} />
            ) : (
              <Star className={cn('w-5 h-5', value ? 'text-accent-yellow fill-accent-yellow' : 'text-muted-gray')} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="feature-post"
                className={cn(
                  'font-medium cursor-pointer',
                  value ? 'text-accent-yellow' : 'text-bone-white'
                )}
              >
                Feature This Post
              </Label>
              {showPaymentInfo && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent-yellow/20 text-accent-yellow">
                  {price}
                </span>
              )}
              <Sparkles
                className="w-4 h-4 text-muted-gray cursor-help"
                title="Featured posts get priority placement, highlighted badge for 7 days, and increased visibility"
              />
            </div>
            <p className="text-xs text-muted-gray mt-1">
              Get more visibility and attract top talent
            </p>
          </div>
        </div>
        <Switch
          id="feature-post"
          checked={value}
          onCheckedChange={handleToggle}
          disabled={disabled || isLoading}
          className="data-[state=checked]:bg-accent-yellow"
        />
      </div>

      {value && (
        <div className="mt-3 pt-3 border-t border-accent-yellow/30">
          <div className="flex items-center gap-2 text-xs text-accent-yellow/80">
            <Star className="w-3 h-3" />
            <span>Your post will be featured for 7 days after payment</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeaturePostToggle;
