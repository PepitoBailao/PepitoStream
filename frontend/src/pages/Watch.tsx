import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Player } from '../components/Player';
import { useStore } from '../store/useStore';

interface StreamSource {
  id: string;
  provider: string;
  link: string;
  quality: string;
  language: string;
  isVerified: boolean;
  latency: number | null;
  score: number;
}

export const Watch: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { preferredQuality, preferredLanguage, user } = useStore();
  const [content, setContent] = useState<any>(null);
  const [sources, setSources] = useState<StreamSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<StreamSource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        // Fetch content details
        const contentRes = await fetch(`/api/content/${slug}`);
        const contentData = await contentRes.json();
        setContent(contentData);

        // Fetch available sources
        const sourcesRes = await fetch(`/api/content/${contentData.id}/sources?quality=${preferredQuality}&language=${preferredLanguage}`);
        const sourcesData = await sourcesRes.json();
        setSources(sourcesData.data || []);
        
        if (sourcesData.data?.length > 0) {
          setSelectedSource(sourcesData.data[0]);
        }
      } catch (error) {
        console.error('Failed to fetch content:', error);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchContent();
    }
  }, [slug, preferredQuality, preferredLanguage]);

  const handleStreamProgress = async (currentTime: number, duration: number) => {
    if (!user || !content) return;
    
    try {
      await fetch('/api/stream/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          contentId: content.id,
          watched: Math.floor(currentTime),
          total: Math.floor(duration),
        }),
      });
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Chargement...</div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Contenu non trouvé</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Player */}
        {selectedSource && (
          <div className="mb-8">
            <Player
              source={selectedSource.link}
              title={content.title}
              onTimeUpdate={handleStreamProgress}
            />
          </div>
        )}

        {/* Content Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2">
            <h1 className="text-4xl font-bold text-white mb-4">{content.title}</h1>
            
            {/* Metadata */}
            <div className="flex gap-4 mb-6 text-gray-400">
              {content.rating && <span>⭐ {content.rating.toFixed(1)}/10</span>}
              {content.releaseDate && (
                <span>{new Date(content.releaseDate).getFullYear()}</span>
              )}
              {content.type && <span>{content.type.replace('_', ' ')}</span>}
            </div>

            {/* Description */}
            <p className="text-gray-300 text-lg mb-8">{content.description}</p>

            {/* Genres */}
            {content.genres?.length > 0 && (
              <div className="mb-8">
                <h3 className="text-white font-semibold mb-2">Genres</h3>
                <div className="flex gap-2 flex-wrap">
                  {content.genres.map((genre: string) => (
                    <span key={genre} className="bg-gray-800 text-gray-300 px-3 py-1 rounded">
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Cast */}
            {content.cast?.length > 0 && (
              <div className="mb-8">
                <h3 className="text-white font-semibold mb-2">Acteurs</h3>
                <p className="text-gray-400">{content.cast.slice(0, 5).join(', ')}</p>
              </div>
            )}
          </div>

          {/* Sidebar - Sources */}
          <div>
            <div className="bg-gray-800 rounded-lg p-6 sticky top-6">
              <h3 className="text-white font-semibold mb-4">Sources disponibles</h3>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sources.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => setSelectedSource(source)}
                    className={`w-full text-left p-3 rounded transition ${
                      selectedSource?.id === source.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <div className="font-semibold">{source.provider.toUpperCase()}</div>
                    <div className="text-sm opacity-75">
                      {source.quality} • {source.language.toUpperCase()}
                    </div>
                    <div className="text-xs opacity-50 mt-1">
                      {source.isVerified ? '✓ Vérifié' : 'Non vérifié'}
                      {source.latency && ` • ${source.latency}ms`}
                    </div>
                  </button>
                ))}
              </div>

              {sources.length === 0 && (
                <p className="text-gray-400 text-sm">Aucune source disponible</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};