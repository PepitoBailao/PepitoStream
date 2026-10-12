import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SearchComponent from './components/SearchComponent';
import StreamDetailsComponent from './components/StreamDetailsComponent';
import PlayerComponent from './components/PlayerComponent';
import './App.css';

interface SearchResult {
  id: string;
  title: string;
  poster: string;
  rating: number;
  year: number;
  type: 'movie' | 'series' | 'anime';
  sources: number;
}

interface PlayerState {
  streamId: string;
  sourceId: string;
  audioLanguage: string;
}

function App() {
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  const handleSearchSelect = (result: SearchResult) => {
    setSelectedResult(result);
    setPlayerState(null);
    setIsPlayerOpen(false);
  };

  const handlePlayClick = (source: any, audio: any) => {
    if (selectedResult) {
      setPlayerState({
        streamId: selectedResult.id,
        sourceId: source.id,
        audioLanguage: audio.language
      });
      setIsPlayerOpen(true);
    }
  };

  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <h1 className="app-title">🍿 PepitoStream</h1>
            <p className="app-subtitle">Trouvez et regardez vos contenus préférés</p>
          </div>
        </header>

        <main className="app-main">
          <Routes>
            <Route
              path="/"
              element={
                <div className="home-container">
                  <SearchComponent
                    onSelect={handleSearchSelect}
                    placeholder="Chercher un film, une série, un anime..."
                  />
                </div>
              }
            />
            <Route
              path="/details/:id"
              element={
                selectedResult && (
                  <div className="details-container">
                    <button className="back-btn" onClick={() => setSelectedResult(null)}>
                      ← Retour
                    </button>
                    <StreamDetailsComponent
                      streamId={selectedResult.id}
                      onPlayClick={handlePlayClick}
                    />
                  </div>
                )
              }
            />
          </Routes>

          {isPlayerOpen && playerState && (
            <div className="player-modal">
              <button
                className="close-player-btn"
                onClick={() => setIsPlayerOpen(false)}
              >
                ✕
              </button>
              <PlayerComponent
                source={{
                  provider: 'PepitoStream',
                  quality: '1080p',
                  resolution: '1920x1080',
                  url: `https://stream.example.com/video/${playerState.streamId}/${playerState.sourceId}`
                }}
                audioTrack={{
                  language: playerState.audioLanguage,
                  type: 'VF'
                }}
                subtitles={[
                  { language: 'Français', url: '#', format: 'vtt' },
                  { language: 'Anglais', url: '#', format: 'vtt' }
                ]}
                title={selectedResult?.title || 'Lecture'}
                onError={(error) => console.error('Player error:', error)}
              />
            </div>
          )}
        </main>

        <footer className="app-footer">
          <p>© 2026 PepitoStream - Tous droits réservés</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
