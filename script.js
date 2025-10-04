// Quote modal open/close helpers (menu-driven)
(function () {
  const modal = document.getElementById('quote');
  if (!modal) return;
  const dialog = modal.querySelector('.modal__dialog');
  const closeBtn = modal.querySelector('.modal__close');
  const form = modal.querySelector('#quote-form');
  const firstField = modal.querySelector('#q-name');
  let lastFocused = null;

  function openModal(triggerEl) {
    lastFocused = triggerEl || document.activeElement;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    if (firstField && typeof firstField.focus === 'function') {
      setTimeout(() => firstField.focus(), 50);
    } else if (dialog && typeof dialog.focus === 'function') {
      dialog.focus();
    }
    document.addEventListener('keydown', onKeyDown, true);
  }

  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKeyDown, true);
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function onKeyDown(e) {
    if (modal.getAttribute('aria-hidden') === 'true') return;
    if (e.key === 'Escape') { e.stopPropagation(); closeModal(); return; }
    if (e.key === 'Tab') {
      const focusables = dialog.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      const list = Array.from(focusables);
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeModal(); });
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  const cancelBtn = modal.querySelector('[data-close]');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  // expose to menu module
  window.__openQuoteModal = openModal;
})();

// Firebase lazy loader (dynamic import) and form submission to Realtime Database
const firebaseConfig = {
  apiKey: "AIzaSyDU6HZRZNf2w-P5fCEvpTYognt1rCGEgtg",
  authDomain: "my-profile-quotes-commnts.firebaseapp.com",
  databaseURL: "https://my-profile-quotes-commnts-default-rtdb.firebaseio.com",
  projectId: "my-profile-quotes-commnts",
  storageBucket: "my-profile-quotes-commnts.firebasestorage.app",
  messagingSenderId: "135995433817",
  appId: "1:135995433817:web:2386024d9b30128f96a248",
  measurementId: "G-0MBQ8PP3P6"
};

let __firebase = null;
async function loadFirebase() {
  if (__firebase) return __firebase;
  console.log('[Firebase] Loading SDKs...');
  try {
    const [appMod, analyticsMod, dbMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.13.2/firebase-analytics.js').catch((e) => { console.warn('[Firebase] Analytics load skipped:', e); return null; }),
      import('https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js')
    ]);
    const { initializeApp } = appMod;
    const { getDatabase, ref, push, serverTimestamp, get, child } = dbMod;
    const analyticsAPI = analyticsMod ? { getAnalytics: analyticsMod.getAnalytics, isSupported: analyticsMod.isSupported } : null;
    console.log('[Firebase] SDKs loaded');
    console.log('[Firebase] Initializing app...');
    const app = initializeApp(firebaseConfig);
    console.log('[Firebase] App initialized');
    if (analyticsAPI) {
      try {
        analyticsAPI.isSupported().then((ok) => { if (ok) { analyticsAPI.getAnalytics(app); console.log('[Firebase] Analytics enabled'); } else { console.log('[Firebase] Analytics not supported in this context'); } });
      } catch (e) { console.warn('[Firebase] Analytics init skipped:', e); }
    }
    const db = getDatabase(app);
    console.log('[Firebase] Database ready');
    __firebase = { app, db, ref, push, serverTimestamp, get, child };
    return __firebase;
  } catch (err) {
    console.error('[Firebase] Failed to load/initialize:', err);
    throw err;
  }
}

// Bind submit to push to /quotes
(() => {
  const modal = document.getElementById('quote');
  if (!modal) return;
  const form = modal.querySelector('#quote-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.elements['name']?.value?.trim();
    const phone = form.elements['phone']?.value?.trim();
    const email = form.elements['email']?.value?.trim();
    console.log('[Quote] Submit clicked', { name, phone, email });
    if (!name || !phone || !email) return; // basic guard; UI handled above
    let apis;
    try {
      apis = await loadFirebase();
    } catch (loadErr) {
      console.error('[Quote] Firebase load error:', loadErr);
      alert('Unable to submit right now (network or SDK issue). Please try again later.');
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    const prevText = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    try {
      const { db, ref, push, serverTimestamp, get, child } = apis;
      const quotesRef = ref(db, 'networking/quotes');
      console.log('[Quote] Pushing to /networking/quotes ...');
      const pushResult = await push(quotesRef, {
        name,
        phone,
        email,
        userAgent: navigator.userAgent,
        createdAt: serverTimestamp()
      });
      console.log('[Quote] Push complete. New key:', pushResult.key);
      // Verify by reading back the child once
      try {
        const snap = await get(child(ref(db), `networking/quotes/${pushResult.key}`));
        console.log('[Quote] Read-back snapshot exists:', snap.exists());
        if (snap.exists()) {
          console.log('[Quote] Saved value:', snap.val());
        }
      } catch (readErr) {
        console.warn('[Quote] Read-back failed (may still be ok):', readErr);
      }
      alert('Thanks! Your request was sent successfully.');
      form.reset();
      // Close modal after success
      const close = modal.querySelector('.modal__close');
      close?.click();
    } catch (err) {
      console.error('[Quote] Error saving to database:', err);
      alert('Sorry, there was an error sending your request. Please try again.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = prevText; }
    }
  });
})();

// Optional: one-time migration utility to copy /quotes => /networking/quotes
// Usage: call window.migrateQuotesToNetworking() in DevTools Console
window.migrateQuotesToNetworking = async function migrateQuotesToNetworking() {
  console.log('[Migrate] Starting migration /quotes -> /networking/quotes');
  let apis;
  try {
    apis = await loadFirebase();
  } catch (e) {
    console.error('[Migrate] Failed to load Firebase:', e);
    return;
  }
  const { db, ref, get, child } = apis;
  try {
    const rootRef = ref(db);
    const snap = await get(child(rootRef, 'quotes'));
    if (!snap.exists()) { console.warn('[Migrate] No /quotes found'); return; }
    const quotes = snap.val();
    const entries = Object.entries(quotes);
    console.log(`[Migrate] Found ${entries.length} quotes to copy`);
    for (const [key, value] of entries) {
      try {
        const dest = child(rootRef, `networking/quotes/${key}`);
        await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js').then(m => m.set(dest, value));
        console.log(`[Migrate] Copied ${key}`);
      } catch (wErr) {
        console.error(`[Migrate] Failed to copy ${key}:`, wErr);
      }
    }
    console.log('[Migrate] Migration complete');
  } catch (err) {
    console.error('[Migrate] Error during migration:', err);
  }
};

// Keyboard navigation between sections
(function () {
  // Disable hero cursor + shapes animation entirely
  // GSAP cursor + shapes parallax in hero
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Intentionally skip setting up hero cursor/shapes listeners

  const sections = Array.from(document.querySelectorAll('.snap-section'));
  const dots = Array.from(document.querySelectorAll('.dot-nav a'));
  // prefersReduced already defined above

  function sectionIndexFromScroll() {
    const y = window.scrollY;
    const vh = window.innerHeight;
    // Find the nearest section based on top edge
    let nearest = 0;
    let minDelta = Infinity;
    for (let i = 0; i < sections.length; i++) {
      const top = sections[i].offsetTop;
      const delta = Math.abs(top - y);
      if (delta < minDelta) { minDelta = delta; nearest = i; }
    }
    // Clamp in case of fractional scroll
    return Math.min(Math.max(nearest, 0), sections.length - 1);
  }

  function scrollToIndex(i) {
    const idx = Math.min(Math.max(i, 0), sections.length - 1);
    const top = sections[idx].offsetTop;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  function updateDots(activeIdx) {
    dots.forEach((a, i) => a.classList.toggle('active', i === activeIdx));
  }

  // Observe which section is centered to update nav dots
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const el = entry.target;
      if (entry.isIntersecting) {
        // Do not animate in; keep sections visible immediately
        el.classList.add('is-visible');
        const idx = sections.indexOf(el);
        updateDots(idx);
        const id = el.id;
        if (history.replaceState) {
          history.replaceState(null, '', `#${id}`);
        }
      } else {
        // Keep visible state; no fade-out
      }
    });
  }, { threshold: [0, 0.1, 0.35, 0.6, 0.85] });

  sections.forEach((s) => io.observe(s));

  // Initialize first visible state without waiting
  requestAnimationFrame(() => {
    const first = sections[0];
    if (first) first.classList.add('is-visible');
  });

  // Parallax effect: shift inner content relative to viewport center
  // Disable inner parallax shift
  function onScroll() { /* no-op to keep content static */ }

  // Key controls: PageUp/PageDown/ArrowUp/ArrowDown/Home/End
  window.addEventListener('keydown', (e) => {
    // If any modal is open, let keys control the modal/its scroll normally
    const anyOpenModal = document.querySelector('.modal[aria-hidden="false"]');
    const menuOpen = document.body.classList.contains('menu-open');
    if (anyOpenModal || menuOpen) return;
    const key = e.key;
    if (["PageDown", "ArrowDown", "PageUp", "ArrowUp", "Home", "End"].includes(key)) {
      e.preventDefault();
      const current = sectionIndexFromScroll();
      if (key === 'PageDown' || key === 'ArrowDown') scrollToIndex(current + 1);
      if (key === 'PageUp' || key === 'ArrowUp') scrollToIndex(current - 1);
      if (key === 'Home') scrollToIndex(0);
      if (key === 'End') scrollToIndex(sections.length - 1);
    }
  }, { passive: false });

  // Activate correct dot on load based on hash
  function initFromHash() {
    const id = (location.hash || '#s1').slice(1);
    const idx = Math.max(0, sections.findIndex(s => s.id === id));
    updateDots(idx);
    // If we're at top and not the first, scroll to it
    if (idx !== 0 && Math.abs(window.scrollY - sections[idx].offsetTop) > 8) {
      scrollToIndex(idx);
    }
  }

  dots.forEach((a, i) => {
    a.addEventListener('click', () => {
      // Allow anchor default (smooth via CSS), but also set active state eagerly
      updateDots(i);
    });
  });

  window.addEventListener('hashchange', initFromHash);
  window.addEventListener('load', () => { initFromHash(); onScroll(); });
})();

// Dynamic neon around cursor for hero headline
(function () {
  const hero = document.querySelector('#s1 .hero-content h1');
  if (!hero) return;
  if (hero.classList.contains('sr-only')) return; // skip when replaced by particle title
  console.log('[Glow] Dynamic neon initialized');

  // Wrap each character in a span.char while preserving spaces
  const raw = hero.textContent || '';
  hero.textContent = '';
  const frag = document.createDocumentFragment();
  const chars = [];
  for (const ch of raw) {
    if (ch === ' ') {
      frag.appendChild(document.createTextNode(' '));
      continue;
    }
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = ch;
    frag.appendChild(span);
    chars.push(span);
  }
  hero.appendChild(frag);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Keep baseline dim glow, skip cursor-based updates
    return;
  }

  let mx = -1, my = -1;
  let raf = 0;
  const maxRadius = 140; // px radius for strong glow falloff (tighter = stronger effect)
  const influence = maxRadius * maxRadius; // compare using squared distance

  function onMove(e) {
    const x = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
    const y = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
    mx = x; my = y;
    if (!raf) raf = requestAnimationFrame(updateGlow);
  }

  function updateGlow() {
    raf = 0;
    if (mx < 0 || my < 0) return;
    for (const el of chars) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = mx - cx;
      const dy = my - cy;
      const d2 = dx * dx + dy * dy;
      // Map distance to 0..1 glow factor with smooth falloff
  let g = d2 >= influence ? 0 : 1 - (d2 / influence);
  // Apply gamma to accentuate near-cursor glow
  g = Math.pow(g, 0.5);
      el.style.setProperty('--g', g.toFixed(3));
    }
  }

  // Listen on the whole window so the glow tracks across the line
  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: true });

  // Reduce CPU when page/tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf); raf = 0;
    }
  });
})();

// Interactive particle text as the hero title
(function () {
  const host = document.getElementById('particle-text');
  if (!host) return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  host.appendChild(canvas);

  let width = 0, height = 0, dpi = Math.max(window.devicePixelRatio || 1, 1);
  let particles = [];
  let rafId = 0;
  let mx = -9999, my = -9999;
  let offsetX = 0, offsetY = 0; // user-controlled offsets (applied via CSS transform)

  const FULL_TEXT = 'NETWORKING';
  let TEXT_LINES = [FULL_TEXT];
  let SAMPLE_GAP = 3; // very dense for solid look
  let PARTICLE_SIZE = 3.2; // bold radius
  let FORCE_RADIUS = 120; // bigger influence
  let FORCE_STRENGTH = 0.48; // stronger push
  let EASE_HOME = 0.085; // easing back to home
  let DAMPING = 0.885; // velocity damping

  function resize() {
    const rect = host.getBoundingClientRect();
    width = Math.max(10, Math.floor(rect.width));
    height = Math.max(10, Math.floor(rect.height));
    canvas.width = Math.floor(width * dpi);
    canvas.height = Math.floor(height * dpi);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    decideLayout();
    initParticles();
  }

  function initParticles() {
    particles = [];
    const off = document.createElement('canvas');
    off.width = Math.floor(width * dpi);
    off.height = Math.floor(height * dpi);
    const octx = off.getContext('2d');
    octx.clearRect(0, 0, off.width, off.height);
    const family = "'Exwayer', Montserrat, Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial";
    // Determine line count and allocate vertical slots
    const lines = TEXT_LINES;
    const lineCount = lines.length;
    // Base font size from line height share
  const lineHeightShare = 0.84 / lineCount; // use more height for single line
    let fontSize = Math.floor(height * lineHeightShare * dpi);
  octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    // For each line, shrink-to-fit width
  const maxTextWidth = off.width * 0.98; // use almost full width
    const yStep = off.height / (lineCount + 1);
    octx.fillStyle = '#ffffff';
    for (let i = 0; i < lineCount; i++) {
      const line = lines[i];
      let fs = fontSize;
      octx.font = `800 ${fs}px ${family}`;
      let m = octx.measureText(line);
      while (m.width > maxTextWidth && fs > 12 * dpi) {
        fs = Math.floor(fs * 0.96);
        octx.font = `800 ${fs}px ${family}`;
        m = octx.measureText(line);
      }
      const y = yStep * (i + 1);
      // Draw a faint stroke then fill to tighten edges for sampling
      octx.lineWidth = Math.max(1, Math.floor(fs * 0.06));
      octx.miterLimit = 2;
      octx.lineJoin = 'round';
      octx.strokeStyle = '#ffffff';
      octx.strokeText(line, off.width / 2, y);
      octx.fillText(line, off.width / 2, y);
    }

  const img = octx.getImageData(0, 0, off.width, off.height).data;
  const step = Math.max(2, Math.floor(SAMPLE_GAP * dpi));
    for (let y = 0; y < off.height; y += step) {
      for (let x = 0; x < off.width; x += step) {
        const idx = (y * off.width + x) * 4 + 3; // alpha channel
        if (img[idx] > 128) {
          // Convert to CSS pixels for physics positions
          const px = x / dpi;
          const py = y / dpi;
          particles.push({
            x: px + (Math.random() - 0.5) * 8,
            y: py + (Math.random() - 0.5) * 8,
            hx: px,
            hy: py,
            vx: 0,
            vy: 0,
          });
        }
      }
    }

    // Recentering: compute bounds of home positions and center within the host
    if (particles.length) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of particles) {
        if (p.hx < minX) minX = p.hx;
        if (p.hx > maxX) maxX = p.hx;
        if (p.hy < minY) minY = p.hy;
        if (p.hy > maxY) maxY = p.hy;
      }
      const contentW = maxX - minX;
      const contentH = maxY - minY;
  const targetCX = width / 2;
  const targetCY = height / 2;
      const currentCX = minX + contentW / 2;
      const currentCY = minY + contentH / 2;
      const shiftX = targetCX - currentCX;
      const shiftY = targetCY - currentCY;
      if (Math.abs(shiftX) > 0.5 || Math.abs(shiftY) > 0.5) {
        for (const p of particles) {
          p.hx += shiftX; p.hy += shiftY;
          p.x += shiftX; p.y += shiftY;
        }
      }
    }

    // Adaptive density cap for performance on very large canvases
  const MAX_PARTICLES = width < 680 ? 12000 : 20000;
    if (particles.length > MAX_PARTICLES) {
      const ratio = particles.length / MAX_PARTICLES;
      const every = Math.ceil(ratio);
      particles = particles.filter((_, i) => i % every === 0);
    }
  }

  function tick() {
    rafId = requestAnimationFrame(tick);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpi, dpi);

    // Draw particles with a soft glow
    for (const p of particles) {
      // mouse force
      const dx = p.x - mx;
      const dy = p.y - my;
      const d2 = dx * dx + dy * dy;
      const r2 = FORCE_RADIUS * FORCE_RADIUS;
      if (d2 < r2) {
        const d = Math.max(6, Math.sqrt(d2));
        const f = (1 - d / FORCE_RADIUS) * FORCE_STRENGTH;
        p.vx += (dx / d) * f * 6;
        p.vy += (dy / d) * f * 6;
      }
      // ease back home
      p.vx += (p.hx - p.x) * EASE_HOME;
      p.vy += (p.hy - p.y) * EASE_HOME;
      // integrate
      p.vx *= DAMPING; p.vy *= DAMPING;
      p.x += p.vx; p.y += p.vy;

      // render
      const glow = 0.3 + Math.min(1, 1 - Math.min(1, d2 / r2)) * 0.7;
      ctx.beginPath();
      ctx.fillStyle = `rgba(94, 234, 212, ${0.65 * glow})`;
      ctx.arc(p.x, p.y, PARTICLE_SIZE, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    mx = x; my = y;
  }
  function onLeave() { mx = -9999; my = -9999; }

  window.addEventListener('resize', resize);
  canvas.addEventListener('mousemove', onMove, { passive: true });
  canvas.addEventListener('mouseleave', onLeave, { passive: true });
  canvas.addEventListener('touchmove', onMove, { passive: true });
  canvas.addEventListener('touchend', onLeave, { passive: true });

  function decideLayout() {
    // Phone-friendly layout: split into two lines when narrow
    if (width < 680) {
      // Keep single word; just tune for mobile
      TEXT_LINES = [FULL_TEXT];
      SAMPLE_GAP = 3;
      PARTICLE_SIZE = 3.0;
      FORCE_RADIUS = 110;
      FORCE_STRENGTH = 0.46;
    } else {
      TEXT_LINES = [FULL_TEXT];
      SAMPLE_GAP = 3;
      PARTICLE_SIZE = 3.2;
      FORCE_RADIUS = 130;
      FORCE_STRENGTH = 0.48;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { resize(); tick(); }, { once: true });
  } else {
    resize(); tick();
  }

  if (document.fonts && typeof document.fonts.ready?.then === 'function') {
    document.fonts.ready.then(() => { resize(); });
  }

  // Controls wiring
  (function setupControls() {
    const panel = document.getElementById('particle-controls');
    if (!panel) return;
    const xEl = document.getElementById('pc-x');
    const yEl = document.getElementById('pc-y');
    const xo = document.getElementById('pc-x-out');
    const yo = document.getElementById('pc-y-out');
    const centerBtn = document.getElementById('pc-center');
    const resetBtn = document.getElementById('pc-reset');

    // Range bounds: allow moving roughly half canvas in any direction
    function setRanges() {
      const maxX = Math.floor(width * 0.45);
      const maxY = Math.floor(height * 0.45);
      xEl.min = -maxX; xEl.max = maxX;
      yEl.min = -maxY; yEl.max = maxY;
      xEl.step = 1; yEl.step = 1;
    }

    function applyOffsets() {
      xo.textContent = String(offsetX);
      yo.textContent = String(offsetY);
      xEl.value = String(offsetX);
      yEl.value = String(offsetY);
      // Apply transform to move the whole canvas (prevents clipping)
      host.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      // persist
      try { localStorage.setItem('pt_offset', JSON.stringify({ x: offsetX, y: offsetY })); } catch {}
    }

    // Load persisted
    try {
      const saved = JSON.parse(localStorage.getItem('pt_offset') || 'null');
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
        offsetX = saved.x; offsetY = saved.y;
      }
    } catch {}

    setRanges();
    applyOffsets();

    xEl.addEventListener('input', () => { offsetX = parseInt(xEl.value || '0', 10) || 0; applyOffsets(); });
    yEl.addEventListener('input', () => { offsetY = parseInt(yEl.value || '0', 10) || 0; applyOffsets(); });
    centerBtn.addEventListener('click', () => { offsetX = 0; offsetY = 0; applyOffsets(); });
    resetBtn.addEventListener('click', () => { offsetX = 0; offsetY = 0; applyOffsets(); try { localStorage.removeItem('pt_offset'); } catch {} });

    // Update ranges when canvas resizes
    window.addEventListener('resize', () => { setRanges(); applyOffsets(); });
  })();
})();

// Services modal (menu-driven)
(function () {
  const modal = document.getElementById('services');
  if (!modal) return;
  const dialog = modal.querySelector('.modal__dialog');
  const closeBtn = modal.querySelector('.modal__close');
  let lastFocused = null;

  function openModal(triggerEl) {
    lastFocused = triggerEl || document.activeElement;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    if (dialog && typeof dialog.focus === 'function') dialog.focus();
    document.addEventListener('keydown', onKeyDown, true);
  }
  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKeyDown, true);
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }
  function onKeyDown(e) {
    if (modal.getAttribute('aria-hidden') === 'true') return;
    if (e.key === 'Escape') { e.stopPropagation(); closeModal(); return; }
    if (e.key === 'Tab') {
      const focusables = dialog.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      const list = Array.from(focusables);
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeModal(); });
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  window.__openServicesModal = openModal;
})();

// Hamburger menu toggle + route to modals
(function () {
  const toggle = document.getElementById('btn-menu');
  const panel = document.getElementById('menu-panel');
  if (!toggle || !panel) return;

  function openMenu() {
    toggle.setAttribute('aria-expanded', 'true');
    panel.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', onKeyDown, true);
    document.documentElement.classList.add('no-snap');
    document.body.classList.add('menu-open');
  }
  function closeMenu() {
    toggle.setAttribute('aria-expanded', 'false');
    panel.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onKeyDown, true);
    document.documentElement.classList.remove('no-snap');
    document.body.classList.remove('menu-open');
  }
  function onKeyDown(e) {
    if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); }
  }
  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[Menu] Toggle clicked');
    const isOpen = panel.getAttribute('aria-hidden') === 'false';
    if (isOpen) { console.log('[Menu] Closing'); closeMenu(); } else { console.log('[Menu] Opening'); openMenu(); }
  });
  // Click outside to close
  document.addEventListener('mousedown', (e) => {
    if (panel.getAttribute('aria-hidden') !== 'false') return;
    if (!panel.contains(e.target) && !toggle.contains(e.target)) {
      closeMenu();
    }
  });
  // Note: avoid over-aggressive capture-phase blockers that would swallow our toggle click

  // Link menu actions to existing controls
  const btnQuoteMenu = document.getElementById('btn-quote-menu');
  const btnServicesMenu = document.getElementById('btn-services-menu');
  const btnExploreMenu = document.getElementById('btn-explore-menu');
  if (btnQuoteMenu) {
    btnQuoteMenu.addEventListener('click', (e) => { closeMenu(); window.__openQuoteModal?.(e.currentTarget); });
  }
  if (btnServicesMenu) {
    btnServicesMenu.addEventListener('click', (e) => { closeMenu(); window.__openServicesModal?.(e.currentTarget); });
  }
  if (btnExploreMenu) {
    btnExploreMenu.addEventListener('click', () => {
      closeMenu();
      const s2 = document.getElementById('s2');
      if (s2) s2.scrollIntoView({ behavior: 'smooth' });
      // Do not touch the URL hash to avoid unintended snap/scroll
    });
  }
})();

// Liquid button effect for all buttons with class .btn-liquid
(function () {
  const buttons = Array.from(document.querySelectorAll('.btn-liquid'));
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    let pointsA = [], pointsB = [];
    let canvasEl = null, ctx = null;
    let rafID = null;
    const points = 8;
    const viscosity = 20;
    const mouseDist = 70;
    const damping = 0.05;
    let mouseX = 0, mouseY = 0;
    let relMouseX = 0, relMouseY = 0;
    let mouseLastX = 0, mouseLastY = 0;
    let mouseDirectionX = 0, mouseDirectionY = 0;
    let mouseSpeedX = 0, mouseSpeedY = 0;

    function getOffset(el) {
      const r = el.getBoundingClientRect();
      return { left: r.left + window.scrollX, top: r.top + window.scrollY };
    }

    function mouseDirection(e) {
      const pageX = e.pageX ?? (e.touches && e.touches[0]?.pageX) ?? 0;
      const pageY = e.pageY ?? (e.touches && e.touches[0]?.pageY) ?? 0;
      mouseDirectionX = pageX === mouseX ? 0 : pageX > mouseX ? 1 : -1;
      mouseDirectionY = pageY === mouseY ? 0 : pageY > mouseY ? 1 : -1;
      mouseX = pageX; mouseY = pageY;
      if (!canvasEl) return;
      const off = getOffset(canvasEl);
      relMouseX = mouseX - off.left;
      relMouseY = mouseY - off.top;
    }
    document.addEventListener('mousemove', mouseDirection, { passive: true });
    document.addEventListener('touchmove', mouseDirection, { passive: true });

    function computeMouseSpeed() {
      mouseSpeedX = mouseX - mouseLastX;
      mouseSpeedY = mouseY - mouseLastY;
      mouseLastX = mouseX; mouseLastY = mouseY;
      setTimeout(computeMouseSpeed, 50);
    }
    computeMouseSpeed();

    function Point(x, y, level) {
      this.x = this.ix = 50 + x;
      this.y = this.iy = 50 + y;
      this.vx = 0; this.vy = 0;
      this.cx1 = 0; this.cy1 = 0;
      this.cx2 = 0; this.cy2 = 0;
      this.level = level;
    }
    Point.prototype.move = function () {
      this.vx += (this.ix - this.x) / (viscosity * this.level);
      this.vy += (this.iy - this.y) / (viscosity * this.level);
      const dx = this.ix - relMouseX, dy = this.iy - relMouseY;
      const relDist = (1 - Math.sqrt((dx * dx) + (dy * dy)) / mouseDist);
      if ((mouseDirectionX > 0 && relMouseX > this.x) || (mouseDirectionX < 0 && relMouseX < this.x)) {
        if (relDist > 0 && relDist < 1) this.vx = (mouseSpeedX / 4) * relDist;
      }
      this.vx *= (1 - damping);
      this.x += this.vx;
      if ((mouseDirectionY > 0 && relMouseY > this.y) || (mouseDirectionY < 0 && relMouseY < this.y)) {
        if (relDist > 0 && relDist < 1) this.vy = (mouseSpeedY / 4) * relDist;
      }
      this.vy *= (1 - damping);
      this.y += this.vy;
    };

    function addPoints(x, y) { pointsA.push(new Point(x, y, 1)); pointsB.push(new Point(x, y, 2)); }

    function init() {
      const rect = btn.getBoundingClientRect();
      const buttonWidth = rect.width;
      const buttonHeight = rect.height;
      canvasEl = document.createElement('canvas');
      btn.appendChild(canvasEl);
      canvasEl.width = Math.ceil(buttonWidth + 100);
      canvasEl.height = Math.ceil(buttonHeight + 100);
      ctx = canvasEl.getContext('2d');

      pointsA = []; pointsB = [];
      let x = buttonHeight / 2;
      for (let j = 1; j < points; j++) {
        addPoints((x + ((buttonWidth - buttonHeight) / points) * j), 0);
      }
      addPoints(buttonWidth - buttonHeight / 5, 0);
      addPoints(buttonWidth + buttonHeight / 10, buttonHeight / 2);
      addPoints(buttonWidth - buttonHeight / 5, buttonHeight);
      for (let j = points - 1; j > 0; j--) {
        addPoints((x + ((buttonWidth - buttonHeight) / points) * j), buttonHeight);
      }
      addPoints(buttonHeight / 5, buttonHeight);
      addPoints(-buttonHeight / 10, buttonHeight / 2);
      addPoints(buttonHeight / 5, 0);
      render();
    }

    function render() {
      rafID = window.requestAnimationFrame(render);
      const w = canvasEl.width, h = canvasEl.height;
      // Clear to transparent to avoid white background behind the button
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < pointsA.length; i++) { pointsA[i].move(); pointsB[i].move(); }

      const off = getOffset(canvasEl);
      const gradientX = Math.min(Math.max(mouseX - off.left, 0), w);
      const gradientY = Math.min(Math.max(mouseY - off.top, 0), h);
      const distance = Math.sqrt(Math.pow(gradientX - w / 2, 2) + Math.pow(gradientY - h / 2, 2)) / Math.sqrt(Math.pow(w / 2, 2) + Math.pow(h / 2, 2));
  const gradient = ctx.createRadialGradient(gradientX, gradientY, 300 + (300 * distance), gradientX, gradientY, 0);
  // teal/cyan gradient
  gradient.addColorStop(0, '#22d3ee');
  gradient.addColorStop(1, '#14b8a6');
      const groups = [pointsA, pointsB];
      for (let j = 0; j <= 1; j++) {
        const pts = groups[j];
  // base fill slightly lighter teal, overlay gradient teal->cyan
  ctx.fillStyle = j === 0 ? '#5eead4' : gradient;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          let nextP = pts[i + 1];
          if (nextP !== undefined) {
            p.cx1 = (p.x + nextP.x) / 2; p.cy1 = (p.y + nextP.y) / 2;
            p.cx2 = (p.x + nextP.x) / 2; p.cy2 = (p.y + nextP.y) / 2;
            ctx.bezierCurveTo(p.x, p.y, p.cx1, p.cy1, p.cx1, p.cy1);
          } else {
            nextP = pts[0];
            p.cx1 = (p.x + nextP.x) / 2; p.cy1 = (p.y + nextP.y) / 2;
            ctx.bezierCurveTo(p.x, p.y, p.cx1, p.cy1, p.cx1, p.cy1);
          }
        }
        ctx.fill();
      }
    }

    // Reinitialize on resize for correct canvas size
    let resizeTO = null;
    function onResize() {
      if (resizeTO) cancelAnimationFrame(resizeTO);
      resizeTO = requestAnimationFrame(() => {
        if (canvasEl) { cancelAnimationFrame(rafID); btn.removeChild(canvasEl); canvasEl = null; }
        init();
      });
    }
    window.addEventListener('resize', onResize);

    // Initialize once DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  });
})();
