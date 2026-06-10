// ===== CART STATE =====
let cart = JSON.parse(localStorage.getItem('saree_cart') || '[]');
let lastTrackId = null;
let lastOrderCustomer = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.getElementById('loader').classList.add('hidden');
  }, 1200);

  window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  loadFeatured();
  loadCategories();
  loadProducts();
  updateCartUI();
  loadHeroMedia();

  // Mobile: require login to browse
  if (window.innerWidth <= 768) {
    fetch('/api/user/me').then(r => r.json()).then(data => {
      if (!data.loggedIn) {
        window.location.href = '/account.html';
      }
    }).catch(() => {
      window.location.href = '/account.html';
    });
  }

  // Auto-track if coming from My Orders page
  const trackId = localStorage.getItem('track_id');
  if (trackId) {
    localStorage.removeItem('track_id');
    setTimeout(() => {
      document.getElementById('trackOrderId').value = trackId;
      document.getElementById('track').scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => trackOrder(), 500);
    }, 1500);
  }
});

// ===== API HELPERS =====
async function api(url, options = {}) {
  const res = await fetch(url, options);
  return res.json();
}

// ===== LOAD HERO MEDIA =====
async function loadHeroMedia() {
  try {
    const res = await fetch('/hero-config.json');
    if (!res.ok) return;
    const files = await res.json();
    const container = document.getElementById('heroMediaContainer');
    if (!files || files.length === 0) return;

    container.innerHTML = files.map((f, i) => {
      if (f.type === 'video') {
        return `<video autoplay muted loop playsinline style="width:100%;max-width:380px;height:auto;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.12);"><source src="${f.url}" type="video/mp4"></video>`;
      }
      return `<div class="floating-card card-${i + 1}"><img src="${f.url}" alt=""></div>`;
    }).join('');
  } catch (e) {}
}

// ===== LOAD FEATURED =====
async function loadFeatured() {
  const products = await api('/api/shop/featured');
  const grid = document.getElementById('featuredGrid');
  if (products.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-box-open"></i><p>Featured products coming soon!</p></div>';
    return;
  }
  grid.innerHTML = products.map(p => productCard(p)).join('');
}

// ===== LOAD CATEGORIES =====
let allCategories = [];
let selectedCategory = '';
let selectedFabric = '';
let selectedColors = [];

async function loadCategories() {
  allCategories = await api('/api/shop/categories');

  // Main categories = those with no parent_id
  const mainCats = allCategories.filter(c => !c.parent_id);
  // Sub categories = those with a parent_id
  const subCats = allCategories.filter(c => c.parent_id);

  // If no parent-child setup yet, treat all as main categories
  const showAsMain = mainCats.length > 0 && subCats.length > 0 ? mainCats : allCategories;

  // Build category tabs
  const tabsContainer = document.getElementById('categoryTabs');
  let tabsHtml = '<button class="cat-tab active" onclick="filterByTab(\'\')">All</button>';
  showAsMain.forEach(c => {
    tabsHtml += `<button class="cat-tab" onclick="filterByTab(${c.id})">${c.name}</button>`;
  });
  tabsContainer.innerHTML = tabsHtml;

  // Hide sub-category row initially
  document.getElementById('fabricFilters').style.display = 'none';
}

function filterByTab(catId) {
  selectedCategory = catId;
  selectedFabric = '';

  // Update active tab
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  event.currentTarget.classList.add('active');

  // Show sub-categories for selected main category
  const fabricContainer = document.getElementById('fabricFilters');
  if (catId) {
    const subCats = allCategories.filter(c => c.parent_id === catId);
    if (subCats.length > 0) {
      fabricContainer.style.display = 'flex';
      fabricContainer.innerHTML = `<button class="fabric-pill active" onclick="filterByFabric('')">All</button>` +
        subCats.map(c => `<button class="fabric-pill" onclick="filterByFabric(${c.id})">${c.name}</button>`).join('');
    } else {
      fabricContainer.style.display = 'none';
    }
  } else {
    fabricContainer.style.display = 'none';
  }

  filterProducts();
}

function filterByFabric(catId) {
  selectedFabric = catId;
  document.querySelectorAll('.fabric-pill').forEach(t => t.classList.remove('active'));
  event.currentTarget.classList.add('active');
  filterProducts();
}

// ===== LOAD PRODUCTS =====
async function loadProducts(category = '', search = '') {
  let url = '/api/shop/products?';
  if (category) url += `category=${category}&`;
  if (search) url += `search=${encodeURIComponent(search)}&`;
  if (selectedColors.length > 0) url += `colors=${encodeURIComponent(selectedColors.join(','))}&`;
  const products = await api(url);
  const grid = document.getElementById('productsGrid');
  if (products.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-search"></i><p>No products found for these filters.</p></div>';
    return;
  }
  grid.innerHTML = products.map(p => productCard(p)).join('');
}

// ===== PRODUCT CARD =====
function productCard(p) {
  const discount = p.original_price ? Math.round((1 - p.price / p.original_price) * 100) : 0;
  const outOfStock = p.stock <= 0;
  const lowStock = p.stock > 0 && p.stock <= 5;

  // Parse color variants (new format)
  let variants = [];
  try { variants = JSON.parse(p.color_variants || '[]'); } catch (e) {}

  // Fallback: old colors format
  if (variants.length === 0 && p.colors) {
    let imgs = [];
    try { imgs = JSON.parse(p.images || '[]'); } catch (e) {}
    p.colors.split(',').forEach((c, i) => {
      const parts = c.trim().split(':');
      if (parts.length === 2) variants.push({ name: parts[0].trim(), hex: parts[1].trim(), images: [imgs[i] || imgs[0] || p.image_url].filter(Boolean) });
    });
  }

  const imgSrc = (variants.length > 0 && variants[0].images && variants[0].images[0])
    ? variants[0].images[0]
    : (p.image_url || 'https://via.placeholder.com/400x500?text=Saree');

  const maxShow = 6;
  const extraColors = variants.length > maxShow ? variants.length - maxShow : 0;

  return `
    <div class="product-card" onclick="viewProduct(${p.id})" style="${outOfStock ? 'opacity:0.6;' : ''}">
      <div class="product-card-image">
        <img src="${imgSrc}" alt="${escapeHtml(p.name)}" loading="lazy" id="card-img-${p.id}">
        ${outOfStock ? '<span class="product-badge" style="background:#C62828;">Sold Out</span>' : lowStock ? `<span class="product-badge" style="background:#E65100;">Only ${p.stock} left!</span>` : p.tags ? `<span class="product-badge">${p.tags.split(',')[0].trim()}</span>` : p.featured ? '<span class="product-badge">Featured</span>' : ''}
      </div>
      ${variants.length > 0 ? `
        <div class="color-palette" onclick="event.stopPropagation();">
          ${variants.slice(0, maxShow).map((v, i) => {
            const img0 = (v.images && v.images[0]) || imgSrc;
            return `<span class="color-dot ${i === 0 ? 'active' : ''}" style="background:${v.hex};" title="${v.name}" onclick="event.stopPropagation(); switchCardColor(${p.id}, ${i}, '${img0}')"></span>`;
          }).join('')}
          ${extraColors > 0 ? `<span class="color-more">+${extraColors}</span>` : ''}
        </div>
      ` : ''}
      <div class="product-card-info">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="product-price">
          <span class="current">₹${Number(p.price).toLocaleString()}</span>
          ${p.original_price ? `<span class="original">₹${Number(p.original_price).toLocaleString()}</span>` : ''}
          ${discount > 0 ? `<span class="discount">${discount}% OFF</span>` : ''}
        </div>
        ${outOfStock
          ? `<button class="add-to-cart-btn" disabled style="background:#ccc;cursor:not-allowed;border-color:#ccc;color:#666;"><i class="fas fa-ban"></i> Sold Out</button>`
          : `<button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCartById(${p.id})"><i class="fas fa-shopping-bag"></i> Add to Cart</button>`
        }
      </div>
    </div>
  `;
}

function switchCardColor(productId, colorIndex, imgUrl) {
  const img = document.getElementById('card-img-' + productId);
  if (img && imgUrl) img.src = imgUrl;
  const card = img.closest('.product-card');
  card.querySelectorAll('.color-dot').forEach((d, i) => {
    d.classList.toggle('active', i === colorIndex);
  });
}

async function addToCartById(id) {
  const p = await api(`/api/shop/products/${id}`);
  if (p.error) return;
  if (p.stock <= 0) { showToast('Sorry, this item is out of stock', 'error'); return; }

  // Check current cart quantity for this item
  const existing = cart.find(item => item.id === id);
  const currentQty = existing ? existing.qty : 0;
  if (currentQty >= p.stock) {
    showToast(`Only ${p.stock} available. You already have ${currentQty} in cart.`, 'error');
    return;
  }

  const imgSrc = p.image_url || 'https://via.placeholder.com/400x500?text=Saree';
  addToCart(id, p.name, p.price, imgSrc, p.original_price || p.price, p.stock);
}

// Also check stock before checkout
async function validateCartStock() {
  for (const item of cart) {
    const p = await api(`/api/shop/products/${item.id}`);
    if (p.stock <= 0) {
      showToast(`"${item.name}" is now out of stock. Please remove it.`, 'error');
      return false;
    }
    if (item.qty > p.stock) {
      showToast(`Only ${p.stock} of "${item.name}" available. You have ${item.qty} in cart.`, 'error');
      item.qty = p.stock;
      item.maxStock = p.stock;
      saveCart();
      updateCartUI();
      return false;
    }
  }
  return true;
}

// ===== VIEW PRODUCT =====
async function viewProduct(id) {
  const p = await api(`/api/shop/products/${id}`);
  const modal = document.getElementById('productModal');
  const detail = document.getElementById('productDetail');
  const outOfStock = p.stock <= 0;
  const lowStock = p.stock > 0 && p.stock <= 5;

  // Parse color variants
  let variants = [];
  try { variants = JSON.parse(p.color_variants || '[]'); } catch (e) {}
  if (variants.length === 0 && p.colors) {
    let imgs = [];
    try { imgs = JSON.parse(p.images || '[]'); } catch (e) {}
    p.colors.split(',').forEach((c, i) => {
      const parts = c.trim().split(':');
      if (parts.length === 2) variants.push({ name: parts[0].trim(), hex: parts[1].trim(), images: [imgs[i] || imgs[0] || p.image_url].filter(Boolean) });
    });
  }

  // Default images (first variant or fallback)
  const defaultImages = variants.length > 0 && variants[0].images ? variants[0].images : (p.images ? JSON.parse(p.images) : [p.image_url]).filter(Boolean);
  const mainImg = defaultImages[0] || 'https://via.placeholder.com/600x400?text=Saree';

  // Store variants data for switching
  window._productVariants = variants;
  window._productImages = defaultImages;
  window._currentImgIndex = 0;

  detail.innerHTML = `
    <div class="pd-slider">
      <img src="${mainImg}" alt="${escapeHtml(p.name)}" class="pd-image" id="pd-main-img">
      ${defaultImages.length > 1 ? `
        <button class="pd-slider-btn prev" onclick="event.stopPropagation(); slideImage(-1)"><i class="fas fa-chevron-left"></i></button>
        <button class="pd-slider-btn next" onclick="event.stopPropagation(); slideImage(1)"><i class="fas fa-chevron-right"></i></button>
        <span class="pd-slider-counter" id="pd-counter">1 / ${defaultImages.length}</span>
      ` : ''}
    </div>
    ${defaultImages.length > 1 ? `
      <div class="pd-thumbnails" id="pd-thumbnails" style="display:flex;gap:6px;margin-bottom:16px;overflow-x:auto;">
        ${defaultImages.map((img, i) => `<img src="${img}" style="width:50px;height:62px;object-fit:cover;cursor:pointer;border:2px solid ${i === 0 ? '#1A1A1A' : 'transparent'};" onclick="goToImage(${i})">`).join('')}
      </div>
    ` : '<div id="pd-thumbnails"></div>'}
    ${variants.length > 0 ? `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
        <span style="font-size:0.8rem;color:#9A9A9A;text-transform:uppercase;">Color:</span>
        ${variants.map((v, i) => `<span class="color-dot ${i === 0 ? 'active' : ''}" style="background:${v.hex};width:24px;height:24px;" title="${v.name}" onclick="switchDetailColor(${i})"></span>`).join('')}
      </div>
    ` : ''}
    <h2 class="pd-name">${escapeHtml(p.name)}</h2>
    ${p.category_name ? `<p class="pd-category">${escapeHtml(p.category_name)}</p>` : ''}
    <p class="pd-price">₹${Number(p.price).toLocaleString()}
      ${p.original_price ? `<span style="font-size:0.9rem;color:#999;text-decoration:line-through;margin-left:8px;">₹${Number(p.original_price).toLocaleString()}</span>` : ''}
    </p>
    <p class="pd-desc">${escapeHtml(p.description || 'A beautiful piece from our premium collection.')}</p>
    ${outOfStock
      ? `<p style="color:#C62828;font-size:0.85rem;margin-bottom:14px;"><i class="fas fa-times-circle"></i> Sold Out</p>
         <button class="add-to-cart-btn" disabled style="background:#ccc;cursor:not-allowed;border-color:#ccc;color:#666;"><i class="fas fa-ban"></i> Sold Out</button>`
      : `${lowStock ? `<p style="color:#E65100;font-size:0.85rem;font-weight:600;margin-bottom:14px;"><i class="fas fa-exclamation-triangle"></i> Only few left — order soon!</p>` : ''}
         <button class="add-to-cart-btn" onclick="addToCartById(${p.id}); closeProductModal();"><i class="fas fa-shopping-bag"></i> Add to Cart</button>`
    }
  `;
  modal.classList.add('active');
}

function slideImage(direction) {
  const images = window._productImages;
  if (!images || images.length <= 1) return;
  window._currentImgIndex = (window._currentImgIndex + direction + images.length) % images.length;
  updateSlider();
}

function goToImage(index) {
  window._currentImgIndex = index;
  updateSlider();
}

function updateSlider() {
  const images = window._productImages;
  const idx = window._currentImgIndex;
  document.getElementById('pd-main-img').src = images[idx];
  const counter = document.getElementById('pd-counter');
  if (counter) counter.textContent = `${idx + 1} / ${images.length}`;
  // Update thumbnails
  const thumbs = document.getElementById('pd-thumbnails');
  if (thumbs) {
    thumbs.querySelectorAll('img').forEach((t, i) => {
      t.style.borderColor = i === idx ? '#1A1A1A' : 'transparent';
    });
  }
}

function switchDetailImage(imgUrl, thumbEl) {
  document.getElementById('pd-main-img').src = imgUrl;
  if (thumbEl) {
    thumbEl.parentElement.querySelectorAll('img').forEach(i => i.style.borderColor = 'transparent');
    thumbEl.style.borderColor = '#1A1A1A';
  }
}

function switchDetailColor(variantIndex) {
  const variants = window._productVariants;
  if (!variants || !variants[variantIndex]) return;
  const v = variants[variantIndex];

  // Update images array and reset index
  const newImages = (v.images && v.images.length > 0) ? v.images : [document.getElementById('pd-main-img').src];
  window._productImages = newImages;
  window._currentImgIndex = 0;

  // Update main image
  document.getElementById('pd-main-img').src = newImages[0];

  // Update counter
  const counter = document.getElementById('pd-counter');
  if (counter) counter.textContent = `1 / ${newImages.length}`;

  // Update slider buttons visibility
  const slider = document.querySelector('.pd-slider');
  const prevBtn = slider.querySelector('.prev');
  const nextBtn = slider.querySelector('.next');
  if (newImages.length > 1) {
    if (!prevBtn) {
      slider.insertAdjacentHTML('beforeend', `
        <button class="pd-slider-btn prev" onclick="event.stopPropagation(); slideImage(-1)"><i class="fas fa-chevron-left"></i></button>
        <button class="pd-slider-btn next" onclick="event.stopPropagation(); slideImage(1)"><i class="fas fa-chevron-right"></i></button>
        <span class="pd-slider-counter" id="pd-counter">1 / ${newImages.length}</span>
      `);
    } else {
      prevBtn.style.display = 'flex';
      nextBtn.style.display = 'flex';
      if (counter) counter.style.display = 'block';
    }
  } else {
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    if (counter) counter.style.display = 'none';
  }

  // Update thumbnails
  const thumbContainer = document.getElementById('pd-thumbnails');
  if (newImages.length > 1) {
    thumbContainer.style.display = 'flex';
    thumbContainer.innerHTML = newImages.map((img, i) => `<img src="${img}" style="width:50px;height:62px;object-fit:cover;cursor:pointer;border:2px solid ${i === 0 ? '#1A1A1A' : 'transparent'};" onclick="goToImage(${i})">`).join('');
  } else {
    thumbContainer.style.display = 'none';
    thumbContainer.innerHTML = '';
  }

  // Update active color dot
  const modal = document.getElementById('productDetail');
  modal.querySelectorAll('.color-dot').forEach((d, i) => d.classList.toggle('active', i === variantIndex));
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('active');
}

// ===== FILTER =====
function filterProducts() {
  const search = document.getElementById('searchInput').value;
  const category = selectedFabric || selectedCategory;
  loadProducts(category, search);
}

function filterByCategory(id) {
  selectedCategory = id;
  filterProducts();
}

// ===== CART =====
function addToCart(id, name, price, image, originalPrice, maxStock) {
  const existing = cart.find(item => item.id === id);
  if (existing) {
    if (existing.qty >= (maxStock || 999)) {
      showToast(`Maximum ${maxStock} available for this item`, 'error');
      return;
    }
    existing.qty += 1;
    existing.maxStock = maxStock || existing.maxStock;
  } else {
    cart.push({ id, name, price, image, qty: 1, originalPrice: originalPrice || price, maxStock: maxStock || 999 });
  }
  saveCart();
  updateCartUI();
  showToast('Added to cart!');
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
  updateCartUI();
}

function updateQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  const newQty = item.qty + delta;
  if (newQty <= 0) { removeFromCart(id); return; }

  // Check stock from server before allowing increase
  if (delta > 0) {
    fetch(`/api/shop/products/${id}`).then(r => r.json()).then(p => {
      if (newQty > p.stock) {
        showToast(`Only ${p.stock} available for "${p.name}"`, 'error');
        return;
      }
      item.qty = newQty;
      item.maxStock = p.stock;
      saveCart();
      updateCartUI();
    });
  } else {
    item.qty = newQty;
    saveCart();
    updateCartUI();
  }
}

function saveCart() {
  localStorage.setItem('saree_cart', JSON.stringify(cart));
}

function updateCartUI() {
  document.getElementById('cartCount').textContent = cart.reduce((sum, i) => sum + i.qty, 0);
  const cartItems = document.getElementById('cartItems');
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  document.getElementById('cartTotal').textContent = `₹${total.toLocaleString()}`;
  if (cart.length === 0) {
    cartItems.innerHTML = '<div class="empty-state"><i class="fas fa-shopping-bag"></i><p>Your cart is empty</p></div>';
    return;
  }
  cartItems.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.image}" alt="${escapeHtml(item.name)}">
      <div class="cart-item-info">
        <h4>${escapeHtml(item.name)}</h4>
        <span class="price">₹${(item.price * item.qty).toLocaleString()}</span>
        <div class="cart-item-qty">
          <button onclick="updateQty(${item.id}, -1)">−</button>
          <span>${item.qty}</span>
          <button onclick="updateQty(${item.id}, 1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${item.id})"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');
}

function openCart() {
  document.getElementById('cartOverlay').classList.add('active');
  document.getElementById('cartSidebar').classList.add('active');
}

function closeCart() {
  document.getElementById('cartOverlay').classList.remove('active');
  document.getElementById('cartSidebar').classList.remove('active');
}

// ===== CHECKOUT =====
function openCheckout() {
  if (cart.length === 0) { showToast('Your cart is empty!', 'error'); return; }
  closeCart();

  // Check if user is logged in before allowing checkout
  fetch('/api/user/me').then(r => r.json()).then(data => {
    if (!data.loggedIn) {
      showToast('Please login to place an order', 'error');
      setTimeout(() => { window.location.href = '/account.html'; }, 1000);
      return;
    }
    // Validate stock before showing checkout
    validateCartStock().then(valid => {
      if (valid) {
        // Auto-fill from logged in user
        const u = data.user;
        if (!document.getElementById('custName').value) document.getElementById('custName').value = u.name || '';
        if (!document.getElementById('custPhone').value) document.getElementById('custPhone').value = u.phone || '';
        if (!document.getElementById('custEmail').value) document.getElementById('custEmail').value = u.email || '';
        if (!document.getElementById('custAddress').value) document.getElementById('custAddress').value = u.address || '';
        document.getElementById('checkoutModal').classList.add('active');
      }
    });
  }).catch(() => {
    showToast('Please login to place an order', 'error');
    setTimeout(() => { window.location.href = '/account.html'; }, 1000);
  });
}

function closeCheckout() {
  document.getElementById('checkoutModal').classList.remove('active');
}

async function placeOrder(e) {
  e.preventDefault();

  const customerData = {
    customer_name: document.getElementById('custName').value,
    customer_phone: document.getElementById('custPhone').value,
    customer_email: document.getElementById('custEmail').value,
    customer_address: document.getElementById('custAddress').value,
    notes: document.getElementById('custNotes').value
  };

  const orderData = {
    ...customerData,
    items: cart.map(item => ({ product_id: item.id, quantity: item.qty }))
  };

  try {
    const result = await api('/api/orders/place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    if (result.success) {
      lastTrackId = result.trackId;
      lastOrderCustomer = { ...customerData };
      localStorage.setItem('saree_customer_phone', customerData.customer_phone.replace(/[\s\-\(\)]/g, ''));

      // Get items from response
      const orderedItems = result.orderDetails.items.map(i => ({
        name: i.name,
        price: i.price,
        image: i.image_url || 'https://via.placeholder.com/100?text=Item',
        qty: i.quantity
      }));
      const totalAmount = result.orderDetails.total_amount;

      cart = [];
      saveCart();
      updateCartUI();
      closeCheckout();
      document.getElementById('checkoutForm').reset();

      showOrderConfirmation(result.trackId, customerData, orderedItems, totalAmount);
    } else {
      showToast(result.error || 'Order failed', 'error');
    }
  } catch (err) {
    showToast('Something went wrong. Try again.', 'error');
  }
}

// ===== ORDER CONFIRMATION =====
function showOrderConfirmation(trackId, customer, items, total) {
  const card = document.getElementById('orderSuccessCard');
  const estimatedDelivery = new Date();
  estimatedDelivery.setDate(estimatedDelivery.getDate() + 5);
  const deliveryStr = estimatedDelivery.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

  card.innerHTML = `
    <div class="order-success-header" style="position:relative;">
      <button onclick="closeOrderSuccess()" style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.2);border:none;color:white;width:36px;height:36px;border-radius:50%;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;"><i class="fas fa-times"></i></button>
      <div class="success-checkmark"><i class="fas fa-check"></i></div>
      <h2>Order Placed Successfully!</h2>
      <p>Thank you, ${escapeHtml(customer.customer_name.split(' ')[0])}!</p>
      <div class="order-id-badge">
        <i class="fas fa-receipt"></i>
        <span>Tracking ID: <strong>${escapeHtml(trackId)}</strong></span>
        <button class="copy-btn" onclick="copyTrackId('${trackId}')" title="Copy"><i class="fas fa-copy"></i></button>
      </div>
    </div>

    <div class="order-success-body">
      <!-- BIG TRACKING ID BOX -->
      <div style="background:#FFF8E1;border:2px solid #FFD54F;border-radius:12px;padding:16px 20px;margin-bottom:24px;text-align:center;">
        <p style="font-size:0.8rem;color:#F57F17;margin-bottom:6px;"><i class="fas fa-info-circle"></i> Save this Tracking ID to track your order</p>
        <p style="font-size:1.6rem;font-weight:700;color:#333;letter-spacing:2px;font-family:monospace;">${escapeHtml(trackId)}</p>
        <button onclick="copyTrackId('${trackId}')" style="margin-top:8px;padding:6px 16px;background:var(--primary);color:white;border:none;border-radius:6px;font-size:0.8rem;cursor:pointer;">
          <i class="fas fa-copy"></i> Copy ID
        </button>
      </div>

      <!-- Timeline -->
      <div class="order-timeline">
        <div class="timeline-step active">
          <div class="timeline-dot"><i class="fas fa-check"></i></div>
          <span class="timeline-label">Placed</span>
        </div>
        <div class="timeline-step current">
          <div class="timeline-dot"><i class="fas fa-clock"></i></div>
          <span class="timeline-label">Confirming</span>
        </div>
        <div class="timeline-step">
          <div class="timeline-dot"><i class="fas fa-shipping-fast"></i></div>
          <span class="timeline-label">Shipped</span>
        </div>
        <div class="timeline-step">
          <div class="timeline-dot"><i class="fas fa-home"></i></div>
          <span class="timeline-label">Delivered</span>
        </div>
      </div>

      <!-- Delivery -->
      <div class="order-info-section">
        <h4><i class="fas fa-truck"></i> Estimated Delivery</h4>
        <div class="delivery-info-card">
          <div class="info-row"><span class="label">Expected by</span><span class="value" style="color:#2E7D32;font-weight:600;">${deliveryStr}</span></div>
        </div>
      </div>

      <!-- Delivery Details -->
      <div class="order-info-section">
        <h4><i class="fas fa-map-marker-alt"></i> Delivery Details</h4>
        <div class="delivery-info-card">
          <div class="info-row"><span class="label">Name</span><span class="value">${escapeHtml(customer.customer_name)}</span></div>
          <div class="info-row"><span class="label">Phone</span><span class="value">${escapeHtml(customer.customer_phone)}</span></div>
          ${customer.customer_email ? `<div class="info-row"><span class="label">Email</span><span class="value">${escapeHtml(customer.customer_email)}</span></div>` : ''}
          <div class="info-row"><span class="label">Address</span><span class="value">${escapeHtml(customer.customer_address)}</span></div>
          <button class="edit-link" onclick="editOrderFromConfirmation('${trackId}')"><i class="fas fa-pen"></i> Edit Details</button>
        </div>
      </div>

      <!-- Items -->
      <div class="order-info-section">
        <h4><i class="fas fa-shopping-bag"></i> Items (${items.length})</h4>
        <div class="order-items-card">
          ${items.map(item => `
            <div class="order-item-row">
              <img src="${item.image}" alt="${escapeHtml(item.name)}">
              <div class="item-details">
                <div class="item-name">${escapeHtml(item.name)}</div>
                <div class="item-qty">Qty: ${item.qty}</div>
              </div>
              <div class="item-price">₹${(item.price * item.qty).toLocaleString()}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Total -->
      <div class="order-info-section">
        <h4><i class="fas fa-receipt"></i> Price Details</h4>
        <div class="price-summary">
          <div class="summary-row"><span>Subtotal</span><span>₹${total.toLocaleString()}</span></div>
          <div class="summary-row"><span>Delivery</span><span style="color:#2E7D32;">FREE</span></div>
          <div class="summary-row total"><span>Total</span><span>₹${total.toLocaleString()}</span></div>
        </div>
      </div>

      <!-- Actions -->
      <div class="order-actions">
        <button class="btn-continue-shopping" onclick="closeOrderSuccess()"><i class="fas fa-shopping-bag"></i> Continue Shopping</button>
        <button class="btn-track-order" onclick="closeOrderSuccess(); scrollToTrack('${trackId}');"><i class="fas fa-map-marker-alt"></i> Track Order</button>
      </div>
      <div style="text-align:center;margin-top:16px;">
        <a href="/my-orders.html" style="color:var(--primary);font-size:0.9rem;text-decoration:none;font-weight:500;"><i class="fas fa-list"></i> View All My Orders</a>
      </div>
    </div>
  `;

  document.getElementById('orderSuccessOverlay').classList.add('active');
}

function closeOrderSuccess() {
  document.getElementById('orderSuccessOverlay').classList.remove('active');
}

function copyTrackId(id) {
  navigator.clipboard.writeText(id).then(() => {
    showToast('Tracking ID copied!', 'success');
  }).catch(() => {
    prompt('Copy your Tracking ID:', id);
  });
}

function scrollToTrack(trackId) {
  document.getElementById('track').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => {
    document.getElementById('trackOrderId').value = trackId;
    trackOrder();
  }, 600);
}

// ===== EDIT ORDER =====
function editOrderFromConfirmation(trackId) {
  if (lastOrderCustomer) {
    document.getElementById('editOrderId').value = trackId;
    document.getElementById('editName').value = lastOrderCustomer.customer_name || '';
    document.getElementById('editPhone').value = lastOrderCustomer.customer_phone || '';
    document.getElementById('editEmail').value = lastOrderCustomer.customer_email || '';
    document.getElementById('editAddress').value = lastOrderCustomer.customer_address || '';
    document.getElementById('editOrderModal').classList.add('active');
  }
}

async function editOrderFromTrack(trackId) {
  const order = await api(`/api/orders/track/${encodeURIComponent(trackId)}`);
  if (order.error) { showToast('Could not load order', 'error'); return; }
  document.getElementById('editOrderId').value = trackId;
  document.getElementById('editName').value = order.customer_name || '';
  document.getElementById('editPhone').value = order.customer_phone || '';
  document.getElementById('editEmail').value = order.customer_email || '';
  document.getElementById('editAddress').value = order.customer_address || '';
  document.getElementById('editOrderModal').classList.add('active');
}

function closeEditOrder() {
  document.getElementById('editOrderModal').classList.remove('active');
}

async function saveOrderEdit() {
  const trackId = document.getElementById('editOrderId').value;
  const data = {
    customer_name: document.getElementById('editName').value,
    customer_phone: document.getElementById('editPhone').value,
    customer_email: document.getElementById('editEmail').value,
    customer_address: document.getElementById('editAddress').value
  };

  const result = await api(`/api/orders/update/${encodeURIComponent(trackId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (result.success) {
    showToast('Details updated!', 'success');
    closeEditOrder();
    lastOrderCustomer = { ...data };
    if (document.getElementById('trackResult').classList.contains('active')) {
      trackOrder();
    }
  } else {
    showToast(result.error || 'Failed to update', 'error');
  }
}

// ===== TRACK ORDER =====
async function trackOrder() {
  const input = document.getElementById('trackOrderId').value.trim();
  if (!input) { showToast('Please enter your Tracking ID', 'error'); return; }

  const result = await api(`/api/orders/track/${encodeURIComponent(input)}`);
  const resultDiv = document.getElementById('trackResult');

  if (result.error) {
    resultDiv.innerHTML = `
      <div style="text-align:center;padding:24px;">
        <i class="fas fa-exclamation-circle" style="font-size:2rem;color:#C62828;margin-bottom:12px;display:block;"></i>
        <p style="color:#C62828;font-weight:500;">${escapeHtml(result.error)}</p>
      </div>`;
    resultDiv.classList.add('active');
    return;
  }

  const statusOrder = ['pending', 'confirmed', 'shipped', 'delivered'];
  const currentIndex = statusOrder.indexOf(result.status);
  const isCancelled = result.status === 'cancelled';
  const trackId = result.track_id || input;

  const estimatedDelivery = new Date(result.created_at);
  estimatedDelivery.setDate(estimatedDelivery.getDate() + 5);
  const deliveryStr = estimatedDelivery.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  resultDiv.innerHTML = `
    <div style="margin-top:24px;border-top:1px solid #eee;padding-top:24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <div>
          <span style="background:var(--gold-light);color:var(--primary-dark);padding:6px 14px;border-radius:50px;font-size:0.85rem;font-weight:600;">Tracking: ${escapeHtml(trackId)}</span>
        </div>
        <span style="color:#666;font-size:0.85rem;">Placed: ${new Date(result.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>

      ${isCancelled ? `
        <div style="background:#FFEBEE;border-radius:12px;padding:16px;text-align:center;margin-bottom:20px;">
          <i class="fas fa-times-circle" style="font-size:1.5rem;color:#C62828;margin-bottom:8px;display:block;"></i>
          <p style="color:#C62828;font-weight:600;">This order has been cancelled</p>
        </div>
      ` : `
        <div class="order-timeline" style="margin-bottom:24px;">
          <div class="timeline-step ${currentIndex >= 0 ? 'active' : ''} ${currentIndex === 0 ? 'current' : ''}">
            <div class="timeline-dot"><i class="fas fa-check"></i></div>
            <span class="timeline-label">Placed</span>
          </div>
          <div class="timeline-step ${currentIndex >= 1 ? 'active' : ''} ${currentIndex === 1 ? 'current' : ''}">
            <div class="timeline-dot"><i class="fas fa-clipboard-check"></i></div>
            <span class="timeline-label">Confirmed</span>
          </div>
          <div class="timeline-step ${currentIndex >= 2 ? 'active' : ''} ${currentIndex === 2 ? 'current' : ''}">
            <div class="timeline-dot"><i class="fas fa-shipping-fast"></i></div>
            <span class="timeline-label">Shipped</span>
          </div>
          <div class="timeline-step ${currentIndex >= 3 ? 'active' : ''} ${currentIndex === 3 ? 'current' : ''}">
            <div class="timeline-dot"><i class="fas fa-home"></i></div>
            <span class="timeline-label">Delivered</span>
          </div>
        </div>

        ${currentIndex < 3 ? `
          <div style="background:#E8F5E9;border-radius:10px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px;">
            <i class="fas fa-truck" style="color:#2E7D32;"></i>
            <span style="font-size:0.9rem;color:#2E7D32;font-weight:500;">Estimated delivery by ${deliveryStr}</span>
          </div>
        ` : `
          <div style="background:#E8F5E9;border-radius:10px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px;">
            <i class="fas fa-check-circle" style="color:#2E7D32;"></i>
            <span style="font-size:0.9rem;color:#2E7D32;font-weight:500;">Delivered!</span>
          </div>
        `}
      `}

      <!-- Delivery -->
      <div class="order-info-section">
        <h4><i class="fas fa-map-marker-alt"></i> Delivery Address</h4>
        <div class="delivery-info-card">
          <div class="info-row"><span class="label">Name</span><span class="value">${escapeHtml(result.customer_name)}</span></div>
          <div class="info-row"><span class="label">Phone</span><span class="value">${escapeHtml(result.customer_phone)}</span></div>
          ${result.customer_email ? `<div class="info-row"><span class="label">Email</span><span class="value">${escapeHtml(result.customer_email)}</span></div>` : ''}
          <div class="info-row"><span class="label">Address</span><span class="value">${escapeHtml(result.customer_address)}</span></div>
          ${!isCancelled && currentIndex < 2 ? `<button class="edit-link" onclick="editOrderFromTrack('${escapeHtml(trackId)}')"><i class="fas fa-pen"></i> Edit Details</button>` : ''}
        </div>
      </div>

      <!-- Items -->
      <div class="order-info-section">
        <h4><i class="fas fa-shopping-bag"></i> Items Ordered</h4>
        <div class="order-items-card">
          ${result.items && result.items.length > 0 ? result.items.map(i => `
            <div class="order-item-row">
              <img src="${i.image_url || 'https://via.placeholder.com/50?text=Item'}" alt="${escapeHtml(i.product_name)}">
              <div class="item-details">
                <div class="item-name">${escapeHtml(i.product_name)}</div>
                <div class="item-qty">Qty: ${i.quantity}</div>
              </div>
              <div class="item-price">₹${(i.price * i.quantity).toLocaleString()}</div>
            </div>
          `).join('') : '<p style="color:#999;padding:12px 0;">Item details not available</p>'}
        </div>
      </div>

      <!-- Total -->
      <div class="order-info-section">
        <h4><i class="fas fa-receipt"></i> Payment Summary</h4>
        <div class="price-summary">
          <div class="summary-row"><span>Items Total</span><span>₹${Number(result.total_amount).toLocaleString()}</span></div>
          <div class="summary-row"><span>Delivery</span><span style="color:#2E7D32;">FREE</span></div>
          <div class="summary-row total"><span>Amount Paid</span><span>₹${Number(result.total_amount).toLocaleString()}</span></div>
        </div>
      </div>
    </div>
  `;
  resultDiv.classList.add('active');
}

// ===== CANCEL ORDER =====
async function cancelOrder(trackId) {
  if (!confirm('Are you sure you want to cancel this order?')) return;

  const result = await api(`/api/orders/cancel/${encodeURIComponent(trackId)}`, { method: 'PUT' });

  if (result.success) {
    showToast('Order cancelled successfully', 'success');
    closeOrderSuccess();
  } else {
    showToast(result.error || 'Failed to cancel', 'error');
  }
}

// ===== UTILITIES =====
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function validatePhone(input) {
  const phone = input.value.replace(/[\s\-\(\)]/g, '');
  const help = document.getElementById('phoneHelp');
  const regex = /^(\+91|91|0)?[6-9]\d{9}$/;
  if (phone.length === 0) {
    help.textContent = 'Enter 10-digit Indian mobile number';
    help.style.color = '#666';
  } else if (regex.test(phone)) {
    help.textContent = '✓ Valid phone number';
    help.style.color = '#2E7D32';
  } else if (phone.length < 10) {
    help.textContent = `${10 - phone.length} more digits needed`;
    help.style.color = '#E65100';
  } else {
    help.textContent = '✗ Invalid. Must start with 6-9, 10 digits';
    help.style.color = '#C62828';
  }
}

function showToast(message, type = '') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('active'), 50);
  setTimeout(() => { toast.classList.remove('active'); setTimeout(() => toast.remove(), 400); }, 3000);
}

function toggleMobileMenu() {
  const links = document.querySelector('.nav-links');
  links.style.display = links.style.display === 'flex' ? 'none' : 'flex';
  links.style.position = 'absolute';
  links.style.top = '100%';
  links.style.left = '0';
  links.style.right = '0';
  links.style.background = 'white';
  links.style.flexDirection = 'column';
  links.style.padding = '20px';
  links.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
  links.style.borderRadius = '0 0 16px 16px';
  links.style.gap = '16px';
}
