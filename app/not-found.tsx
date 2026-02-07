import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-broadcast-bg">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-text-primary mb-4">404</h1>
        <h2 className="text-2xl text-text-secondary mb-6">Page Not Found</h2>
        <p className="text-text-tertiary mb-8">
          The page you're looking for doesn't exist.
        </p>
        <Link 
          href="/" 
          className="inline-block px-6 py-3 bg-momentum-up text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          Go back home
        </Link>
      </div>
    </div>
  );
}
