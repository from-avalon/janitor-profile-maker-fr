/*
 * Layout stylesheets for hardcoded rosters.
 *
 * js/hardcode.js writes the markup and the wiring — which file is the default,
 * what each :target swaps. Neither is any use on its own: paste it into an empty
 * About Me and you get a pile of unstyled divs. This is the other half, the part
 * that makes a roster look like something, and it is a *starting point* — it
 * lands in the document as ordinary CSS you are meant to edit afterwards.
 *
 * A style owns the look; the wiring owns the state. They meet at a handful of
 * class names (.cs-shell, .cs-roster, .cs-grid, .cs-slot-face, .cs-stage-preview
 * …), so a new style can be added here without touching the emitters, as long as
 * it styles those.
 *
 * Everything is written for JanitorAI: no custom properties, no var(), no url().
 * Colours are interpolated from the theme instead.
 */
(function (global) {
  'use strict';

  /*
   * Stage on the left, roster of tiles on the right, one file open at a time.
   * Rectangular and quiet on purpose — it is meant to be restyled.
   */
  function contactSelect(o) {
    var accent = o.accent;
    var preview = o.preview;
    var ink = o.ink;
    return [
'/* JanitorAI renders About Me inside a narrow, boxed column. A roster needs the',
' * full width of the page, so the container is flattened out of the way first —',
' * display: contents on the box itself, and the wrappers above it unclamped. */',
'.pp-uc-about-me { display: contents; }',
'.pp-uc-background, .pp-uc-background > div, .profile-page-container, .profile-page-flex {',
'  max-width: none !important;',
'  background: transparent !important;',
'  box-shadow: none !important;',
'}',
'.profile-page-flex { display: block !important; width: 100% !important; }',
'.pp-uc-background, .profile-info-wrapper-box, .profile-info-stack { width: 100% !important; max-width: none !important; }',
'',
'.cs-shell, .cs-shell * { box-sizing: border-box; }',
'',
'.cs-shell {',
'  position: relative;',
'  z-index: 5;',
'  display: flex;',
'  width: min(1320px, calc(100% - 28px));',
'  min-height: 720px;',
'  margin: 18px auto 46px;',
'  overflow: hidden;',
'  border: 1px solid #2e3239;',
'  border-radius: 18px;',
'  background: #0b0d10;',
'  box-shadow: 0 26px 70px #000a;',
'  isolation: isolate;',
'}',
'',
'/* Fixed, not absolute, and that is the whole trick: a hash link scrolls its',
' * target into view, and something already in the viewport needs no scrolling,',
' * so picking a file does not jolt the page. */',
'.cs-key { position: fixed; top: 0; left: 0; width: 1px; height: 1px; pointer-events: none; }',
'',
'.cs-scene { position: absolute; inset: 0 36% 0 0; z-index: 0; overflow: hidden; background: #0d1013; }',
'',
'.cs-scene-art {',
'  position: absolute;',
'  inset: 0;',
'  width: 100%;',
'  height: 100%;',
'  object-fit: cover;',
'  object-position: center center;',
'  opacity: 0;',
'  transition: opacity .3s ease;',
'}',
'',
'.cs-scene-shade { position: absolute; inset: 0; z-index: 2; background: linear-gradient(90deg, #0b0d1022, transparent 32%, #0b0d10 100%), linear-gradient(0deg, #0b0d10 0%, transparent 38% 74%, #0b0d1099 100%); }',
'.cs-scene-mark { position: absolute; top: 11%; left: 5%; z-index: 3; color: #ffffff09; font-size: clamp(5rem, 13vw, 11rem); font-weight: 800; letter-spacing: -.08em; line-height: .78; text-transform: uppercase; }',
'',
'.cs-topline { position: absolute; top: 20px; right: calc(36% + 18px); left: 22px; z-index: 7; display: flex; align-items: center; justify-content: space-between; color: #e8ebef; font-size: .56rem; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }',
'.cs-topline-status { padding: 7px 12px; border: 1px solid #ffffff33; border-radius: 999px; background: #0b0d10a8; }',
'.cs-topline i { display: inline-block; width: 6px; height: 6px; margin-right: 7px; border-radius: 50%; background: ' + accent + '; animation: cs-pulse 1.9s ease-in-out infinite; }',
'',
'.cs-identity { position: absolute; bottom: 34px; left: 38px; z-index: 7; width: calc(64% - 76px); animation: cs-rise .7s .1s cubic-bezier(.2,.8,.2,1) both; }',
'.cs-code { display: inline-block; margin-bottom: 10px; padding: 6px 10px; background: ' + accent + '; color: ' + ink + '; font-size: .55rem; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }',
'/* Character names on JanitorAI run long, so this stays a size that can take',
' * one without dropping it out of the bottom of the stage. */',
'.cs-name { margin: 0; color: #fff; font-size: clamp(1.9rem, 4.2vw, 3.4rem); font-weight: 800; letter-spacing: -.03em; line-height: 1.02; text-transform: uppercase; overflow-wrap: break-word; }',
'.cs-title { margin: 14px 0 8px; color: ' + accent + '; font-size: .66rem; font-weight: 800; letter-spacing: .26em; text-transform: uppercase; }',
'.cs-quote { max-width: 430px; margin: 0; color: #eef1f4; font-size: .8rem; font-weight: 600; line-height: 1.55; }',
'.cs-desc { max-width: 460px; margin: 10px 0 0; color: #aeb5bd; font-size: .7rem; line-height: 1.6; }',
'',
'.cs-roster { flex: 0 0 36%; display: flex; flex-direction: column; justify-content: center; width: 36%; margin-left: 64%; padding: 44px 34px 44px 30px; color: #eef1f4; }',
'',
'/* z-index on a flex item lifts these without positioning them, which is what',
' * keeps the stage previews anchored to the shell. Do not swap for position. */',
'.cs-roster-head, .cs-grid, .cs-select-line, .cs-filters { z-index: 6; }',
'',
'.cs-filters { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 11px; }',
'.cs-filter { padding: 4px 7px; border: 1px solid #383d45; color: #99a1ab !important; font-size: .45rem; font-weight: 800; letter-spacing: .1em; line-height: 1; text-decoration: none !important; text-transform: uppercase; transition: border-color .18s ease, background .18s ease, color .18s ease; }',
'.cs-filter:hover { border-color: ' + accent + '; color: ' + accent + ' !important; }',
'',
'.cs-roster-head { display: flex; align-items: end; justify-content: space-between; margin: 0 0 12px; }',
'.cs-roster-head strong { display: block; font-size: clamp(1.5rem, 2.6vw, 2.3rem); font-weight: 800; letter-spacing: -.04em; line-height: .9; text-transform: uppercase; }',
'.cs-roster-head span { color: #6c747e; font-size: .5rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }',
'',
'/* A roster is any size. Tiles wrap by width first and the grid scrolls once it',
' * runs out of height, so the shell keeps the height it was drawn at. */',
'.cs-grid {',
'  display: grid;',
'  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));',
'  gap: 9px;',
'  max-height: 47vh;',
'  padding: 4px 8px 8px 0;',
'  overflow-y: auto;',
'}',
'',
'/* Static on purpose: the stage preview inside each tile is positioned against',
' * .cs-shell, and a positioned tile would trap it. */',
'.cs-slot { position: static; min-width: 0; text-decoration: none !important; }',
'',
'.cs-slot-face {',
'  position: relative;',
'  display: block;',
'  aspect-ratio: .78;',
'  overflow: hidden;',
'  border: 1px solid #353a42;',
'  border-radius: 6px;',
'  background: #14171c;',
'  transition: border-color .18s ease, box-shadow .18s ease, transform .22s ease;',
'}',
'',
'.cs-slot-face::before, .cs-slot-face::after { position: absolute; pointer-events: none; }',
'.cs-slot-face::before { content: "+"; top: 50%; left: 50%; color: #4d545d; font-size: 1.2rem; font-weight: 300; transform: translate(-50%, -50%); }',
'.cs-slot-face::after { content: ""; right: 7px; bottom: 6px; color: #5b626b; font-size: .38rem; font-weight: 800; letter-spacing: .1em; }',
'',
'.cs-slot-thumb { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover; object-position: center center; transition: transform .4s cubic-bezier(.2,.8,.2,1), filter .22s ease; }',
'',
'.cs-slot-live .cs-slot-face::before { top: 6px; left: 7px; z-index: 3; padding: 3px 5px; border-radius: 3px; background: ' + ink + 'e0; color: #98a0aa; font-size: .45rem; font-weight: 800; letter-spacing: .06em; transform: none; }',
'.cs-slot-live .cs-slot-face::after { right: 0; bottom: 0; left: 0; z-index: 3; padding: 16px 7px 6px; background: linear-gradient(0deg, ' + ink + ' 0%, ' + ink + 'e0 60%, transparent 100%); color: #fff; font-size: .46rem; font-weight: 800; letter-spacing: .1em; }',
'.cs-slot-live .cs-slot-thumb { filter: saturate(.5) brightness(.68) contrast(1.06); }',
'',
'/* The wide art a tile throws onto the stage while the pointer is on it. Width',
' * and height rather than insets: an absolutely positioned <img> is a replaced',
' * element and drops the right/bottom offsets. */',
'.cs-stage-preview {',
'  position: absolute;',
'  top: 0;',
'  left: 0;',
'  width: 64%;',
'  height: 100%;',
'  z-index: 1;',
'  opacity: 0;',
'  object-fit: cover;',
'  object-position: center center;',
'  pointer-events: none;',
'  filter: saturate(.72) contrast(1.1) brightness(.66);',
'  transition: opacity .16s ease;',
'}',
'',
'/* Matches .cs-scene-shade so the name stays readable over a preview. */',
'.cs-slot-live::after {',
'  content: "";',
'  position: absolute;',
'  inset: 0 36% 0 0;',
'  z-index: 2;',
'  opacity: 0;',
'  pointer-events: none;',
'  background: linear-gradient(90deg, #0b0d1022, transparent 32%, #0b0d10 100%), linear-gradient(0deg, #0b0d10 0%, transparent 38% 74%, #0b0d1099 100%);',
'  transition: opacity .16s ease;',
'}',
'',
'.cs-slot-live:hover .cs-slot-face { border-color: ' + preview + '; box-shadow: 0 0 0 2px ' + ink + ', 0 8px 20px #0008; transform: translateY(-4px); }',
'.cs-slot-live:hover .cs-slot-thumb { filter: saturate(.9) brightness(.96) contrast(1.05); transform: scale(1.05); }',
'.cs-slot-live:hover .cs-stage-preview, .cs-slot-live:hover::after { opacity: 1; }',
'',
"/* In the roster column rather than floating over the stage: a long character",
" * name and a floating panel fight for the same corner, and the name wins. */",
'.cs-tags { z-index: 6; margin: 12px 0 0; padding: 10px 0 0; border-top: 1px solid #23272d; }',
'.cs-tags::before { display: block; margin-bottom: 8px; color: #7d858f; font-size: .46rem; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }',
'.cs-tags a, .cs-tags span { display: inline-block; margin: 3px 3px 0 0; padding: 5px 7px; border: 1px solid #3b414a; border-radius: 3px; color: #eef1f4 !important; font-size: .48rem; font-weight: 800; letter-spacing: .06em; line-height: 1; text-decoration: none !important; text-transform: uppercase; transition: border-color .2s ease, background .2s ease, color .2s ease; }',
'.cs-tags a:hover { border-color: ' + accent + '; background: ' + accent + '; color: ' + ink + ' !important; }',
'.cs-tags span { border-color: ' + accent + '70; color: ' + accent + ' !important; }',
'',
'.cs-select-line { display: flex; align-items: center; margin-top: 14px; padding-top: 13px; border-top: 1px solid #23272d; }',
'.cs-select-line > span { color: #6c747e; font-size: .5rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }',
'.cs-launch { display: inline-block; margin-left: auto; padding: 11px 16px; border: 0; border-radius: 5px; background: ' + accent + '; color: ' + ink + ' !important; font-size: .58rem; font-weight: 800; letter-spacing: .12em; text-decoration: none !important; text-transform: uppercase; transition: filter .2s ease, transform .2s ease; }',
'.cs-launch:hover { filter: brightness(1.12); transform: translateY(-2px); }',
'',
'.cs-index { position: absolute; right: 16px; bottom: 14px; z-index: 7; color: #4d545d; font-size: .46rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }',
'',
'@keyframes cs-rise { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }',
'@keyframes cs-pulse { 0%, 100% { opacity: .45; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.15); } }',
'',
'@media screen and (max-width: 1040px) {',
'  .cs-shell { min-height: 640px; }',
'  .cs-scene, .cs-slot-live::after { inset: 0 42% 0 0; }',
'  .cs-stage-preview { width: 58%; }',
'  .cs-topline { right: calc(42% + 16px); }',
'  .cs-identity { left: 26px; width: calc(58% - 48px); }',
'  .cs-roster { flex-basis: 42%; width: 42%; margin-left: 58%; padding: 38px 22px 38px 22px; }',
'  .cs-grid { max-height: 42vh; }',
'  .cs-tags { right: calc(42% - 18px); bottom: 78px; width: 270px; }',
'  .cs-desc { display: none !important; }',
'}',
'',
'@media screen and (max-width: 700px) {',
'  .cs-shell { flex-direction: column; justify-content: flex-end; width: calc(100% - 18px); min-height: 800px; border-radius: 14px; }',
'  .cs-scene, .cs-slot-live::after { inset: 0 0 360px 0; }',
'  .cs-stage-preview { width: 100%; height: calc(100% - 360px); }',
'  .cs-topline { top: 14px; right: 14px; left: 14px; }',
'  .cs-topline-file { display: none !important; }',
'  .cs-identity { bottom: 380px; left: 18px; width: calc(100% - 36px); }',
'  .cs-name { font-size: clamp(2.2rem, 12vw, 3.6rem); }',
'  .cs-roster { flex: 0 0 360px; width: 100%; height: 360px; margin-left: 0; justify-content: flex-start; padding: 16px 16px 18px; }',
'  .cs-roster-head strong { font-size: 1.4rem; }',
'  .cs-roster-head span { display: none; }',
'  .cs-grid { grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 6px; max-height: 168px; }',
'  .cs-tags a, .cs-tags span { margin-top: 2px; padding: 4px 5px; font-size: .42rem; }',
'  .cs-select-line { margin-top: 12px; padding-top: 10px; }',
'  .cs-select-line > span { display: none !important; }',
'  .cs-launch { width: 100%; margin-left: 0; text-align: center; }',
'  .cs-index { display: none !important; }',
'}',
'',
'@media (prefers-reduced-motion: reduce) {',
'  .cs-identity, .cs-topline i { animation: none !important; }',
'  .cs-scene-art, .cs-stage-preview, .cs-slot-face, .cs-slot-thumb, .cs-slot-live::after, .cs-launch { transition: none !important; }',
'}'
    ].join('\n');
  }

  var STYLES = [
    {
      id: 'contact-select',
      name: 'Contact select',
      blurb: 'Wide stage on one side, scrolling roster of tiles on the other.',
      css: contactSelect
    },
    {
      id: 'proxy-terminal',
      name: 'Proxy Terminal',
      blurb: 'A complete ZZZ-inspired profile menu with editable About Me, Friends and Links screens.',
      css: function (o) {
        return global.JaiProxyTerminalStyle ? global.JaiProxyTerminalStyle(o) : '';
      }
    },
    {
      id: 'steam',
      name: 'Steam profile',
      blurb: 'A player profile: level, a favourite-character showcase, featured characters, friends and links, with your own background and avatar frame. Your character list becomes a library underneath.',
      css: function (o) {
        return global.JaiSteamProfile ? global.JaiSteamProfile.style(o) : '';
      }
    },
    {
      id: 'photo-feed',
      name: 'Instagram-style (Golden Hour)',
      blurb: 'The Golden Hour template, filled in from Profile data: counts from your characters, bio from About me, story highlights for your featured characters and each section, your links as stickers and your friends as mentions.',
      // Not generated here: this design is a template's parts (Insert →
      // Sections shows them added), so it has no stylesheet of its own.
      css: null,
      template: 'golden-hour'
    },
    {
      id: 'none',
      name: 'None — I style it myself',
      blurb: 'Writes markup and wiring only. Your own CSS supplies the look.',
      css: null
    }
  ];

  function get(id) {
    for (var i = 0; i < STYLES.length; i++) if (STYLES[i].id === id) return STYLES[i];
    return STYLES[0];
  }

  function css(id, options) {
    var style = get(id);
    return style && style.css ? style.css(options) : '';
  }

  global.JaiHardcodeStyles = { list: STYLES, get: get, css: css };
})(window);
