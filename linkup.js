/* LinkUp — shared rendering.
 *
 * A page is a profile object and nothing else. The live page reads one and
 * draws it; the editor writes one and hands it straight back to the same
 * renderer, so the preview cannot drift from the real thing.
 *
 * There is no backend yet. Profiles live in localStorage, which is enough to
 * demonstrate the product and not enough to sell it — accounts, payments and
 * email sending are the next build, not this one. */

const LinkUp = (() => {
  const KEY = 'linkup.profile';

  const DEMO = {
    name: 'Becca Lyons',
    handle: '@bodiesbybeccaa',
    tagline: 'Online coach — strength, food, and not hating either.',
    avatar: '',
    welcomeVideo: '',
    backgroundVideo: '',
    backgroundImage: '',
    theme: 'midnight',
    bubbleStyle: 'glass',
    captureEnabled: true,
    captureHeading: 'Get the free 5-day reset',
    links: [
      { label: 'Join The Village', note: 'most popular', url: 'https://jointhevillage.ie', size: 'l', emoji: '💫', shape: 'bubble' },
      { label: '8 Week Reset', note: '€39', url: '#', emoji: '🔥', shape: 'ticket' },
      { label: 'Calorie calculator', note: '', url: '#', emoji: '🧮', shape: 'sticker', size: 's' },
      { label: 'Instagram', note: '', url: '#', emoji: '📸', shape: 'polaroid' },
      { label: 'Book a call', note: '', url: '#', emoji: '☎️', shape: 'note', size: 's' },
    ],
  };

  /* Presets rather than a colour picker: most people pick badly, and a page
     that looks cheap is the whole reason they left Linktree. */
  const THEMES = {
    blush:    { label: 'Blush',    bg: '#2e1b2b', accent: '#ff7fb8', deep: '#ef4e97', light: '#ffb3d4' },
    midnight: { label: 'Midnight', bg: '#111629', accent: '#7f9dff', deep: '#4e6ce8', light: '#b3c4ff' },
    sage:     { label: 'Sage',     bg: '#1d2620', accent: '#8fc79b', deep: '#4fa068', light: '#c2e6ca' },
    amber:    { label: 'Amber',    bg: '#2a1a10', accent: '#f0a35e', deep: '#d97b28', light: '#f7cfa4' },
    ink:      { label: 'Ink',      bg: '#141414', accent: '#b9b9b9', deep: '#8a8a8a', light: '#e2e2e2' },
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...DEMO, ...JSON.parse(raw) } : { ...DEMO };
    } catch {
      return { ...DEMO };
    }
  }

  function save(profile) {
    localStorage.setItem(KEY, JSON.stringify(profile));
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* A link the customer typed is not to be trusted with the page's own
     origin — javascript: URLs in particular. Anything unrecognised becomes a
     dead anchor rather than a live one. */
  function safeUrl(url) {
    const u = String(url ?? '').trim();
    if (!u || u === '#') return '#';
    if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return 'https://' + u;
    return '#';
  }

  function applyTheme(root, name) {
    const t = THEMES[name] || THEMES.blush;
    root.style.setProperty('--p-bg', t.bg);
    root.style.setProperty('--p-accent', t.accent);
    root.style.setProperty('--p-deep', t.deep);
    root.style.setProperty('--p-light', t.light);
    // Colour the browser chrome too, so the page doesn't stop at a white bar.
    const meta = (root.ownerDocument || root).querySelector?.('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', t.bg);
  }

  function backgroundHtml(p) {
    if (p.backgroundVideo) {
      // muted + playsinline is the only combination iOS will start on its own.
      return `<video src="${esc(p.backgroundVideo)}" autoplay muted loop playsinline
                     ${p.backgroundImage ? `poster="${esc(p.backgroundImage)}"` : ''}></video>`;
    }
    if (p.backgroundImage) return `<img src="${esc(p.backgroundImage)}" alt="" />`;
    return '';
  }

  // How much text has to fit decides the size it's set at.
  function fit(label) {
    const n = String(label || '').length;
    return n > 24 ? 'longer' : n > 14 ? 'long' : '';
  }

  /* Three sizes. `big` was the old boolean and still means large, so pages
     built before sizes existed look exactly as they did. */
  const SIZES = ['s', 'm', 'l'];
  const sizeOf = l => (SIZES.includes(l.size) ? l.size : (l.big ? 'l' : 'm'));

  /* One emoji, not a string of them — a circle this size has room for one, and
     three of them turns the label into a ransom note. */
  function oneEmoji(v) {
    const t = String(v ?? '').trim();
    if (!t) return '';
    return [...t][0] || '';
  }

  /* Placement.
     A bubble may carry x and y as percentages of the stage — that's what makes
     a LinkUp page a composition rather than a list. Anything without them is
     laid out automatically, so a page built before placing existed still looks
     right, and so does one where she's only moved two of them. */
  const placed = l => Number.isFinite(l.x) && Number.isFinite(l.y);
  const anyPlaced = p => (p.links || []).some(placed);

  /* Automatic arrangement for anything she hasn't placed herself.
     Not a column and not a grid. Objects come down the board in rows, leaning
     alternately, each nudged off the centre line by a fixed amount taken from
     its position in the list — so it reads as arranged, and it is the same
     every time rather than reshuffling as she types.

     It has to know that a ticket is not a circle: wide objects take a row to
     themselves, or two of them side by side would sit on top of each other. */
  /* Roughly how much room each object takes, in pixels, on a phone. Kept here
     rather than measured because the layout has to be decided before anything
     is on screen — and because it must come out the same every time, not
     depend on when a font finished loading. Generous by design: a few pixels
     Widths are the ones used on the narrowest phones, where bubbles step down
     a size — that is the only place things can touch, so it is the width the
     decision has to be made at. */
  const BOX = {
    bubble:   { s: [96, 116], m: [112, 146], l: [140, 176] },
    polaroid: { s: [124, 172], m: [156, 210], l: [192, 252] },
    sticker:  { s: [150,  96], m: [190, 112], l: [210, 132] },
    ticket:   { s: [148,  78], m: [182,  88], l: [220, 108] },
    note:     { s: [112, 120], m: [136, 140], l: [168, 168] },
    pill:     { s: [190,  74], m: [230,  88], l: [260, 104] },
  };
  const boxOf = l => BOX[shapeOf(l)][sizeOf(l)];

  /* Two objects share a row only if they actually fit side by side. The pair
     sits at 29% and 71%, so the gap between their centres is 42% of the board;
     anything wider than that has the row to itself. */
  const STAGE_W = 280;                       // a 320px phone, less the padding
  const fitsBeside = (a, b) => (boxOf(a)[0] + boxOf(b)[0]) / 2 + 4 <= STAGE_W * 0.42;

  function autoLayout(links) {
    const rows = [];
    let i = 0;
    while (i < links.length) {
      if (i + 1 < links.length && fitsBeside(links[i], links[i + 1])) { rows.push([i, i + 1]); i += 2; }
      else { rows.push([i]); i += 1; }
    }

    /* Rows are as tall as the tallest thing in them, so a polaroid never lands
       on the note beneath it however many objects there are. */
    const GAP = 22;
    const heights = rows.map(r => Math.max(...r.map(idx => boxOf(links[idx])[1])) + GAP);
    const total = heights.reduce((a, b) => a + b, 0);

    const spots = [];
    let top = 0;
    rows.forEach((rowItems, r) => {
      const mid = top + heights[r] / 2;
      const y = (mid / total) * 100;
      if (rowItems.length === 1) {
        const idx = rowItems[0];
        spots[idx] = { x: 50 + (r % 2 ? -6 : 6), y };
      } else {
        rowItems.forEach((idx, k) => {
          const lean = r % 2 === 0 ? 0 : 4;
          const jitter = ((idx * 37) % 7) - 3;
          spots[idx] = { x: (k === 0 ? 29 : 71) + lean + jitter, y };
        });
      }
      top += heights[r];
    });
    spots.stageHeight = total;      // the board tells the CSS how tall to be
    return spots;
  }

  /* ── Shapes ─────────────────────────────────────────────────────────────
     A page is a pinboard, and every offer is an object on it. Which object is
     the customer's choice — that, plus where it sits and how it leans, is what
     stops two LinkUp pages looking like each other. */
  const SHAPES = ['bubble', 'polaroid', 'sticker', 'ticket', 'note', 'pill'];
  const shapeOf = l => (SHAPES.includes(l.shape) ? l.shape : 'bubble');

  /* Lean. Fixed per position, never random, so nothing wobbles to a new angle
     on every keystroke. Bubbles stay upright — a tilted sphere is just wrong. */
  function tiltOf(l, i) {
    if (Number.isFinite(l.tilt)) return l.tilt;
    if (shapeOf(l) === 'bubble' || shapeOf(l) === 'pill') return 0;
    return [-4, 3, -2.5, 5, -6, 2][i % 6];
  }

  function inner(l, shape, emoji) {
    const label = esc(l.label);
    const note  = l.note ? `<span class="note">${esc(l.note)}</span>` : '';
    const pic   = l.image ? `<span class="shot" style="background-image:url('${esc(l.image)}')"></span>` : '';
    const em    = emoji ? `<span class="emoji" aria-hidden="true">${esc(emoji)}</span>` : '';

    if (shape === 'polaroid') {
      // A photo with a caption written under it. Falls back to the emoji on a
      // coloured card when there's no picture yet, rather than a grey hole.
      return `${pic || `<span class="shot empty">${emoji || '📷'}</span>`}
              <span class="cap">${label}</span>${note}`;
    }
    if (shape === 'ticket') {
      return `<span class="stub">${em || ''}</span>
              <span class="tbody"><span class="tlabel">${label}</span>
              ${l.note ? `<span class="tnote">${esc(l.note)}</span>` : ''}</span>`;
    }
    if (shape === 'sticker') return `${em}<span class="slab">${label}</span>${note}`;
    if (shape === 'note')    return `${em}<span class="nlab">${label}</span>${note}`;
    if (shape === 'pill')    return `${em}<span class="plab">${label}</span>${note}`;
    return `${em}<span>${label}</span>${note}`;                       // bubble
  }

  /* How tall the board has to be for what's on it. */
  function stageHeight(p) {
    const links = (p.links || []).filter(l => l.label);
    return links.length ? autoLayout(links).stageHeight : 340;
  }

  function bubblesHtml(p) {
    const links = (p.links || []).filter(l => l.label);
    const auto = autoLayout(links);
    return links.map((l, i) => {
      const emoji = oneEmoji(l.emoji);
      const shape = shapeOf(l);
      const spot  = placed(l) ? { x: l.x, y: l.y } : auto[i];
      const dur   = (8 + (i * 1.7) % 5).toFixed(2);
      const delay = ((i * 0.9) % 3).toFixed(2);
      const swing = (6 + (i * 3) % 7).toFixed(0);
      return `
      <a class="bubble ${shape} ${sizeOf(l)} ${emoji ? 'has-emoji' : ''} ${shape === 'bubble' ? fit(l.label) : ''}"
         href="${esc(safeUrl(l.url))}"
         ${safeUrl(l.url) === '#' ? '' : 'target="_blank" rel="noopener noreferrer"'}
         data-i="${i}"
         style="--x:${spot.x}%; --y:${spot.y}%; --dur:${dur}s; --delay:${delay}s; --swing:${swing}px;
                --rise:${(i * 90)}ms; --tilt:${tiltOf(l, i)}deg">
        ${inner(l, shape, emoji)}
      </a>`;
    }).join('');
  }

  function captureHtml(p) {
    if (!p.captureEnabled) return '';
    return `
      <div class="capture-wrap">
        <form class="capture" onsubmit="LinkUp.onCapture(event)">
          <input type="email" name="email" required placeholder="Your email" aria-label="Your email" />
          <button type="submit">Join</button>
        </form>
        <p class="capture-note">${esc(p.captureHeading || '')}</p>
      </div>`;
  }

  /* Renders into whatever containers exist, so the editor can reuse it for a
     live preview without duplicating any markup. */
  function render(p, { root = document, bgEl, pageEl } = {}) {
    const html = root.documentElement || document.documentElement;
    applyTheme(html, p.theme);
    // The look of the bubbles is an attribute on the root, so all of it is
    // decided in CSS and none of it is decided here.
    html.setAttribute('data-bubbles', ['glass', 'solid', 'outline'].includes(p.bubbleStyle) ? p.bubbleStyle : 'glass');
    const bg = bgEl || root.querySelector('.bg');
    const page = pageEl || root.querySelector('.page');
    if (bg) bg.innerHTML = backgroundHtml(p);
    if (!page) return;
    page.innerHTML = `
      ${p.avatar ? `<img class="avatar" src="${esc(p.avatar)}" alt="" />` : ''}
      <h1 class="name">${esc(p.name)}</h1>
      ${p.handle ? `<div class="handle">${esc(p.handle)}</div>` : ''}
      ${p.tagline ? `<p class="tagline">${esc(p.tagline)}</p>` : ''}
      <nav class="bubbles stage" style="--stage-h:${stageHeight(p)}px">${bubblesHtml(p)}</nav>
      ${captureHtml(p)}
      <p class="foot">Made with <a href="/">LinkUp</a></p>`;
  }


  /* ── Nudge ──────────────────────────────────────────────────────────────
     Bubbles lean away from a pointer as it passes. It is the difference
     between a picture of bubbles and something that feels like it's floating
     in front of you, and it costs one rAF over a handful of elements. */
  function liven(root = document) {
    const stage = root.querySelector('.bubbles');
    if (!stage || stage.dataset.livened) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stage.dataset.livened = '1';

    let px = null, py = null, queued = false;

    const apply = () => {
      queued = false;
      stage.querySelectorAll('.bubble').forEach(el => {
        if (px == null) { el.style.setProperty('--nudge-x', '0px'); el.style.setProperty('--nudge-y', '0px'); return; }
        const b = el.getBoundingClientRect();
        const dx = (b.left + b.width / 2) - px;
        const dy = (b.top + b.height / 2) - py;
        const dist = Math.hypot(dx, dy);
        const reach = 190;
        if (dist > reach || dist === 0) {
          el.style.setProperty('--nudge-x', '0px');
          el.style.setProperty('--nudge-y', '0px');
          return;
        }
        const push = (1 - dist / reach) * 26;
        el.style.setProperty('--nudge-x', `${((dx / dist) * push).toFixed(1)}px`);
        el.style.setProperty('--nudge-y', `${((dy / dist) * push).toFixed(1)}px`);
      });
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(apply); } };

    const doc = root.ownerDocument || root;
    doc.addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; queue(); }, { passive: true });
    doc.addEventListener('pointerleave', () => { px = py = null; queue(); });
    doc.addEventListener('pointercancel', () => { px = py = null; queue(); });
  }

  /* ── Placing, from inside the preview ───────────────────────────────────
     The editor's preview is the editing surface: a bubble is dragged where it
     should live and the position is handed back to the editor, which owns the
     data. Nothing is saved in here. */
  function makePlaceable(root, onMove) {
    const stage = root.querySelector('.bubbles');
    if (!stage) return;
    stage.classList.add('placing');

    stage.querySelectorAll('.bubble').forEach(el => {
      el.addEventListener('click', e => e.preventDefault());   // never follow the link while arranging
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        const i = Number(el.dataset.i);
        el.classList.add('held');
        el.setPointerCapture(e.pointerId);

        const move = (ev) => {
          const box = stage.getBoundingClientRect();
          const half = el.offsetWidth / 2;
          // Kept fully on the stage, so nothing can be dragged out of sight.
          const x = Math.min(Math.max(ev.clientX - box.left, half), box.width - half);
          const y = Math.min(Math.max(ev.clientY - box.top, half), box.height - half);
          el.style.setProperty('--x', `${((x / box.width) * 100).toFixed(2)}%`);
          el.style.setProperty('--y', `${((y / box.height) * 100).toFixed(2)}%`);
        };
        const up = () => {
          el.classList.remove('held');
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
          onMove(i, parseFloat(el.style.getPropertyValue('--x')), parseFloat(el.style.getPropertyValue('--y')));
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      });
    });
  }

  /* No server to post to yet. Storing locally proves the flow and makes it
     obvious this is a demo rather than quietly losing someone's address. */
  function onCapture(e) {
    e.preventDefault();
    const input = e.target.querySelector('input[name=email]');
    const list = JSON.parse(localStorage.getItem('linkup.emails') || '[]');
    list.push({ email: input.value, at: new Date().toISOString() });
    localStorage.setItem('linkup.emails', JSON.stringify(list));
    e.target.outerHTML = `<p class="tagline">Thanks — you're on the list.</p>`;
  }

  return { KEY, DEMO, THEMES, SIZES, SHAPES, sizeOf, shapeOf, placed, anyPlaced, autoLayout, liven, makePlaceable,
           load, save, render, esc, safeUrl, onCapture };
})();
