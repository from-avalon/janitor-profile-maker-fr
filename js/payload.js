/*
 * A JanitorAI profile "theme" is not a separate CSS setting — it is the
 * contents of the About Me field. Creators paste one blob of HTML in there
 * containing `<style>…</style>` plus whatever markup the styles decorate, and
 * JanitorAI drops it into `.pp-uc-about-me` in the page body. Because a <style>
 * element works wherever it lands, those rules then restyle the whole page.
 *
 * So the document the editor holds is HTML, not CSS. This module is the seam:
 * it finds the <style> blocks inside that HTML so the rest of the app — the
 * visual controls, the presets, the linter — can keep working on plain CSS and
 * have their edits spliced back into the right place.
 */
(function (global) {
  'use strict';

  var STYLE_RE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;

  /*
   * Every <style> block, with the offsets of its *contents* in the payload.
   * Returned in document order.
   */
  function styleBlocks(payload) {
    var out = [];
    var m;
    STYLE_RE.lastIndex = 0;
    while ((m = STYLE_RE.exec(payload))) {
      // Scanned rather than indexOf('>'), because an attribute value may
      // legitimately contain '>' inside quotes.
      var cssStart = openingTagEnd(payload, m.index);
      out.push({
        start: m.index,
        end: m.index + m[0].length,
        cssStart: cssStart,
        cssEnd: cssStart + m[1].length,
        css: m[1]
      });
    }
    return out;
  }

  function openingTagEnd(payload, tagStart) {
    var quote = null;
    for (var i = tagStart; i < payload.length; i++) {
      var c = payload[i];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '>') return i + 1;
    }
    return payload.length;
  }

  /* Where new declarations go: the last <style> block wins the cascade. */
  function targetBlock(payload) {
    var blocks = styleBlocks(payload);
    return blocks.length ? blocks[blocks.length - 1] : null;
  }

  /*
   * All CSS in the payload, concatenated in document order. Used to read the
   * value a control should show — later blocks win ties, same as the cascade.
   */
  function allCss(payload) {
    return styleBlocks(payload).map(function (b) { return b.css; }).join('\n');
  }

  /*
   * Runs `fn(css) -> css` against the target block and splices the result back,
   * creating a <style> block first if the payload has none.
   */
  function editCss(payload, fn) {
    var block = targetBlock(payload);
    if (!block) {
      var css = fn('');
      if (!css.trim()) return payload;
      var opening = '<style>\n' + css.replace(/\n+$/, '') + '\n</style>\n';
      return payload ? opening + '\n' + payload : opening;
    }
    var next = fn(block.css);
    return payload.slice(0, block.cssStart) + next + payload.slice(block.cssEnd);
  }

  /* Maps an offset inside the target block's CSS to an offset in the payload. */
  function cssOffsetToPayload(payload, offset) {
    var block = targetBlock(payload);
    return block ? block.cssStart + offset : offset;
  }

  var STARTER =
    '<style>\n' +
    '/* Everything in here restyles your whole profile page.\n' +
    '   Use the Design panel on the left, or write rules by hand. */\n' +
    '\n' +
    '</style>\n' +
    '\n' +
    '<!-- Markup below shows up inside your About Me box. -->\n';

  global.JaiPayload = {
    styleBlocks: styleBlocks,
    targetBlock: targetBlock,
    allCss: allCss,
    editCss: editCss,
    cssOffsetToPayload: cssOffsetToPayload,
    STARTER: STARTER
  };
})(window);
