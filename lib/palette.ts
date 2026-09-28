// The Night Match palette as values — ONE copy for the whole app.
// (Named palette, not tokens: doc 14 L46 reads the coach page for the word
// "token" to prove the coach link never carries one, and an import path is
// no reason to weaken a launch-gate check.)
//
// Until 16 Sep every screen carried its own `const T = {...}` — 46 private
// copies of the same colours. None had drifted yet, but that is how a token
// set forks: one screen nudges a grey and nothing notices. globals.css :root
// holds these same values as CSS custom properties, and
// scripts/palette-check.mjs fails if the two ever differ or if a screen starts
// its own palette again.
//
// Reach for var(--token) in stylesheets and classes. Use T where a literal
// colour is required: inline SVG attributes, image routes (ImageResponse has
// no CSS variables), and inline styles not yet moved onto classes.
// THE SURFACE STACK moved on 28 Sep — surface, surface2, sunken, line and
// muted. Both copies move in the same commit or scripts/palette-check.mjs
// fails, which is the point of it. The derivation and the rule (disclosure
// goes down, action goes up; the hairline does the elevation work; no shadows)
// are written out in app/globals.css :root. Four of these are charter values,
// so this is a proposal awaiting a D-number, not a settled token set.
export const T = {
  bg: '#0b120e',
  surface: '#1d2b23',
  surface2: '#25332c',
  sunken: '#15201a',
  line: '#32463b',
  ink: '#eef5f0',
  secondary: '#b9c8bf',
  muted: '#8a9d92',
  placeholder: '#6b7d73',
  accent: '#3ddc84',
  onAccent: '#06130c',
  amber: '#eda100',
  purple: '#a479e2',
  red: '#e34948',
} as const;

// Which custom property each value mirrors, for the sync check.
export const CSS_VAR: Record<keyof typeof T, string> = {
  bg: '--bg', surface: '--surface', surface2: '--surface-2', sunken: '--surface-sunken',
  line: '--line', ink: '--ink', secondary: '--secondary', muted: '--muted',
  placeholder: '--placeholder', accent: '--accent', onAccent: '--on-accent',
  amber: '--amber', purple: '--purple', red: '--red',
};
