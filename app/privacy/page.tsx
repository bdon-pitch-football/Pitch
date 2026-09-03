import type { Metadata } from 'next';
import { renderLegal } from '@/app/legal/legal-page';

export const metadata: Metadata = {
  title: 'Privacy policy — Pitch Football',
  robots: { index: false, follow: false }, // only the front page ranks (doc 29 §7)
};

export default function PrivacyPage() {
  return renderLegal('20-Privacy-Policy-Adult.md');
}
