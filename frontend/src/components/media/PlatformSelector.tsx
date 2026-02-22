import { useMediaPlatforms } from '@/hooks/media';

interface PlatformSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

const PlatformSelector = ({ selectedIds, onChange }: PlatformSelectorProps) => {
  const { data: platforms, isLoading } = useMediaPlatforms();

  const togglePlatform = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((pid) => pid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  if (isLoading) {
    return <div className="text-xs text-muted-gray">Loading platforms...</div>;
  }

  if (!platforms?.length) {
    return <div className="text-xs text-muted-gray">No platforms configured.</div>;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {platforms.map((platform: any) => (
        <label
          key={platform.id}
          className="inline-flex items-center gap-2 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(platform.id)}
            onChange={() => togglePlatform(platform.id)}
            className="w-4 h-4 rounded border-muted-gray/50 bg-charcoal-black accent-accent-yellow"
          />
          <span className="flex items-center gap-1.5 text-sm text-bone-white">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: platform.color || '#6b7280' }}
            />
            {platform.name}
          </span>
        </label>
      ))}
    </div>
  );
};

export default PlatformSelector;
