// The HTML part of every email — drawn FROM the plain text, never written
// beside it (BUZ, 1 Oct: spec K, E1, E3, E9; doc 15 rule 12).
//
// Doc 15 is written as text, and the text stays the message. Until 1 Oct it
// was the only part: robust in every theme and with pictures off, but with no
// sender a stranger could place, none of doc 15's bold, and a 55-character
// random string as the only thing to press. The HTML part fixes those three
// and nothing else. Because it is generated from the text that already sends,
// it cannot say anything the text does not: the permission suite strips this
// HTML to its visible words and checks they ARE the text part (em-text).
//
// What the HTML part never carries, and why:
//   · No image of any kind. A hosted logo is a tracking pixel — it tells our
//     server when a parent opened an email about their child — and an inline
//     one is an attachment, which §19 forbids. The wordmark is live type.
//   · No tracking and no rewritten link. Every href is our own domain or the
//     one support address, exactly as printed. Open and click tracking are
//     OFF on the Resend domain (docs/team/GO-LIVE.md); with them on, Resend
//     would add a pixel and rewrite these links, and nothing here could stop it.
//   · No club crest or colours (E9). A crest is an image fetch, and a club
//     inbox is shared and forwarded.
//   · No web font, no script, no stylesheet link, no "view in browser".
//
// The parts, from the text:
//   · paragraphs split on blank lines;
//   · `Label: https://pitchfootball.com.au/…` becomes a button, ONLY where
//     doc 15 draws one for that message (BUTTONS) — so a name or role a
//     stranger typed (§6) can never be turned into something to press;
//   · `- ` lines become a list; §34's code and §20's "It goes to:" a well;
//   · the sign-off stays in the panel and the line after it (the site and
//     contact line, and §19's opt-out) goes to the footer, in the same order;
//   · doc 15's bold comes from BOLD, which wraps words already there and
//     cannot add or change one. A pattern that misses renders unbolded.
// Every value is HTML-escaped, including the name and role a stranger typed
// into §6 (D-94 §6).
//
// One action gets one green button. Where doc 15 sets two choices side by
// side with equal weight (EQUAL), every button is plain and nothing is green
// (D-53). A choice that is doing nothing — "Let it expire", "Ignore" — is
// never drawn as a button (E4): its words, while doc 15 has them, are text.
//
// Pure: no database, no environment, no framework. lib/messaging calls it at
// dispatch, so a retried row renders exactly as its first attempt did.
import { T } from './palette.ts';
import { SUPPORT_EMAIL } from './support.ts';

const SITE_URL = 'https://pitchfootball.com.au';

/**
 * E8: `https://` on every link in the plain-text part. Outlook for Windows
 * links nothing without a scheme, so a bare address made a parent copy a
 * 32-character token by hand. An address already carrying a scheme, or a
 * mailbox on the domain, is left alone. SMS never comes through here: doc 15
 * writes texts without the scheme, and they stay that way.
 */
export const withScheme = (body: string): string =>
  body.replace(/(?<![\w@./:-])pitchfootball\.com\.au/g, SITE_URL);

// The buttons doc 15 draws, per message, by label. A `Label: address` line
// whose label is not here is text.
const BUTTONS: Record<string, RegExp[]> = {
  'doc15.§2': [/^Review and approve$/],
  'doc15.§2b': [/^Confirm it's me$/],
  'doc15.§5': [/^Renew for another 90 days$/],
  'doc15.§10': [/^Set a new password$/],
  'doc15.§10a': [/^Set your password$/],
  'doc15.§10b': [/^Confirm your address$/],
  'doc15.§13': [/^Leave it on, or turn it off$/],
  'doc15.§19': [/^Open [^:\n]{1,60}'s CV$/],
  'doc15.§20': [/^Check the address and send$/],
  'doc15.§22': [/^See what they sent$/, /^Turn sending off$/],
  'doc15.§23': [/^Renew for another 90 days$/],
  'doc15.§24.email': [/^Open Pitch$/],
  'doc15.§27': [/^Read it on Pitch$/],
  'doc15.§28': [/^Sign in to read it$/],
  'doc15.§29': [/^See the card$/],
  'doc15.§30': [/^See what changed$/],
  'doc15.§31': [/^Manage or cancel this subscription$/],
  'doc15.§32': [/^Update the card$/],
  'doc15.§33': [/^Change your password$/],
  'doc15.§36': [/^Switch this link off$/],
  'doc15.§37': [/^Switch this link off$/],
};

/** Doc 15 gives these messages two choices of equal weight: no button is green. */
export const EQUAL = new Set(['doc15.§5', 'doc15.§6', 'doc15.§13', 'doc15.§20', 'doc15.§22', 'doc15.§23']);

const lit = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const NAME = "[^\\n]{1,60}?";
/**
 * Doc 15's bold, per message — a second copy of its emphasis, kept here next
 * to the renderer, and the permission suite fails if one of these is not
 * found in its message (em-bold). Names, clubs and dates doc 15 bolds are
 * values, not words, and are left plain.
 */
export const BOLD: Record<string, RegExp[]> = {
  'doc15.§2': [lit('Nothing is visible to anyone until you approve it.'), lit('What you are agreeing to, in plain words:'),
    new RegExp(`^${NAME} will not appear in any search\\.`), new RegExp(`^No one can contact ${NAME} directly\\.`),
    lit('You hold the share link.'), new RegExp(`^You see everything ${NAME} sees\\.`)],
  'doc15.§2b': [lit("but they can't send it until you confirm you're their parent."), lit('Once you confirm:'),
    new RegExp(`^You're told every time ${NAME} sends their CV to a club`), new RegExp(`^No one can contact ${NAME} directly\\.`),
    new RegExp(`^You can pause ${NAME}'s page at any time\\.`)],
  'doc15.§6': [lit('We have not given them anything.'), lit('This is unverified.')],
  'doc15.§8': [lit('the content is not visible to anyone.')],
  'doc15.§16': [lit('Two things remain, and we want to be straight about both.')],
  'doc15.§17': [lit("If you're under 18: that's completely fine, and Pitch is built for you.")],
  'doc15.§19': [lit('Replies to this message do not reach the family.'), new RegExp(`^If you want ${NAME} at a trial`)],
  'doc15.§29': [lit("Once it's out, we can't take it back")],
  'doc15.§30': [lit("The page hasn't gone blank and nothing has been taken down.")],
  'doc15.§31': [lit('Tax invoice'), lit('PITCH FOOTBALL')],
  'doc15.§32': [lit('Nothing has changed yet.'), lit('Nothing is deleted.')],
  'doc15.§34': [lit('It does not give you anything about any player under 18,')],
  'doc15.§35': [lit('You can ask again whenever you like.')],
  'doc15.§36': [new RegExp(`^If you switch it off, the club can no longer open ${NAME}'s page\\.`)],
  'doc15.§37': [lit('that link still works'), lit('We have not switched it off for you.')],
};

/** §2's preview line is doc 15's own preheader; every other one is the email's opening sentence. */
const PREHEADER: Record<string, string> = { 'doc15.§2': 'Nothing goes live until you say so.' };

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const FONT = "Archivo,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";
const P = (size: string, weight: number, colour: string, lh: number, margin = '0 0 16px') =>
  `margin:${margin};font-family:${FONT};font-size:${size};font-weight:${weight};line-height:${lh};color:${colour}`;
const BODY = P('15px', 500, T.secondary, 1.6);
const LEAD = P('16.5px', 700, T.ink, 1.5);
const STRONG = `color:${T.ink};font-weight:800`;
const LINK = `color:${T.muted};text-decoration:underline`;

// The words of a line, with doc 15's bold and a mailto on the support
// address. Ranges are found on the raw text and each piece is escaped, so a
// bold pattern can only ever wrap what is already there.
function inline(raw: string, key: string | undefined): string {
  const ranges: [number, number][] = [];
  for (const re of (key && BOLD[key]) || []) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    for (const m of raw.matchAll(g)) {
      const a = m.index ?? 0, b = a + m[0].length;
      if (b > a && !ranges.some(([x, y]) => a < y && b > x)) ranges.push([a, b]);
    }
  }
  ranges.sort((p, q) => p[0] - q[0]);
  const mail = (s: string) => esc(s).split(SUPPORT_EMAIL)
    .join(`<a href="mailto:${SUPPORT_EMAIL}" style="color:inherit;text-decoration:underline">${SUPPORT_EMAIL}</a>`);
  let out = '', at = 0;
  for (const [a, b] of ranges) {
    out += mail(raw.slice(at, a)) + `<strong style="${STRONG}">${mail(raw.slice(a, b))}</strong>`;
    at = b;
  }
  return out + mail(raw.slice(at));
}

// Footer lines: our own addresses become links, as printed; nothing else does.
function footerInline(raw: string): string {
  return raw.split(/(https:\/\/pitchfootball\.com\.au(?:[A-Za-z0-9/_\-?=&.~%]*[A-Za-z0-9/_\-=&~%])?)/).map((part, i) => {
    // break-all: §19's opt-out is one 120-character address, wider than a phone.
    if (i % 2 === 1) return `<a href="${esc(part)}" style="${LINK};word-break:break-all">${esc(part)}</a>`;
    return esc(part).split(SUPPORT_EMAIL).join(`<a href="mailto:${SUPPORT_EMAIL}" style="${LINK}">${SUPPORT_EMAIL}</a>`);
  }).join('');
}

const BUTTON_LINE = /^([^:\n]{1,60}): (https:\/\/pitchfootball\.com\.au(?:\/\S*)?)$/;

function button(label: string, url: string, primary: boolean): string {
  const a = primary
    ? `display:block;height:50px;line-height:50px;font-family:${FONT};font-size:15px;font-weight:800;color:${T.onAccent};letter-spacing:0.02em;text-decoration:none;text-align:center;border-radius:14px`
    : `display:block;height:46px;line-height:46px;font-family:${FONT};font-size:14px;font-weight:700;color:${T.ink};text-decoration:none;text-align:center;border-radius:14px`;
  const td = primary
    ? `align="center" bgcolor="${T.accent}" style="background:${T.accent};border-radius:14px"`
    : `align="center" bgcolor="${T.surface2}" style="background:${T.surface2};border:1px solid ${T.line};border-radius:14px"`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:4px 0 0"><tr><td ${td}>`
    + `<a href="${esc(url)}" style="${a}">${esc(label)}</a></td></tr></table>`
    // The address under every button, so a client that will not draw the
    // button (Outlook squares it; some strip it) still has the way through.
    + `<p style="${P('12.5px', 500, T.muted, 1.5, '9px 0 20px')};word-break:break-all"><a href="${esc(url)}" style="${LINK}">${esc(url)}</a></p>`;
}

export interface RenderedEmail { text: string; html: string }

/**
 * Render one email as its two parts. `key` is the doc 15 key; a row that has
 * lost it renders as plain paragraphs with no button and no bold.
 */
export function renderEmail(key: string | undefined, subject: string, body: string): RenderedEmail {
  const text = withScheme(body);
  const paras = text.split(/\n{2,}/).map((p) => p.split('\n'));
  // The LAST sign-off is the template's own: words typed by someone else
  // (§6's name and role) come before it, so they can never be moved into the
  // footer, where addresses become links.
  const signAt = paras.findLastIndex((l) => l[0].startsWith('— Pitch'));
  const main = signAt === -1 ? paras : paras.slice(0, signAt);
  const signOff = signAt === -1 ? null : paras[signAt][0];
  const footer = signAt === -1 ? [] : [...paras[signAt].slice(1), ...paras.slice(signAt + 1).flat()];

  const allowed = (key && BUTTONS[key]) || [];
  const isButton = (line: string) => {
    const m = BUTTON_LINE.exec(line);
    return m && allowed.some((re) => re.test(m[1])) ? { label: m[1], url: m[2] } : null;
  };
  const buttons = main.flat().filter((l) => isButton(l)).length;
  const primary = !!key && !EQUAL.has(key) && buttons === 1;

  let first = true; // nothing but "Hi," has been drawn yet
  let preview = key ? PREHEADER[key] ?? '' : '';
  const parts: string[] = [];
  for (const lines of main) {
    if (lines.every((l) => l.startsWith('- '))) {
      parts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px">${lines.map((l) =>
        `<tr><td width="20" valign="top" aria-hidden="true" style="font-family:${FONT};font-size:15px;font-weight:800;line-height:1.6;color:${T.muted};padding:0 0 10px">&#8226;</td>`
        + `<td valign="top" style="font-family:${FONT};font-size:15px;font-weight:500;line-height:1.6;color:${T.secondary};padding:0 0 10px">${inline(l.slice(2), key)}</td></tr>`).join('')}</table>`);
      first = false;
      continue;
    }
    if (key === 'doc15.§34' && lines.length === 1 && /^[A-Z0-9]{2,8}(?: [A-Z0-9]{2,8})?$/.test(lines[0])) {
      parts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px"><tr><td align="center" bgcolor="${T.sunken}" style="background:${T.sunken};border-radius:12px;padding:18px 12px">`
        + `<p style="margin:0;font-family:${MONO};font-size:34px;font-weight:800;line-height:1.2;letter-spacing:0.14em;color:${T.ink}">${esc(lines[0])}</p></td></tr></table>`);
      continue;
    }
    const well = key === 'doc15.§20' && lines.length === 1 ? /^(It goes to:) (\S+@\S+)$/.exec(lines[0]) : null;
    if (well) {
      // §20: the address in full, in monospace, above the fold — where a
      // fourteen-year-old's typo gets caught (D-99).
      parts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px"><tr><td bgcolor="${T.sunken}" style="background:${T.sunken};border-radius:12px;padding:14px 16px">`
        + `<p style="margin:0;font-family:${FONT};font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${T.muted}">${esc(well[1])}</p>`
        + `<p style="margin:6px 0 0;font-family:${MONO};font-size:15px;font-weight:800;line-height:1.4;color:${T.ink};word-break:break-all">${esc(well[2])}</p></td></tr></table>`);
      continue;
    }
    let run: string[] = [];
    const flush = () => {
      if (!run.length) return;
      const hi = lines.length === 1 && run[0] === 'Hi,';
      // The lead is the opening paragraph after any "Hi," — one line of it.
      const isLead = first && !hi && lines.length === 1;
      if (!hi) {
        if (!preview) preview = /^.*?[.?!:](?=\s|$)/.exec(run[0])?.[0] ?? run[0];
        first = false;
      }
      parts.push(`<p style="${isLead ? LEAD : BODY}">${run.map((l) => inline(l, key)).join('<br>')}</p>`);
      run = [];
    };
    for (const l of lines) {
      const b = isButton(l);
      if (b) { flush(); parts.push(button(b.label, b.url, primary)); } else run.push(l);
    }
    flush();
  }
  if (signOff) parts.push(`<p style="${P('15px', 700, T.ink, 1.6, '6px 0 0')}">${inline(signOff, undefined)}</p>`);

  const foot = footer.map((l) => `<p style="${P('12px', 500, T.muted, 1.55, '0 0 4px')}">${footerInline(l)}</p>`).join('');
  const html = `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<meta name="format-detection" content="telephone=no,date=no,address=no">
<title>${esc(subject)}</title>
<!--[if mso]><style>table,td,p,a,span,strong{font-family:Arial,sans-serif!important}</style><![endif]-->
<style>
:root{color-scheme:dark;supported-color-schemes:dark}
body{margin:0!important;padding:0!important;background:${T.bg}}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
@media (max-width:480px){.pf-outer{padding:20px 0 30px!important}.pf-panel{background:${T.bg}!important;border:0!important;padding:0 18px!important}.pf-foot{padding-left:18px!important;padding-right:18px!important}}
@media print{body,table,td,p,a,span,strong{background:#ffffff!important;color:${T.bg}!important;border-color:#cccccc!important}}
</style>
</head>
<body style="margin:0;padding:0;background:${T.bg}" bgcolor="${T.bg}">
<div aria-hidden="true" style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${T.bg}">${esc(preview)}${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.bg}" style="background:${T.bg}"><tr><td class="pf-outer" align="center" style="padding:28px 20px 36px">`
+ `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">`
// The wordmark, as type (D-173: top right). Not an image — see the top of this file.
+ `<tr><td align="right" style="padding:0 4px 14px"><div aria-hidden="true" style="font-family:${FONT};font-size:20px;font-weight:900;line-height:1;color:${T.ink};letter-spacing:-0.035em">P<span style="color:${T.accent}">I</span>TCH</div></td></tr>`
+ `<tr><td class="pf-panel" bgcolor="${T.surface}" style="background:${T.surface};border:1px solid ${T.line};border-radius:16px;padding:30px 32px 28px">${parts.join('')}</td></tr>`
+ (foot ? `<tr><td class="pf-foot" style="padding:20px 4px 0">${foot}</td></tr>` : '')
+ `</table></td></tr></table>
</body>
</html>
`;
  return { text, html };
}
