/**
 * MoodboardMasonryView - Pinterest-style masonry layout for moodboard items
 * Uses CSS Grid with variable row spans based on aspect ratio.
 */
import React from 'react';
import { Star, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MoodboardItem } from '@/hooks/backlot';

interface MoodboardMasonryViewProps {
  items: MoodboardItem[];
  onItemClick?: (item: MoodboardItem) => void;
  canEdit: boolean;
}

// Category colors for badges
const CATEGORY_COLORS: Record<string, string> = {
  Lighting: 'border-yellow-500/50 text-yellow-400',
  Wardrobe: 'border-pink-500/50 text-pink-400',
  Location: 'border-green-500/50 text-green-400',
  Props: 'border-orange-500/50 text-orange-400',
  Color: 'border-purple-500/50 text-purple-400',
  Character: 'border-blue-500/50 text-blue-400',
  Mood: 'border-cyan-500/50 text-cyan-400',
  Other: 'border-gray-500/50 text-gray-400',
};

// Get row span based on aspect ratio
function getRowSpan(aspectRatio: string | null): number {
  switch (aspectRatio) {
    case 'portrait':
      return 35;
    case 'landscape':
      return 18;
    case 'square':
    default:
      return 24;
  }
}

export function MoodboardMasonryView({ items, onItemClick, canEdit }: MoodboardMasonryViewProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-gray">
        No items in this section
      </div>
    );
  }

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gridAutoRows: '10px',
      }}
    >
      {items.map((item, index) => {
        const rowSpan = getRowSpan(item.aspect_ratio);

        return (
          <div
            key={item.id}
            className="group relative rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 cursor-pointer transition-colors"
            style={{ gridRowEnd: `span ${rowSpan}` }}
            onClick={() => onItemClick?.(item)}
          >
            {/* Image */}
            <div className="absolute inset-0">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.title || `Item ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-gray">
                  No image
                </div>
              )}
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-3">
                {/* Title */}
                <h4 className="font-medium text-bone-white truncate text-sm">
                  {item.title || `Item ${index + 1}`}
                </h4>

                {/* Meta */}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {item.category && (
                    <Badge
                      variant="outline"
                      className={cn('text-xs', CATEGORY_COLORS[item.category])}
                    >
                      {item.category}
                    </Badge>
                  )}

                  {item.rating !== null && item.rating > 0 && (
                    <div className="flex items-center">
                      <Star className="w-3 h-3 fill-accent-yellow text-accent-yellow" />
                      <span className="text-xs text-accent-yellow ml-0.5">{item.rating}</span>
                    </div>
                  )}

                  {item.tags && item.tags.length > 0 && (
                    <span className="text-xs text-muted-gray">
                      {item.tags.length} tag{item.tags.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Color palette */}
                {item.color_palette && item.color_palette.length > 0 && (
                  <div className="flex items-center gap-0.5 mt-2">
                    {item.color_palette.map((color, i) => (
                      <div
                        key={i}
                        className="w-4 h-4 rounded-sm border border-white/20"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Category badge (always visible) */}
            {item.category && (
              <div className="absolute top-2 left-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs bg-black/50 backdrop-blur-sm',
                    CATEGORY_COLORS[item.category]
                  )}
                >
                  {item.category}
                </Badge>
              </div>
            )}

            {/* Rating (always visible) */}
            {item.rating !== null && item.rating > 0 && (
              <div className="absolute top-2 right-2 flex items-center bg-black/50 backdrop-blur-sm rounded px-1.5 py-0.5">
                <Star className="w-3 h-3 fill-accent-yellow text-accent-yellow" />
                <span className="text-xs text-accent-yellow ml-0.5">{item.rating}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
