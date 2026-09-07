// Sign out. A route handler rather than a page because only a handler (or a
// server action) may write cookies, and the cookie IS the session.
//
// This answers GET on purpose. A forged cross-site request can therefore sign
// somebody out — which costs them one sign-in and reveals nothing — and in
// exchange a parent handing the laptop back can reach it by typing the word.
// That trade is only acceptable because signing out destroys no data; nothing
// else in this product answers a state change on GET.
import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  await clearSession();
  return NextResponse.redirect(new URL('/signin?out=1', request.url));
}
