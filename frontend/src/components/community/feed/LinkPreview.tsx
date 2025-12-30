/**
 * LinkPreview - Displays a link preview card with Open Graph metadata
 */
import React from 'react';
import { ExternalLink } from 'lucide-react';

interface LinkPreviewProps {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  siteName?: string | null;
}

const LinkPreview: React.FC<LinkPreviewProps> = ({
  url,
  title,
  description,
  image,
  siteName,
}) => {
  const displayUrl = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-3 border border-muted-gray/20 rounded-lg overflow-hidden hover:border-muted-gray/40 transition-colors"
    >
      {image && (
        <div className="w-full h-40 bg-charcoal-black">
          <img
            src={image}
            alt={title || 'Link preview'}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
      <div className="p-3 bg-charcoal-black/50">
        <div className="flex items-center gap-2 text-xs text-muted-gray mb-1">
          <ExternalLink className="w-3 h-3" />
          <span>{siteName || displayUrl}</span>
        </div>
        {title && (
          <h4 className="font-medium text-bone-white line-clamp-2 text-sm">
            {title}
          </h4>
        )}
        {description && (
          <p className="text-xs text-muted-gray line-clamp-2 mt-1">
            {description}
          </p>
        )}
      </div>
    </a>
  );
};

export default LinkPreview;
