import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './StreamDetailsComponent.css';

interface AudioTrack {
  language: string;
  codec: string;
  channels: string;
  bitrate: string;
  type: 'VF' | 'VOSTFR' | 'VO' | 'other';
}

interface Source {
  id: string;
  provider: string;
  quality: string;
  resolution: string;
  fps: number;
  bitrate: string;
  languages: AudioTrack[];
  score: number;
  url: string;
}

interface StreamDetails {
  id: string;
  title: string;
  poster: string;
  synopsis: string;
  rating: number;
  year: number;
  genres: string[];
  runtime: number;
  director: string;
  cast: string[];
  sources: Source[];
  bestSource: Source;
  availableAudio: AudioTrack[];
}

interface StreamDetailsComponentProps {
  streamId: string;
  onPlayClick?: (source: Source, audio: AudioTrack) => void;
}

export const StreamDetailsComponent: React.FC<StreamDetailsComponentProps> = ({
  streamId,
  onPlayClick
}) => {
  const [details, setDetails] = useState<StreamDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<AudioTrack | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'sources' | 'audio'>('overview');

  useEffect(() => {
    fetchStreamDetails();
  }, [streamId]);

  const fetchStreamDetails = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`/api/streams/${streamId}`, {
        timeout: 10000
      });
      setDetails(response.data);
      setSelectedSource(response.data.bestSource);
      setSelectedAudio(response.data.bestSource.languages[0]);
    } catch (err) {
      setError('Erreur lors du chargement des détails');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAudioOptions = async () => {
    if (!selectedSource) return;
    try {
      const response = await axios.get(`/api/streams/${streamId}/audio`, {
        params: { sourceId: selectedSource.id },
        timeout: 5000
      });
      setSelectedAudio(response.data.recommended);
    } catch (err) {
      console.error('Audio fetch error:', err);
    }
  };

  const handlePlay = () => {
    if (selectedSource && selectedAudio) {
      onPlayClick?.(selectedSource, selectedAudio);
    }
  };

  if (isLoading) {
    return <div className="stream-details loading">Chargement...</div>;
  }

  if (error || !details) {
    return <div className="stream-details error">{error}</div>;
  }

  return (
    <div className="stream-details">
      {/* Header avec poster */}
      <div className="details-header">
        <img src={details.poster} alt={details.title} className="details-poster" />
        <div className="details-header-content">
          <h1 className="details-title">{details.title}</h1>
          <div className="details-meta">
            <span className="rating">⭐ {details.rating}/10</span>
            <span className="year">📅 {details.year}</span>
            <span className="runtime">⏱️ {details.runtime}min</span>
          </div>
          <div className="details-genres">
            {details.genres.map(genre => (
              <span key={genre} className="genre-badge">{genre}</span>
            ))}
          </div>
          <p className="details-synopsis">{details.synopsis}</p>
          <div className="details-credits">
            <p><strong>Réalisateur:</strong> {details.director}</p>
            <p><strong>Casting:</strong> {details.cast.slice(0, 3).join(', ')}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="details-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Aperçu
        </button>
        <button
          className={`tab-btn ${activeTab === 'sources' ? 'active' : ''}`}
          onClick={() => setActiveTab('sources')}
        >
          📺 Sources ({details.sources.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
          onClick={() => setActiveTab('audio')}
        >
          🔊 Audio ({details.availableAudio.length})
        </button>
      </div>

      {/* Content */}
      <div className="details-content">
        {activeTab === 'overview' && (
          <div className="tab-overview">
            <div className="overview-box">
              <h3>✨ Meilleure source</h3>
              <div className="best-source">
                <div className="source-badge">{details.bestSource.provider}</div>
                <div className="source-stats">
                  <span>📊 {details.bestSource.quality}</span>
                  <span>📐 {details.bestSource.resolution}</span>
                  <span>🎬 {details.bestSource.fps}fps</span>
                  <span>🎯 Score: {details.bestSource.score}/100</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sources' && (
          <div className="tab-sources">
            <div className="sources-grid">
              {details.sources.map(source => (
                <div
                  key={source.id}
                  className={`source-card ${selectedSource?.id === source.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedSource(source);
                    fetchAudioOptions();
                  }}
                >
                  <div className="source-provider">{source.provider}</div>
                  <div className="source-quality">{source.quality}</div>
                  <div className="source-resolution">{source.resolution}</div>
                  <div className="source-fps">{source.fps}fps</div>
                  <div className="source-bitrate">{source.bitrate}</div>
                  <div className="source-score">
                    <span className="score-label">Score</span>
                    <span className="score-value">{source.score}/100</span>
                  </div>
                  <div className="source-languages">
                    {source.languages.map((lang, idx) => (
                      <span key={idx} className="lang-badge">{lang.type}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="tab-audio">
            <div className="audio-options">
              {details.availableAudio.map((audio, idx) => (
                <div
                  key={idx}
                  className={`audio-option ${selectedAudio === audio ? 'selected' : ''}`}
                  onClick={() => setSelectedAudio(audio)}
                >
                  <div className="audio-type">
                    <span className="type-badge">{audio.type}</span>
                    <span className="language">{audio.language}</span>
                  </div>
                  <div className="audio-specs">
                    <span className="codec">🎵 {audio.codec}</span>
                    <span className="channels">🔊 {audio.channels}</span>
                    <span className="bitrate">📊 {audio.bitrate}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="audio-recommendation">
              <div className="recommendation-box">
                <h4>💡 Recommandation</h4>
                <p>
                  {details.availableAudio.some(a => a.type === 'VF')
                    ? 'Version Française disponible'
                    : 'Meilleure qualité en VOSTFR'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Play Button */}
      <div className="details-action">
        <button className="play-btn" onClick={handlePlay}>
          ▶️ Lire maintenant
        </button>
        <button className="info-btn">
          ❓ Plus d'infos
        </button>
      </div>
    </div>
  );
};

export default StreamDetailsComponent;