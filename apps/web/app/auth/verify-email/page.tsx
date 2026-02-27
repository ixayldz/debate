import { VerifyEmailClient } from './verify-email-client';

export default async function AuthVerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawToken = params.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken || '';
  return <VerifyEmailClient token={token} />;
}
