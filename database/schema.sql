-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  profile_picture_url TEXT,
  bio TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  two_fa_enabled BOOLEAN DEFAULT FALSE,
  two_fa_secret VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content Metadata Table
CREATE TABLE IF NOT EXISTS content_metadata (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- 'movie', 'tv', 'anime'
  title VARCHAR(255) NOT NULL,
  original_title VARCHAR(255),
  description TEXT,
  year INTEGER,
  rating DECIMAL(3,1),
  genre VARCHAR(255),
  poster_url TEXT,
  backdrop_url TEXT,
  tmdb_id INTEGER UNIQUE,
  imdb_id VARCHAR(50),
  jikan_id INTEGER,
  status VARCHAR(50), -- 'active', 'archived', 'pending'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copies Table (Torrents/Links)
CREATE TABLE IF NOT EXISTS copies (
  id SERIAL PRIMARY KEY,
  content_id INTEGER NOT NULL,
  FOREIGN KEY (content_id) REFERENCES content_metadata(id),
  source VARCHAR(100) NOT NULL, -- 'ygg', 'c411', 'tr4ker', etc
  file_name VARCHAR(500) NOT NULL,
  file_size BIGINT,
  file_hash VARCHAR(255),
  video_codec VARCHAR(50),
  video_resolution VARCHAR(50),
  audio_tracks TEXT[], -- JSON array of audio tracks
  languages VARCHAR(50)[],
  bitrate INTEGER,
  duration_minutes INTEGER,
  seeders INTEGER,
  leechers INTEGER,
  is_verified BOOLEAN DEFAULT FALSE,
  is_available BOOLEAN DEFAULT TRUE,
  magnet_link TEXT,
  direct_link TEXT,
  season_number INTEGER,
  episode_number INTEGER,
  episode_title VARCHAR(255),
  release_group VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Preferences Table
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  preferred_language VARCHAR(10) DEFAULT 'vf', -- 'vf', 'vo', 'vostfr'
  quality_profile VARCHAR(50) DEFAULT 'pepito', -- 'pepito-cine', 'pepito', 'pepito-voyage', 'pepito-macqueen'
  max_bitrate INTEGER DEFAULT 25000,
  min_video_resolution VARCHAR(50) DEFAULT '720p',
  preferred_audio_format VARCHAR(50) DEFAULT 'ac3-5.1',
  allow_3d BOOLEAN DEFAULT FALSE,
  skip_intros BOOLEAN DEFAULT TRUE,
  auto_play_next BOOLEAN DEFAULT TRUE,
  subtitles_enabled BOOLEAN DEFAULT TRUE,
  subtitle_language VARCHAR(10) DEFAULT 'fr',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stream History Table
CREATE TABLE IF NOT EXISTS stream_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  content_id INTEGER NOT NULL,
  FOREIGN KEY (content_id) REFERENCES content_metadata(id),
  copy_id INTEGER,
  FOREIGN KEY (copy_id) REFERENCES copies(id),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  stopped_at TIMESTAMP,
  total_seconds INTEGER,
  watched_seconds INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  device VARCHAR(100),
  ip_address INET,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Watchlist Table
CREATE TABLE IF NOT EXISTS watchlist (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  content_id INTEGER NOT NULL,
  FOREIGN KEY (content_id) REFERENCES content_metadata(id),
  position INTEGER DEFAULT 0,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, content_id)
);

-- Reviews & Ratings Table
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  content_id INTEGER NOT NULL,
  FOREIGN KEY (content_id) REFERENCES content_metadata(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 10),
  comment TEXT,
  helpful_count INTEGER DEFAULT 0,
  unhelpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, content_id)
);

-- Cache Table
CREATE TABLE IF NOT EXISTS cache (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin Audit Log Table
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id INTEGER,
  changes JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Background Jobs Table
CREATE TABLE IF NOT EXISTS background_jobs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(100) NOT NULL,
  data JSONB,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_content_title ON content_metadata(title);
CREATE INDEX idx_content_year ON content_metadata(year);
CREATE INDEX idx_content_type ON content_metadata(type);
CREATE INDEX idx_copies_content ON copies(content_id);
CREATE INDEX idx_copies_source ON copies(source);
CREATE INDEX idx_history_user ON stream_history(user_id);
CREATE INDEX idx_history_content ON stream_history(content_id);
CREATE INDEX idx_watchlist_user ON watchlist(user_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_content ON reviews(content_id);
CREATE INDEX idx_cache_expires ON cache(expires_at);
CREATE INDEX idx_jobs_status ON background_jobs(status);
