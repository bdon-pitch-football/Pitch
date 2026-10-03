-- ---------------------------------------------------------------------------
-- 0178 — An erased child leaves no invitation behind (D-26; John, 3 Oct,
-- JOHN-to-LEO-parent-door-findings-3-oct.md §3.1, "Urgent (a)"; doc 14 I7).
-- Folded into the adult-guardian hotfix at Leo's request: the same release.
--
-- WHY THIS EXISTS. An under-16 is created when their parent approves the
-- invitation (lib/guardian-flow approveInvitation), and nothing tied the
-- invitation to the child it created. pending_invitation.child_id (0048,
-- on delete cascade) is set only for a 16–17, whose record existed first.
-- So when a family erased an under-16 (fn_erase_child, 0084), the approved
-- invitation stayed, holding the child's first name and date of birth and
-- the parent's name, email and mobile, and support's lookup still found it
-- by that number or address. The parent's mobile is held nowhere else.
--
-- WHY A NEW COLUMN, NOT child_id. John's note says "write child_id at
-- approval for every kind". child_id already means something else in four
-- places: it marks a 16–17's parent-confirmation in approveInvitation, in
-- /a/[id]'s wording (existing_child), in support's lookup (teen), and in the
-- funnel's linking of early events to an under-16's log (0077:
-- `pi.child_id is null`). Writing it for an under-16 would change what the
-- approval page says to a parent and quietly stop the funnel lines. So the
-- link John asked for is its own column, approved_child_id: the person an
-- approval was for, every band, on delete cascade. 0084's cascade is then
-- true for every child, and child_id keeps the one meaning it has.
--
-- WHAT IT DOES TO ROWS ALREADY THERE. Counts only are printed, never a row:
--   · backfilled: every approved invitation gets approved_child_id from its
--     own `approved` consent row (detail.invitation_id → subject_id), where
--     that person still exists;
--   · orphans deleted: approved invitations whose `approved` subject no
--     longer exists — the child was erased and the row stayed. They hold a
--     child's and a parent's details that D-26 said were gone;
--   · unattributed: approved invitations with no `approved` consent row at
--     all. Counted and left: nothing says whose they are;
--   · legacy: approved on one channel before 0045, whose NOT VALID check an
--     update would trip. Counted and left (none are expected: production
--     began after 0045).
-- John's I8 (clear approved rows after 30 days) and I9 (the approving
-- parent's own deletion) are not in this file; they wait for their build.
--
-- PRODUCTION (after 0177). `add column` with no default is a catalogue
-- change; the index is built on a small table; the backfill and the delete
-- touch only approved invitations. One transaction, re-run refused by the
-- ledger and by the column already existing.
-- ---------------------------------------------------------------------------

alter table pending_invitation
  add column approved_child_id uuid references person(id) on delete cascade;
comment on column pending_invitation.approved_child_id is
  'The person this invitation was approved for, every band (0178). Cascades the invitation away with them (D-26). child_id stays the 16–17 parent-confirmation marker (0048).';
create index pending_invitation_approved_child_idx on pending_invitation (approved_child_id);

do $m$
declare n_backfilled int; n_orphans int; n_unattributed int; n_legacy int;
begin
  with src as (
    select distinct on (pi.id) pi.id, ce.subject_id
      from pending_invitation pi
      join consent_event ce on ce.event = 'approved' and ce.detail ->> 'invitation_id' = pi.id::text
     where pi.approved_at is not null
     order by pi.id, ce.at
  ), done as (
    update pending_invitation pi set approved_child_id = src.subject_id
      from src
     where src.id = pi.id and exists (select 1 from person p where p.id = src.subject_id)
       -- 0045's two-channel rule is NOT VALID: a row approved on one channel
       -- before it is history, and an update would be re-checked against it
       -- and fail the release. Such rows are counted below and left.
       and pi.sms_confirmed_at is not null and pi.email_confirmed_at is not null
    returning 1)
  select count(*)::int into n_backfilled from done;

  with gone as (
    delete from pending_invitation pi
     where pi.approved_at is not null and pi.approved_child_id is null
       and exists (select 1 from consent_event ce where ce.event = 'approved' and ce.detail ->> 'invitation_id' = pi.id::text)
       and not exists (select 1 from consent_event ce join person p on p.id = ce.subject_id
                        where ce.event = 'approved' and ce.detail ->> 'invitation_id' = pi.id::text)
    returning 1)
  select count(*)::int into n_orphans from gone;

  select count(*)::int into n_legacy from pending_invitation pi
   where pi.approved_at is not null and pi.approved_child_id is null
     and (pi.sms_confirmed_at is null or pi.email_confirmed_at is null)
     and exists (select 1 from consent_event ce join person p on p.id = ce.subject_id
                  where ce.event = 'approved' and ce.detail ->> 'invitation_id' = pi.id::text);
  select count(*)::int into n_unattributed from pending_invitation pi
   where pi.approved_at is not null and pi.approved_child_id is null
     and not exists (select 1 from consent_event ce where ce.event = 'approved' and ce.detail ->> 'invitation_id' = pi.id::text);

  raise notice '0178: % approved invitation(s) tied to their child; % orphan(s) of an erased child deleted; % approved on one channel before 0045, left; % approved with no approval on the log, left.',
    n_backfilled, n_orphans, n_legacy, n_unattributed;
end $m$;
