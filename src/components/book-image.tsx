import React from 'react';

interface BookImageProps {
  imageUrl?: string | null;
  title: string;
  height?: string;
  className?: string;
}

export function BookImage({ imageUrl, title, height = "h-60", className = "" }: BookImageProps) {
  return (
    <>
      {imageUrl ? (
        <div className={`relative ${height} ${className}`}>
          <img 
            src={imageUrl} 
            alt={title} 
            className="w-full h-full object-contain bg-gray-50" 
            onError={(e) => {
              e.currentTarget.src = "https://via.placeholder.com/400x300?text=No+Image";
              e.currentTarget.onerror = null;
            }}
          />
        </div>
      ) : (
        <div className={`relative ${height} ${className} flex items-center justify-center bg-gray-100`}>
          <span className="text-gray-400 text-sm">No image available</span>
        </div>
      )}
    </>
  );
}