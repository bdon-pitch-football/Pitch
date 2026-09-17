import type { Metadata } from 'next';
import { renderLegal } from '@/app/legal/legal-page';

// Doc 21, the privacy policy written for a child (legal register: served at
// /privacy/family, and shown inside the guardian approval flow).
export const metadata: Metadata = {
  title: 'Your privacy — for young players and families',
  robots: { index: false, follow: false },
};

export default function FamilyPrivacyPage() {
  return renderLegal('21-Privacy-Policy-Child.md');
}
