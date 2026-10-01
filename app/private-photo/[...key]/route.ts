// The local private bucket (development only). In production an under-18's
// photo is fetched from Supabase with a signed URL and this route is a 404;
// here there is no bucket, so this stands in for one with the same rule: the
// address carries an expiry and an HMAC over the key and the expiry
// (lib/player-photo devPhotoUrl), minted by lib/storage imageSrc after the
// read was allowed, and dead once it expires. Nothing here asks who you are —
// neither does a signed URL. Every refusal is the same 404, so an address
// that expired, was tampered with or never existed cannot be told apart.
import { devPrivateImage } from '@/lib/storage';
import { PHOTO_URL_TTL_SECONDS } from '@/lib/player-photo';

export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const url = new URL(request.url);
  const body = devPrivateImage(key.join('/'), url.searchParams.get('e'), url.searchParams.get('s'));
  if (!body) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  return new Response(new Uint8Array(body), {
    headers: { 'content-type': 'image/jpeg', 'cache-control': `private, max-age=${PHOTO_URL_TTL_SECONDS}` },
  });
}
