'use server';
import { redirect } from 'next/navigation';
import { saveCvDraft } from '@/lib/cv-build';
import { STAT_KEYS, type StatKey } from '@/lib/football';
import { requireRecordActor } from '@/lib/record-guard';

export async function saveDraft(recordId: string, formData: FormData) {
  // Never trust the record id in the URL (D-94 §3).
  await requireRecordActor(recordId);
  const positions = String(formData.get('positions') ?? '').split(',').filter(Boolean);
  const stats: Partial<Record<StatKey, number | null>> = {};
  for (const k of STAT_KEYS) {
    const raw = String(formData.get(`stat_${k}`) ?? '').trim();
    stats[k] = raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0);
  }
  await saveCvDraft(recordId, {
    positions,
    squadNumber: formData.get('squadNumber') ? Number(formData.get('squadNumber')) : null,
    foot: (formData.get('foot') as 'Left' | 'Right') || null,
    about: String(formData.get('about') ?? ''),
    surfacedStats: String(formData.get('surfaced') ?? '').split(',').filter(Boolean) as StatKey[],
    stats,
    season: '2026',
  });
  redirect(`/build/${recordId}?saved=1`);
}
