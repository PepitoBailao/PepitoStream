# 🎬 PepitoStream

Advanced streaming platform with smart source management, quality optimization, and comprehensive anime support.

## Features

✨ **Smart Source Management**
- Automatic source selection based on quality and latency
- Multi-source redundancy with automatic failover
- Torrent and direct link aggregation

🌍 **Multi-Language Support**
- VF (French), VO (Original), VOSTFR (French Subtitles)
- Intelligent language fallback system
- Audio track detection from file metadata

📺 **Comprehensive Anime Support**
- Dedicated anime indexing via Jikan API
- Episode and season tracking
- Community rating integration

⚡ **Performance**
- Sub-10ms response times
- Intelligent caching system
- Optimized database queries

🎯 **Quality Profiles**
- **PepitoCiné**: Maximum quality (4K, remux)
- **PepitoDuVoyage**: Low bandwidth streaming
- **Pepito**: Balanced quality and speed
- **PepitoMacqueen**: Fast loading priority

🔐 **Security & Privacy**
- JWT-based authentication
- User preference privacy controls
- Secure API key management
- 2FA support

## Tech Stack

### Frontend
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Query** - Data fetching
- **Zustand** - State management
- **Framer Motion** - Animations

### Backend
- **Next.js API Routes** - Serverless functions
- **Express.js** - API server
- **PostgreSQL** - Database
- **Redis** - Caching
- **Node.js** - Runtime

### External APIs
- **TMDB** - Movie/TV metadata
- **Jikan** - Anime data
- **TorBox** - Torrent information
- **Trackers** - YGG, C411, Tr4ker, DMM, Draupnirr

## Project Structure

```
PepitoStream/
├── src/
│   ├── components/          # React components
│   ├── pages/              # Next.js pages & API routes
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utility functions
│   ├── styles/             # Global styles
│   └── types/              # TypeScript types
├── backend/                # Express.js server
├── database/               # Database schema & migrations
├── scripts/                # Utility scripts
├── public/                 # Static assets
└── docs/                   # Documentation
```

## Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/PepitoBailao/PepitoStream.git
cd PepitoStream
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

4. **Initialize database**
```bash
npm run db:init
npm run db:migrate
```

5. **Start development server**
```bash
npm run dev
```

Visit `http://localhost:3000`

## Development

### Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript check
npm run format       # Format code with Prettier
npm run db:init      # Initialize database
npm run db:migrate   # Run migrations
```

## Quality Profiles Configuration

### PepitoCiné (Maximum Quality)
- Video: 4K (2160p) preferred, 1080p minimum
- Audio: TrueHD Atmos 7.1, DTS-HD
- Format: REMUX preferred, BluRay acceptable
- Max size: 54GB

### Pepito (Balanced)
- Video: 1080p preferred, 720p minimum
- Audio: AC3 5.1, AAC stereo
- Format: BluRay, WEB-DL
- Max size: 5GB

### PepitoDuVoyage (Low Bandwidth)
- Video: 720p preferred, 480p minimum
- Audio: AAC stereo only
- Format: WEB-DL, compressed
- Max size: 2GB

### PepitoMacqueen (Fast Loading)
- Video: 480p preferred
- Audio: AAC stereo only
- Format: WEB-DL only
- Max size: 1GB

## Database

The project uses PostgreSQL with the following main tables:

- `users` - User accounts
- `content_metadata` - Movies/TV shows/Anime
- `copies` - Torrent/stream copies
- `stream_history` - Viewing history
- `watchlist` - User watchlists
- `reviews` - User reviews
- `user_preferences` - Quality and language preferences

See `database/schema.sql` for the complete schema.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

### Content
- `GET /api/content/search` - Search content
- `GET /api/content/:id` - Get content details
- `GET /api/content/:id/sources` - Get available sources

### User
- `GET /api/user/profile` - Get user profile
- `GET /api/user/watchlist` - Get watchlist
- `GET /api/user/history` - Get watch history
- `POST /api/user/preferences` - Update preferences

## Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

- Never commit `.env` files
- Report security issues to: security@pepito-stream.com
- All API calls are rate-limited
- User data is encrypted at rest

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

PepitoStream is for educational purposes only. Users are responsible for ensuring they have the right to stream all content. We do not host, provide, or distribute copyrighted content.

## Support

- 📧 Email: support@pepito-stream.com
- 💬 Discord: [Join our server](https://discord.gg/pepito-stream)
- 🐛 Issues: [GitHub Issues](https://github.com/PepitoBailao/PepitoStream/issues)

---

Made with ❤️ by PepitoBailao
