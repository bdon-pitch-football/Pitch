'use server';
// The press that proves an address (0056, L21).
//
// A PRESS, never a page load — the same rule as the guardian's two channels
// (D-156, 0045): mail scanners follow links, and a GET that proved an address
// would turn a scanner into a person. The database marks the proof
// (fn_use_email_proof), single-use, so two simultaneous opens cannot both
// consume the link.
//
// FORM FIELDS, NOT bind(): this arrives from an email, often opening in a
// webview, and a bound action needs the client runtime to resolve its
// arguments — a 500 instead of a working button.
import { redirect } from 'next/navigation';
import { useAddressProof } from '@/lib/auth';
import { claimQuery } from '@/lib/claim-return';

export async function confirmAddress(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const personId = await useAddressProof(token);
  // A dead link and a fresh one end in the same two places: the sign-in page
  // or the panel that says this link is finished. Nothing here says whether
  // an account exists (D-94 §2).
  // F7: the club they were claiming rides along to the sign-in door.
  const claim = claimQuery(formData.get('claim'), '&');
  redirect(personId ? `/signin?confirmed=1${claim}` : `/confirm/${encodeURIComponent(token)}${claim.replace('&', '?')}`);
}
