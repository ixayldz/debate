import { ResetPasswordClient } from './reset-password-client';

export default async function AuthResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawToken = params.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken || '';
  return <ResetPasswordClient token={token} />;
}
