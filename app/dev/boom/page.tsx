// A route that throws, so the 500 page can be PROVEN rather than reasoned
// about. app/error.tsx is the only screen in the product that cannot be
// reached by using the product correctly, and a failure surface nobody has
// rendered is a failure surface nobody has designed.
//
// Gated exactly as /design and /dev/outbox are: not found in production, so
// it is not a surface (the banned-word sweep and the route crawl both read
// this same shape). The render suite opens it; nothing else links to it.
import { notFound } from 'next/navigation';

export default function Boom() {
  if (process.env.NODE_ENV === 'production') notFound();
  throw new Error('deliberate: the render suite is checking the 500 page');
}
