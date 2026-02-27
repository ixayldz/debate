'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestPhoneOtp, verifyPhoneOtp } from '@/lib/api/auth-api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button, Input } from '@/components/common/ui';

export default function PhoneLoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deliveryId, setDeliveryId] = useState<string | undefined>();

  const handleRequestOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await requestPhoneOtp(phone);
      setDeliveryId(response.deliveryId);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP gonderilemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await verifyPhoneOtp({
        phone,
        code,
        username: username || undefined,
        displayName: displayName || undefined,
        language: 'tr',
      });

      if (!response.accessToken) {
        setError('Telefon dogrulama sonrasi token uretilmedi');
        return;
      }

      setSession(response.accessToken, response.user);

      router.push('/hall');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP dogrulamasi basarisiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-3xl">Telefon Ile Giris</h1>
        <p className="text-sm text-text/70">SMS kodu ile hizli giris yap.</p>
      </div>

      {step === 'phone' ? (
        <form className="space-y-3" onSubmit={handleRequestOtp}>
          <Input
            placeholder="+905xxxxxxxxx"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? 'Gonderiliyor...' : 'Kodu Gonder'}
          </Button>
        </form>
      ) : (
        <form className="space-y-3" onSubmit={handleVerify}>
          <Input
            placeholder="6 haneli kod"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
          <Input
            placeholder="Yeni kullaniciysan kullanici adi"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <Input
            placeholder="Yeni kullaniciysan gorunen ad"
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          {deliveryId ? <p className="text-xs text-text/70">Teslimat ID: {deliveryId}</p> : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? 'Dogrulaniyor...' : 'Dogrula ve Giris Yap'}
          </Button>
        </form>
      )}
    </div>
  );
}
