/* ============================================================
   SandwichNSmoothies — Main Script
============================================================ */

gsap.registerPlugin(ScrollTrigger);


/* ============================================================
   AUTO BACKGROUND REMOVAL (any colour)
   Samples the background colour from the four corner patches,
   then removes pixels within colour-distance tolerance.
   Used for images with non-white studio backdrops.
============================================================ */
function removeBgAuto(img, drawW, drawH, tolerance = 38, feather = 30) {
  const off  = document.createElement('canvas');
  off.width  = drawW;
  off.height = drawH;
  const c    = off.getContext('2d', { willReadFrequently: true });
  c.drawImage(img, 0, 0, drawW, drawH);

  const data = c.getImageData(0, 0, drawW, drawH);
  const px   = data.data;

  // Sample background from 10×10 patches at each corner
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
   BACKGROUND REMOVAL (near-white / grey)
   Removes near-white/grey pixels from a loaded Image element.
   Returns an offscreen canvas with those pixels made transparent.
   threshold: pixels with avg brightness above this become transparent
   feather:   how many units of smooth fade at the edge
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
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const brightness = (r + g + b) / 3;

    if (brightness > threshold) {
      // Remap [threshold .. 255] → alpha [255 .. 0] with smooth feather
      const t  = Math.min(1, (brightness - threshold) / feather);
      px[i + 3] = Math.round((1 - t) * 255);
    }
  }

  c.putImageData(data, 0, 0);
  return off;
}


/* ============================================================
   LOGO BACKGROUND REMOVAL
   Process logo once → create blob URL → swap all logo <img> srcs
============================================================ */
function processLogos() {
  const logoImg = new Image();
  // Same-origin (localhost) — no CORS header needed; omitting crossOrigin keeps canvas untainted
  logoImg.src = 'Gemini_Generated_Image_cp1b1lcp1b1lcp1b.png';

  logoImg.onload = () => {
    const processed = removeWhiteBg(
      logoImg,
      logoImg.naturalWidth,
      logoImg.naturalHeight,
      215,   // threshold — removes light grey background
      30     // feather — smooth edges
    );

    processed.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      // Update all logo images on the page
      document.querySelectorAll('.nav-logo, .footer-logo').forEach(el => {
        el.src = url;
      });
    }, 'image/png');
  };
}

processLogos();


/* ============================================================
   ABOUT SECTION — FLOATING SANDWICH
   Load the sandwich PNG, remove white bg via pixel processing,
   draw the result on the <canvas> so the sandwich "floats"
   on the off-white section background exactly like the hero.
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
  const fs    = Math.max(72, Math.min(190, window.innerWidth * 0.13));
  const lh    = fs * 0.86;
  const count = Math.ceil(window.innerHeight / lh) + 3;

  el.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const d = document.createElement('div');
    d.className   = 'wallpaper-line';
    d.textContent = word;
    el.appendChild(d);
  }
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
  }, 150);
}, { passive: true });


/* ============================================================
   CANVAS SCROLL ANIMATION
   Frames play forward (assembled→exploded) on scroll down.
   White backgrounds removed per-frame via pixel processing.
   Frames are cached after first render so processing is one-time.
============================================================ */
const canvas      = document.getElementById('sandwichCanvas');
const ctx         = canvas.getContext('2d');
const FRAME_COUNT = 125;

// Internal canvas resolution — half of source (faster pixel processing)
const CW = 728, CH = 408;
canvas.width  = CW;
canvas.height = CH;

const rawFrames       = new Array(FRAME_COUNT);  // original Image objects
const processedFrames = new Array(FRAME_COUNT).fill(null); // transparent canvases
let   loadedCount     = 0;

function pad(n) { return String(n).padStart(3, '0'); }

// Draw a processed (transparent-bg) frame to the visible canvas
function renderFrame(index) {
  const i   = Math.max(0, Math.min(FRAME_COUNT - 1, index));
  const img = rawFrames[i];
  if (!img || !img.complete || !img.naturalWidth) return;

  // Process on first use, then cache
  if (!processedFrames[i]) {
    processedFrames[i] = removeWhiteBg(img, CW, CH, 225, 18);
  }

  ctx.clearRect(0, 0, CW, CH);
  ctx.drawImage(processedFrames[i], 0, 0);
}

// Preload all frames; draw first frame as soon as it's ready
function preload() {
  return new Promise(resolve => {
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      // Same-origin — no crossOrigin needed; canvas stays untainted for pixel processing
      img.src = `ezgif-frame-${pad(i + 1)}.jpg`;

      img.onload = () => {
        loadedCount++;
        if (i === 0) renderFrame(0);          // immediate first paint
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

// Background-preprocess upcoming frames so scroll feels instant
function warmCache() {
  let i = 0;
  function next() {
    if (i >= FRAME_COUNT) return;
    if (!processedFrames[i] && rawFrames[i]?.complete) {
      processedFrames[i] = removeWhiteBg(rawFrames[i], CW, CH, 225, 18);
    }
    i++;
    requestIdleCallback ? requestIdleCallback(next) : setTimeout(next, 8);
  }
  next();
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
      scrub: 0.6,
      anticipatePin: 1,
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
============================================================ */
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


/* ============================================================
   MENU MODAL  (poster card click → category items)
============================================================ */
const menuModal     = document.getElementById('menuModal');
const modalContent  = document.getElementById('modalContent');

function openMenuModal(catId) {
  const tpl = document.getElementById(`tpl-${catId}`);
  if (!tpl) return;

  modalContent.innerHTML = '';
  modalContent.appendChild(tpl.content.cloneNode(true));

  // Re-apply current language so freshly cloned nodes get translated
  applyLanguage(lang);

  menuModal.classList.add('open');
  menuModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  // Focus the close button for keyboard users
  setTimeout(() => menuModal.querySelector('.modal-close')?.focus(), 50);
}

function closeMenuModal() {
  menuModal.classList.remove('open');
  menuModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

// Wire up every poster card
document.querySelectorAll('.menu-card').forEach(card => {
  card.addEventListener('click', () => openMenuModal(card.dataset.cat));
});

// Close handlers — backdrop, X button, and ESC
menuModal.querySelectorAll('[data-close]').forEach(el => {
  el.addEventListener('click', closeMenuModal);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && menuModal.classList.contains('open')) closeMenuModal();
}, { passive: true });

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


/* ============================================================
   EN / DA LANGUAGE TOGGLE
============================================================ */
let lang = 'da';

function applyLanguage(l) {
  lang = l;
  document.querySelectorAll('[data-en]').forEach(el => {
    const text = el.getAttribute(`data-${l}`);
    if (!text) return;
    el.innerHTML = text.includes('<') ? text : '';
    if (!text.includes('<')) el.textContent = text;
  });
  document.querySelectorAll('.lang-opt').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.lang === l);
  });
  document.documentElement.lang = l;
}

// Apply default language (Danish) as soon as DOM is ready
applyLanguage('da');

document.getElementById('langToggle').addEventListener('click', () => {
  applyLanguage(lang === 'da' ? 'en' : 'da');
});


/* ============================================================
   MOBILE NAV
============================================================ */
const hamburger     = document.getElementById('hamburger');
const mobileNav     = document.getElementById('mobileNav');
const mobileOverlay = document.getElementById('mobileOverlay');

const openMobileNav  = () => { mobileNav.classList.add('open'); mobileOverlay.classList.add('open'); document.body.style.overflow = 'hidden'; };
const closeMobileNav = () => { mobileNav.classList.remove('open'); mobileOverlay.classList.remove('open'); document.body.style.overflow = ''; };

hamburger.addEventListener('click', () => mobileNav.classList.contains('open') ? closeMobileNav() : openMobileNav(), { passive: false });
mobileOverlay.addEventListener('click', closeMobileNav, { passive: true });
mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMobileNav, { passive: true }));


/* ============================================================
   SMOOTH ANCHOR SCROLL
============================================================ */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const navH   = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'));
    const offset = target.getBoundingClientRect().top + window.scrollY - navH - 16;
    requestAnimationFrame(() => {
      window.scrollTo({ top: offset, behavior: 'smooth' });
    });
  }, { passive: false });
});


/* ============================================================
   PERFORMANCE OPTIMIZATION — Cache navbar height to avoid recalculation
============================================================ */
let cachedNavHeight = null;
function getNavHeight() {
  if (cachedNavHeight === null) {
    cachedNavHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'));
  }
  return cachedNavHeight;
}

window.addEventListener('resize', () => {
  cachedNavHeight = null;
}, { passive: true });


/* ============================================================
   SHOPPING BAG INTEGRATION
   Add shopping bag icons to all prices with click handlers
============================================================ */
function initShoppingBags() {
  document.querySelectorAll('.d-price').forEach(priceEl => {
    // Skip if already processed
    if (priceEl.querySelector('.shopping-bag-btn')) return;

    const price = priceEl.textContent;
    priceEl.innerHTML = `
      <span class="price-wrapper">
        <span>${price}</span>
        <button class="shopping-bag-btn" aria-label="Add to cart">
          🛍️<span class="cart-badge">1</span>
        </button>
      </span>
    `;

    const btn = priceEl.querySelector('.shopping-bag-btn');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Trigger animation
      btn.classList.add('added');
      
      // Reset after 2 seconds
      setTimeout(() => {
        btn.classList.remove('added');
      }, 2000);
    });
  });
}

// Initialize when menu modal opens
const originalOpenModal = window.openMenuModal;
window.openMenuModal = function(catId) {
  originalOpenModal(catId);
  // Wait for DOM to update, then initialize shopping bags
  setTimeout(() => initShoppingBags(), 50);
};
