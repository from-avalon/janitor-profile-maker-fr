/*
 * Drop-in style packs.
 *
 * Every preset is written inside JanitorAI's restrictions: no url(), no CSS
 * variables, no nesting, no column-gap/row-gap, no @property or @container. If
 * you edit these, keep them that way — the linter will tell you if you slip.
 *
 * Presets are appended to the stylesheet between markers so the app can toggle
 * one off again without touching anything the creator wrote around it.
 */
(function (global) {
  'use strict';

  var PRESETS = [
    {
      id: 'glass',
      name: 'Frosted glass',
      category: 'Whole profile',
      blurb: 'Translucent panels with a blurred backdrop. Sits well on top of a busy background image.',
      css:
'.pp-uc-background,\n' +
'.pp-cc-wrapper {\n' +
'  background: linear-gradient(160deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.02));\n' +
'  border: 1px solid rgba(255, 255, 255, 0.18);\n' +
'  border-radius: 18px;\n' +
'  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.22);\n' +
'  backdrop-filter: blur(14px);\n' +
'}\n' +
'.profile-background-box-1,\n' +
'.profile-background-box-2,\n' +
'.profile-background-box-3,\n' +
'.pp-cc-gradient-1,\n' +
'.pp-cc-gradient-2,\n' +
'.pp-cc-gradient-3 {\n' +
'  background: transparent;\n' +
'}\n' +
'.pp-uc-about-me {\n' +
'  background: rgba(0, 0, 0, 0.22);\n' +
'  border-radius: 12px;\n' +
'  padding: 14px 16px;\n' +
'}\n' +
'.pp-top-bar-app-menu-list {\n' +
'  background: rgba(20, 20, 28, 0.72);\n' +
'  border: 1px solid rgba(255, 255, 255, 0.18);\n' +
'  border-radius: 14px;\n' +
'  backdrop-filter: blur(14px);\n' +
'  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);\n' +
'}\n' +
'.pp-top-bar-app-menu-list-item:hover {\n' +
'  background: rgba(255, 255, 255, 0.10);\n' +
'}\n'
    },
    {
      id: 'neon',
      name: 'Neon wire',
      category: 'Whole profile',
      blurb: 'Dark panels, hot pink and cyan edges, everything glowing slightly.',
      css:
'.pp-uc-background,\n' +
'.pp-cc-wrapper {\n' +
'  background: #0b0714;\n' +
'  border: 1px solid #ff2d95;\n' +
'  border-radius: 14px;\n' +
'  box-shadow: 0 0 18px rgba(255, 45, 149, 0.55), inset 0 0 24px rgba(45, 226, 230, 0.14);\n' +
'}\n' +
'.profile-background-box-1,\n' +
'.pp-cc-gradient-1 { background: transparent; }\n' +
'.pp-uc-title {\n' +
'  color: #2de2e6;\n' +
'  letter-spacing: 2px;\n' +
'  text-shadow: 0 0 6px #2de2e6, 0 0 22px rgba(45, 226, 230, 0.6);\n' +
'}\n' +
'.pp-cc-name {\n' +
'  color: #ff2d95;\n' +
'  text-shadow: 0 0 8px rgba(255, 45, 149, 0.75);\n' +
'}\n' +
'.pp-cc-tags-item {\n' +
'  background: rgba(45, 226, 230, 0.10);\n' +
'  border: 1px solid rgba(45, 226, 230, 0.45);\n' +
'  color: #9df7f9;\n' +
'}\n' +
'.pp-uc-avatar {\n' +
'  border: 2px solid #2de2e6;\n' +
'  box-shadow: 0 0 20px rgba(45, 226, 230, 0.65);\n' +
'}\n' +
'.pp-top-bar-app-menu-list {\n' +
'  background: #0b0714;\n' +
'  border: 1px solid #ff2d95;\n' +
'  box-shadow: 0 0 18px rgba(255, 45, 149, 0.55);\n' +
'}\n' +
'.pp-top-bar-app-menu-list-item { color: #9df7f9; }\n' +
'.pp-top-bar-app-menu-list-item:hover {\n' +
'  background: rgba(255, 45, 149, 0.16);\n' +
'  color: #ffffff;\n' +
'}\n' +
'.pp-top-bar-app-menu-list hr { border-color: rgba(255, 45, 149, 0.35); }\n'
    },
    {
      id: 'sakura',
      name: 'Sakura',
      category: 'Whole profile',
      blurb: 'Warm pinks, soft edges, rounded everything.',
      css:
'.pp-uc-background,\n' +
'.pp-cc-wrapper {\n' +
'  background: linear-gradient(165deg, #2a1520 0%, #3d1f2e 55%, #55283c 100%);\n' +
'  border: 1px solid rgba(255, 183, 209, 0.35);\n' +
'  border-radius: 22px;\n' +
'  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.4);\n' +
'}\n' +
'.profile-background-box-1,\n' +
'.pp-cc-gradient-1 { background: transparent; }\n' +
'.pp-uc-title {\n' +
'  font-family: "Courgette", cursive;\n' +
'  color: #ffd7e6;\n' +
'  text-shadow: 0 2px 10px rgba(255, 120, 170, 0.5);\n' +
'}\n' +
'.pp-uc-avatar { border-radius: 50%; border: 3px solid #ffb7d1; }\n' +
'.pp-cc-avatar { border-radius: 16px; }\n' +
'.pp-cc-tags-item {\n' +
'  background: rgba(255, 183, 209, 0.16);\n' +
'  border: 1px solid rgba(255, 183, 209, 0.4);\n' +
'  color: #ffe3ee;\n' +
'  border-radius: 999px;\n' +
'}\n'
    },
    {
      id: 'gothic',
      name: 'Blood moon',
      category: 'Whole profile',
      blurb: 'Near-black panels, deep red accents, serif display type.',
      css:
'.pp-uc-background,\n' +
'.pp-cc-wrapper {\n' +
'  background: linear-gradient(180deg, #0c0708 0%, #170a0c 100%);\n' +
'  border: 1px solid #4a1015;\n' +
'  border-radius: 4px;\n' +
'  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);\n' +
'}\n' +
'.profile-background-box-1,\n' +
'.pp-cc-gradient-1 { background: transparent; }\n' +
'.pp-uc-title {\n' +
'  font-family: "Pirata One", "Cinzel", serif;\n' +
'  color: #c9303c;\n' +
'  letter-spacing: 1px;\n' +
'  text-shadow: 0 0 14px rgba(201, 48, 60, 0.55);\n' +
'}\n' +
'.pp-cc-name { font-family: "Cinzel", serif; color: #e8d9c5; }\n' +
'.pp-uc-about-me { font-family: "Cardo", serif; color: #cbbba6; }\n' +
'.pp-cc-tags-item {\n' +
'  background: #1a0a0c;\n' +
'  border: 1px solid #4a1015;\n' +
'  color: #b98c8c;\n' +
'  border-radius: 2px;\n' +
'}\n' +
'.pp-cc-star { filter: hue-rotate(-40deg) saturate(2); }\n'
    },
    {
      id: 'terminal',
      name: 'CRT terminal',
      category: 'Whole profile',
      blurb: 'Monospaced green-on-black with scanlines drawn as a repeating gradient.',
      css:
'.pp-uc-background,\n' +
'.pp-cc-wrapper {\n' +
'  background: repeating-linear-gradient(\n' +
'    180deg,\n' +
'    #04120a 0px,\n' +
'    #04120a 2px,\n' +
'    #071c0f 3px,\n' +
'    #04120a 4px\n' +
'  );\n' +
'  border: 1px solid #1f7a3d;\n' +
'  border-radius: 2px;\n' +
'  box-shadow: 0 0 14px rgba(31, 122, 61, 0.4), inset 0 0 30px rgba(0, 0, 0, 0.6);\n' +
'}\n' +
'.profile-background-box-1,\n' +
'.pp-cc-gradient-1 { background: transparent; }\n' +
'.pp-uc-title,\n' +
'.pp-cc-name,\n' +
'.pp-uc-about-me,\n' +
'.pp-cc-description p,\n' +
'.pp-cc-tags-item,\n' +
'.pp-uc-followers-count,\n' +
'.pp-uc-member-since {\n' +
'  font-family: "VT323", "Share Tech", monospace;\n' +
'  color: #57ff8f;\n' +
'}\n' +
'.pp-uc-title { font-size: 34px; text-shadow: 0 0 8px rgba(87, 255, 143, 0.7); }\n' +
'.pp-cc-tags-item {\n' +
'  background: transparent;\n' +
'  border: 1px solid #1f7a3d;\n' +
'  border-radius: 0;\n' +
'}\n' +
'.pp-uc-avatar { border-radius: 0; border: 1px solid #1f7a3d; filter: saturate(0.6) contrast(1.1); }\n'
    },
    {
      id: 'vapor',
      name: 'Vaporwave',
      category: 'Whole profile',
      blurb: 'Sunset gradients, wide letter spacing, chrome-ish text.',
      css:
'.pp-uc-background,\n' +
'.pp-cc-wrapper {\n' +
'  background: linear-gradient(180deg, #2b1055 0%, #7b2d8e 55%, #ff6b9d 100%);\n' +
'  border: 1px solid rgba(255, 255, 255, 0.25);\n' +
'  border-radius: 10px;\n' +
'  box-shadow: 0 0 24px rgba(255, 107, 157, 0.45);\n' +
'}\n' +
'.profile-background-box-1,\n' +
'.pp-cc-gradient-1 { background: transparent; }\n' +
'.pp-uc-title {\n' +
'  font-family: "Orbitron", sans-serif;\n' +
'  letter-spacing: 6px;\n' +
'  text-transform: uppercase;\n' +
'  background: linear-gradient(180deg, #ffffff 0%, #ffe6f4 40%, #7df9ff 100%);\n' +
'  -webkit-background-clip: text;\n' +
'  background-clip: text;\n' +
'  color: transparent;\n' +
'}\n' +
'.pp-cc-name { font-family: "Orbitron", sans-serif; letter-spacing: 1px; color: #fff; }\n' +
'.pp-cc-tags-item {\n' +
'  background: rgba(0, 0, 0, 0.28);\n' +
'  color: #7df9ff;\n' +
'  border: 1px solid rgba(125, 249, 255, 0.5);\n' +
'}\n'
    },
    {
      id: 'parchment',
      name: 'Dark academia',
      category: 'Whole profile',
      blurb: 'Aged paper tones, serif type, hairline rules.',
      css:
'.pp-uc-background,\n' +
'.pp-cc-wrapper {\n' +
'  background: linear-gradient(160deg, #241d16 0%, #2f2619 100%);\n' +
'  border: 1px solid #6b5637;\n' +
'  border-radius: 3px;\n' +
'  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);\n' +
'}\n' +
'.profile-background-box-1,\n' +
'.pp-cc-gradient-1 { background: transparent; }\n' +
'.pp-uc-title { font-family: "Cinzel", serif; color: #e6d3ac; letter-spacing: 3px; }\n' +
'.pp-cc-name { font-family: "Cardo", serif; color: #e6d3ac; }\n' +
'.pp-uc-about-me,\n' +
'.pp-cc-description p { font-family: "Crimson Text", serif; color: #cbb894; font-size: 15px; }\n' +
'.pp-cc-tags-item {\n' +
'  background: transparent;\n' +
'  border: 1px solid #6b5637;\n' +
'  color: #b9a179;\n' +
'  border-radius: 2px;\n' +
'  font-family: "Cardo", serif;\n' +
'}\n' +
'.pp-uc-avatar { border-radius: 2px; border: 1px solid #6b5637; filter: sepia(0.25); }\n'
    },
    {
      id: 'minimal',
      name: 'Quiet minimal',
      category: 'Whole profile',
      blurb: 'Flat charcoal panels, no glow, generous spacing. A good starting base.',
      css:
'.pp-uc-background,\n' +
'.pp-cc-wrapper {\n' +
'  background: #17181c;\n' +
'  border: 1px solid #26282e;\n' +
'  border-radius: 12px;\n' +
'  box-shadow: none;\n' +
'}\n' +
'.profile-background-box-1,\n' +
'.profile-background-box-2,\n' +
'.profile-background-box-3,\n' +
'.pp-cc-gradient-1,\n' +
'.pp-cc-gradient-2,\n' +
'.pp-cc-gradient-3 { background: transparent; }\n' +
'.pp-uc-title { font-family: "Inter", sans-serif; font-weight: 600; letter-spacing: -0.5px; }\n' +
'.pp-cc-name { font-family: "Inter", sans-serif; font-weight: 500; }\n' +
'.pp-cc-tags-item {\n' +
'  background: #1f2127;\n' +
'  border: 1px solid #2c2f36;\n' +
'  color: #a6adba;\n' +
'  border-radius: 6px;\n' +
'}\n' +
'.pp-cc-star-line { display: none; }\n' +
'.pp-page-background { opacity: 0.35; filter: blur(3px); }\n'
    },
    {
      id: 'starfield',
      name: 'Starfield background',
      category: 'Background',
      blurb: 'Replaces the background image with a drifting star pattern built from gradients.',
      css:
'.pp-page-background {\n' +
'  opacity: 1;\n' +
'  filter: none;\n' +
'  background-color: #05060f;\n' +
'  background-image:\n' +
'    radial-gradient(1px 1px at 20% 30%, rgba(255, 255, 255, 0.9), transparent 100%),\n' +
'    radial-gradient(1px 1px at 70% 15%, rgba(255, 255, 255, 0.7), transparent 100%),\n' +
'    radial-gradient(1.5px 1.5px at 45% 70%, rgba(200, 220, 255, 0.9), transparent 100%),\n' +
'    radial-gradient(1px 1px at 85% 60%, rgba(255, 255, 255, 0.6), transparent 100%),\n' +
'    radial-gradient(1px 1px at 12% 82%, rgba(255, 255, 255, 0.8), transparent 100%),\n' +
'    linear-gradient(180deg, #05060f 0%, #0d0a24 60%, #150c2e 100%);\n' +
'  background-size: 420px 420px, 380px 380px, 500px 500px, 460px 460px, 340px 340px, 100% 100%;\n' +
'  animation: jai-drift 90s linear infinite;\n' +
'}\n' +
'@keyframes jai-drift {\n' +
'  from { background-position: 0 0, 0 0, 0 0, 0 0, 0 0, 0 0; }\n' +
'  to   { background-position: 420px 420px, -380px 380px, 500px -500px, -460px 460px, 340px 340px, 0 0; }\n' +
'}\n'
    },
    {
      id: 'aurora',
      name: 'Aurora background',
      category: 'Background',
      blurb: 'A slow-moving green and violet wash behind the page.',
      css:
'.pp-page-background {\n' +
'  opacity: 1;\n' +
'  filter: blur(40px);\n' +
'  background-color: #060912;\n' +
'  background-image:\n' +
'    radial-gradient(60% 45% at 20% 25%, rgba(56, 232, 160, 0.55), transparent 70%),\n' +
'    radial-gradient(55% 40% at 78% 30%, rgba(140, 82, 255, 0.5), transparent 70%),\n' +
'    radial-gradient(70% 50% at 50% 90%, rgba(38, 120, 255, 0.4), transparent 70%);\n' +
'  background-size: 180% 180%, 170% 170%, 200% 200%;\n' +
'  animation: jai-aurora 26s ease-in-out infinite alternate;\n' +
'}\n' +
'@keyframes jai-aurora {\n' +
'  from { background-position: 0% 0%, 100% 0%, 50% 100%; }\n' +
'  to   { background-position: 40% 30%, 60% 40%, 30% 60%; }\n' +
'}\n'
    },
    {
      id: 'shimmer',
      name: 'Shimmering username',
      category: 'Accents',
      blurb: 'Animated gradient sweep across your @name.',
      css:
'.pp-uc-title {\n' +
'  background: linear-gradient(\n' +
'    100deg,\n' +
'    #ffffff 0%,\n' +
'    #ffb3e6 25%,\n' +
'    #9ad7ff 50%,\n' +
'    #ffb3e6 75%,\n' +
'    #ffffff 100%\n' +
'  );\n' +
'  background-size: 300% 100%;\n' +
'  -webkit-background-clip: text;\n' +
'  background-clip: text;\n' +
'  color: transparent;\n' +
'  animation: jai-shimmer 6s linear infinite;\n' +
'}\n' +
'@keyframes jai-shimmer {\n' +
'  from { background-position: 0% 50%; }\n' +
'  to   { background-position: 300% 50%; }\n' +
'}\n'
    },
    {
      id: 'cardlift',
      name: 'Cards lift on hover',
      category: 'Accents',
      blurb: 'Motion only — layers on top of whichever colour scheme you are using.',
      css:
'.pp-cc-wrapper {\n' +
'  transition: transform 0.25s ease, box-shadow 0.25s ease;\n' +
'}\n' +
'.pp-cc-wrapper:hover {\n' +
'  transform: translateY(-8px) scale(1.015);\n' +
'  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55);\n' +
'  z-index: 2;\n' +
'}\n' +
'.pp-cc-avatar { transition: filter 0.25s ease, transform 0.4s ease; }\n' +
'.pp-cc-wrapper:hover .pp-cc-avatar { filter: brightness(1.1) saturate(1.15); }\n'
    },
    {
      id: 'holotags',
      name: 'Holographic tags',
      category: 'Accents',
      blurb: 'Iridescent animated tag pills.',
      css:
'.pp-cc-tags-item {\n' +
'  background: linear-gradient(\n' +
'    90deg,\n' +
'    rgba(255, 106, 213, 0.35),\n' +
'    rgba(106, 224, 255, 0.35),\n' +
'    rgba(180, 255, 160, 0.35),\n' +
'    rgba(255, 106, 213, 0.35)\n' +
'  );\n' +
'  background-size: 300% 100%;\n' +
'  border: 1px solid rgba(255, 255, 255, 0.28);\n' +
'  border-radius: 999px;\n' +
'  color: #ffffff;\n' +
'  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);\n' +
'  animation: jai-holo 8s linear infinite;\n' +
'}\n' +
'@keyframes jai-holo {\n' +
'  from { background-position: 0% 50%; }\n' +
'  to   { background-position: 300% 50%; }\n' +
'}\n'
    },
    {
      id: 'menuglass',
      name: 'Glass user menu',
      category: 'Accents',
      blurb: 'Restyles just the avatar dropdown. Open it from the Profile tab to see it.',
      css:
'.pp-top-bar-app-menu-list {\n' +
'  background: linear-gradient(180deg, rgba(28, 26, 42, 0.92), rgba(16, 15, 26, 0.92));\n' +
'  border: 1px solid rgba(255, 255, 255, 0.16);\n' +
'  border-radius: 16px;\n' +
'  padding: 6px;\n' +
'  backdrop-filter: blur(16px);\n' +
'  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);\n' +
'}\n' +
'.pp-top-bar-app-menu-list-item {\n' +
'  border-radius: 10px;\n' +
'  transition: background 0.18s ease, color 0.18s ease;\n' +
'}\n' +
'.pp-top-bar-app-menu-list-item:hover {\n' +
'  background: rgba(192, 132, 252, 0.18);\n' +
'  color: #ffffff;\n' +
'}\n' +
'.pp-top-bar-app-menu-list hr { display: none; }\n'
    },
    {
      id: 'focus',
      name: 'Portfolio mode',
      category: 'Layout',
      blurb: 'Hides the footer and dims site chrome so the cards carry the page.',
      css:
'.pp-footer { display: none; }\n' +
'.pp-top-bar-outer { background: rgba(0, 0, 0, 0.35); border-bottom: 1px solid rgba(255, 255, 255, 0.06); }\n' +
'.profile-page-container { padding-top: 28px; }\n' +
'.pp-page-background { opacity: 0.5; filter: blur(6px) brightness(0.7); }\n'
    },
    {
      id: 'wide',
      name: 'Wide card grid',
      category: 'Layout',
      blurb: 'Narrower profile panel, more room for bots.',
      css:
'.profile-page-flex { gap: 24px; }\n' +
'.pp-uc-background { max-width: 320px; }\n' +
'.pp-cc-list-container { gap: 14px; }\n' +
'.pp-cc-description { max-height: 140px; overflow: hidden; }\n'
    }
  ];

  var OPEN = '/* ==> jai-preset:';
  var CLOSE = '/* <== jai-preset:';

  function header(p) { return OPEN + ' ' + p.id + ' — ' + p.name + ' */'; }
  function footer(p) { return CLOSE + ' ' + p.id + ' */'; }

  function isApplied(css, preset) {
    return css.indexOf(OPEN + ' ' + preset.id + ' ') !== -1;
  }

  function apply(css, preset) {
    if (isApplied(css, preset)) return css;
    var sep = css && !/\n\s*$/.test(css) ? '\n\n' : (css ? '\n' : '');
    return css + sep + header(preset) + '\n' + preset.css + footer(preset) + '\n';
  }

  function remove(css, preset) {
    var start = css.indexOf(OPEN + ' ' + preset.id + ' ');
    if (start === -1) return css;
    var endMarker = footer(preset);
    var end = css.indexOf(endMarker, start);
    if (end === -1) return css;
    end += endMarker.length;
    if (css[end] === '\n') end++;
    while (start > 0 && css[start - 1] === '\n') start--;
    return (css.slice(0, start) + '\n' + css.slice(end)).replace(/\n{3,}/g, '\n\n');
  }

  // ------------------------------------------------------- advanced templates
  //
  // A community template is HTML *and* CSS, split into components you can apply
  // one at a time (see tools/build_template.py). So unlike a basic preset, which
  // only ever touches the <style> block, a component has to be spliced into both
  // halves of the About Me document — and taken back out of both.

  var HTML_OPEN = '<!-- ==> jai-part:';
  var HTML_CLOSE = '<!-- <== jai-part:';

  function htmlHeader(part) { return HTML_OPEN + ' ' + part.id + ' — ' + part.name + ' -->'; }
  function htmlFooter(part) { return HTML_CLOSE + ' ' + part.id + ' -->'; }

  function templates() { return global.JAI_TEMPLATES || []; }

  /* Every component of every template, flat, in canonical order. */
  function allParts() {
    var out = [];
    templates().forEach(function (t) {
      (t.components || []).forEach(function (c) { out.push(c); });
    });
    return out;
  }

  function isPartApplied(payload, part) {
    if (part.css && global.JaiPayload.allCss(payload).indexOf(OPEN + ' ' + part.id + ' ') !== -1) {
      return true;
    }
    return !!(part.html && payload.indexOf(HTML_OPEN + ' ' + part.id + ' ') !== -1);
  }

  /* Component ids that come after `part` in the template's own order. */
  function laterThan(part) {
    var out = [];
    var seen = false;
    allParts().forEach(function (p) {
      if (p.id === part.id) { seen = true; return; }
      if (seen) out.push(p.id);
    });
    return out;
  }

  /*
   * Inserts `block` so applied components stay in the author's original order no
   * matter which order they were switched on in. Without this, adding the card
   * redesign after the flourish that layers over it would silently reverse their
   * cascade and the flourish would vanish.
   */
  function insertOrdered(text, block, openMarker, laterIds) {
    var at = -1;
    laterIds.forEach(function (id) {
      var i = text.indexOf(openMarker + ' ' + id + ' ');
      if (i !== -1 && (at === -1 || i < at)) at = i;
    });
    if (at === -1) {
      var sep = text && !/\n\s*$/.test(text) ? '\n\n' : (text ? '\n' : '');
      return text + sep + block + '\n';
    }
    return text.slice(0, at) + block + '\n\n' + text.slice(at);
  }

  function applyPart(payload, part) {
    if (isPartApplied(payload, part)) return payload;
    var later = laterThan(part);
    var out = payload;

    if (part.css) {
      out = global.JaiPayload.editCss(out, function (css) {
        var block = header(part) + '\n' + part.css.replace(/\n+$/, '') + '\n' + footer(part);
        return insertOrdered(css, block, OPEN, later);
      });
    }
    if (part.html) {
      var markup = htmlHeader(part) + '\n' + part.html.replace(/\n+$/, '') + '\n' + htmlFooter(part);
      out = insertOrdered(out, markup, HTML_OPEN, later);
    }
    return out;
  }

  function cutBlock(text, openMarker, endMarker, id) {
    var start = text.indexOf(openMarker + ' ' + id + ' ');
    if (start === -1) return text;
    var end = text.indexOf(endMarker, start);
    if (end === -1) return text;
    end += endMarker.length;
    if (text[end] === '\n') end++;
    while (start > 0 && text[start - 1] === '\n') start--;
    return (text.slice(0, start) + '\n' + text.slice(end)).replace(/\n{3,}/g, '\n\n');
  }

  function removePart(payload, part) {
    var out = payload;
    if (part.css) {
      out = global.JaiPayload.editCss(out, function (css) {
        return cutBlock(css, OPEN, footer(part), part.id);
      });
    }
    if (part.html) {
      out = cutBlock(out, HTML_OPEN, htmlFooter(part), part.id);
    }
    return out;
  }

  global.JaiPresets = {
    all: PRESETS,
    isApplied: isApplied,
    apply: apply,
    remove: remove,
    templates: templates,
    allParts: allParts,
    isPartApplied: isPartApplied,
    applyPart: applyPart,
    removePart: removePart
  };
})(window);
