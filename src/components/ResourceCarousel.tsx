import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  images: { id: string; image_url: string }[];
  mainImage?: string | null;
  alt?: string;
  className?: string;
}

const ResourceCarousel = ({ images, mainImage, alt = "", className = "w-full h-28 object-cover" }: Props) => {
  const allImages = [
    ...(mainImage ? [{ id: "main", image_url: mainImage }] : []),
    ...images,
  ];

  const [current, setCurrent] = useState(0);

  if (allImages.length === 0) return null;
  if (allImages.length === 1) {
    return <img src={allImages[0].image_url} alt={alt} className={className} />;
  }

  return (
    <div className="relative group">
      <img
        src={allImages[current].image_url}
        alt={alt}
        className={className}
      />
      {/* Dots */}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
        {allImages.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
            className={`h-1.5 rounded-full transition-all ${
              i === current ? "w-4 bg-white" : "w-1.5 bg-white/50"
            }`}
          />
        ))}
      </div>
      {/* Arrows */}
      {current > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setCurrent(current - 1); }}
          className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {current < allImages.length - 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setCurrent(current + 1); }}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default ResourceCarousel;
