#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Doc 14 section S — assert the corpus agrees with itself, and says what it must.

v2, rebuilt to John's five findings (1 Sep):

  S2 knew one date.        Still only knows dates we already know are dead --
                            DEAD_DATES is a curated enumeration, not a general
                            date matcher. That is deliberate (matching any date
                            flagged a leap-year test row and every demo fixture)
                            and it is a LIMIT, not a fix. The version that
                            survives the next decision is the inverse: flag any
                            date in a live document, exempt one a locked decision
                            also states -- so a date dies when its decision dies
                            rather than when somebody edits a regex. (John, 1 Sep:
                            a docstring outliving its subject, in the file whose
                            job is catching that.)
  S1 and S6 skipped doc 15. Now included — it is where a price and a message
                            reach a customer, and where both are authored.
  S3 checked one citation.  Now every occurrence; right-then-wrong passes silently
                            otherwise, and that is the more dangerous direction.
  Nothing checked absence.  S9-S11 added. Every serious defect this fortnight was
                            an absence or a survival, not a contradiction:
                            doc 22 named no party, three banners outlived their
                            own subject, and eight markers pointed at nothing.
  S4 unbuilt.               Built — doc 18's question list is stable and John
                            treats it as an interface.

FALSE POSITIVES FIXED SO FAR: 5 (v1) + 0 (v2).
Keep that number visible. A check that has never produced a false positive is
usually a check that is not looking hard enough, and the day someone skips a
warning because "it always says that" is the day the control stops being one.
"""
import os, re, sys, html

ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
SKIP = ('_superseded', '_archive', '13-Board-Room', '_to_delete', 'repo', 'content')
FALSE_POSITIVES_FIXED = 8   # 5 in v1, 3 in v2 (S2 over-broad, S10 "not current", S12 quoting the old domain)
# Predicted next: S10. A legitimate do-not-publish warning and a banner that has
# outlived its subject look identical to a regex, and doc 22 carries three of the
# first kind. When it cries wolf, make the legitimate ones structurally
# distinguishable -- do not widen the exemption list. (John, 1 Sep.)

FAILS, WARNS = [], []
fail = lambda c, m: FAILS.append((c, m))
warn = lambda c, m: WARNS.append((c, m))


def live_files(exts=('.md', '.html')):
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP and not d.startswith('.')]
        if any(s in dirpath.split(os.sep) for s in SKIP):
            continue
        for f in sorted(filenames):
            if f.endswith(exts) and not f.startswith('_'):
                yield os.path.join(dirpath, f)


def text(p):
    s = open(p, encoding='utf-8', errors='replace').read()
    if p.endswith('.html'):
        s = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', s, flags=re.S)
        s = html.unescape(re.sub(r'<[^>]+>', ' ', s))
    return s


rel = lambda p: os.path.relpath(p, ROOT)
base = lambda p: os.path.basename(p)

REG = os.path.join(ROOT, '06-Design-Decisions-Register.html')
reg_raw = open(REG, encoding='utf-8').read()

DECISIONS = {m.group(1): {'lk': 'locked', 'pr': 'proposed', 'op': 'open'}[m.group(2)]
             for m in re.finditer(r'class="id">(D-\d+)</div><div class="st (lk|pr|op)"', reg_raw)}
MARKED = {m.group(1) for m in
          re.finditer(r'class="id">(D-\d+)</div>.{0,120}?<div class="t">(.*?)</div>', reg_raw, re.S)
          if re.search(r'\[(SUPERSEDED|DISPLACED|WITHDRAWN)', m.group(2))}


# ---------------------------------------------------------------- S7 tally
def s7():
    claimed = {v: int(k) for k, v in
               re.findall(r'<span class="tl"><b>(\d+)</b> (locked|proposed|open)</span>', reg_raw)}
    for k in ('locked', 'proposed', 'open'):
        actual = sum(1 for v in DECISIONS.values() if v == k)
        if claimed.get(k) != actual:
            fail('S7', f'tally says {claimed.get(k)} {k}, actual {actual}')


# ---------------------------------------------------------------- S3 citations
def s3():
    for p in live_files():
        if base(p) == base(REG):
            continue
        body = text(p)
        for d in sorted(set(re.findall(r'\bD-(\d{1,3})\b', body))):
            key = f'D-{int(d)}'
            if key not in DECISIONS:
                key = f'D-{int(d):02d}'
            if key not in DECISIONS:
                fail('S3', f'{rel(p)} cites D-{d}, which does not exist')
                continue
            if key not in MARKED:
                continue
            # EVERY occurrence, not the first — a file that gets it right first
            # and wrong later would otherwise pass silently.
            explained = False
            for m in re.finditer(r'\bD-0?' + str(int(d)) + r'\b', body):
                ctx = body[max(0, m.start() - 120):m.start() + 160]
                if re.search(r'supersed|displac|withdraw|stale|dead|no longer|replaced', ctx, re.I):
                    explained = True
            if not explained:
                warn('S3', f'{rel(p)} cites {key} (superseded/displaced) without saying so, in any mention')


# ---------------------------------------------------------------- S5 entity
ACN, ABN, ENTITY = '701879718', '65701879718', 'EBSD Enterprises Pty Ltd'
acn_ok = lambda d: (10 - (sum(int(a) * b for a, b in zip(d[:8], [8, 7, 6, 5, 4, 3, 2, 1])) % 10)) % 10 == int(d[8])


def abn_ok(d):
    n = [int(x) for x in d]; n[0] -= 1
    return sum(a * b for a, b in zip(n, [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19])) % 89 == 0


def s5():
    if not acn_ok(ACN):
        fail('S5', 'ACN check digit does not validate')
    if not abn_ok(ABN):
        fail('S5', 'ABN check digit does not validate')
    for p in live_files():
        body = text(p)
        for m in re.finditer(r'\bACN[:\s]*([\d\s]{9,13})', body):
            if m.group(1).strip().replace(' ', '') != ACN:
                fail('S5', f'{rel(p)} carries a different ACN: {m.group(1).strip()!r}')
        for m in re.finditer(r'\bABN[:\s]*([\d\s]{11,16})', body):
            if m.group(1).strip().replace(' ', '') != ABN:
                fail('S5', f'{rel(p)} carries a different ABN: {m.group(1).strip()!r}')


# ---------------------------------------------------------------- S1 prices
DEAD = {'$299': '$329', '$49': '$54', '$289': '$319'}
PRICED = ('legal/', 'design-screens/', '15-Message-Copy.md', '10-Build-Brief-CLAUDE.md',
          '17-Handover-to-Claude-Code.md')


def s1():
    for p in live_files():
        r = rel(p)
        if not (r.startswith(PRICED[:2]) or base(p) in PRICED):
            continue
        body = text(p)
        for dead, now in DEAD.items():
            for m in re.finditer(re.escape(dead) + r'(?![\d.])', body):
                ctx = body[max(0, m.start() - 110):m.start() + 110]
                if re.search(r'supersed|previous|was |formerly|old |before|correct|amended', ctx, re.I):
                    continue
                fail('S1', f'{r} states {dead} — the register holds {now} (D-109 amended)')


# ---------------------------------------------------------------- S2 dates
# S2 is the hardest check here and both attempts at it were wrong.
#
#   v1 matched the literal string "14 September" — a check against last month.
#   v2 matched any month with a day number — and flagged a leap-year test row,
#      every demo fixture date on every screen, and every document's own byline.
#
# The honest version does two separate, narrow things instead of one broad one.
# Dates on screens are demo data by design and are exempt wholesale.
DEAD_DATES = re.compile(
    r'\b(?:1[1-5]\s*(?:[–-]\s*1[1-5]\s*)?Sep(?:t|tember)?|9\s*Sep(?:t|tember)?|'
    r'2[18]\s*Sep(?:t|tember)?|30\s*Oct(?:ober)?)\b', re.I)
COMMITMENT = re.compile(
    r'(launch(?:es|ing)?|go(?:es)?[-\s]live|ship(?:s|ping)?|live)\s+'
    r'(?:on|by|is|date\s+is)?\s*(?:the\s+)?'
    r'(\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)', re.I)

DATE_EXEMPT = ('06-Design-Decisions-Register.html', '12-Social-Brief-ANNA.md',
               '07-Mission-Goals-Values.html', '27-Club-Verification-Call.md',
               '15-Message-Copy.md')


def s2():
    for p in live_files():
        r = rel(p)
        if base(p) in DATE_EXEMPT or r.startswith('design-screens/'):
            continue
        body = text(p)
        for rx, label in ((DEAD_DATES, 'a date from the dead runway'),
                          (COMMITMENT, 'a launch commitment')):
            for m in rx.finditer(body):
                ctx = body[max(0, m.start() - 260):m.start() + 260]
                if re.search(r'no longer|supersed|removed|dead|gone|not a date|undated|'
                             r'D-131|D-47|used to|previously', ctx, re.I):
                    continue
                fail('S2', f'{r} carries {label}: {m.group(0)!r} (D-131 removed the runway)')


# ---------------------------------------------------------------- S6 banned
BANNED = {'potential': r'\bpotential\b', 'insights': r'\binsights\b', 'struggling': r'\bstruggling\b',
          'applicant': r'\bapplicants?\b', 'declined': r'\bdeclined\b', 'rejected': r'\brejected\b',
          'unsuccessful': r'\bunsuccessful\b'}
SURFACES = ('design-screens/',)


def s6():
    for p in live_files():
        r = rel(p)
        on_surface = r.startswith(SURFACES) and 'walk-the-pitch' not in r
        is_copy = base(p) == '15-Message-Copy.md'
        if not (on_surface or is_copy):
            continue
        body = text(p)
        for word, pat in BANNED.items():
            for m in re.finditer(pat, body, re.I):
                if is_copy:
                    ctx = body[max(0, m.start() - 200):m.start() + 200]
                    if re.search(r'banned|never|not say|do not|why it', ctx, re.I):
                        continue   # doc 15 explains the ban; explaining is not using
                fail('S6', f'{r} contains banned word "{word}" (D-85, D-108)')


# ---------------------------------------------------------------- S4 cross-refs
def s4():
    d18 = os.path.join(ROOT, 'legal', '18-Solicitor-Brief-D27.html')
    if not os.path.exists(d18):
        warn('S4', 'doc 18 not found — cross-reference check skipped')
        return
    qs = {int(n) for n in re.findall(r'class="qnum">\s*Question\s+(\d+)', open(d18, encoding='utf-8').read())}
    if not qs:
        warn('S4', 'doc 18 question anchors not found — check the parse anchor')
        return
    for p in live_files():
        body = text(p)
        for m in re.finditer(r'\[LEGAL[:\s]*doc\s*(\d+)[,\s]*Q?\s*(\d+)?', body, re.I):
            doc_n, q_n = m.group(1), m.group(2)
            hits = [f for f in os.listdir(ROOT) + os.listdir(os.path.join(ROOT, 'legal'))
                    if f.startswith(f'{int(doc_n):02d}-')]
            if not hits:
                fail('S4', f'{rel(p)} points at doc {doc_n}, which does not exist')
            elif q_n and int(q_n) not in qs:
                fail('S4', f'{rel(p)} points at doc {doc_n} question {q_n}, which does not exist '
                           f'(doc 18 has 1–{max(qs)})')


# ---------------------------------------------------------------- S9-S11 absence
def s9_presence():
    """Every instrument names the entity and carries a version."""
    for p in live_files():
        r = rel(p)
        if not r.startswith('legal/') or base(p).startswith('00-'):
            continue
        body = text(p)
        if not re.search(re.escape(ENTITY), body, re.I):
            fail('S9', f'{r} names no legal entity — the defect in doc 22 was an absence, '
                       'not a contradiction')
        if not re.search(r'\bv\d+\.\d+\b', body):
            fail('S9', f'{r} carries no version string')


def s10_banners():
    """No live document carries a banner saying it is unrevised or not current."""
    # Must describe THIS DOCUMENT's revision state. "not currently offered" and
    # "not current behaviour" are statements about a product, and one of them is a
    # deliberate do-not-publish warning John wants kept. Five false positives.
    pat = re.compile(r'(this document has not (?:yet )?been (?:revised|updated)|'
                     r'do not treat (?:its|this|the) \w+|'
                     r'awaiting (?:a |his |her |their )?rewrite|'
                     r'has not been revised since|'
                     r'placeholders? throughout this document)', re.I)
    for p in live_files():
        body = text(p)
        for m in pat.finditer(body):
            ctx = body[max(0, m.start() - 200):m.start() + 200]
            if re.search(r'used to|previously|removed|corrected|no longer|was wrong', ctx, re.I):
                continue
            warn('S10', f'{rel(p)} carries a self-invalidating banner: {m.group(0)!r} — '
                        'a warning that outlives its subject teaches readers to distrust the sound parts')


def s11_claims():
    for p in live_files():
        r = rel(p)
        if r.startswith('06-') or r.startswith('legal/'):
            continue
        body = text(p)
        for m in re.finditer(r'(we|pitch)\s+(verif\w+|check\w*)\s+(the\s+)?age', body, re.I):
            ctx = body[max(0, m.start() - 120):m.start() + 60]
            if re.search(r'never|not\b|no\b|forbid|must not|cannot|imply|claim', ctx, re.I):
                continue
            fail('S11', f'{r} appears to claim Pitch verifies age (D-96)')


DOMAIN = 'pitchfootball.com.au'


def s12_domain():
    """One domain, spelled one way. The hyphenated form was in 122 places
    across 47 files -- including every SMS -- while three legal documents had
    already moved to the real one. Nobody could tell which was right by reading."""
    import itertools
    for p in itertools.chain(live_files(), [os.path.join(ROOT, 'repo', '.env.example')]):
        if not os.path.exists(p):
            continue
        body = open(p, encoding='utf-8', errors='replace').read()
        for m in re.finditer(r'\bpitch[-_]football\.com\.au\b', body, re.I):
            ctx = body[max(0, m.start() - 260):m.start() + 200]
            # A document explaining that the old form was wrong has to quote it.
            # False positive #8: D-150 says so at length.
            if re.search(r'does not resolve|wrong one|no hyphen|hyphenated|supersed|'
                         r'said <code>|was <code>|corrected|used to', ctx, re.I):
                continue
            fail('S12', f'{rel(p)} uses a domain that does not resolve: {m.group(0)!r} '
                        f'-- it is {DOMAIN}')


for fn in (s7, s3, s5, s1, s2, s6, s4, s9_presence, s10_banners, s11_claims, s12_domain):
    fn()

print(f'corpus check v2 — {len(DECISIONS)} decisions, '
      f'{sum(1 for v in DECISIONS.values() if v == "locked")} locked')
print(f'false positives fixed to date: {FALSE_POSITIVES_FIXED}\n')
for c, m in FAILS:
    print(f'  FAIL  {c}   {m}')
for c, m in WARNS:
    print(f'  warn  {c}  {m}')
if not FAILS and not WARNS:
    print('  clean')
print(f'\n{len(FAILS)} failures, {len(WARNS)} warnings')
sys.exit(1 if FAILS else 0)
