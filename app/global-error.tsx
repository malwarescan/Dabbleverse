'use client';

export const dynamic = 'force-dynamic';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <h1>Something went wrong!</h1>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
