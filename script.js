/* ============================================================
   SandwichNSmoothies — Main Script  (performance-optimised)
============================================================ */

gsap.registerPlugin(ScrollTrigger);

/* ── Device / motion detection ─────────────────────────────── */
const isMobile       = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


/* ============================================================
   BACKGROUND REMOVAL — auto (any colour)
============================================================ */
function removeBgAuto(img, drawW, drawH, tolerance = 38, feather = 30) {
  const off  = document.createElement('canvas');
  off.width  = drawW;
  off.height = drawH;
  const c    = off.getContext('2d', { willReadFrequently: true });
  c.drawImage(img, 0, 0, drawW, drawH);

  const data = c.getImageData(0, 0, drawW, drawH);
  const px   = data.data;

  const p = Math.max(6, Math.floor(Math.min(drawW, drawH) * 0.015));
  let sR = 0, sG = 0, sB = 0, n = 0;
  const corners = [[0,0],[drawW-p,0],[0,drawH-p],[drawW-p,drawH-p]];
  for (const [cx,cy] of corners) {
    for (let y = cy; y < Math.min(cy+p, drawH); y++) {
      for (let x = cx; x < Math.min(cx+p, drawW); x++) {
        const i = (y*drawW+x)*4;
        sR += px[i]; sG += px[i+1]; sB += px[i+2]; n++;
      }
    }
  }
  const bgR = sR/n, bgG = sG/n, bgB = sB/n;

  for (let i = 0; i < px.length; i += 4) {
    const dr = px[i]-bgR, dg = px[i+1]-bgG, db = px[i+2]-bgB;
    const dist = Math.sqrt(dr*dr + dg*dg + db*db);
    if (dist < tolerance + feather) {
      const t = Math.max(0, Math.min(1, (dist - tolerance) / feather));
      px[i+3] = Math.round(t * 255);
    }
  }

  c.putImageData(data, 0, 0);
  return off;
}


/* ============================================================
   BACKGROUND REMOVAL — near-white / grey
============================================================ */
function removeWhiteBg(img, drawW, drawH, threshold = 225, feather = 20) {
  const off  = document.createElement('canvas');
  off.width  = drawW;
  off.height = drawH;
  const c    = off.getContext('2d', { willReadFrequently: true });
  c.drawImage(img, 0, 0, drawW, drawH);

  const data = c.getImageData(0, 0, drawW, drawH);
  const px   = data.data;

  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i+1], b = px[i+2];
    const brightness = (r + g + b) / 3;
    if (brightness > threshold) {
      const t  = Math.min(1, (brightness - threshold) / feather);
      px[i+3] = Math.round((1 - t) * 255);
    }
  }

  c.putImageData(data, 0, 0);
  return off;
}


/* ============================================================
   LOGO BACKGROUND REMOVAL
============================================================ */
function processLogos() {
  const logoImg = new Image();
  logoImg.src = 'Gemini_Generated_Image_cp1b1lcp1b1lcp1b.png';

  logoImg.onload = () => {
    const processed = removeWhiteBg(
      logoImg,
      logoImg.naturalWidth,
      logoImg.naturalHeight,
      215,
      30
    );
    processed.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      document.querySelectorAll('.nav-logo, .footer-logo').forEach(el => {
        el.src = url;
      });
    }, 'image/png');
  };
}

processLogos();


/* ============================================================
   ABOUT SECTION — FLOATING SANDWICH
============================================================ */
(function renderAboutSandwich() {
  const ac  = document.getElementById('aboutSandwichCanvas');
  if (!ac) return;
  const actx = ac.getContext('2d');

  const img = new Image();
  img.src = 'Gemini_Generated_Image_9xaab9xaab9xaab9.png';

  img.onload = () => {
    ac.width  = img.naturalWidth;
    ac.height = img.naturalHeight;
    const processed = removeWhiteBg(img, img.naturalWidth, img.naturalHeight, 220, 22);
    actx.drawImage(processed, 0, 0);
  };
})();


/* ============================================================
   WALLPAPER TEXT FILL
============================================================ */
function fillWallpaper(el, word) {
  if (!el) return;
  const fs    = Math.max(72, Math.min(190, window.innerWidth * 0.13));
  const lh    = fs * 0.86;
  const count = Math.ceil(window.innerHeight / lh) + 3;

  // Single DOM write via fragment — no layout thrashing
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const d = document.createElement('div');
    d.className   = 'wallpaper-line';
    d.textContent = word;
    frag.appendChild(d);
  }
  el.innerHTML = '';
  el.appendChild(frag);
}

const sandwichWall = document.getElementById('sandwichWallpaper');
const smoothieWall  = document.getElementById('smoothieWallpaper');

fillWallpaper(sandwichWall, 'SANDWICH');
fillWallpaper(smoothieWall,  'SMOOTHIE');

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    fillWallpaper(sandwichWall, 'SANDWICH');
    fillWallpaper(smoothieWall,  'SMOOTHIE');
    ScrollTrigger.refresh();
  }, 200);
}, { passive: true });


/* ============================================================
   CANVAS SCROLL ANIMATION
   — Mobile: half internal resolution = 4x fewer pixels to process
   — warmCache runs only during browser idle time, never blocks scroll
============================================================ */
const canvas = document.getElementById('sandwichCanvas');
const ctx    = canvas.getContext('2d', { alpha: true });
const FRAME_COUNT = 125;

const CW = 728;
const CH = 408;
canvas.width  = CW;
canvas.height = CH;

const rawFrames       = new Array(FRAME_COUNT);
const processedFrames = new Array(FRAME_COUNT).fill(null);
let   loadedCount     = 0;
let   currentFrame    = -1; // skip redundant redraws

function pad(n) { return String(n).padStart(3, '0'); }

function renderFrame(index) {
  const i = Math.max(0, Math.min(FRAME_COUNT - 1, index));
  if (i === currentFrame) return; // already on this frame — skip
  currentFrame = i;

  const img = rawFrames[i];
  if (!img || !img.complete || !img.naturalWidth) return;

  if (!processedFrames[i]) {
    processedFrames[i] = removeWhiteBg(img, CW, CH, 225, 18);
  }

  ctx.clearRect(0, 0, CW, CH);
  ctx.drawImage(processedFrames[i], 0, 0);
}

function preload() {
  return new Promise(resolve => {
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.decoding = 'async'; // decode off main thread
      img.src = `ezgif-frame-${pad(i + 1)}.jpg`;

      img.onload = () => {
        loadedCount++;
        if (i === 0) renderFrame(0);
        if (loadedCount === FRAME_COUNT) resolve();
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === FRAME_COUNT) resolve();
      };

      rawFrames[i] = img;
    }
  });
}

// Pre-process frames only during idle time — never steals from scroll
function warmCache() {
  let i = 0;
  const schedule = typeof requestIdleCallback === 'function'
    ? cb => requestIdleCallback(cb, { timeout: 500 })
    : cb => setTimeout(cb, 16);

  function next() {
    // Process fewer frames per idle slot on mobile to stay under 16ms budget
    const limit = isMobile ? 2 : 8;
    let count = 0;
    while (i < FRAME_COUNT && count < limit) {
      if (!processedFrames[i] && rawFrames[i]?.complete) {
        processedFrames[i] = removeWhiteBg(rawFrames[i], CW, CH, 225, 18);
        count++;
      }
      i++;
    }
    if (i < FRAME_COUNT) schedule(next);
  }
  schedule(next);
}

preload().then(() => {
  initScrollAnimation();
  warmCache();
});

function initScrollAnimation() {
  const obj = { frame: 0 };

  gsap.to(obj, {
    frame: FRAME_COUNT - 1,
    ease: 'none',
    scrollTrigger: {
      trigger: '#hero',
      start: 'top top',
      end: '+=900',
      pin: true,
      scrub: isMobile ? 1 : 0.6,  // more scrub on mobile = smoother on fast swipe
      anticipatePin: 1,
      fastScrollEnd: true,          // stops over-shooting on fast finger swipe
      preventOverlaps: true,
    },
    onUpdate() {
      renderFrame(Math.round(obj.frame));
    },
  });
}


/* ============================================================
   PARALLAX — WALLPAPER BACKGROUNDS
============================================================ */
gsap.to('#sandwichWallpaper', {
  y: -100,
  ease: 'none',
  scrollTrigger: {
    trigger: '#hero',
    start: 'top top',
    end: 'bottom top',
    scrub: 1.2,
  },
});

gsap.to('#smoothieWallpaper', {
  y: -100,
  ease: 'none',
  scrollTrigger: {
    trigger: '#smoothies',
    start: 'top bottom',
    end: 'bottom top',
    scrub: 1.2,
  },
});


/* ============================================================
   SMOOTHIE FRUIT PARALLAX
============================================================ */
document.querySelectorAll('.fruit').forEach((fruit, i) => {
  const dir = i % 2 === 0 ? -1 : 1;
  gsap.to(fruit, {
    y: dir * 60,
    rotate: dir * 20,
    ease: 'none',
    scrollTrigger: {
      trigger: '#smoothies',
      start: 'top bottom',
      end: 'bottom top',
      scrub: 1 + i * 0.2,
    },
  });
});


/* ============================================================
   NAVBAR SCROLL STATE
============================================================ */
const navbar = document.getElementById('navbar');
ScrollTrigger.create({
  start: 'top -10',
  onToggle: self => navbar.classList.toggle('scrolled', self.isActive),
});


/* ============================================================
   SECTION REVEAL ANIMATIONS
   — Skipped entirely for users who prefer reduced motion
============================================================ */
if (!prefersReduced) {
  function reveal(selector, fromVars) {
    gsap.utils.toArray(selector).forEach((el, i) => {
      gsap.fromTo(el,
        { opacity: 0, ...fromVars },
        {
          opacity: 1, x: 0, y: 0,
          duration: 0.75,
          delay: i * 0.08,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 84%',
            toggleActions: 'play none none none',
          },
        }
      );
    });
  }

  reveal('.gsap-fade-up',      { y: 40 });
  reveal('.gsap-reveal-left',  { x: -50 });
  reveal('.gsap-reveal-right', { x: 50 });

  gsap.utils.toArray('.menu-card').forEach((card, i) => {
    gsap.from(card, {
      opacity: 0,
      y: 32,
      duration: 0.6,
      ease: 'power2.out',
      delay: (i % 4) * 0.06,
      scrollTrigger: {
        trigger: card,
        start: 'top 92%',
        toggleActions: 'play none none none',
      },
    });
  });

  document.querySelectorAll('.stat-n').forEach(el => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter() {
        gsap.from(el, { scale: 0.5, opacity: 0, duration: 0.5, ease: 'back.out(1.7)' });
      },
    });
  });

} else {
  // Immediately show all animated elements — no flicker
  document.querySelectorAll('.gsap-fade-up, .gsap-reveal-left, .gsap-reveal-right').forEach(el => {
    el.style.opacity = '1';
    el.style.transform = 'none';
  });
}


/* ============================================================
   MENU MODAL
============================================================ */
const menuModal    = document.getElementById('menuModal');
const modalContent = document.getElementById('modalContent');

function openMenuModal(catId) {
  const tpl = document.getElementById(`tpl-${catId}`);
  if (!tpl) return;

  modalContent.innerHTML = '';
  modalContent.appendChild(tpl.content.cloneNode(true));

  applyLanguage(lang);
  initShoppingBags(); // called directly — no fragile window override needed

  menuModal.classList.add('open');
  menuModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  setTimeout(() => menuModal.querySelector('.modal-close')?.focus(), 50);
}

function closeMenuModal() {
  menuModal.classList.remove('open');
  menuModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

document.querySelectorAll('.menu-card').forEach(card => {
  card.addEventListener('click', () => openMenuModal(card.dataset.cat), { passive: true });
});

menuModal.querySelectorAll('[data-close]').forEach(el => {
  el.addEventListener('click', closeMenuModal, { passive: true });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && menuModal.classList.contains('open')) closeMenuModal();
}, { passive: true });


/* ============================================================
   EN / DA LANGUAGE TOGGLE
============================================================ */
let lang = 'da';

function applyLanguage(l) {
  lang = l;
  document.querySelectorAll('[data-en]').forEach(el => {
    const text = el.getAttribute(`data-${l}`);
    if (!text) return;
    if (text.includes('<')) {
      el.innerHTML = text;
    } else {
      el.textContent = text;
    }
  });
  document.querySelectorAll('.lang-opt').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.lang === l);
  });
  document.documentElement.lang = l;
}

applyLanguage('da');

document.getElementById('langToggle').addEventListener('click', () => {
  applyLanguage(lang === 'da' ? 'en' : 'da');
}, { passive: true });


/* ============================================================
   MOBILE NAV
============================================================ */
const hamburger     = document.getElementById('hamburger');
const mobileNav     = document.getElementById('mobileNav');
const mobileOverlay = document.getElementById('mobileOverlay');

const openMobileNav  = () => {
  mobileNav.classList.add('open');
  mobileOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
};

const closeMobileNav = () => {
  mobileNav.classList.remove('open');
  mobileOverlay.classList.remove('open');
  document.body.style.overflow = '';
};

hamburger.addEventListener('click', () => {
  mobileNav.classList.contains('open') ? closeMobileNav() : openMobileNav();
}, { passive: true });

mobileOverlay.addEventListener('click', closeMobileNav, { passive: true });

mobileNav.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', closeMobileNav, { passive: true });
});


/* ============================================================
   SMOOTH ANCHOR SCROLL
============================================================ */
let cachedNavHeight = null;
function getNavHeight() {
  if (cachedNavHeight === null) {
    cachedNavHeight = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--nav-h')
    );
  }
  return cachedNavHeight;
}

window.addEventListener('resize', () => { cachedNavHeight = null; }, { passive: true });

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = target.getBoundingClientRect().top + window.scrollY - getNavHeight() - 16;
    requestAnimationFrame(() => {
      window.scrollTo({ top: offset, behavior: 'smooth' });
    });
  }, { passive: false });
});


/* ============================================================
   SHOPPING BAG
============================================================ */
function initShoppingBags() {
  document.querySelectorAll('.d-price').forEach(priceEl => {
    if (priceEl.querySelector('.shopping-bag-btn')) return;

    const price = priceEl.textContent.trim();
    priceEl.innerHTML = `
      <span class="price-wrapper">
        <span>${price}</span>
        <button class="shopping-bag-btn" aria-label="Add to cart">
          🛍️<span class="cart-badge">1</span>
        </button>
      </span>
    `;

    const btn = priceEl.querySelector('.shopping-bag-btn');
    let resetTimer;
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add('added');
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => btn.classList.remove('added'), 2000);
    }, { passive: false });
  });
}
