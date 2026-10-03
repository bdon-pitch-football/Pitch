// The YouTube video a pasted link names, or null. Read from the link's own
// parts, not a pattern over the whole string, so every shape a phone's Share
// button or a browser's address bar hands a family plays inline: watch?v=
// (wherever v sits among the other parameters), youtu.be/, /shorts/, /live/
// and /embed/, on www., m. or the bare host. Anything else is null, and the
// façade opens it in a new tab instead (components/cv/ClipCard.tsx). An id is
// exactly YouTube's eleven characters, so nothing else rides into the embed
// address.
const ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeId(link: string): string | null {
  let u: URL;
  try { u = new URL(link); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean);
  let id: string | null | undefined = null;
  if (host === 'youtu.be') id = parts[0];
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
    if (parts[0] === 'watch') id = u.searchParams.get('v');
    else if (['shorts', 'live', 'embed'].includes(parts[0])) id = parts[1];
  }
  return id && ID.test(id) ? id : null;
}
