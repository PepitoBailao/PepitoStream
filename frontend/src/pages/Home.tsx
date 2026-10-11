import React, { useState, useEffect } from 'react';
import { Search } from '../components/Search';
import { ContentCard } from '../components/ContentCard';
import { useStore } from '../store/useStore';
import { Content } from '../store/useStore';

export const Home: React.FC = () => {
  const { favorites, addFavorite, removeFavorite } = useStore();
  const [trending, setTrending] = useState<Content[]>([]);
  const [popular, setPopular] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        // Fetch trending content
        const trendingRes = await fetch('/api/content/trending?limit=20');
        const trendingData = await trendingRes.json();
        setTrending(trendingData.data || []);

        // Fetch popular content
        const popularRes = await fetch('/api/content/popular?limit=20');
        const popularData = await popularRes.json();
        setPopular(popularData.data || []);
      } catch (error) {
        console.error('Failed to fetch content:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, []);

  const handleAddFavorite = (content: Content) => {
    const isFavorite = favorites.some(fav => fav.id === content.id);
    if (isFavorite) {
      removeFavorite(content.id);
    } else {
      addFavorite(content);
    }
  };

  const handlePlay = (content: Content) => {
    window.location.href = `/watch/${content.slug}`;
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-blue-900 to-gray-900 py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold text-white mb-8">PepitoStream</h1>
          <p className="text-xl text-gray-300 mb-8">
            Le meilleur agrégateur de contenu en streaming
          </p>
          <Search />
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        {loading ? (
          <div className="text-center text-gray-400">Chargement...</div>
        ) : (
          <>
            {/* Trending Section */}
            <section className="mb-16">
              <h2 className="text-3xl font-bold text-white mb-8">Tendances</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {trending.map((content) => (
                  <ContentCard
                    key={content.id}
                    content={content}
                    onPlay={handlePlay}
                    onAddFavorite={handleAddFavorite}
                  />
                ))}
              </div>
            </section>

            {/* Popular Section */}
            <section>
              <h2 className="text-3xl font-bold text-white mb-8">Populaire</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {popular.map((content) => (
                  <ContentCard
                    key={content.id}
                    content={content}
                    onPlay={handlePlay}
                    onAddFavorite={handleAddFavorite}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};