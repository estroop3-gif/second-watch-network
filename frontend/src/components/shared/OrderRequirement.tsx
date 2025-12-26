/**
 * OrderRequirement - Distinct toggle for Order of the Second Watch membership requirement
 * This is clearly differentiated from labor union requirements
 */
import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Shield, HelpCircle } from 'lucide-react';

interface OrderRequirementProps {
  value: boolean;
  onChange: (required: boolean) => void;
  disabled?: boolean;
}

const OrderRequirement: React.FC<OrderRequirementProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div
      className={`p-4 rounded-lg border transition-colors ${
        value
          ? 'border-emerald-500 bg-emerald-900/20'
          : 'border-muted-gray/30 bg-charcoal-black/30'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-full ${
              value ? 'bg-emerald-600/30' : 'bg-muted-gray/20'
            }`}
          >
            <Shield className={`w-5 h-5 ${value ? 'text-emerald-400' : 'text-muted-gray'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="order-requirement"
                className={`font-medium cursor-pointer ${
                  value ? 'text-emerald-300' : 'text-bone-white'
                }`}
              >
                Order of the Second Watch Members Only
              </Label>
              <HelpCircle
                className="w-4 h-4 text-muted-gray cursor-help"
                title="This is NOT a labor union requirement. The Order of the Second Watch is our platform's professional community of vetted filmmakers."
              />
            </div>
            <p className="text-xs text-muted-gray mt-1">
              Limit applications to verified Order members
            </p>
          </div>
        </div>
        <Switch
          id="order-requirement"
          checked={value}
          onCheckedChange={onChange}
          disabled={disabled}
          className="data-[state=checked]:bg-emerald-600"
        />
      </div>

      {value && (
        <div className="mt-3 pt-3 border-t border-emerald-600/30">
          <p className="text-xs text-emerald-300/80">
            Only Order members will be able to apply to this position.
            Non-members will see a prompt to join the Order.
          </p>
        </div>
      )}
    </div>
  );
};

export default OrderRequirement;
