/* LinkUp — profile model, quiz funnel, and hub renderer.
 *
 * A page is either a Sales Quiz (guided path → program) or a Hub (curated
 * destinations). The editor and the live page share this module so the preview
 * cannot drift from production. */

const LinkUp = (() => {
  const KEY = 'linkup.profile';

  /* Demo is a generic coach — not a real client brand. Shows the quiz product. */
  const DEMO = {
    name: 'Maya Chen',
    handle: '@maya.moves',
    tagline: 'Strength, pregnancy fitness, and training that fits real life.',
    avatar: '',
    welcomeVideo: '',
    backgroundVideo: '',
    backgroundImage: '',
    theme: 'midnight',
    mode: 'quiz', // 'quiz' | 'hub'
    bubbleStyle: 'glass',
    captureEnabled: false,
    captureHeading: 'Get weekly tips',
    links: [
      { label: 'Instagram', note: '', url: 'https://instagram.com', size: 'm', emoji: '📸', shape: 'pill' },
      { label: 'Free guide', note: 'PDF', url: '#', size: 'm', emoji: '📘', shape: 'sticker' },
    ],
    quiz: {
      enabled: true,
      introTitle: 'Find your next step',
      introSub: 'Sixty seconds. Honest answers. The programme that fits you — not a wall of links.',
      introCta: 'Start',
      questions: [
        {
          id: 'q1',
          text: 'Where are you right now?',
          options: [
            { id: 'a', label: 'Pregnant', next: 'q2' },
            { id: 'b', label: 'Trying to conceive', next: 'result:conceive' },
            { id: 'c', label: 'Postpartum / rebuilding', next: 'result:postpartum' },
            { id: 'd', label: 'Not pregnant — training goals', next: 'q3' },
          ],
        },
        {
          id: 'q2',
          text: 'Which trimester?',
          options: [
            { id: 'a', label: 'First (1–12 weeks)', next: 'result:trim1' },
            { id: 'b', label: 'Second (13–26 weeks)', next: 'result:trim2' },
            { id: 'c', label: 'Third (27–40 weeks)', next: 'result:trim3' },
          ],
        },
        {
          id: 'q3',
          text: 'What are you chasing?',
          options: [
            { id: 'a', label: 'Build muscle & strength', next: 'result:muscle' },
            { id: 'b', label: 'Lose weight sustainably', next: 'result:lose' },
            { id: 'c', label: 'Feel energised & consistent', next: 'result:energy' },
          ],
        },
      ],
      results: {
        conceive: {
          title: 'Preconception Strength',
          subtitle: 'Build a body that’s ready — without burning out.',
          benefits: ['Gentle progressive strength', 'Cycle-aware training weeks', 'Nutrition that supports fertility', 'Private community check-ins'],
          price: 'From €49',
          cta: 'See the programme',
          url: 'https://example.com/preconception',
        },
        trim1: {
          title: 'Trimester 1 Studio',
          subtitle: 'Stay strong while energy is low and everything is new.',
          benefits: ['Safe first-trimester sessions', 'Nausea-friendly workouts', 'Pelvic floor foundations', 'Weekly form tips'],
          price: 'From €59',
          cta: 'Join Trimester 1',
          url: 'https://example.com/t1',
        },
        trim2: {
          title: 'Trimester 2 Momentum',
          subtitle: 'Your energy window — train with confidence.',
          benefits: ['Strength that scales with bump', 'Core strategies that adapt', 'Mobility for comfort', 'Coach messaging'],
          price: 'From €59',
          cta: 'Join Trimester 2',
          url: 'https://example.com/t2',
        },
        trim3: {
          title: 'Trimester 3 Prep',
          subtitle: 'Prepare for birth and the weeks after.',
          benefits: ['Labour-prep movement', 'Breath & pelvic floor', 'Short sessions for fatigue', 'Birth recovery roadmap'],
          price: 'From €59',
          cta: 'Join Trimester 3',
          url: 'https://example.com/t3',
        },
        postpartum: {
          title: 'Rebuild & Return',
          subtitle: 'Come back stronger — on your timeline.',
          benefits: ['Diastasis-aware progressions', 'Sleep-friendly workouts', 'Strength for motherhood', 'Supportive check-ins'],
          price: 'From €69',
          cta: 'Start Rebuild',
          url: 'https://example.com/postpartum',
        },
        muscle: {
          title: 'Strength Lab',
          subtitle: 'Progressive lifting with clear weekly targets.',
          benefits: ['4-day strength split', 'Video demos for every lift', 'Progressive overload plan', 'Form feedback'],
          price: 'From €79',
          cta: 'Enter Strength Lab',
          url: 'https://example.com/strength',
        },
        lose: {
          title: 'Lean Reset',
          subtitle: 'Lose weight without living in a deficit forever.',
          benefits: ['Training + nutrition paired', 'Sustainable calorie framework', 'Habit tracking that sticks', 'Weekly accountability'],
          price: 'From €79',
          cta: 'Start Lean Reset',
          url: 'https://example.com/lean',
        },
        energy: {
          title: 'Daily Engine',
          subtitle: 'Consistency over intensity — feel human again.',
          benefits: ['20–30 min sessions', 'Energy-first programming', 'Mobility + strength blend', 'Habit streaks'],
          price: 'From €49',
          cta: 'Get Daily Engine',
          url: 'https://example.com/energy',
        },
      },
    },
  };

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
      return raw ? mergeProfile(JSON.parse(raw)) : structuredClone(DEMO);
    } catch {
      return structuredClone(DEMO);
    }
  }

  function save(profile) {
    localStorage.setItem(KEY, JSON.stringify(profile));
  }

  function mergeProfile(p) {
    const base = structuredClone(DEMO);
    const out = { ...base, ...p };
    if (p?.quiz) {
      out.quiz = {
        ...base.quiz,
        ...p.quiz,
        questions: Array.isArray(p.quiz.questions) ? p.quiz.questions : base.quiz.questions,
        results: p.quiz.results && typeof p.quiz.results === 'object' ? p.quiz.results : base.quiz.results,
      };
    }
    if (!Array.isArray(out.links)) out.links = [];
    if (out.mode !== 'hub' && out.mode !== 'quiz') out.mode = out.quiz?.enabled === false ? 'hub' : 'quiz';
    return out;
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function safeUrl(url) {
    const u = String(url ?? '').trim();
    if (!u || u === '#') return '#';
    if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return 'https://' + u;
    return '#';
  }

  function applyTheme(root, name) {
    const t = THEMES[name] || THEMES.midnight;
    root.style.setProperty('--p-bg', t.bg);
    root.style.setProperty('--p-accent', t.accent);
    root.style.setProperty('--p-deep', t.deep);
    root.style.setProperty('--p-light', t.light);
    const meta = (root.ownerDocument || root).querySelector?.('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', t.bg);
  }

  function backgroundHtml(p) {
    if (p.backgroundVideo) {
      return `<video src="${esc(p.backgroundVideo)}" autoplay muted loop playsinline
                     ${p.backgroundImage ? `poster="${esc(p.backgroundImage)}"` : ''}></video>`;
    }
    if (p.backgroundImage) return `<img src="${esc(p.backgroundImage)}" alt="" />`;
    return '';
  }

  /* ── Hub (curated destinations) ─────────────────────────────────────── */
  const SHAPES = ['bubble', 'polaroid', 'sticker', 'ticket', 'note', 'pill'];
  const SIZES = ['s', 'm', 'l'];
  const shapeOf = l => (SHAPES.includes(l.shape) ? l.shape : 'pill');
  const sizeOf = l => (SIZES.includes(l.size) ? l.size : (l.big ? 'l' : 'm'));
  const placed = l => Number.isFinite(l.x) && Number.isFinite(l.y);
  const anyPlaced = p => (p.links || []).some(placed);

  function hubHtml(p) {
    const links = (p.links || []).filter(l => l.label);
    if (!links.length) {
      return `<div class="hub-empty"><p>No destinations yet.</p></div>`;
    }
    return `<nav class="hub-list">${links.map((l, i) => {
      const url = safeUrl(l.url);
      return `<a class="hub-item rise" style="--rise:${i * 70}ms" href="${esc(url)}"
        ${url === '#' ? '' : 'target="_blank" rel="noopener noreferrer"'} data-i="${i}">
        ${l.emoji ? `<span class="hub-emoji">${esc([...String(l.emoji)][0] || '')}</span>` : ''}
        <span class="hub-copy"><strong>${esc(l.label)}</strong>
        ${l.note ? `<small>${esc(l.note)}</small>` : ''}</span>
        <span class="hub-arrow" aria-hidden="true">→</span>
      </a>`;
    }).join('')}</nav>`;
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

  /* ── Quiz funnel ────────────────────────────────────────────────────── */
  function quizShell(p) {
    const q = p.quiz || {};
    return `
      <div class="quiz" id="quiz" data-step="intro">
        <div class="quiz-progress" aria-hidden="true"><i id="quizBar"></i></div>
        <div class="quiz-stage" id="quizStage"></div>
      </div>`;
  }

  function renderQuizStep(p, step, { root = document } = {}) {
    const stage = root.querySelector('#quizStage');
    const bar = root.querySelector('#quizBar');
    const quizRoot = root.querySelector('#quiz');
    if (!stage || !p.quiz) return;

    const questions = p.quiz.questions || [];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const firstPaint = !stage.dataset.ready;

    function swap(html, progress) {
      if (bar) bar.style.width = `${Math.max(4, progress * 100)}%`;
      if (quizRoot) quizRoot.dataset.step = step;

      const paint = () => {
        stage.innerHTML = html;
        stage.classList.remove('out');
        stage.dataset.ready = '1';
        void stage.offsetWidth;
        stage.classList.add('in');
      };

      if (firstPaint || reduced) {
        paint();
        return;
      }
      stage.classList.remove('in');
      stage.classList.add('out');
      setTimeout(paint, 220);
    }

    if (step === 'intro') {
      swap(`
        <div class="quiz-panel intro">
          ${p.avatar ? `<img class="quiz-avatar" src="${esc(p.avatar)}" alt="" />` : `<div class="quiz-mark" aria-hidden="true"></div>`}
          <p class="quiz-kicker">${esc(p.name || 'LinkUp')}</p>
          <h1>${esc(p.quiz.introTitle || 'Find your next step')}</h1>
          <p class="quiz-lede">${esc(p.quiz.introSub || '')}</p>
          <button type="button" class="quiz-cta" data-quiz-go="q:${questions[0]?.id || ''}">${esc(p.quiz.introCta || 'Start')}</button>
          ${p.mode === 'quiz' && (p.links || []).some(l => l.label) ? `<button type="button" class="quiz-skip" data-quiz-go="hub">Browse all links</button>` : ''}
        </div>`, 0);
      return;
    }

    if (step === 'hub') {
      swap(`
        <div class="quiz-panel hub">
          <button type="button" class="quiz-back" data-quiz-go="intro">← Back</button>
          <h2>All destinations</h2>
          ${hubHtml(p)}
        </div>`, 1);
      return;
    }

    if (step.startsWith('q:')) {
      const id = step.slice(2);
      const qi = questions.findIndex(x => x.id === id);
      const question = questions[qi];
      if (!question) return;
      const progress = (qi + 1) / (questions.length + 1);
      swap(`
        <div class="quiz-panel question">
          <p class="quiz-count">Question ${qi + 1} of ${questions.length}</p>
          <h2>${esc(question.text)}</h2>
          <div class="quiz-options">
            ${(question.options || []).map((opt, i) => `
              <button type="button" class="quiz-option rise" style="--rise:${i * 60}ms"
                data-quiz-go="${esc(opt.next || '')}">
                <span>${esc(opt.label)}</span>
                <i aria-hidden="true">→</i>
              </button>`).join('')}
          </div>
        </div>`, progress);
      return;
    }

    if (step.startsWith('result:')) {
      const key = step.slice(7);
      const r = p.quiz.results?.[key];
      if (!r) {
        swap(`<div class="quiz-panel"><h2>Nothing matched</h2><button type="button" class="quiz-cta" data-quiz-go="intro">Start again</button></div>`, 1);
        return;
      }
      const url = safeUrl(r.url);
      swap(`
        <div class="quiz-panel result">
          <p class="quiz-kicker">Your match</p>
          <h1>${esc(r.title)}</h1>
          <p class="quiz-lede">${esc(r.subtitle || '')}</p>
          <ul class="quiz-benefits">
            ${(r.benefits || []).map(b => `<li>${esc(b)}</li>`).join('')}
          </ul>
          ${r.price ? `<p class="quiz-price">${esc(r.price)}</p>` : ''}
          <a class="quiz-cta" href="${esc(url)}" ${url === '#' ? '' : 'target="_blank" rel="noopener noreferrer"'}">${esc(r.cta || 'Continue')}</a>
          <button type="button" class="quiz-skip" data-quiz-go="intro">Retake the quiz</button>
        </div>`, 1);
    }
  }

  function wireQuiz(p, { root = document, onTap } = {}) {
    const quiz = root.querySelector('#quiz');
    if (!quiz) return;
    let step = 'intro';
    renderQuizStep(p, step, { root });

    quiz.onclick = (e) => {
      const btn = e.target.closest('[data-quiz-go]');
      if (!btn) return;
      const next = btn.getAttribute('data-quiz-go');
      if (!next) return;
      if (onTap && btn.matches('.quiz-option, .quiz-cta')) {
        try { onTap(btn.textContent.trim().slice(0, 80)); } catch {}
      }
      if (next.startsWith('q:')) step = next;
      else if (next.startsWith('result:')) step = next;
      else if (next === 'hub' || next === 'intro') step = next;
      else if (next.startsWith('q') && !next.includes(':')) step = `q:${next}`;
      else step = next;
      renderQuizStep(p, step, { root });
    };
  }

  /* Renders into whatever containers exist. */
  function render(p, { root = document, bgEl, pageEl, interactive = true } = {}) {
    p = mergeProfile(p);
    const html = root.documentElement || document.documentElement;
    applyTheme(html, p.theme);
    html.setAttribute('data-mode', p.mode === 'hub' ? 'hub' : 'quiz');
    const bg = bgEl || root.querySelector('.bg');
    const page = pageEl || root.querySelector('.page');
    if (bg) bg.innerHTML = backgroundHtml(p);
    if (!page) return;

    const showBadge = true; // plan gating applied by host page if needed via dataset
    const foot = `<p class="foot">Made with <a href="/">LinkUp</a></p>`;

    if (p.mode === 'hub' || p.quiz?.enabled === false) {
      page.innerHTML = `
        <header class="profile-head rise">
          ${p.avatar ? `<img class="avatar" src="${esc(p.avatar)}" alt="" />` : ''}
          <h1 class="name">${esc(p.name)}</h1>
          ${p.handle ? `<div class="handle">${esc(p.handle)}</div>` : ''}
          ${p.tagline ? `<p class="tagline">${esc(p.tagline)}</p>` : ''}
        </header>
        ${hubHtml(p)}
        ${captureHtml(p)}
        ${foot}`;
      return;
    }

    page.innerHTML = `
      ${quizShell(p)}
      ${captureHtml(p)}
      ${foot}`;
    if (interactive) wireQuiz(p, { root });
  }

  function liven() { /* hub items use CSS rise; quiz handles its own motion */ }

  function makePlaceable() { /* hub no longer uses free placement */ }

  function onCapture(e) {
    e.preventDefault();
    const input = e.target.querySelector('input[name=email]');
    const list = JSON.parse(localStorage.getItem('linkup.emails') || '[]');
    list.push({ email: input.value, at: new Date().toISOString() });
    localStorage.setItem('linkup.emails', JSON.stringify(list));
    e.target.outerHTML = `<p class="tagline">Thanks — you're on the list.</p>`;
  }

  /* Helpers for editor */
  function emptyQuestion() {
    return {
      id: 'q' + Math.random().toString(36).slice(2, 7),
      text: 'New question',
      options: [
        { id: 'a', label: 'Option A', next: 'result:new' },
        { id: 'b', label: 'Option B', next: 'result:new' },
      ],
    };
  }

  function emptyResult(key) {
    return {
      title: 'Programme name',
      subtitle: 'One line on who it’s for.',
      benefits: ['Benefit one', 'Benefit two', 'Benefit three'],
      price: 'From €59',
      cta: 'Get started',
      url: 'https://',
    };
  }

  return {
    KEY, DEMO, THEMES, SIZES, SHAPES, sizeOf, shapeOf, placed, anyPlaced,
    load, save, mergeProfile, render, esc, safeUrl, onCapture, liven, makePlaceable,
    wireQuiz, renderQuizStep, emptyQuestion, emptyResult, hubHtml,
  };
})();
