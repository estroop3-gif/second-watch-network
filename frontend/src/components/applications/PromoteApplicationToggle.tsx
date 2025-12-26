/**
 * Promote Application Toggle - Option to promote/boost application visibility
 */
import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Shield } from 'lucide-react';

interface PromoteApplicationToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  isOrderMember?: boolean;
  promotionPrice?: number;
}

const PromoteApplicationToggle: React.FC<PromoteApplicationToggleProps> = ({
  value,
  onChange,
  isOrderMember = false,
  promotionPrice = 4.99,
}) => {
  return (
    <div
      className={`p-4 rounded-lg border transition-colors ${
        value
          ? 'bg-purple-600/10 border-purple-600/30'
          : 'bg-charcoal-black/30 border-muted-gray/20'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Sparkles className={`w-5 h-5 mt-0.5 ${value ? 'text-purple-400' : 'text-muted-gray'}`} />
          <div className="space-y-1">
            <Label className="text-bone-white font-medium">Promote Your Application</Label>
            <p className="text-sm text-muted-gray">
              Get noticed first! Promoted applications appear at the top of the list.
            </p>
            {isOrderMember ? (
              <div className="flex items-center gap-1 text-sm text-emerald-400">
                <Shield className="w-4 h-4" />
                <span>Free for Order members</span>
              </div>
            ) : (
              <p className="text-sm text-purple-400">
                ${promotionPrice.toFixed(2)} one-time fee
              </p>
            )}
          </div>
        </div>
        <Switch
          checked={value}
          onCheckedChange={onChange}
          className="data-[state=checked]:bg-purple-600"
        />
      </div>

      {value && !isOrderMember && (
        <div className="mt-3 pt-3 border-t border-muted-gray/20">
          <p className="text-xs text-muted-gray">
            Payment will be processed when you submit your application.
            Join The Order for free promotions on all applications!
          </p>
        </div>
      )}
    </div>
  );
};

export default PromoteApplicationToggle;
