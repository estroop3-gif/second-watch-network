/**
 * Requirement Checklist - Shows what requirements must be met
 */
import React from 'react';
import { Check, X, AlertCircle, MapPin, Shield, FileText } from 'lucide-react';
import type { ApplicationRequirements } from '@/types/applications';

interface RequirementChecklistProps {
  requirements: ApplicationRequirements;
  fulfilled: {
    local_hire_confirmed?: boolean | null;
    is_order_member?: boolean;
    has_resume?: boolean;
  };
}

interface RequirementItemProps {
  label: string;
  icon: React.ReactNode;
  required: boolean;
  fulfilled: boolean | null | undefined;
}

const RequirementItem: React.FC<RequirementItemProps> = ({ label, icon, required, fulfilled }) => {
  if (!required) return null;

  const isComplete = fulfilled === true;
  const isPending = fulfilled === null || fulfilled === undefined;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
        isComplete
          ? 'bg-green-600/10 text-green-400'
          : isPending
          ? 'bg-amber-600/10 text-amber-400'
          : 'bg-red-600/10 text-red-400'
      }`}
    >
      <span className="w-5 h-5">{icon}</span>
      <span className="flex-1">{label}</span>
      {isComplete ? (
        <Check className="w-4 h-4" />
      ) : isPending ? (
        <AlertCircle className="w-4 h-4" />
      ) : (
        <X className="w-4 h-4" />
      )}
    </div>
  );
};

const RequirementChecklist: React.FC<RequirementChecklistProps> = ({
  requirements,
  fulfilled,
}) => {
  const hasRequirements =
    requirements.requires_local_hire ||
    requirements.requires_order_member ||
    requirements.requires_resume;

  if (!hasRequirements) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-gray font-medium">Requirements</p>
      <div className="space-y-1">
        <RequirementItem
          label="Local hire only"
          icon={<MapPin className="w-4 h-4" />}
          required={!!requirements.requires_local_hire}
          fulfilled={fulfilled.local_hire_confirmed}
        />
        <RequirementItem
          label="Order members only"
          icon={<Shield className="w-4 h-4" />}
          required={!!requirements.requires_order_member}
          fulfilled={fulfilled.is_order_member}
        />
        <RequirementItem
          label="Resume required"
          icon={<FileText className="w-4 h-4" />}
          required={!!requirements.requires_resume}
          fulfilled={fulfilled.has_resume}
        />
      </div>
    </div>
  );
};

export default RequirementChecklist;
