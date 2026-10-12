import React, { useState, useRef, useEffect } from 'react';
import './PlayerComponent.css';

interface Subtitle {
  language: string;
  url: string;
  format: 'srt' | 'vtt' | 'ass';
}

interface PlayerSource {
  provider: string;
  quality: string;
  resolution: string;
  url: string;
}

interface PlayerComponentProps {
  source: PlayerSource;
  audioTrack?: {
    language: string;
    type: string;
  };
  subtitles?: Subtitle[];
  title: string;
  onError?: (error: Error) => void;
}

export const PlayerComponent: React.FC<PlayerComponentProps> = ({
  source,
  audioTrack,
  subtitles = [],
  title,
  onError
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [selectedSubtitle, setSelectedSubtitle] = useState<Subtitle | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [quality, setQuality] = useState(source.quality);
  const [buffered, setBuffered] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateBuffered = () => {
      if (video.buffered.length > 0) {
        setBuffered((video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
      }
    };

    video.addEventListener('progress', updateBuffered);
    return () => video.removeEventListener('progress', updateBuffered);
  }, []);

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(err => {
        console.error('Play error:', err);
        onError?.(new Error('Impossible de lire la vidéo'));
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setCurrentTime(e.currentTarget.currentTime);
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration);
  };

  const handleSeek = (newTime: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    const video = videoRef.current;
    if (video) {
      video.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const handleToggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.volume = volume || 1;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  };

  const handleToggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!isFullscreen) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  const handlePlaybackRateChange = (newRate: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = newRate;
      setPlaybackRate(newRate);
    }
  };

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`player-container ${isFullscreen ? 'fullscreen' : ''}`}
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="player-video"
        src={source.url}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        crossOrigin="anonymous"
      />

      {/* Subtitles */}
      {selectedSubtitle && (
        <track
          kind="subtitles"
          src={selectedSubtitle.url}
          srcLang={selectedSubtitle.language}
          default
        />
      )}

      {/* Buffering indicator */}
      {isBuffering && (
        <div className="buffering-indicator">
          <div className="spinner"></div>
          <p>Chargement...</p>
        </div>
      )}

      {/* Controls */}
      {showControls && (
        <div className="player-controls">
          {/* Progress bar */}
          <div className="progress-bar-container">
            <div className="buffered-bar" style={{ width: `${buffered}%` }}></div>
            <div className="progress-bar" style={{ width: `${progressPercent}%` }}></div>
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={e => handleSeek(parseFloat(e.target.value))}
              className="progress-input"
            />
          </div>

          {/* Bottom controls */}
          <div className="controls-bottom">
            <div className="controls-left">
              <button className="control-btn" onClick={handlePlayPause} title={isPlaying ? 'Pause' : 'Lecture'}>
                {isPlaying ? '⏸️' : '▶️'}
              </button>

              <div className="volume-control">
                <button className="control-btn" onClick={handleToggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                  {isMuted ? '🔇' : '🔊'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                  className="volume-slider"
                />
              </div>

              <span className="time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="controls-center">
              <span className="title-display">{title}</span>
            </div>

            <div className="controls-right">
              {/* Playback speed */}
              <div className="speed-menu">
                <button className="control-btn">{playbackRate}x</button>
                <div className="speed-options">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                    <button
                      key={rate}
                      className={`speed-option ${playbackRate === rate ? 'active' : ''}`}
                      onClick={() => handlePlaybackRateChange(rate)}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtitles */}
              <div className="subtitles-menu">
                <button className="control-btn">CC</button>
                <div className="subtitles-options">
                  <button
                    className={`subtitle-option ${!selectedSubtitle ? 'active' : ''}`}
                    onClick={() => setSelectedSubtitle(null)}
                  >
                    Aucun
                  </button>
                  {subtitles.map((sub, idx) => (
                    <button
                      key={idx}
                      className={`subtitle-option ${selectedSubtitle === sub ? 'active' : ''}`}
                      onClick={() => setSelectedSubtitle(sub)}
                    >
                      {sub.language}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality selector */}
              <div className="quality-menu">
                <button className="control-btn">{quality}</button>
                <div className="quality-options">
                  {['720p', '1080p', '4K'].map(q => (
                    <button
                      key={q}
                      className={`quality-option ${quality === q ? 'active' : ''}`}
                      onClick={() => setQuality(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fullscreen */}
              <button
                className="control-btn"
                onClick={handleToggleFullscreen}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? '⛔' : '⛶'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerComponent;