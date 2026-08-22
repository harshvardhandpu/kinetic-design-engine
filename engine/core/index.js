/* KINETIC core — framework-independent primitive registry.
 * Every primitive exports { meta, mount } and honors the handle contract:
 * play/pause/seek/progress/state/destroy + reduced-motion a11y contract.
 */
import * as revealStagger from './primitives/reveal-stagger.js';
import * as marquee from './primitives/marquee.js';
import * as scrollProgress from './primitives/scroll-progress.js';
import * as hoverLift from './primitives/hover-lift.js';
import * as scrambleText from './primitives/scramble-text.js';
import * as pageTransition from './primitives/page-transition.js';
import * as cursorGlow from './primitives/cursor-glow.js';
import * as gridReveal from './primitives/grid-reveal.js';

export const primitives = {
  [revealStagger.meta.id]: revealStagger,
  [marquee.meta.id]: marquee,
  [scrollProgress.meta.id]: scrollProgress,
  [hoverLift.meta.id]: hoverLift,
  [scrambleText.meta.id]: scrambleText,
  [pageTransition.meta.id]: pageTransition,
  [cursorGlow.meta.id]: cursorGlow,
  [gridReveal.meta.id]: gridReveal,
};

export function mountById(id, el, opts) {
  const p = primitives[id];
  if (!p) throw new Error(`unknown kinetic primitive: ${id}`);
  return p.mount(el, opts);
}

export function ids() { return Object.keys(primitives); }
