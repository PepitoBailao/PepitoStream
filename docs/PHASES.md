# 📋 PepitoStream - Development Phases

Complete project roadmap with all 13 phases of development.

## Phase 1: Authentication & User Management
- User registration and login
- JWT-based authentication
- Password hashing with bcryptjs
- User profile management
- Email verification

## Phase 2: Content Metadata Management
- Integration with TMDB API
- Integration with Jikan API for anime
- Content search functionality
- Metadata caching
- Genre and category management

## Phase 3: Source Management & Indexing
- Torrent indexing from multiple trackers (YGG, C411, Tr4ker, DMM, Draupnirr)
- Direct link aggregation
- Source verification
- File name parsing and metadata extraction
- Quality detection (video codec, resolution, audio tracks)

## Phase 4: Smart Streaming & Quality Optimization
- Quality profile system (PepitoCiné, Pepito, PepitoDuVoyage, PepitoMacqueen)
- Automatic source selection based on:
  - User preferences
  - Network latency
  - Video bitrate
  - Audio quality
- Bitrate calculation and validation
- File size to duration ratio analysis

## Phase 5: Multi-Language Support
- Language detection from file metadata
- VF (French) / VO (Original) / VOSTFR (French Subtitles) support
- Intelligent fallback system:
  - User requests VF → if not available, try VOSTFR → if not available, try VO
  - User requests VO → if not available, try VOSTFR → if not available, try VF
- Audio track mapping

## Phase 6: Anime Integration
- Anime-specific metadata via Jikan API
- Episode tracking for series
- Season management
- Anime rating and community reviews
- Anime search with advanced filters

## Phase 7: Player & Streaming
- Video player integration (HLS/DASH support)
- Torrent streaming via WebTorrent/Webtorrent
- Direct link streaming
- Resolution switching
- Playback quality adaptation
- Seek support
- Subtitle rendering

## Phase 8: Search & Discovery
- Full-text search implementation
- Advanced filtering:
  - By type (movies, TV, anime)
  - By year
  - By genre
  - By language
  - By quality
  - By rating
- Trending content
- New releases
- Personalized recommendations based on watch history

## Phase 9: Watch History & Statistics
- Track viewing activity
- Resume watching functionality
- Watch time statistics
- Completion tracking
- Device tracking
- IP logging for security
- User statistics dashboard

## Phase 10: Watchlist & Favorites
- Add/remove from watchlist
- Organize watchlist with custom sorting
- Mark as favorite
- Notification for new episodes/seasons
- Priority ordering

## Phase 11: Reviews & Ratings
- User ratings (1-10 scale)
- Written reviews
- Helpful/unhelpful voting
- Community review aggregation
- Rating display on content pages

## Phase 12: User Profile & Preferences
- User profile page
- Edit profile (username, bio, avatar)
- Quality preferences per profile
- Stream settings:
  - Video codec preferences
  - Audio format preferences
  - Subtitle preferences
- Privacy controls
- Notification settings
- 2FA setup and management
- Session management
- Download history

## Phase 13: Admin Dashboard
- Content management:
  - Add/edit/delete content
  - Bulk import functionality
  - Metadata editing
  - Source verification
- User management:
  - View user activity
  - Ban/restrict users
  - View user preferences
- Analytics:
  - Streaming statistics
  - Popular content
  - User engagement metrics
- System monitoring:
  - Database health
  - Cache status
  - Background job queue
  - Error logs
- Source management:
  - Tracker configuration
  - Source health check
  - Manual source verification
- Moderation:
  - Content reports
  - User reports
  - Blocked content management

## Technology Stack

### Frontend
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- React Query
- Zustand
- Framer Motion
- React Hot Toast

### Backend
- Next.js API Routes
- Express.js
- PostgreSQL
- Redis
- Node.js

### External Services
- TMDB API
- Jikan API
- TorBox API
- Tracker APIs (YGG, C411, Tr4ker, DMM, Draupnirr)

## Database Schema

Key tables:
- `users` - User accounts and authentication
- `content_metadata` - Movies, TV shows, and anime
- `copies` - Torrents and direct links
- `stream_history` - Watch history
- `watchlist` - User watchlists
- `reviews` - User reviews and ratings
- `user_preferences` - Quality and language settings
- `cache` - Caching layer
- `admin_audit_log` - Admin actions logging
- `background_jobs` - Async job queue

## Deployment

Recommended deployment stack:
- Frontend: Vercel, Netlify, or self-hosted Node.js
- Backend: Self-hosted Express or Vercel serverless
- Database: PostgreSQL (managed or self-hosted)
- Cache: Redis (managed or self-hosted)
- Cloudflare Tunnel for private deployment on personal server

## Performance Goals

- Response time: < 10ms (with caching)
- Search response: < 100ms
- Content load: < 500ms
- Video start time: < 3 seconds
- Database queries: < 50ms (avg)

## Security Considerations

- JWT authentication with secure tokens
- Password hashing with bcryptjs
- 2FA support via TOTP
- CORS configuration
- Rate limiting on API endpoints
- SQL injection prevention with parameterized queries
- XSS protection
- CSRF token validation
- Secure HTTP headers
- User data encryption at rest

## Future Enhancements

- Social features (follow, share)
- User collections
- Advanced recommendation algorithm
- Multi-user household accounts
- Offline download support
- Progressive Web App (PWA)
- Mobile applications
- Subtitle download and sync
- Casting support (Chromecast, AirPlay)
- Integration with other streaming services
