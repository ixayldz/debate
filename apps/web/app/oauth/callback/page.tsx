import { Suspense } from 'react';
import { OAuthCallbackClient } from './callback-client';

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[450px] items-center justify-center px-4">
      <div className="soft-card w-full p-6 text-center">
        <h1 className="font-display text-2xl">OAuth</h1>
        <p className="mt-2 text-sm text-text/75">Authorizing...</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <OAuthCallbackClient />
    </Suspense>
  );
}
