import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import type { PermissionValue } from '@/hooks/backlot/useProjectAccess';

interface PermissionToggleProps {
  value: PermissionValue;
  onChange: (value: PermissionValue) => void;
  disabled?: boolean;
  viewOnly?: boolean;
}

const PermissionToggle: React.FC<PermissionToggleProps> = ({ value, onChange, disabled, viewOnly }) => {
  const handleViewChange = (checked: boolean) => {
    onChange({
      view: checked,
      edit: checked ? value.edit : false,
    });
  };

  const handleEditChange = (checked: boolean) => {
    onChange({
      view: checked ? true : value.view,
      edit: checked,
    });
  };

  return (
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={value.view}
          onCheckedChange={handleViewChange}
          disabled={disabled}
        />
        <span className="text-sm text-muted-gray">View</span>
      </label>
      {!viewOnly && (
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={value.edit}
            onCheckedChange={handleEditChange}
            disabled={disabled || !value.view}
          />
          <span className="text-sm text-muted-gray">Edit</span>
        </label>
      )}
    </div>
  );
};

export default PermissionToggle;
