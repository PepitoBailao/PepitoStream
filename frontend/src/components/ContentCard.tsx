import React from 'react';
import { Star, Heart, Play } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Content } from '../store/useStore';

interface ContentCardProps {
  content: Content;
  onPlay?: (content: Content) => void;
  onAddFavorite?: (content: Content) => void;
}

export const ContentCard: React.FC<ContentCardProps> = ({
  content,
  onPlay,
  onAddFavorite,
}) => {
  const { favorites } = useStore();
  const isFavorite = favorites.some(fav => fav.id === content.id);

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 cursor-pointer group">
      {/* Image */}
      <div className="relative overflow-hidden bg-gray-900 aspect-video">
        <img
          src={content.image || '/placeholder.jpg'}
          alt={content.title}
          className="w-full h-full object-cover group-hover:brightness-50 transition-all"
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all flex items-center justify-center gap-4">
          <button
            onClick={() => onPlay?.(content)}
            className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100"
          >
            <Play className="w-6 h-6" />
          </button>
          <button
            onClick={() => onAddFavorite?.(content)}
            className={`p-3 rounded-full transition-all transform scale-75 group-hover:scale-100 ${
              isFavorite
                ? 'bg-red-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-red-600 hover:text-white'
            }`}
          >
            <Heart className={`w-6 h-6 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Type Badge */}
        <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
          {content.type === 'ANIME' ? 'Anime' : content.type === 'TV_SERIES' ? 'Série' : 'Film'}
        </div>
      </div>

      {/* Content Info */}
      <div className="p-3">
        <h3 className="text-white font-semibold line-clamp-2 mb-2">
          {content.title}
        </h3>

        {/* Rating */}
        {content.rating && (
          <div className="flex items-center gap-1 mb-2">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-yellow-400 text-sm">{content.rating.toFixed(1)}</span>
          </div>
        )}

        {/* Genres */}
        {content.genres.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-3">
            {content.genres.slice(0, 2).map((genre) => (
              <span
                key={genre}
                className="text-gray-400 text-xs bg-gray-700 px-2 py-1 rounded"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {content.description && (
          <p className="text-gray-300 text-sm line-clamp-2">
            {content.description}
          </p>
        )}
      </div>
    </div>
  );
};