/**
 * ImageGallery - Displays post images in a grid layout
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PostImage } from '@/types/community';

interface ImageGalleryProps {
  images: PostImage[];
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images }) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const gridClass = (() => {
    switch (images.length) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-2';
      case 3:
        return 'grid-cols-2';
      case 4:
        return 'grid-cols-2';
      default:
        return 'grid-cols-2';
    }
  })();

  return (
    <>
      <div className={cn('grid gap-2 mt-3', gridClass)}>
        {images.slice(0, 4).map((image, index) => (
          <div
            key={index}
            className={cn(
              'relative overflow-hidden rounded-lg cursor-pointer bg-charcoal-black',
              images.length === 3 && index === 0 && 'row-span-2',
              images.length === 1 ? 'max-h-96' : 'h-40'
            )}
            onClick={() => setLightboxIndex(index)}
          >
            <img
              src={image.url}
              alt={image.alt || `Image ${index + 1}`}
              className="w-full h-full object-cover hover:opacity-90 transition-opacity"
            />
            {images.length > 4 && index === 3 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  +{images.length - 4}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-accent-yellow transition-colors"
            onClick={() => setLightboxIndex(null)}
          >
            <X className="w-8 h-8" />
          </button>

          <img
            src={images[lightboxIndex].url}
            alt={images[lightboxIndex].alt || `Image ${lightboxIndex + 1}`}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Navigation dots */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    idx === lightboxIndex ? 'bg-white' : 'bg-white/40'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(idx);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ImageGallery;
