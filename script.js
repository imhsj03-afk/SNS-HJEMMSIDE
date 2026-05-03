/* ============================================================
   SandwichNSmoothies — Main Script  (performance-optimised)
============================================================ */

gsap.registerPlugin(ScrollTrigger);

/* ── CRITICAL MOBILE FIX: stop address bar resize from breaking the pin ── */
ScrollTrigger.config({
  ignoreMobileResize: true,
  autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load'
});

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
let   currentFrame    = -1;

function pad(n) { return String(n).padStart(3, '0'); }

function renderFrame(index) {
  const i = Math.max(0, Math.min(FRAME_COUNT - 1, index));

  const img = rawFrames[i];
  if (!img || !img.complete || !img.naturalWidth) return;

  if (!processedFrames[i]) {
    processedFrames[i] = removeWhiteBg(img, CW, CH, 225, 18);
  }

  if (!processedFrames[i]) return;

  if (i === currentFrame) return;
  currentFrame = i;
  ctx.clearRect(0, 0, CW, CH);
  ctx.drawImage(processedFrames[i], 0, 0);
}

function preload() {
  return new Promise(resolve => {
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.decoding = 'async';
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

function prewarmCriticalFrames() {
  const criticalIndexes = [
    ...Array.from({ length: 10 }, (_, i) => i),
    ...Array.from({ length: 10 }, (_, i) => FRAME_COUNT - 1 - i)
  ];
  for (const i of criticalIndexes) {
    if (!processedFrames[i] && rawFrames[i]?.complete && rawFrames[i]?.naturalWidth) {
      processedFrames[i] = removeWhiteBg(rawFrames[i], CW, CH, 225, 18);
    }
  }
}

function warmCache() {
  let i = 0;
  const schedule = typeof requestIdleCallback === 'function'
    ? cb => requestIdleCallback(cb, { timeout: 500 })
    : cb => setTimeout(cb, 16);

  function next() {
    const limit = isMobile ? 1 : 8;
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
  prewarmCriticalFrames();
  initScrollAnimation();
  warmCache();
});

function initScrollAnimation() {
  const obj = { frame: 0 };
  const scrollDist = isMobile ? window.innerHeight * 1.2 : 900;

  gsap.to(obj, {
    frame: FRAME_COUNT - 1,
    ease: 'none',
    scrollTrigger: {
      trigger: '#hero',
      start: 'top top',
      end: `+=${scrollDist}`,
      pin: true,
      pinSpacing: true,
      invalidateOnRefresh: true,
      scrub: isMobile ? 0.8 : 0.6,
      anticipatePin: 1,
      fastScrollEnd: true,
      preventOverlaps: true,
      onRefresh() {
        renderFrame(0);
      },
      onLeaveBack() {
        renderFrame(0);
      },
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
    invalidateOnRefresh: true,
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
    invalidateOnRefresh: true,
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
      invalidateOnRefresh: true,
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

  const modalDialog = menuModal.querySelector('.modal-dialog');
  let cartBar = modalDialog.querySelector('.cart-bar');
  if (!cartBar) {
    cartBar = document.createElement('div');
    cartBar.className = 'cart-bar hidden';
    cartBar.innerHTML = `
      <div class="cart-info">
        <div class="cart-items-count"></div>
        <div class="cart-total">0 kr</div>
      </div>
      <button class="btn-checkout" aria-label="Gå til betaling">Gå til betaling →</button>
    `;
    modalDialog.appendChild(cartBar);
    cartBar.querySelector('.btn-checkout').addEventListener('click', openCheckout, { passive: true });
  }

  modalContent.classList.add('has-cart-bar');
  initCartQuantityControls();

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

initCheckoutModal();
initFloatingCartButton();


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
   CART SYSTEM — Food Ordering with Quantity Controls
============================================================ */
const cart = {}; // { "Item Name": { price: 89, qty: 2 }, ... }

function parsePrice(priceText) {
  const match = priceText.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function getItemKey(itemName) {
  return itemName.trim();
}

function getCartTotals() {
  let totalItems = 0;
  let totalPrice = 0;
  Object.values(cart).forEach(item => {
    totalItems += item.qty || 0;
    totalPrice += (item.price || 0) * (item.qty || 0);
  });
  return { totalItems, totalPrice };
}

function updateCartBar() {
  const { totalItems, totalPrice } = getCartTotals();
  const cartBar = document.querySelector('.cart-bar');
  const itemsCountEl = cartBar?.querySelector('.cart-items-count');
  const totalEl = cartBar?.querySelector('.cart-total');

  if (totalItems === 0) {
    cartBar?.classList.add('hidden');
    updateFloatingCartButton();
    return;
  }

  cartBar?.classList.remove('hidden');

  if (itemsCountEl) {
    itemsCountEl.textContent = totalItems === 1 ? '1 vare' : `${totalItems} varer`;
  }
  if (totalEl) {
    totalEl.textContent = `${totalPrice} kr`;
  }
  updateFloatingCartButton();
}

function updateFloatingCartButton() {
  const { totalItems, totalPrice } = getCartTotals();
  const floatingBtn = document.getElementById('floatingCartBtn');

  if (totalItems === 0) {
    floatingBtn?.classList.remove('show');
  } else {
    floatingBtn?.classList.add('show');
    const countEl = floatingBtn?.querySelector('.cart-count');
    const priceEl = floatingBtn?.querySelector('.cart-price');
    if (countEl) countEl.textContent = `${totalItems} ${totalItems === 1 ? 'vare' : 'varer'}`;
    if (priceEl) priceEl.textContent = `kr. ${totalPrice}`;
  }
}

function initCartQuantityControls() {
  document.querySelectorAll('.d-item').forEach(item => {
    const dInfoEl = item.querySelector('.d-info');
    const dPriceEl = item.querySelector('.d-price');
    const itemName = dInfoEl?.querySelector('strong')?.textContent.trim();
    const priceText = dPriceEl?.textContent.trim();

    if (!itemName || !priceText) return;

    const key = getItemKey(itemName);
    const price = parsePrice(priceText);
    const existingControl = item.querySelector('.qty-control');
    if (existingControl) return;

    const qtyControl = document.createElement('div');
    qtyControl.className = 'qty-control';
    qtyControl.innerHTML = `
      <button class="qty-btn minus" aria-label="Fjern">−</button>
      <span class="qty-display">0</span>
      <button class="qty-btn plus" aria-label="Tilføj">+</button>
    `;

    item.style.display = 'grid';
    item.style.gridTemplateColumns = '1fr auto auto';
    item.style.alignItems = 'center';
    item.appendChild(qtyControl);

    const minusBtn = qtyControl.querySelector('.minus');
    const plusBtn = qtyControl.querySelector('.plus');
    const qtyDisplay = qtyControl.querySelector('.qty-display');

    function updateUI() {
      const qty = cart[key]?.qty || 0;
      qtyDisplay.textContent = qty;
      minusBtn.disabled = qty === 0;
      if (qty > 0) {
        item.classList.add('has-qty');
      } else {
        item.classList.remove('has-qty');
      }
      updateCartBar();
    }

    minusBtn.addEventListener('click', e => {
      e.stopPropagation();
      if ((cart[key]?.qty || 0) > 0) {
        cart[key].qty--;
        if (cart[key].qty === 0) delete cart[key];
        updateUI();
      }
    }, { passive: false });

    plusBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (!cart[key]) {
        cart[key] = { price, qty: 0 };
      }
      cart[key].qty++;
      updateUI();
    }, { passive: false });

    updateUI();
  });
}

function openCheckout() {
  if (Object.keys(cart).length === 0) return;

  const menuModal = document.getElementById('menuModal');
  menuModal.classList.remove('open');
  menuModal.setAttribute('aria-hidden', 'true');

  const checkoutModal = document.getElementById('checkoutModal');
  const checkoutItems = checkoutModal.querySelector('.checkout-items');
  checkoutItems.innerHTML = '';

  let total = 0;
  Object.entries(cart).forEach(([itemName, itemData]) => {
    const qty = itemData.qty || 0;
    const price = itemData.price || 0;
    if (qty > 0) {
      const lineTotal = price * qty;
      total += lineTotal;

      const itemEl = document.createElement('div');
      itemEl.className = 'checkout-item';
      itemEl.innerHTML = `
        <div class="checkout-item-name">${itemName}</div>
        <div class="checkout-item-qty">×${qty}</div>
        <div class="checkout-item-price">${lineTotal} kr</div>
      `;
      checkoutItems.appendChild(itemEl);
    }
  });

  checkoutModal.querySelector('.checkout-total-amount').textContent = `${total} kr`;
  checkoutModal.classList.add('open');
  checkoutModal.setAttribute('aria-hidden', 'false');
}

function closeCheckout(goBackToMenu = false) {
  const checkoutModal = document.getElementById('checkoutModal');
  checkoutModal.classList.remove('open');
  checkoutModal.setAttribute('aria-hidden', 'true');

  if (goBackToMenu) {
    const menuModal = document.getElementById('menuModal');
    menuModal.classList.add('open');
    menuModal.setAttribute('aria-hidden', 'false');
  }
}

function clearCart() {
  Object.keys(cart).forEach(key => delete cart[key]);
  updateFloatingCartButton();
}

function showConfirmation(message) {
  const confirmation = document.getElementById('confirmationMessage');
  confirmation.querySelector('.confirmation-text').textContent = message;
  confirmation.classList.add('show');

  setTimeout(() => {
    confirmation.classList.remove('show');
    closeCheckout();
    clearCart();
  }, 2000);
}

function initCheckoutModal() {
  const checkoutModal = document.getElementById('checkoutModal');
  if (!checkoutModal) return;

  const backdrop = checkoutModal.querySelector('.modal-backdrop');
  const backBtn = checkoutModal.querySelector('.btn-back');
  const paymentBtns = checkoutModal.querySelectorAll('.payment-btn');

  backdrop?.addEventListener('click', () => closeCheckout(true), { passive: true });
  backBtn?.addEventListener('click', () => closeCheckout(true), { passive: true });

  paymentBtns.forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      showConfirmation('Tak for din ordre! 🎉');
    }, { passive: false });
  });
}

function initFloatingCartButton() {
  const floatingBtn = document.getElementById('floatingCartBtn');
  if (!floatingBtn) return;

  floatingBtn.addEventListener('click', openCheckout, { passive: true });
}
