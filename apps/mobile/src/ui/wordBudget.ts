/**
 * Word budget of a screen state (docs/product/engagement.md E1, D-E4). Jest measures the rendered host tree: drawn text
 * counts, accessibility labels do not, a closed fold costs nothing because its children are not rendered.
 */

/** Exempt drawn text, marked on ui/Text. An `icon` label sits beside its pictogram and has at most three words. */
export type Budget = 'icon' | 'error' | 'declaration' | 'rules';

const ICON_WORDS = 3;

/** The part of a rendered host element the count reads, as the test renderer exposes it. */
export type HostNode = { type: string; props: Record<string, unknown>; children: readonly (HostNode | string)[] };

/** Whitespace-separated tokens with at least one letter. "02:30", "29" and "·" are not words, "2 d 5 h" has two. */
export function words(text: string): string[] {
  return text.split(/\s+/).filter(token => /\p{L}/u.test(token));
}

// Joins one outermost text with its nested spans, as it is drawn. An exempt span leaves a space so words on either side stay apart.
function drawn(node: HostNode | string): string {
  if (typeof node === 'string') return node;
  if (node.props.budget) { exempt(node); return ' '; }
  return node.children.map(drawn).join('');
}

function exempt(node: HostNode) {
  if (node.props.budget !== 'icon') return;
  const label = node.children.map(child => typeof child === 'string' ? child : drawn(child)).join('');
  const count = words(label).length;
  if (count > ICON_WORDS) throw new Error(`icon label has ${count} words, at most ${ICON_WORDS}: "${label}"`);
}

/** Counts the drawn words below `root`. The list names them, so a failing ratchet shows what was added. */
export function visibleWords(root: HostNode): { count: number; words: string[] } {
  const found: string[] = [];
  const walk = (node: HostNode | string) => {
    if (typeof node === 'string') return;
    if (node.type === 'Text') { found.push(...words(drawn(node))); return; }
    node.children.forEach(walk);
  };
  walk(root);
  return { count: found.length, words: found };
}
