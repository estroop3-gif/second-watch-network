/**
 * MoodboardGridView - Uniform grid view for moodboard items
 * Standard grid layout with consistent card sizes.
 */
import React from 'react';
import { Star, Tag, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MoodboardItem } from '@/hooks/backlot';

interface MoodboardGridViewProps {
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

export function MoodboardGridView({ items, onItemClick, canEdit }: MoodboardGridViewProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-gray">
        No items in this section
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((item, index) => (
        <Card
          key={item.id}
          className="bg-white/5 border-white/10 hover:border-white/20 cursor-pointer transition-colors overflow-hidden group"
          onClick={() => onItemClick?.(item)}
        >
          {/* Image container */}
          <div className="aspect-video bg-white/10 relative overflow-hidden">
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

            {/* Category badge overlay */}
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

            {/* Rating overlay */}
            {item.rating !== null && item.rating > 0 && (
              <div className="absolute top-2 right-2 flex items-center bg-black/50 backdrop-blur-sm rounded px-1.5 py-0.5">
                <Star className="w-3 h-3 fill-accent-yellow text-accent-yellow" />
                <span className="text-xs text-accent-yellow ml-0.5">{item.rating}</span>
              </div>
            )}
          </div>

          {/* Card content */}
          <CardContent className="p-3">
            {/* Title */}
            <h4 className="font-medium text-bone-white truncate text-sm">
              {item.title || `Item ${index + 1}`}
            </h4>

            {/* Notes preview */}
            {item.notes && (
              <p className="text-xs text-muted-gray line-clamp-1 mt-0.5">
                {item.notes}
              </p>
            )}

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <Tag className="w-3 h-3 text-muted-gray" />
                <span className="text-xs text-muted-gray truncate">
                  {item.tags.slice(0, 2).join(', ')}
                  {item.tags.length > 2 && ` +${item.tags.length - 2}`}
                </span>
              </div>
            )}

            {/* Color palette */}
            {item.color_palette && item.color_palette.length > 0 && (
              <div className="flex items-center gap-0.5 mt-2">
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

            {/* Source link */}
            {item.source_url && (
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-muted-gray hover:text-bone-white mt-2"
              >
                <ExternalLink className="w-3 h-3" />
                Source
              </a>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
