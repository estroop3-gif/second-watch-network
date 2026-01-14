/**
 * MoodboardListView - List view for moodboard items
 * Shows items in a horizontal layout with image + details side by side.
 */
import React from 'react';
import { Star, ExternalLink, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MoodboardItem } from '@/hooks/backlot';

interface MoodboardListViewProps {
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

export function MoodboardListView({ items, onItemClick, canEdit }: MoodboardListViewProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-gray">
        No items in this section
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="flex gap-4 p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 cursor-pointer transition-colors"
          onClick={() => onItemClick?.(item)}
        >
          {/* Thumbnail */}
          <div className="w-40 h-24 flex-shrink-0 rounded overflow-hidden bg-white/5">
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

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="font-medium text-bone-white truncate">
                  {item.title || `Item ${index + 1}`}
                </h4>
                {item.notes && (
                  <p className="text-sm text-muted-gray line-clamp-2 mt-1">
                    {item.notes}
                  </p>
                )}
              </div>

              {/* Rating */}
              {item.rating !== null && item.rating > 0 && (
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        'w-4 h-4',
                        star <= item.rating!
                          ? 'fill-accent-yellow text-accent-yellow'
                          : 'text-muted-gray/30'
                      )}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {item.category && (
                <Badge
                  variant="outline"
                  className={cn('text-xs', CATEGORY_COLORS[item.category])}
                >
                  {item.category}
                </Badge>
              )}

              {item.aspect_ratio && (
                <Badge variant="outline" className="text-xs border-white/20 text-muted-gray">
                  {item.aspect_ratio}
                </Badge>
              )}

              {item.tags && item.tags.length > 0 && (
                <div className="flex items-center gap-1">
                  <Tag className="w-3 h-3 text-muted-gray" />
                  <span className="text-xs text-muted-gray">
                    {item.tags.slice(0, 3).join(', ')}
                    {item.tags.length > 3 && ` +${item.tags.length - 3}`}
                  </span>
                </div>
              )}

              {item.source_url && (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-gray hover:text-bone-white"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Color palette */}
            {item.color_palette && item.color_palette.length > 0 && (
              <div className="flex items-center gap-1 mt-2">
                {item.color_palette.map((color, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-sm border border-white/10"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
