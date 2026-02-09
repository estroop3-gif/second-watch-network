import { X } from 'lucide-react';

interface Label {
  id: string;
  name: string;
  color: string;
}

interface LabelChipProps {
  label: Label;
  onRemove?: (labelId: string) => void;
}

const LabelChip = ({ label, onRemove }: LabelChipProps) => {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted-gray/20 text-xs text-bone-white">
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: label.color || '#6b7280' }}
      />
      <span className="truncate max-w-[120px]">{label.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(label.id);
          }}
          className="ml-0.5 rounded-full p-0.5 hover:bg-muted-gray/40 transition-colors"
        >
          <X className="h-3 w-3 text-muted-gray hover:text-bone-white" />
        </button>
      )}
    </span>
  );
};

export default LabelChip;
