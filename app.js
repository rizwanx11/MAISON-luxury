/* =============================================
   MAISON — App Logic
   ============================================= */

// ---- STATE ----
let products = JSON.parse(localStorage.getItem('maison_products') || '[]');
let activeFilter = 'all';
let captionTarget = null;

// ---- DOM REFS ----
const productGrid    = document.getElementById('productGrid');
const emptyState     = document.getElementById('emptyState');
const modalOverlay   = document.getElementById('modalOverlay');
const modal          = document.getElementById('modal');
const step1          = document.getElementById('step1');
const step2          = document.getElementById('step2');
const productUrl     = document.getElementById('productUrl');
const fetchBtn       = document.getElementById('fetchBtn');
const fetchBtnText   = document.getElementById('fetchBtnText');
const fetchSpinner   = document.getElementById('fetchSpinner');
const manualToggle   = document.getElementById('manualToggle');
const backBtn        = document.getElementById('backBtn');
const saveProductBtn = document.getElementById('saveProductBtn');
const inputTitle     = document.getElementById('inputTitle');
const inputPrice     = document.getElementById('inputPrice');
const inputImage     = document.getElementById('inputImage');
const inputLink      = document.getElementById('inputLink');
const inputCategory  = document.getElementById('inputCategory');
const previewStrip   = document.getElementById('previewStrip');
const generateCaption = document.getElementById('generateCaptionBtn');
const captionOutput  = document.getElementById('captionOutput');
const captionText    = document.getElementById('captionText');
const hashtagText    = document.getElementById('hashtagText');
const copyCaption    = document.getElementById('copyCaption');
const themeToggle    = document.getElementById('themeToggle');
const toast          = document.getElementById('toast');

// ---- OPEN MODAL ----
function openModal() {
  modalOverlay.classList.add('open');
  resetModal();
}

function closeModal() {
  modalOverlay.classList.remove('open');
}

function resetModal() {
  step1.classList.remove('hidden');
  step2.classList.add('hidden');
  productUrl.value = '';
  inputTitle.value = '';
  inputPrice.value = '';
  inputImage.value = '';
  inputLink.value = '';
  inputCategory.value = 'amazon';
  previewStrip.innerHTML = '';
  captionOutput.classList.add('hidden');
  captionText.textContent = '';
  hashtagText.textContent = '';
}

document.getElementById('addProductBtn').addEventListener('click', openModal);
document.getElementById('heroAddBtn').addEventListener('click', openModal);
document.getElementById('emptyAddBtn').addEventListener('click', openModal);
document.getElementById('modalClose').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

// ---- THEME TOGGLE ----
const savedTheme = localStorage.getItem('maison_theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('maison_theme', next);
});

// ---- NAVBAR SCROLL ----
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (window.scrollY > 40) navbar.classList.add('scrolled');
  else navbar.classList.remove('scrolled');
});

// ---- DETECT STORE ----
function detectStore(url) {
  if (!url) return 'other';
  const u = url.toLowerCase();
  if (u.includes('amazon')) return 'amazon';
  if (u.includes('flipkart')) return 'flipkart';
  if (u.includes('meesho')) return 'meesho';
  return 'other';
}

// ---- FETCH PRODUCT (via AllOrigins + meta scraping) ----
async function fetchProductData(url) {
  // Try AllOrigins proxy to get page HTML
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(proxy, { signal: AbortSignal.timeout(12000) });
    const data = await res.json();
    const html = data.contents || '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract title
    let title =
      doc.querySelector('meta[property="og:title"]')?.content ||
      doc.querySelector('meta[name="twitter:title"]')?.content ||
      doc.querySelector('title')?.textContent ||
      '';

    // Clean title
    title = title.replace(/\s*[-|]\s*(Amazon|Flipkart|Meesho).*$/i, '').trim();

    // Extract image
    let image =
      doc.querySelector('meta[property="og:image"]')?.content ||
      doc.querySelector('meta[name="twitter:image"]')?.content ||
      '';

    // Extract price – common patterns
    let price = '';
    const pricePatterns = [
      'meta[property="product:price:amount"]',
      'meta[property="og:price:amount"]',
      '[id*="price"] [aria-hidden="true"]',
      '[class*="price"] [aria-hidden="true"]',
      '.a-price-whole',
      '[data-testid="price"]',
      '[class*="price"]:first-of-type',
    ];

    for (const selector of pricePatterns) {
      const el = doc.querySelector(selector);
      if (el) {
        const raw = (el.content || el.textContent || '').replace(/\s+/g, '').replace(/[^\d.,₹$€£¥]/g, '');
        if (raw.length > 0 && raw.length < 15) { price = raw; break; }
      }
    }

    // Try description for price hint
    if (!price) {
      const desc = doc.querySelector('meta[property="og:description"]')?.content || '';
      const priceMatch = desc.match(/[₹$€£¥]\s?[\d,]+(?:\.\d{1,2})?/);
      if (priceMatch) price = priceMatch[0];
    }

    // For Meesho and Flipkart og:image may be relative – fix it
    if (image && image.startsWith('//')) image = 'https:' + image;

    return { title, image, price, link: url };
  } catch (err) {
    console.warn('Fetch failed:', err);
    return null;
  }
}

// ---- FETCH BUTTON ----
fetchBtn.addEventListener('click', async () => {
  const url = productUrl.value.trim();
  if (!url) { showToast('Please paste a product link first'); return; }

  // Set loading state
  fetchBtnText.classList.add('hidden');
  fetchSpinner.classList.remove('hidden');
  fetchBtn.disabled = true;

  const result = await fetchProductData(url);

  fetchBtnText.classList.remove('hidden');
  fetchSpinner.classList.add('hidden');
  fetchBtn.disabled = false;

  if (result && result.title) {
    // Pre-fill form
    inputTitle.value = result.title || '';
    inputPrice.value = result.price ? `₹${result.price}` : '';
    inputImage.value = result.image || '';
    inputLink.value = result.link || url;
    inputCategory.value = detectStore(url);
    updatePreviewStrip();
    goToStep2();
    showToast('Product details extracted!');
  } else {
    // Failed – go to manual
    inputLink.value = url;
    inputCategory.value = detectStore(url);
    goToStep2();
    showToast('Could not auto-extract. Please fill details manually.', 3500);
  }
});

// ---- MANUAL TOGGLE ----
manualToggle.addEventListener('click', () => {
  inputLink.value = productUrl.value.trim();
  inputCategory.value = detectStore(productUrl.value.trim());
  goToStep2();
});

function goToStep2() {
  step1.classList.add('hidden');
  step2.classList.remove('hidden');
}

// ---- PREVIEW STRIP ----
function updatePreviewStrip() {
  const img = inputImage.value.trim();
  const title = inputTitle.value.trim();
  const price = inputPrice.value.trim();
  if (!img && !title) { previewStrip.innerHTML = ''; return; }

  previewStrip.innerHTML = `
    ${img ? `<img src="${img}" alt="Preview" onerror="this.style.display='none'">` : ''}
    <div class="preview-info">
      <strong>${title || 'Untitled Product'}</strong>
      ${price ? `<span>${price}</span>` : ''}
    </div>
  `;
}

inputImage.addEventListener('input', updatePreviewStrip);
inputTitle.addEventListener('input', updatePreviewStrip);

// ---- BACK ----
backBtn.addEventListener('click', () => {
  step1.classList.remove('hidden');
  step2.classList.add('hidden');
});

// ---- SAVE PRODUCT ----
saveProductBtn.addEventListener('click', () => {
  const title = inputTitle.value.trim();
  const link  = inputLink.value.trim();

  if (!title) { showToast('Please add a product title'); inputTitle.focus(); return; }
  if (!link)  { showToast('Please add a product link'); inputLink.focus(); return; }

  const product = {
    id: Date.now().toString(),
    title,
    price: inputPrice.value.trim(),
    image: inputImage.value.trim(),
    link,
    category: inputCategory.value,
    addedAt: Date.now(),
  };

  products.unshift(product);
  saveProducts();
  renderProducts();
  closeModal();
  showToast('Added to your collection ✦');

  // Scroll to collections
  setTimeout(() => {
    document.getElementById('collections').scrollIntoView({ behavior: 'smooth' });
  }, 300);
});

// ---- LOCAL STORAGE ----
function saveProducts() {
  localStorage.setItem('maison_products', JSON.stringify(products));
}

// ---- RENDER ----
function renderProducts() {
  const filtered = activeFilter === 'all'
    ? products
    : products.filter(p => p.category === activeFilter);

  productGrid.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.add('visible');
    return;
  }

  emptyState.classList.remove('visible');

  filtered.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.style.animationDelay = `${i * 0.06}s`;
    card.dataset.id = p.id;

    const badgeClass = ['amazon', 'flipkart', 'meesho'].includes(p.category) ? p.category : '';
    const storeLabel = p.category.charAt(0).toUpperCase() + p.category.slice(1);

    card.innerHTML = `
      <div class="card-image-wrap">
        ${p.image
          ? `<img src="${p.image}" alt="${escHtml(p.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-placeholder\\'>✦</div>'">`
          : `<div class="card-placeholder">✦</div>`
        }
        <span class="card-store-badge ${badgeClass}">${storeLabel}</span>
        <button class="card-delete" data-id="${p.id}" title="Remove">×</button>
      </div>
      <div class="card-body">
        <div class="card-title">${escHtml(p.title)}</div>
        ${p.price ? `<div class="card-price">${escHtml(p.price)}</div>` : ''}
        <div class="card-actions">
          <a class="card-buy-btn" href="${escHtml(p.link)}" target="_blank" rel="noopener noreferrer">Buy Now →</a>
          <button class="card-caption-btn" data-id="${p.id}">Caption ✦</button>
        </div>
      </div>
    `;

    productGrid.appendChild(card);
  });

  // Delete buttons
  productGrid.querySelectorAll('.card-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteProduct(btn.dataset.id);
    });
  });

  // Caption buttons
  productGrid.querySelectorAll('.card-caption-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = products.find(x => x.id === btn.dataset.id);
      if (p) openCaptionModal(p);
    });
  });
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---- DELETE ----
function deleteProduct(id) {
  products = products.filter(p => p.id !== id);
  saveProducts();
  renderProducts();
  showToast('Removed from collection');
}

// ---- FILTER ----
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderProducts();
  });
});

// ---- CAPTION GENERATOR (in add modal) ----
generateCaption.addEventListener('click', () => {
  const title = inputTitle.value.trim() || 'this beautiful piece';
  const price = inputPrice.value.trim();
  const store = inputCategory.value;
  const { caption, hashtags } = generateCaptionFor({ title, price, category: store });
  captionText.textContent = caption;
  hashtagText.textContent = hashtags;
  captionOutput.classList.remove('hidden');
});

copyCaption.addEventListener('click', () => {
  const full = `${captionText.textContent}\n\n${hashtagText.textContent}`;
  navigator.clipboard.writeText(full).then(() => showToast('Caption copied!'));
});

// ---- FLOATING CAPTION MODAL ----
let captionModal = null;

function openCaptionModal(product) {
  if (captionModal) captionModal.remove();

  const { caption, hashtags } = generateCaptionFor(product);

  captionModal = document.createElement('div');
  captionModal.className = 'caption-modal';
  captionModal.innerHTML = `
    <div class="caption-modal-header">
      <span class="caption-modal-title">Caption & Tags</span>
      <button class="caption-modal-close" id="capModalClose">×</button>
    </div>
    <div class="caption-box" id="capText">${escHtml(caption)}</div>
    <div class="hashtag-box" id="capTags">${escHtml(hashtags)}</div>
    <div style="display:flex;gap:8px;margin-top:12px;">
      <button class="btn-ghost btn-xs" id="capCopy">Copy All</button>
      <button class="btn-ghost btn-xs" id="capClose2">Close</button>
    </div>
  `;
  document.body.appendChild(captionModal);

  requestAnimationFrame(() => captionModal.classList.add('open'));

  captionModal.querySelector('#capModalClose').addEventListener('click', closeCaptionModal);
  captionModal.querySelector('#capClose2').addEventListener('click', closeCaptionModal);
  captionModal.querySelector('#capCopy').addEventListener('click', () => {
    navigator.clipboard.writeText(`${caption}\n\n${hashtags}`).then(() => showToast('Copied!'));
  });
}

function closeCaptionModal() {
  if (captionModal) {
    captionModal.classList.remove('open');
    setTimeout(() => { captionModal?.remove(); captionModal = null; }, 400);
  }
}

// ---- CAPTION GENERATOR LOGIC ----
function generateCaptionFor({ title, price, category }) {
  const storeMap = {
    amazon: 'Amazon India',
    flipkart: 'Flipkart',
    meesho: 'Meesho',
    other: 'an exclusive retailer',
  };
  const storeName = storeMap[category] || 'an exclusive retailer';

  const openings = [
    `✨ Obsessed with this find!`,
    `💛 The piece you didn't know you needed.`,
    `🖤 Quiet luxury at its finest.`,
    `✦ This is what effortless dressing looks like.`,
    `🌿 Understated. Elegant. Unforgettable.`,
  ];

  const middles = [
    `Introducing the **${title}** — a true wardrobe essential.`,
    `Say hello to your next favourite: **${title}**.`,
    `Curated with care: **${title}** is everything.`,
  ];

  const closings = price
    ? [`Available now${storeName ? ` on ${storeName}` : ''} for just ${price}. Link in bio! 🛍️`]
    : [`Available now${storeName ? ` on ${storeName}` : ''}. Link in bio! 🛍️`];

  const caption = [
    openings[Math.floor(Math.random() * openings.length)],
    middles[Math.floor(Math.random() * middles.length)].replace('**', '').replace('**', ''),
    '',
    closings[0],
  ].join('\n');

  const tags = [
    '#FashionFind', '#OOTDInspiration', '#LuxuryFashion', '#CuratedStyle',
    '#AffiliatePick', '#FashionForward', '#StyleGoals', '#WardrobeEssentials',
    '#MinimalFashion', '#EditorialStyle', '#FashionBlogger', '#OutfitOfTheDay',
  ];

  // Add store-specific tags
  if (category === 'amazon') tags.push('#AmazonFinds', '#AmazonFashion');
  if (category === 'flipkart') tags.push('#FlipkartFinds', '#FlipkartFashion');
  if (category === 'meesho') tags.push('#MeeshoFinds', '#MeeshoFashion');

  // Pick 10-12 random tags
  const shuffled = tags.sort(() => Math.random() - 0.5).slice(0, 12);
  const hashtags = shuffled.join(' ');

  return { caption, hashtags };
}

// ---- TOAST ----
let toastTimer = null;
function showToast(msg, duration = 2500) {
  toast.textContent = msg;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ---- SEED DATA (first load) ----
function seedDefaultProducts() {
  if (products.length > 0) return;

  const defaults = [
    {
      id: 'seed1',
      title: 'Floral Satin Midi Slip Dress',
      price: '₹1,299',
      image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
      link: '#',
      category: 'meesho',
      addedAt: Date.now() - 3000,
    },
    {
      id: 'seed2',
      title: 'Linen Co-ord Set — Natural Beige',
      price: '₹2,499',
      image: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=600&q=80',
      link: '#',
      category: 'flipkart',
      addedAt: Date.now() - 2000,
    },
    {
      id: 'seed3',
      title: 'Oversized Cashmere Blend Blazer',
      price: '₹3,899',
      image: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=600&q=80',
      link: '#',
      category: 'amazon',
      addedAt: Date.now() - 1000,
    },
    {
      id: 'seed4',
      title: 'Minimal Leather Crossbody Bag',
      price: '₹1,799',
      image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80',
      link: '#',
      category: 'amazon',
      addedAt: Date.now(),
    },
  ];

  products = defaults;
  saveProducts();
}

// ---- INIT ----
seedDefaultProducts();
renderProducts();
