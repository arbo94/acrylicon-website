// AcryliCon Ireland — interactions
// One shared rAF engine drives every scroll-linked effect from a damped
// "shadow" scroll value (smooths the read only — native scroll is never touched).
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const mapRange = (v, inA, inB, outA, outB) => {
    const t = Math.max(0, Math.min(1, (v - inA) / (inB - inA)));
    return outA + t * (outB - outA);
  };

  // ---------- Scroll engine ----------
  const DAMPING = reduced ? 1 : 0.1;
  let target = scrollY;
  let smooth = scrollY;
  let running = false;
  let vh = innerHeight;
  const effects = [];

  // Document-space range of a scene: 0 when its top reaches `offset`, 1 when its bottom leaves the viewport.
  const ranges = new Map();
  function measure() {
    vh = innerHeight;
    ranges.clear();
    effects.forEach((fx) => fx.el && ranges.set(fx.el, {
      top: fx.el.getBoundingClientRect().top + scrollY,
      height: fx.el.offsetHeight,
    }));
  }
  function progress(el, offset = 0) {
    const r = ranges.get(el);
    if (!r) return 0;
    const start = r.top - offset;
    const end = r.top + r.height - vh;
    return Math.max(0, Math.min(1, (smooth - start) / Math.max(1, end - start)));
  }

  // Damping is per 60fps frame; scale by elapsed time so 120Hz screens and throttled tabs feel the same.
  let last = 0;
  function tick(now) {
    const dt = last ? Math.min(now - last, 1000) : 16.7;
    last = now;
    const alpha = 1 - Math.pow(1 - DAMPING, dt / 16.7);
    smooth += (target - smooth) * alpha;
    if (Math.abs(target - smooth) < 0.1) smooth = target;
    effects.forEach((fx) => fx.update());
    if (smooth !== target) requestAnimationFrame(tick);
    else { running = false; last = 0; }
  }
  function kick() {
    if (!running) { running = true; requestAnimationFrame(tick); }
  }
  addEventListener('scroll', () => { target = scrollY; kick(); }, { passive: true });
  addEventListener('resize', () => { measure(); kick(); });
  addEventListener('load', () => { measure(); kick(); });

  const navH = () => parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 48;

  // 1. Hero: framed photo grows to full bleed, caption rises in.
  const heroScene = $('#hero-scene');
  const heroFrame = $('#hero-frame');
  const heroCap = $('#hero-caption');
  effects.push({
    el: heroScene,
    update() {
      const p = progress(heroScene, navH() + vh * 0.35);
      heroFrame.style.setProperty('--frame-s', mapRange(p, 0, 0.55, 0.86, 1).toFixed(4));
      heroFrame.style.setProperty('--frame-r', mapRange(p, 0, 0.55, 28, 0).toFixed(1) + 'px');
      heroCap.style.setProperty('--cap-o', mapRange(p, 0.5, 0.8, 0, 1).toFixed(3));
      heroCap.style.setProperty('--cap-y', mapRange(p, 0.5, 0.8, 24, 0).toFixed(1) + 'px');
    },
  });

  // 2. Statement: words light up in reading order as you scroll.
  const statement = $('#statement');
  const accentFrom = statement.dataset.accentFrom;
  const accentAt = statement.textContent.indexOf(accentFrom);
  let charPos = 0;
  statement.innerHTML = statement.textContent.split(/(\s+)/).map((tok) => {
    const start = charPos;
    charPos += tok.length;
    if (!tok.trim()) return tok;
    return `<span class="w${start >= accentAt ? ' accent' : ''}">${tok}</span>`;
  }).join('');
  const words = $$('.w', statement);
  const statementScene = $('#about');
  effects.push({
    el: statementScene,
    update() {
      const p = progress(statementScene, navH());
      const lit = Math.round(mapRange(p, 0.05, 0.8, 0, words.length));
      words.forEach((w, i) => w.classList.toggle('on', i < lit));
    },
  });

  // 3. Cure scene: scroll scrubs a 0:00 → 2:00 clock and steps through the timeline.
  const cure = $('#cure');
  const clock = $('#clock');
  const steps = $$('#steps .step');
  effects.push({
    el: cure,
    update() {
      const p = progress(cure, navH());
      const f = mapRange(p, 0.08, 0.85, 0, 1);
      const mins = Math.round(f * 120);
      clock.textContent = `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
      cure.style.setProperty('--cure-p', f.toFixed(4));
      let now = -1;
      steps.forEach((s, i) => {
        const on = f >= parseFloat(s.dataset.at) && p > 0;
        s.classList.toggle('on', on);
        if (on) now = i;
      });
      steps.forEach((s, i) => s.classList.toggle('now', i === now));
    },
  });

  // 4. Systems: sticky-stacked cards recede as the next one pins over them.
  const cards = $$('.stack-card');
  const stackMQ = matchMedia('(min-width: 834px)');
  effects.push({
    update() {
      if (reduced || !stackMQ.matches) {
        cards.forEach((c) => { c.style.transform = ''; c.style.opacity = ''; });
        return;
      }
      // Read phase
      const rects = cards.map((c) => c.getBoundingClientRect());
      const tops = cards.map((c) => parseFloat(getComputedStyle(c).top) || 0);
      // Write phase — burial measured against each card's own sticky top
      const SLOP = 4;
      cards.forEach((card, i) => {
        let buried = 0;
        if (rects[i].top <= tops[i] + SLOP) {
          for (let j = i + 1; j < cards.length; j++) {
            if (rects[j].top <= tops[j] + SLOP) buried++;
          }
        }
        card.style.transform = buried ? `scale(${Math.max(0.85, 0.95 - 0.03 * (buried - 1)).toFixed(3)})` : '';
        card.style.opacity = buried ? Math.max(0.6, 1 - buried * 0.14).toFixed(3) : '';
      });
    },
  });

  measure();
  kick();

  // ---------- Cross-section theme morph (centre-line band, height-independent) ----------
  const themeMeta = $('meta[name="theme-color"]');
  const themeIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const theme = e.target.dataset.themeSection;
      root.dataset.theme = theme;
      themeMeta.content = theme === 'dark' ? '#000000' : '#ffffff';
    });
  }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
  $$('[data-theme-section]').forEach((el) => themeIO.observe(el));

  // ---------- One-shot reveals for secondary content ----------
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  const observeReveals = () => $$('.reveal:not(.in)').forEach((el) => revealIO.observe(el));

  // ---------- Mobile menu ----------
  const menuBtn = $('.menu-btn');
  const setMenu = (open) => {
    document.body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  menuBtn.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  $$('.nav-links a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // ---------- Horizontal galleries (native scroll; buttons are a convenience) ----------
  $$('[data-gallery]').forEach((btn) => {
    const g = document.getElementById(btn.dataset.gallery);
    const update = () => {
      const dir = +btn.dataset.dir;
      btn.disabled = dir < 0 ? g.scrollLeft <= 4 : g.scrollLeft + g.clientWidth >= g.scrollWidth - 4;
    };
    btn.addEventListener('click', () => {
      const item = g.firstElementChild;
      const step = item.offsetWidth + parseFloat(getComputedStyle(g).columnGap || 20);
      g.scrollBy({ left: +btn.dataset.dir * step, behavior: reduced ? 'auto' : 'smooth' });
    });
    g.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
  });

  // ---------- Projects ----------
  const projects = [
    ['marine-harvest', 'Marine Harvest', 'food', 'Fish production'],
    ['kerry-group', 'Kerry Group', 'food', 'Food production'],
    ['abp-cahir', 'ABP Cahir', 'food', 'Food production'],
    ['divilly-meats', 'Divilly Meats', 'food', 'Food production'],
    ['patisserie-royale', 'Patisserie Royale', 'bakery', 'Bakery'],
    ['olearys-butchers-co-cork', "O'Learys Butchers, Cork", 'bakery', 'Butchers'],
    ['fx-buckleys-greenogue-co-dublin', 'FX Buckleys, Greenogue', 'bakery', 'Butchers'],
    ['bakery-belfast', 'Bakery, Belfast', 'bakery', 'Bakery'],
    ['pharmaceutical-project-co-kildare', 'Pharmaceutical, Kildare', 'pharma', 'Pharmaceutical'],
    ['chemical-bund-project-co-dublin', 'Chemical Bund, Dublin', 'pharma', 'Chemical bund'],
    ['tankingproject', 'Tanking Project', 'pharma', 'Tanking'],
    ['clean-room-project', 'Clean Room', 'pharma', 'Pharmaceutical'],
    ['retail-project-co-cork', 'Retail Project, Cork', 'retail', 'Retail'],
    ['hardware-store-co-kerry', 'Hardware Store, Kerry', 'retail', 'Retail'],
    ['porschegarage', 'Porsche Garage', 'retail', 'Showroom'],
    ['b-q-office-steps', 'B&Q Office Steps', 'retail', 'Retail'],
    ['shelbourne-fc-changing-room', 'Shelbourne FC', 'leisure', 'Changing rooms'],
    ['school-basketball-court', 'School Basketball Court', 'leisure', 'Sports'],
    ['leisure-club-sports-facilities', 'Hotel Leisure Club', 'leisure', 'Leisure'],
    ['woodlands-hotel-adare', 'Woodlands Hotel, Adare', 'leisure', 'Pool deck'],
    ['warehouse-project-co-down', 'Warehouse, Co. Down', 'other', 'Industrial'],
    ['intel-kitchen', 'Intel Kitchen', 'other', 'Commercial kitchen'],
    ['flake-coving-works', 'Flake Coving Works', 'other', 'Flake system'],
    ['micro-brewery-co-dublin', 'Micro-Brewery, Dublin', 'other', 'Brewery'],
  ];
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const grid = $('#project-grid');
  grid.innerHTML = projects.map(([img, title, cat, label], i) => `
    <button class="project reveal" data-cat="${cat}" data-i="${i}" aria-label="View ${esc(title)}">
      <div class="project-img"><img src="assets/img/${img}.jpg" alt="${esc(title)}" loading="lazy" width="1000" height="700"></div>
      <h3>${esc(title)}</h3><small>${label}</small>
    </button>`).join('');
  observeReveals();

  const filterBtns = $$('.filters button');
  filterBtns.forEach((btn) => btn.addEventListener('click', () => {
    filterBtns.forEach((b) => b.setAttribute('aria-pressed', b === btn));
    const f = btn.dataset.filter;
    $$('.project', grid).forEach((p) => {
      p.hidden = f !== 'all' && p.dataset.cat !== f;
      if (!p.hidden) p.classList.add('in');
    });
    measure(); kick();
  }));

  // Lightbox
  const lb = $('#lightbox');
  const lbImg = $('img', lb);
  let current = 0;
  let opener = null;
  const visible = () => $$('.project:not([hidden])', grid).map((p) => +p.dataset.i);
  const show = (i) => {
    current = i;
    const [img, title, , label] = projects[i];
    lbImg.src = `assets/img/${img}.jpg`;
    lbImg.alt = title;
    $('figcaption span', lb).textContent = title;
    $('figcaption small', lb).textContent = label;
  };
  const step = (d) => {
    const v = visible();
    show(v[(v.indexOf(current) + d + v.length) % v.length]);
  };
  const close = () => {
    lb.classList.remove('open');
    document.body.style.overflow = '';
    opener && opener.focus();
  };
  grid.addEventListener('click', (e) => {
    const p = e.target.closest('.project');
    if (!p) return;
    opener = p;
    show(+p.dataset.i);
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
    $('.lb-close', lb).focus();
  });
  $('.lb-close', lb).addEventListener('click', close);
  $('.lb-prev', lb).addEventListener('click', () => step(-1));
  $('.lb-next', lb).addEventListener('click', () => step(1));
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });

  // ---------- Contact form ----------
  // Opens the visitor's email app with the enquiry filled in.
  // Swap for a form service endpoint when going live.
  const form = $('#contact-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const bad = $$('[required]', form).find((f) => !f.value.trim() || !f.checkValidity());
    $$('.field', form).forEach((f) => f.classList.remove('invalid'));
    if (bad) { bad.closest('.field').classList.add('invalid'); bad.focus(); return; }
    const d = Object.fromEntries(new FormData(form));
    const body = `Name: ${d.name}\nCompany: ${d.company}\nEmail: ${d.email}\nPhone: ${d.phone}\nSector: ${d.sector}\nArea: ${d.area} m²\n\n${d.message}`;
    location.href = `mailto:info@acrylicon.ie?subject=${encodeURIComponent('Website enquiry: ' + d.sector)}&body=${encodeURIComponent(body)}`;
    const status = $('#form-status');
    status.textContent = 'Thanks. Your email app should now open with your enquiry ready to send.';
    status.classList.add('show');
  });

  $('#year').textContent = new Date().getFullYear();
})();
