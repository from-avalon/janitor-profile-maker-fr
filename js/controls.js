/*
 * The simplified builder: a catalogue of (selector, property) pairs with a
 * sensible input widget for each.
 *
 * Every selector here is a *label* class (`.pp-…` / `.profile-…`) rather than an
 * emotion class (`.css-1abc2de`), because emotion hashes are regenerated on
 * every JanitorAI deploy and would break creators' profiles. The reference
 * panel exposes the emotion IDs for the cases labels do not cover.
 *
 * Controls do not own state. They read their current value out of the
 * stylesheet and write back into it, so hand-written CSS and the visual
 * builder always agree.
 */
(function (global) {
  'use strict';

  var FONTS = [
    'Abril Fatface', 'Aladin', 'Aldrich', 'Alegreya Sans SC', 'Berkshire Swash',
    'Black Ops One', 'Cardo', 'Caveat', 'Caveat Brush', 'Chango',
    'Cherry Bomb One', 'Cinzel', 'Cinzel Decorative', 'Courgette',
    'Courier Prime', 'Crimson Text', 'Cutive Mono', 'DM Sans', 'DM Serif Text',
    'Dancing Script', 'DotGothic16', 'Fascinate', 'Fraunces', 'Graduate',
    'Grenze Gotisch', 'Inter', 'Jacquard 12', 'Jacquard 24', 'Jim Nightshade',
    'Jua', 'Jura', 'Lacquer', 'Lato', 'Lexend', 'Linefont', 'Lobster', 'Mitr',
    'Monoton', 'Montserrat', 'Montserrat Alternates', 'Notable', 'Noto Sans JP',
    'Noto Sans KR', 'Noto Sans SC', 'Oleo Script', 'Orbitron', 'Pacifico',
    'Pangolin', 'Petit Formal Script', 'Pirata One', 'Pixelify Sans',
    'Playpen Sans Hebrew', 'Poppins', 'Press Start 2P', 'Raleway', 'Roboto',
    'Roboto Condensed', 'Rock Salt', 'Rubik Glitch', 'Share Tech', 'Sigmar One',
    'Silkscreen', 'Special Elite', 'Sunshiney', 'Tagesschrift', 'VT323'
  ];

  /* Short constructors keep the catalogue readable. */
  function col(sel, prop, label, help) {
    return { sel: sel, prop: prop, label: label, type: 'color', help: help };
  }
  function len(sel, prop, label, opts) {
    opts = opts || {};
    return {
      sel: sel, prop: prop, label: label, type: 'length',
      min: opts.min != null ? opts.min : 0,
      max: opts.max != null ? opts.max : 100,
      step: opts.step || 1,
      unit: opts.unit || 'px',
      units: opts.units || ['px', 'rem', 'em', '%', 'vw', 'vh'],
      help: opts.help
    };
  }
  function num(sel, prop, label, opts) {
    opts = opts || {};
    return {
      sel: sel, prop: prop, label: label, type: 'number',
      min: opts.min != null ? opts.min : 0,
      max: opts.max != null ? opts.max : 10,
      step: opts.step || 0.1,
      help: opts.help
    };
  }
  function pick(sel, prop, label, values, help) {
    return { sel: sel, prop: prop, label: label, type: 'select', values: values, help: help };
  }
  function text(sel, prop, label, placeholder, help) {
    return { sel: sel, prop: prop, label: label, type: 'text', placeholder: placeholder, help: help };
  }
  function font(sel, label, help) {
    return { sel: sel, prop: 'font-family', label: label, type: 'font', values: FONTS, help: help };
  }
  function grad(sel, prop, label, help) {
    return { sel: sel, prop: prop || 'background', label: label, type: 'gradient', help: help };
  }
  function shadow(sel, prop, label, help) {
    return { sel: sel, prop: prop || 'box-shadow', label: label, type: 'shadow', help: help };
  }
  function hide(sel, label, help) {
    return {
      sel: sel, prop: 'display', label: label, type: 'toggle',
      on: 'none', help: help || 'Removes this element from the page.'
    };
  }

  var WEIGHTS = ['300', '400', '500', '600', '700', '800', '900'];
  var ALIGN = ['left', 'center', 'right', 'justify'];
  var TRANSFORM = ['none', 'uppercase', 'lowercase', 'capitalize'];
  var FIT = ['cover', 'contain', 'fill', 'none', 'scale-down'];

  var GROUPS = [
    {
      id: 'page',
      title: 'Page & background',
      blurb: 'The layer behind everything. Your background image itself is set in ' +
             'JanitorAI profile settings — CSS can only tint, blur and fade it.',
      controls: [
        num('.pp-page-background', 'opacity', 'Background opacity', { min: 0, max: 1, step: 0.01 }),
        text('.pp-page-background', 'filter', 'Background filter',
             'blur(2px) brightness(0.6)', 'Try blur(), brightness(), saturate(), grayscale().'),
        grad('.pp-page-background', 'background-image', 'Replace with a gradient',
             'Overrides the image entirely. url() is stripped by JanitorAI, so gradients are the only CSS backgrounds available.'),
        col('body', 'background-color', 'Page colour'),
        len('.profile-page-container', 'padding-top', 'Space above the profile', { max: 200 }),
        len('.profile-page-flex', 'gap', 'Gap: profile box ↔ cards', { max: 120 }),
        pick('.profile-page-flex', 'flex-direction', 'Layout direction',
             ['row', 'row-reverse', 'column', 'column-reverse'],
             'row-reverse puts the bot cards on the left.')
      ]
    },
    {
      id: 'profilebox',
      title: 'Profile box',
      blurb: 'The panel holding your avatar, name, badges and bio.',
      controls: [
        grad('.pp-uc-background', 'background', 'Panel background'),
        col('.pp-uc-background', 'border-color', 'Border colour'),
        len('.pp-uc-background', 'border-width', 'Border width', { max: 12 }),
        pick('.pp-uc-background', 'border-style', 'Border style',
             ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'none']),
        len('.pp-uc-background', 'border-radius', 'Corner rounding', { max: 80 }),
        shadow('.pp-uc-background', 'box-shadow', 'Panel shadow / glow'),
        len('.profile-info-wrapper-box', 'padding', 'Inner padding', { max: 80 }),
        text('.pp-uc-background', 'backdrop-filter', 'Backdrop filter',
             'blur(10px)', 'Frosted-glass effect over whatever is behind the panel.'),
        hide('.profile-background-box-1', 'Hide gradient layer 1'),
        grad('.profile-background-box-2', 'background', 'Gradient layer 2'),
        grad('.profile-background-box-3', 'background', 'Gradient layer 3')
      ]
    },
    {
      id: 'avatar',
      title: 'Avatar',
      controls: [
        len('.pp-uc-avatar', 'width', 'Width', { max: 400, unit: 'px' }),
        len('.pp-uc-avatar', 'height', 'Height', { max: 400, unit: 'px' }),
        len('.pp-uc-avatar', 'border-radius', 'Corner rounding', { max: 200 }),
        col('.pp-uc-avatar', 'border-color', 'Border colour'),
        len('.pp-uc-avatar', 'border-width', 'Border width', { max: 20 }),
        pick('.pp-uc-avatar', 'object-fit', 'Image fit', FIT),
        shadow('.pp-uc-avatar', 'box-shadow', 'Glow / shadow'),
        text('.pp-uc-avatar', 'filter', 'Filter', 'saturate(1.2) contrast(1.1)'),
        text('.pp-uc-avatar-container', 'transform', 'Transform', 'rotate(-3deg)'),
        text('.pp-uc-avatar:hover', 'transform', 'Transform on hover', 'scale(1.05)'),
        text('.pp-uc-avatar', 'transition', 'Transition', 'all .3s ease')
      ]
    },
    {
      id: 'identity',
      title: 'Username, followers & badges',
      controls: [
        font('.pp-uc-title', 'Username font'),
        len('.pp-uc-title', 'font-size', 'Username size', { max: 96, unit: 'px' }),
        pick('.pp-uc-title', 'font-weight', 'Username weight', WEIGHTS),
        col('.pp-uc-title', 'color', 'Username colour'),
        text('.pp-uc-title', 'text-shadow', 'Username glow', '0 0 12px #ff5ea8'),
        len('.pp-uc-title', 'letter-spacing', 'Letter spacing', { min: -5, max: 20, step: 0.5 }),
        pick('.pp-uc-title', 'text-transform', 'Capitalisation', TRANSFORM),
        col('.pp-uc-followers-count', 'color', 'Followers colour'),
        len('.pp-uc-followers-count', 'font-size', 'Followers size', { max: 40 }),
        col('.pp-uc-member-since', 'color', '"Member since" colour'),
        len('.pp-uc-member-since', 'font-size', '"Member since" size', { max: 40 }),
        hide('.profile-badges', 'Hide event badges'),
        len('.profile-badge-img', 'width', 'Badge size', { max: 120 }),
        text('.profile-badge-img', 'filter', 'Badge filter', 'drop-shadow(0 0 6px #fff)')
      ]
    },
    {
      id: 'bio',
      title: 'About me',
      blurb: 'The box your whole theme lives in — everything you write in the editor on ' +
             'the right renders inside it. Style your own markup with your own class ' +
             'names; these controls style the container itself.',
      controls: [
        font('.pp-uc-about-me', 'Bio font'),
        len('.pp-uc-about-me', 'font-size', 'Bio text size', { max: 40 }),
        col('.pp-uc-about-me', 'color', 'Bio text colour'),
        num('.pp-uc-about-me', 'line-height', 'Line height', { min: 0.8, max: 3, step: 0.05 }),
        pick('.pp-uc-about-me', 'text-align', 'Text alignment', ALIGN),
        grad('.pp-uc-about-me', 'background', 'Bio background'),
        len('.pp-uc-about-me', 'padding', 'Bio padding', { max: 60 }),
        len('.pp-uc-about-me', 'border-radius', 'Bio rounding', { max: 60 }),
        col('.pp-uc-about-me', 'border-color', 'Bio border colour'),
        len('.pp-uc-about-me', 'border-width', 'Bio border width', { max: 12 }),
        len('.pp-uc-about-me', 'max-height', 'Max height (scrolls past this)', { max: 800 }),
        pick('.pp-uc-about-me', 'overflow-y', 'Overflow', ['visible', 'auto', 'scroll', 'hidden']),
        col('.pp-uc-about-me a', 'color', 'Link colour')
      ]
    },
    {
      id: 'buttons',
      title: 'Follow & options buttons',
      blurb: 'Only visitors see these. Switch the preview to "Visitor" to check them.',
      controls: [
        grad('.pp-uc-follow-button', 'background', 'Follow button fill'),
        col('.pp-uc-follow-button', 'color', 'Follow text colour'),
        len('.pp-uc-follow-button', 'border-radius', 'Follow rounding', { max: 60 }),
        len('.pp-uc-follow-button', 'height', 'Follow height', { max: 120 }),
        font('.pp-uc-follow-button', 'Follow font'),
        col('.pp-uc-follow-button:before', 'background-color', 'Follow inner fill',
            'The dark plate that sits on top of the gradient border.'),
        col('.pp-uc-follow-text', 'color', 'Follow label colour',
            'The span inside the button. Once you are following, it reads FOLLOWING and ' +
            'the button carries [data-following="true"], so you can style the two states apart.'),
        len('.pp-uc-follow-text', 'letter-spacing', 'Follow label spacing', { min: -2, max: 12, step: 0.5 }),
        grad('.pp-uc-options-menu', 'background', 'Options button fill'),
        col('.pp-uc-options-menu', 'color', 'Options text colour'),
        len('.pp-uc-options-menu', 'border-radius', 'Options rounding', { max: 60 })
      ]
    },
    {
      id: 'tabs',
      title: 'Tabs, search & counter',
      controls: [
        font('.pp-tabs-button', 'Tab font'),
        col('.pp-tabs-button', 'color', 'Tab text colour'),
        len('.pp-tabs-button', 'font-size', 'Tab text size', { max: 40 }),
        grad('.pp-tabs-indicator', 'background', 'Active tab bar'),
        len('.pp-tabs-indicator', 'height', 'Active tab bar height', { max: 20 }),
        grad('.pp-pg-total', 'background', 'Character counter fill'),
        col('.pp-pg-total', 'color', 'Character counter text'),
        len('.pp-pg-total', 'border-radius', 'Character counter rounding', { max: 40 }),
        col('.pp-fl-search-input', 'background-color', 'Search box fill'),
        col('.pp-fl-search-input', 'color', 'Search text colour'),
        len('.pp-fl-search-input', 'border-radius', 'Search rounding', { max: 40 }),
        col('.pp-fl-filter-button', 'background-color', 'Filter button fill'),
        col('.pp-pg-page-button', 'color', 'Page number colour'),
        grad('.pp-pg-page-button-active', 'background', 'Active page fill')
      ]
    },
    {
      id: 'cards',
      title: 'Bot cards',
      blurb: 'Every card in your grid. `:hover` variants are included where they matter.',
      controls: [
        len('.pp-cc-wrapper', 'border-radius', 'Card rounding', { max: 60 }),
        shadow('.pp-cc-wrapper', 'box-shadow', 'Card shadow / glow'),
        text('.pp-cc-wrapper', 'transform', 'Card transform', 'rotate(-1deg)'),
        text('.pp-cc-wrapper:hover', 'transform', 'Card transform on hover', 'translateY(-6px) scale(1.02)'),
        text('.pp-cc-wrapper', 'transition', 'Card transition', 'all .25s ease'),
        grad('.pp-cc-gradient-1', 'background', 'Card border gradient'),
        grad('.pp-cc-gradient-2', 'background', 'Card gradient layer 2'),
        grad('.pp-cc-gradient-3', 'background', 'Card gradient layer 3'),
        font('.pp-cc-name', 'Bot name font'),
        col('.pp-cc-name', 'color', 'Bot name colour'),
        len('.pp-cc-name', 'font-size', 'Bot name size', { max: 48 }),
        text('.pp-cc-name', 'text-shadow', 'Bot name glow', '0 0 8px #b28dff'),
        len('.pp-cc-avatar', 'border-radius', 'Bot image rounding', { max: 60 }),
        text('.pp-cc-avatar', 'filter', 'Bot image filter', 'saturate(1.1)'),
        text('.pp-cc-wrapper:hover .pp-cc-avatar', 'filter', 'Bot image filter on hover', 'brightness(1.15)'),
        col('.pp-cc-creator-name', 'color', 'Your @name on cards'),
        col('.pp-cc-description p', 'color', 'Card description colour'),
        len('.pp-cc-description p', 'font-size', 'Card description size', { max: 32 }),
        font('.pp-cc-description', 'Card description font'),
        grad('.pp-cc-ribbon-wrap', 'background', 'Chat-count ribbon fill'),
        col('.pp-cc-chats-count', 'color', 'Chat-count number colour'),
        hide('.pp-cc-star-line', 'Hide the star divider'),
        text('.pp-cc-star', 'filter', 'Star filter', 'hue-rotate(120deg)'),
        col('.pp-cc-tokens-count', 'color', 'Token count colour'),
        len('.pp-cc-list-container', 'gap', 'Gap between cards', { max: 60 })
      ]
    },
    {
      id: 'tags',
      title: 'Tags',
      blurb: 'A single tag can be targeted with `.pp-tag-<name>` — e.g. `.pp-tag-female`. ' +
             'Custom tags lowercase and strip spaces: "Ice Cream" → `.pp-tag-icecream`.',
      controls: [
        grad('.pp-cc-tags-item', 'background', 'Tag fill'),
        col('.pp-cc-tags-item', 'color', 'Tag text colour'),
        len('.pp-cc-tags-item', 'border-radius', 'Tag rounding', { max: 40 }),
        len('.pp-cc-tags-item', 'font-size', 'Tag text size', { max: 28 }),
        len('.pp-cc-tags-item', 'padding', 'Tag padding', { max: 30 }),
        col('.pp-cc-tags-item', 'border-color', 'Tag border colour'),
        len('.pp-cc-tags-item', 'border-width', 'Tag border width', { max: 8 }),
        font('.pp-cc-tags-item', 'Tag font'),
        grad('.pp-tag-limitless', 'background', 'Limitless tag fill'),
        col('.pp-tag-limitless', 'color', 'Limitless tag text'),
        grad('.pp-cc-tags-custom', 'background', 'Custom tag fill'),
        col('.pp-cc-tags-custom', 'color', 'Custom tag text'),
        len('.pp-cc-tags', 'gap', 'Gap between tags', { max: 30 })
      ]
    },
    {
      id: 'usermenu',
      title: 'User menu popup',
      blurb: 'The panel behind your avatar in the header. Open it from the Profile tab, ' +
             'or just click the avatar in the preview. Individual entries are addressable ' +
             'by href, e.g. `.pp-top-bar-app-menu-list-item[href$="/my_characters"]`.',
      controls: [
        grad('.pp-top-bar-app-menu-list', 'background', 'Menu background'),
        col('.pp-top-bar-app-menu-list', 'border-color', 'Menu border colour'),
        len('.pp-top-bar-app-menu-list', 'border-width', 'Menu border width', { max: 10 }),
        len('.pp-top-bar-app-menu-list', 'border-radius', 'Menu rounding', { max: 40 }),
        shadow('.pp-top-bar-app-menu-list', 'box-shadow', 'Menu shadow / glow'),
        len('.pp-top-bar-app-menu-list', 'padding', 'Menu padding', { max: 40 }),
        len('.pp-top-bar-app-menu-list', 'min-width', 'Menu width', { max: 500 }),
        text('.pp-top-bar-app-menu-list', 'backdrop-filter', 'Menu backdrop filter', 'blur(10px)'),
        font('.pp-top-bar-app-menu-list-item', 'Menu item font'),
        col('.pp-top-bar-app-menu-list-item', 'color', 'Menu item colour'),
        len('.pp-top-bar-app-menu-list-item', 'font-size', 'Menu item size', { max: 30 }),
        len('.pp-top-bar-app-menu-list-item', 'padding', 'Menu item padding', { max: 40 }),
        grad('.pp-top-bar-app-menu-list-item:hover', 'background', 'Menu item hover fill'),
        col('.pp-top-bar-app-menu-list-item:hover', 'color', 'Menu item hover colour'),
        col('.pp-top-bar-app-menu-list-item svg', 'color', 'Menu icon colour'),
        len('.pp-top-bar-app-menu-list-item svg', 'width', 'Menu icon size', { max: 60 }),
        col('.pp-top-bar-app-menu-list hr', 'border-color', 'Separator colour'),
        hide('.pp-top-bar-app-menu-list hr', 'Hide the separators'),
        grad('[class*="_plusItem_"]', 'background', 'janitor+ row fill',
             'The logo row at the top of the menu.'),
        hide('[class*="_plusItem_"]', 'Hide the janitor+ row')
      ]
    },
    {
      id: 'chrome',
      title: 'Header & footer',
      blurb: 'Site chrome. Restyling it is allowed, but keep it usable — see the JAI CSS policy.',
      controls: [
        grad('.pp-top-bar-outer', 'background', 'Header background'),
        col('.pp-top-bar-outer', 'border-color', 'Header border colour'),
        hide('.pp-top-bar-outer', 'Hide the header'),
        grad('.pp-top-bar-logo', 'background', 'Logo plate fill'),
        col('.pp-top-bar-logo-name', 'color', '"janitor" colour'),
        font('.pp-top-bar-logo-name', '"janitor" font'),
        col('.pp-top-bar-logo-sub-name', 'color', '"beta" colour'),
        grad('.pp-top-bar-create-char', 'background', 'Create-character fill'),
        col('.pp-top-bar-create-char', 'color', 'Create-character text'),
        col('.pp-top-bar-search-box', 'background-color', 'Search bar fill'),
        hide('.pp-footer', 'Hide the footer'),
        grad('.pp-footer', 'background', 'Footer background')
      ]
    }
  ];

  global.JaiControls = { groups: GROUPS, fonts: FONTS };
})(window);
