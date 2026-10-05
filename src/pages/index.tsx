import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  return (
    <>
      <Head>
        <title>PepitoStream - Advanced Streaming Platform</title>
        <meta name="description" content="PepitoStream - Smart streaming with quality optimization" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gradient-dark">
        {/* Header */}
        <nav className="flex justify-between items-center p-6 border-b border-dark-tertiary">
          <div className="text-3xl font-black text-accent">🎬 PepitoStream</div>
          <div className="flex gap-4">
            <Link href="/auth/login" className="btn-secondary">
              Login
            </Link>
            <Link href="/auth/register" className="btn-primary">
              Sign Up
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4">
          <h1 className="text-6xl font-black text-white text-center mb-6">
            Watch Smarter, Not Harder
          </h1>
          <p className="text-xl text-gray-300 text-center mb-8 max-w-2xl">
            PepitoStream combines advanced source management, quality optimization, and anime support
            for the ultimate streaming experience.
          </p>

          <div className="flex gap-4">
            <Link href="/browse" className="btn-primary text-lg px-8 py-3">
              Explore Now
            </Link>
            <Link href="#features" className="btn-secondary text-lg px-8 py-3">
              Learn More
            </Link>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 px-4 bg-dark-secondary">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold text-center mb-12">Why Choose PepitoStream?</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: '⚡ Ultra-Fast',
                  description: 'Responses in under 10ms with intelligent caching',
                },
                {
                  title: '🎯 Smart Sources',
                  description: 'Automatically selects best quality and language options',
                },
                {
                  title: '🌍 Multi-Language',
                  description: 'Supports VF, VO, VOSTFR with automatic fallback',
                },
                {
                  title: '📺 Anime Support',
                  description: 'Dedicated anime indexing and source management',
                },
                {
                  title: '🔄 Auto-Failover',
                  description: 'Seamlessly switches sources if playback fails',
                },
                {
                  title: '⚙️ Custom Profiles',
                  description: 'PepitoCiné, PepitoDuVoyage, and more quality profiles',
                },
              ].map((feature, i) => (
                <div key={i} className="card">
                  <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                  <p className="text-gray-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-dark-tertiary py-12 px-4">
          <div className="max-w-6xl mx-auto text-center text-gray-400">
            <p>&copy; 2026 PepitoStream. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </>
  );
}
