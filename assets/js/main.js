// AcryliCon Ireland — site interactions
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // Header state on scroll
  const header = $('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile nav
  const toggle = $('.nav-toggle');
  const setNav = (open) => {
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
  $$('.nav a').forEach((a) => a.addEventListener('click', () => setNav(false)));

  // Reveal on scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  const observeReveals = () => $$('.reveal:not(.in)').forEach((el) => io.observe(el));
  observeReveals();

  // Count-up stats
  const counter = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const end = +el.dataset.count;
      const start = end > 1900 ? end - 16 : 0;
      const t0 = performance.now();
      const step = (t) => {
        const p = Math.min((t - t0) / 1400, 1);
        const v = Math.round(start + (end - start) * (1 - Math.pow(1 - p, 3)));
        el.textContent = end > 1900 ? v : v.toLocaleString('en-IE');
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      counter.unobserve(el);
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach((el) => counter.observe(el));

  // Systems tabs
  const tabs = $$('.system-list [role="tab"]');
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (e) => {
      const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      const next = tabs[(i + dir + tabs.length) % tabs.length];
      next.focus();
      selectTab(next);
    });
  });
  function selectTab(tab) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).classList.toggle('active', on);
    });
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  // Projects
  const projects = [
    ['marine-harvest', 'Marine Harvest – Fish Production', 'food', 'Food Production'],
    ['kerry-group', 'Kerry Group', 'food', 'Food Production'],
    ['abp-cahir', 'ABP Cahir', 'food', 'Food Production'],
    ['divilly-meats', 'Divilly Meats', 'food', 'Food Production'],
    ['patisserie-royale', 'Patisserie Royale', 'bakery', 'Bakeries & Butchers'],
    ['olearys-butchers-co-cork', "O'Learys Butchers, Co. Cork", 'bakery', 'Bakeries & Butchers'],
    ['fx-buckleys-greenogue-co-dublin', 'FX Buckleys, Greenogue', 'bakery', 'Bakeries & Butchers'],
    ['bakery-belfast', 'Bakery, Belfast', 'bakery', 'Bakeries & Butchers'],
    ['pharmaceutical-project-co-kildare', 'Pharmaceutical Project, Co. Kildare', 'pharma', 'Pharmaceutical'],
    ['chemical-bund-project-co-dublin', 'Chemical Bund Project, Co. Dublin', 'pharma', 'Pharmaceutical'],
    ['tankingproject', 'Tanking Project', 'pharma', 'Pharmaceutical'],
    ['clean-room-project', 'Clean Room Project', 'pharma', 'Pharmaceutical'],
    ['retail-project-co-cork', 'Retail Project, Co. Cork', 'retail', 'Retail'],
    ['hardware-store-co-kerry', 'Hardware Store, Co. Kerry', 'retail', 'Retail'],
    ['porschegarage', 'Porsche Garage', 'retail', 'Retail'],
    ['b-q-office-steps', 'B&Q Office Steps', 'retail', 'Retail'],
    ['shelbourne-fc-changing-room', 'Shelbourne FC Changing Room', 'leisure', 'Leisure & Sports'],
    ['school-basketball-court', 'School Basketball Court', 'leisure', 'Leisure & Sports'],
    ['leisure-club-sports-facilities', 'Hotel Leisure Club', 'leisure', 'Leisure & Sports'],
    ['woodlands-hotel-adare', 'Woodlands Hotel, Adare', 'leisure', 'Leisure & Sports'],
    ['warehouse-project-co-down', 'Warehouse Project, Co. Down', 'other', 'Industrial'],
    ['intel-kitchen', 'Intel Kitchen', 'other', 'Commercial Kitchen'],
    ['flake-coving-works', 'Flake Coving Works', 'other', 'Flake System'],
    ['micro-brewery-co-dublin', 'Micro-Brewery, Co. Dublin', 'other', 'Brewery'],
  ];
  const grid = $('#project-grid');
  grid.innerHTML = projects.map(([img, title, cat, label], i) => `
    <button class="project reveal" data-cat="${cat}" data-i="${i}" aria-label="View ${title}">
      <div class="project-img"><img src="assets/img/${img}.jpg" alt="${title}" loading="lazy"></div>
      <h4>${title}</h4><small>${label}</small>
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
  }));

  // Lightbox
  const lb = $('#lightbox');
  const lbImg = $('img', lb);
  let current = 0;
  const visible = () => $$('.project:not([hidden])', grid).map((p) => +p.dataset.i);
  const show = (i) => {
    current = i;
    const [img, title, , label] = projects[i];
    lbImg.src = `assets/img/${img}.jpg`;
    lbImg.alt = title;
    $('figcaption strong', lb).textContent = title;
    $('figcaption small', lb).textContent = label;
  };
  const step = (d) => {
    const v = visible();
    show(v[(v.indexOf(current) + d + v.length) % v.length]);
  };
  const close = () => { lb.classList.remove('open'); document.body.style.overflow = ''; };
  grid.addEventListener('click', (e) => {
    const p = e.target.closest('.project');
    if (!p) return;
    show(+p.dataset.i);
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
    $('.lightbox-close', lb).focus();
  });
  $('.lightbox-close', lb).addEventListener('click', close);
  $('.lightbox-nav.prev', lb).addEventListener('click', () => step(-1));
  $('.lightbox-nav.next', lb).addEventListener('click', () => step(1));
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });

  // Client logo marquee — duplicate for a seamless loop
  const marquee = $('#marquee');
  marquee.innerHTML += marquee.innerHTML.replace(/alt="[^"]*"/g, 'alt="" aria-hidden="true"');

  // Testimonials carousel
  const track = $('#t-track');
  $$('.t-controls button').forEach((b) => b.addEventListener('click', () => {
    const card = $('.t-card', track);
    track.scrollBy({ left: +b.dataset.dir * (card.offsetWidth + 20), behavior: 'smooth' });
  }));

  // Contact form — opens the visitor's email client with the enquiry pre-filled.
  // Swap for a form service / backend endpoint when going live.
  const form = $('#contact-form');
  const status = $('#form-status');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const invalid = $$('[required]', form).find((f) => !f.value.trim() || (f.type === 'email' && !f.checkValidity()));
    if (invalid) { invalid.focus(); invalid.style.borderColor = 'var(--red)'; return; }
    const d = Object.fromEntries(new FormData(form));
    const body = `Name: ${d.name}\nCompany: ${d.company}\nEmail: ${d.email}\nPhone: ${d.phone}\nSector: ${d.sector}\nArea: ${d.area} m²\n\n${d.message}`;
    window.location.href = `mailto:info@acrylicon.ie?subject=${encodeURIComponent('Website enquiry – ' + d.sector)}&body=${encodeURIComponent(body)}`;
    status.textContent = "Thanks — your email app should now open with your enquiry ready to send.";
    status.classList.add('show');
  });
  $$('[required]', form).forEach((f) => f.addEventListener('input', () => { f.style.borderColor = ''; }));

  $('#year').textContent = new Date().getFullYear();
})();
