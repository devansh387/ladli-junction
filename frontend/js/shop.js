'use strict';

/**
 * Shop Module
 * Handles: product display, filtering, cart UI, checkout, order tracking.
 * All data fetched from backend API — no direct DB access.
 */

const Shop = (() => {
  let allCategories = [];
  let selectedCategory = '';
  let selectedFabric = '';
  let selectedColors = [];

  // ─── Initialization ──────────────────────────────────────────────────────

  function init() {
    // Loader
    setTimeout(() => {
      const loader = Utils.$('#loader');
      if (loader) loader.classList.add('hidden');
    }, 1200);

    // Navbar scroll effect
    window.addEventListener('scroll', () => {
      const navbar = Utils.$('#navbar');
      if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 50);
    });

    // Cart events
    window.addEventListener('cart:updated', updateCartUI);

    loadHeroMedia();
    loadFeatured();
    loadCategories();
    loadProducts();
    updateCartUI();

    // Auto-track from My Orders page
    const trackId = localStorage.getItem('track_id');
    if (trackId) {
      localStorage.removeItem('track_id');
      setTimeout(() => {
        const input = Utils.$('#trackOrderId');
        if (input) input.value = trackId;
        document.getElementById('track')?.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => trackOrder(), 500);
      }, 1500);
    }

    // Init auth state for checkout
    Api.init();
  }

  // ─── Hero Media ──────────────────────────────────────────────────────────

  async function loadHeroMedia() {
    try {
      const { ok, data } = await Api.get('/hero-config');
      if (!ok || !data || data.length === 0) return;
      const container = Utils.$('#heroMediaContainer');
      if (!container) return;

      container.innerHTML = data.map((f, i) => {
        if (f.type === 'video') {
          return `<video autoplay muted loop playsinline style="width:100%;max-width:380px;height:auto;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.12);"><source src="${CONFIG.API_BASE}${f.url}" type="video/mp4"></video>`;
        }
        return `<div class="floating-card card-${i + 1}"><img src="${CONFIG.API_BASE}${f.url}" alt=""></div>`;
      }).join('');
    } catch { /* silent */ }
  }

  // ─── Featured Products ───────────────────────────────────────────────────

  async function loadFeatured() {
    const { ok, data } = await Api.get('/shop/featured');
    const grid = Utils.$('#featuredGrid');
    if (!grid) return;

    if (!ok || !data.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-box-open"></i><p>Featured products coming soon!</p></div>';
      return;
    }
    grid.innerHTML = data.map(productCard).join('');
  }

  // ─── Categories ──────────────────────────────────────────────────────────

  async function loadCategories() {
    const { ok, data } = await Api.get('/shop/categories');
    if (!ok) return;
    allCategories = data;

    const mainCats = data.filter((c) => !c.parent_id);
    const subCats = data.filter((c) => c.parent_id);
    const showAsMain = mainCats.length > 0 && subCats.length > 0 ? mainCats : data;

    const tabsContainer = Utils.$('#categoryTabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '<button class="cat-tab active" onclick="Shop.filterByTab(\'\')">All</button>' +
      showAsMain.map((c) => `<button class="cat-tab" onclick="Shop.filterByTab(${c.id})">${Utils.escapeHtml(c.name)}</button>`).join('');

    const fabricContainer = Utils.$('#fabricFilters');
    if (fabricContainer) fabricContainer.style.display = 'none';
  }

  function filterByTab(catId) {
    selectedCategory = catId;
    selectedFabric = '';

    Utils.$$('.cat-tab').forEach((t) => t.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');

    const fabricContainer = Utils.$('#fabricFilters');
    if (catId && fabricContainer) {
      const subCats = allCategories.filter((c) => c.parent_id === catId);
      if (subCats.length > 0) {
        fabricContainer.style.display = 'flex';
        fabricContainer.innerHTML = `<button class="fabric-pill active" onclick="Shop.filterByFabric('')">All</button>` +
          subCats.map((c) => `<button class="fabric-pill" onclick="Shop.filterByFabric(${c.id})">${Utils.escapeHtml(c.name)}</button>`).join('');
      } else {
        fabricContainer.style.display = 'none';
      }
    } else if (fabricContainer) {
      fabricContainer.style.display = 'none';
    }
    filterProducts();
  }

  function filterByFabric(catId) {
    selectedFabric = catId;
    Utils.$$('.fabric-pill').forEach((t) => t.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
    filterProducts();
  }

  // ─── Products ────────────────────────────────────────────────────────────

  async function loadProducts() {
    const search = Utils.$('#searchInput')?.value || '';
    const category = selectedFabric || selectedCategory;
    let url = '/shop/products?';
    if (category) url += `category=${category}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (selectedColors.length > 0) url += `colors=${encodeURIComponent(selectedColors.join(','))}&`;

    const { ok, data } = await Api.get(url);
    const grid = Utils.$('#productsGrid');
    if (!grid) return;

    if (!ok || !data.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-search"></i><p>No products found for these filters.</p></div>';
      return;
    }
    grid.innerHTML = data.map(productCard).join('');
  }

  function filterProducts() {
    loadProducts();
  }

  function onColorFilterChange(colors) {
    selectedColors = colors;
    loadProducts();
  }

  // ─── Product Card ────────────────────────────────────────────────────────

  function productCard(p) {
    const discount = p.original_price ? Math.round((1 - p.price / p.original_price) * 100) : 0;
    const outOfStock = p.stock <= 0;
    const lowStock = p.stock > 0 && p.stock <= 5;

    let variants = [];
    try { variants = typeof p.color_variants === 'string' ? JSON.parse(p.color_variants) : (p.color_variants || []); } catch { variants = []; }

    if (variants.length === 0 && p.colors) {
      let imgs = [];
      try { imgs = typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || []); } catch { imgs = []; }
      p.colors.split(',').forEach((c, i) => {
        const parts = c.trim().split(':');
        if (parts.length === 2) variants.push({ name: parts[0].trim(), hex: parts[1].trim(), images: [imgs[i] || imgs[0] || p.image_url].filter(Boolean) });
      });
    }

    const imgSrc = (variants.length > 0 && variants[0].images && variants[0].images[0])
      ? resolveImageUrl(variants[0].images[0])
      : resolveImageUrl(p.image_url);

    const maxShow = 6;
    const extraColors = variants.length > maxShow ? variants.length - maxShow : 0;

    return `
      <div class="product-card" onclick="Shop.viewProduct(${p.id})" style="${outOfStock ? 'opacity:0.6;' : ''}">
        <div class="product-card-image">
          <img src="${imgSrc}" alt="${Utils.escapeAttr(p.name)}" loading="lazy" id="card-img-${p.id}" onerror="this.src='https://via.placeholder.com/400x500?text=Saree'">
          ${outOfStock ? '<span class="product-badge" style="background:#C62828;">Sold Out</span>' : lowStock ? `<span class="product-badge" style="background:#E65100;">Only ${p.stock} left!</span>` : p.tags ? `<span class="product-badge">${Utils.escapeHtml(p.tags.split(',')[0].trim())}</span>` : p.featured ? '<span class="product-badge">Featured</span>' : ''}
        </div>
        ${variants.length > 0 ? `
          <div class="color-palette" onclick="event.stopPropagation();">
            ${variants.slice(0, maxShow).map((v, i) => {
              const img0 = resolveImageUrl((v.images && v.images[0]) || p.image_url);
              return `<span class="color-dot ${i === 0 ? 'active' : ''}" style="background:${v.hex};" title="${Utils.escapeAttr(v.name)}" onclick="event.stopPropagation(); Shop.switchCardColor(${p.id}, ${i}, '${Utils.escapeAttr(img0)}')"></span>`;
            }).join('')}
            ${extraColors > 0 ? `<span class="color-more">+${extraColors}</span>` : ''}
          </div>` : ''}
        <div class="product-card-info">
          <h3>${Utils.escapeHtml(p.name)}</h3>
          <div class="product-price">
            <span class="current">${Utils.formatCurrency(p.price)}</span>
            ${p.original_price ? `<span class="original">${Utils.formatCurrency(p.original_price)}</span>` : ''}
            ${discount > 0 ? `<span class="discount">${discount}% OFF</span>` : ''}
          </div>
          ${outOfStock
            ? `<button class="add-to-cart-btn" disabled style="background:#ccc;cursor:not-allowed;border-color:#ccc;color:#666;"><i class="fas fa-ban"></i> Sold Out</button>`
            : `<button class="add-to-cart-btn" onclick="event.stopPropagation(); Shop.addToCart(${p.id})"><i class="fas fa-shopping-bag"></i> Add to Cart</button>`}
        </div>
      </div>`;
  }

  function switchCardColor(productId, colorIndex, imgUrl) {
    const img = document.getElementById('card-img-' + productId);
    if (img && imgUrl) img.src = imgUrl;
    const card = img?.closest('.product-card');
    if (card) {
      card.querySelectorAll('.color-dot').forEach((d, i) => d.classList.toggle('active', i === colorIndex));
    }
  }

  // ─── Add to Cart ─────────────────────────────────────────────────────────

  async function addToCart(productId) {
    const { ok, data } = await Api.get(`/shop/products/${productId}`);
    if (!ok || !data) { Utils.showToast('Product not found.', 'error'); return; }
    if (data.stock <= 0) { Utils.showToast('Sorry, this item is out of stock.', 'error'); return; }

    const result = Cart.addItem(data);
    if (result.success) {
      Utils.showToast('Added to cart!', 'success');
    } else {
      Utils.showToast(result.error, 'error');
    }
  }

  // ─── View Product Detail ─────────────────────────────────────────────────

  async function viewProduct(id) {
    const { ok, data: p } = await Api.get(`/shop/products/${id}`);
    if (!ok || !p) return;

    const modal = Utils.$('#productModal');
    const detail = Utils.$('#productDetail');
    if (!modal || !detail) return;

    const outOfStock = p.stock <= 0;
    let variants = [];
    try { variants = typeof p.color_variants === 'string' ? JSON.parse(p.color_variants) : (p.color_variants || []); } catch { variants = []; }

    let defaultImages = [];
    if (variants.length > 0 && variants[0].images) {
      defaultImages = variants[0].images.map(resolveImageUrl);
    } else {
      try {
        const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || []);
        defaultImages = imgs.map(resolveImageUrl);
      } catch { defaultImages = []; }
      if (defaultImages.length === 0 && p.image_url) defaultImages = [resolveImageUrl(p.image_url)];
    }
    if (defaultImages.length === 0) defaultImages = ['https://via.placeholder.com/600x400?text=Saree'];

    window._pdImages = defaultImages;
    window._pdIndex = 0;
    window._pdVariants = variants;

    detail.innerHTML = `
      <div class="pd-slider">
        <img src="${defaultImages[0]}" alt="${Utils.escapeAttr(p.name)}" class="pd-image" id="pd-main-img" onerror="this.src='https://via.placeholder.com/600x400?text=Saree'">
        ${defaultImages.length > 1 ? `
          <button class="pd-slider-btn prev" onclick="event.stopPropagation(); Shop.slideImage(-1)"><i class="fas fa-chevron-left"></i></button>
          <button class="pd-slider-btn next" onclick="event.stopPropagation(); Shop.slideImage(1)"><i class="fas fa-chevron-right"></i></button>
          <span class="pd-slider-counter" id="pd-counter">1 / ${defaultImages.length}</span>` : ''}
      </div>
      ${variants.length > 0 ? `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
          <span style="font-size:0.8rem;color:#9A9A9A;text-transform:uppercase;">Color:</span>
          ${variants.map((v, i) => `<span class="color-dot ${i === 0 ? 'active' : ''}" style="background:${v.hex};width:24px;height:24px;" title="${Utils.escapeAttr(v.name)}" onclick="Shop.switchDetailColor(${i})"></span>`).join('')}
        </div>` : ''}
      <h2 class="pd-name">${Utils.escapeHtml(p.name)}</h2>
      ${p.category_name ? `<p class="pd-category">${Utils.escapeHtml(p.category_name)}</p>` : ''}
      <p class="pd-price">${Utils.formatCurrency(p.price)}
        ${p.original_price ? `<span style="font-size:0.9rem;color:#999;text-decoration:line-through;margin-left:8px;">${Utils.formatCurrency(p.original_price)}</span>` : ''}
      </p>
      <p class="pd-desc">${Utils.escapeHtml(p.description || 'A beautiful piece from our premium collection.')}</p>
      ${outOfStock
        ? `<button class="add-to-cart-btn" disabled style="background:#ccc;cursor:not-allowed;border-color:#ccc;color:#666;"><i class="fas fa-ban"></i> Sold Out</button>`
        : `<button class="add-to-cart-btn" onclick="Shop.addToCart(${p.id}); Shop.closeProductModal();"><i class="fas fa-shopping-bag"></i> Add to Cart</button>`}`;

    modal.classList.add('active');
  }

  function slideImage(dir) {
    const imgs = window._pdImages;
    if (!imgs || imgs.length <= 1) return;
    window._pdIndex = (window._pdIndex + dir + imgs.length) % imgs.length;
    Utils.$('#pd-main-img').src = imgs[window._pdIndex];
    const counter = Utils.$('#pd-counter');
    if (counter) counter.textContent = `${window._pdIndex + 1} / ${imgs.length}`;
  }

  function switchDetailColor(idx) {
    const variants = window._pdVariants;
    if (!variants || !variants[idx]) return;
    const v = variants[idx];
    const newImages = (v.images && v.images.length > 0) ? v.images.map(resolveImageUrl) : window._pdImages;
    window._pdImages = newImages;
    window._pdIndex = 0;
    Utils.$('#pd-main-img').src = newImages[0];
    const counter = Utils.$('#pd-counter');
    if (counter) counter.textContent = `1 / ${newImages.length}`;
    const detail = Utils.$('#productDetail');
    if (detail) detail.querySelectorAll('.color-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  function closeProductModal() {
    Utils.$('#productModal')?.classList.remove('active');
  }

  // ─── Cart UI ─────────────────────────────────────────────────────────────

  function updateCartUI() {
    const countEl = Utils.$('#cartCount');
    if (countEl) countEl.textContent = Cart.getCount();

    const cartItems = Utils.$('#cartItems');
    const totalEl = Utils.$('#cartTotal');
    if (!cartItems) return;

    const items = Cart.getItems();
    if (totalEl) totalEl.textContent = Utils.formatCurrency(Cart.getTotal());

    if (items.length === 0) {
      cartItems.innerHTML = '<div class="empty-state"><i class="fas fa-shopping-bag"></i><p>Your cart is empty</p></div>';
      return;
    }

    cartItems.innerHTML = items.map((item) => `
      <div class="cart-item">
        <img src="${resolveImageUrl(item.image)}" alt="${Utils.escapeAttr(item.name)}" onerror="this.src='https://via.placeholder.com/60x80?text=Item'">
        <div class="cart-item-info">
          <h4>${Utils.escapeHtml(item.name)}</h4>
          <span class="price">${Utils.formatCurrency(item.price * item.qty)}</span>
          <div class="cart-item-qty">
            <button onclick="Shop.updateQty(${item.id}, -1)">−</button>
            <span>${item.qty}</span>
            <button onclick="Shop.updateQty(${item.id}, 1)">+</button>
          </div>
        </div>
        <button class="cart-item-remove" onclick="Shop.removeFromCart(${item.id})"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');
  }

  function updateQty(id, delta) {
    const result = Cart.updateQuantity(id, delta);
    if (result && !result.success) Utils.showToast(result.error, 'error');
  }

  function removeFromCart(id) {
    Cart.removeItem(id);
  }

  function openCart() {
    Utils.$('#cartOverlay')?.classList.add('active');
    Utils.$('#cartSidebar')?.classList.add('active');
  }

  function closeCart() {
    Utils.$('#cartOverlay')?.classList.remove('active');
    Utils.$('#cartSidebar')?.classList.remove('active');
  }

  // ─── Checkout ────────────────────────────────────────────────────────────

  async function openCheckout() {
    if (Cart.isEmpty()) { Utils.showToast('Your cart is empty!', 'error'); return; }
    closeCart();

    // Require login
    const loggedIn = await Api.init();
    if (!loggedIn) {
      Utils.showToast('Please login to place an order.', 'error');
      setTimeout(() => { window.location.href = '/account.html'; }, 1000);
      return;
    }

    // Validate stock
    const stockResult = await Cart.validateStock();
    if (!stockResult.valid) {
      Utils.showToast(stockResult.error, 'error');
      updateCartUI();
      return;
    }

    // Auto-fill user info
    const { ok, data } = await Api.get('/user/me', true);
    if (ok && data.user) {
      const u = data.user;
      const nameEl = Utils.$('#custName');
      const phoneEl = Utils.$('#custPhone');
      const emailEl = Utils.$('#custEmail');
      const addressEl = Utils.$('#custAddress');
      if (nameEl && !nameEl.value) nameEl.value = u.name || '';
      if (phoneEl && !phoneEl.value) phoneEl.value = u.phone || '';
      if (emailEl && !emailEl.value) emailEl.value = u.email || '';
      if (addressEl && !addressEl.value) addressEl.value = u.address || '';
    }

    Utils.$('#checkoutModal')?.classList.add('active');
  }

  function closeCheckout() {
    Utils.$('#checkoutModal')?.classList.remove('active');
  }

  async function placeOrder(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    Utils.setLoading(btn, true);

    const orderData = {
      customer_name: Utils.$('#custName')?.value.trim(),
      customer_phone: Utils.cleanPhone(Utils.$('#custPhone')?.value || ''),
      customer_address: Utils.$('#custAddress')?.value.trim(),
      customer_email: Utils.$('#custEmail')?.value.trim() || '',
      notes: Utils.$('#custNotes')?.value.trim() || '',
      items: Cart.getItems().map((i) => ({ product_id: i.id, quantity: i.qty })),
    };

    const { ok, data } = await Api.post('/orders/place', orderData, true);
    Utils.setLoading(btn, false);

    if (!ok) {
      Utils.showToast(Utils.extractError(data), 'error');
      return;
    }

    // Save phone for convenience
    Utils.setStoredPhone(orderData.customer_phone);

    // Clear cart and close checkout
    Cart.clear();
    updateCartUI();
    closeCheckout();
    Utils.$('#checkoutForm')?.reset();

    // Show success
    showOrderConfirmation(data.orderDetails);
  }

  // ─── Order Confirmation ──────────────────────────────────────────────────

  function showOrderConfirmation(order) {
    const card = Utils.$('#orderSuccessCard');
    if (!card) return;

    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 5);
    const deliveryStr = estimatedDelivery.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

    card.innerHTML = `
      <div class="order-success-header">
        <div class="success-checkmark"><i class="fas fa-check"></i></div>
        <h2>Order Placed Successfully!</h2>
        <p>Thank you, ${Utils.escapeHtml(order.customer_name.split(' ')[0])}!</p>
        <div class="order-id-badge">
          <i class="fas fa-receipt"></i>
          <span>Tracking ID: <strong>${Utils.escapeHtml(order.track_id)}</strong></span>
          <button class="copy-btn" onclick="Shop.copyTrackId('${Utils.escapeAttr(order.track_id)}')" title="Copy"><i class="fas fa-copy"></i></button>
        </div>
      </div>
      <div class="order-success-body">
        <div style="background:#FFF8E1;border:2px solid #FFD54F;border-radius:12px;padding:16px 20px;margin-bottom:24px;text-align:center;">
          <p style="font-size:0.8rem;color:#F57F17;margin-bottom:6px;"><i class="fas fa-info-circle"></i> Save this Tracking ID</p>
          <p style="font-size:1.6rem;font-weight:700;color:#333;letter-spacing:2px;font-family:monospace;">${Utils.escapeHtml(order.track_id)}</p>
          <button onclick="Shop.copyTrackId('${Utils.escapeAttr(order.track_id)}')" style="margin-top:8px;padding:6px 16px;background:var(--primary);color:white;border:none;border-radius:6px;font-size:0.8rem;cursor:pointer;"><i class="fas fa-copy"></i> Copy ID</button>
        </div>
        <div class="order-info-section">
          <h4><i class="fas fa-truck"></i> Estimated Delivery</h4>
          <div class="delivery-info-card"><div class="info-row"><span class="label">Expected by</span><span class="value" style="color:#2E7D32;font-weight:600;">${deliveryStr}</span></div></div>
        </div>
        <div class="order-info-section">
          <h4><i class="fas fa-receipt"></i> Total</h4>
          <div class="price-summary"><div class="summary-row total"><span>Amount</span><span>${Utils.formatCurrency(order.total_amount)}</span></div></div>
        </div>
        <div class="order-actions">
          <button class="btn-continue-shopping" onclick="Shop.closeOrderSuccess()"><i class="fas fa-shopping-bag"></i> Continue Shopping</button>
          <button class="btn-track-order" onclick="Shop.closeOrderSuccess(); Shop.scrollToTrack('${Utils.escapeAttr(order.track_id)}');"><i class="fas fa-map-marker-alt"></i> Track Order</button>
        </div>
      </div>`;

    Utils.$('#orderSuccessOverlay')?.classList.add('active');
  }

  function closeOrderSuccess() {
    Utils.$('#orderSuccessOverlay')?.classList.remove('active');
  }

  function copyTrackId(id) {
    navigator.clipboard.writeText(id).then(() => Utils.showToast('Tracking ID copied!', 'success')).catch(() => prompt('Copy your Tracking ID:', id));
  }

  function scrollToTrack(trackId) {
    document.getElementById('track')?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => {
      const input = Utils.$('#trackOrderId');
      if (input) input.value = trackId;
      trackOrder();
    }, 600);
  }

  // ─── Order Tracking ──────────────────────────────────────────────────────

  async function trackOrder() {
    const input = Utils.$('#trackOrderId')?.value.trim();
    if (!input) { Utils.showToast('Please enter your Tracking ID.', 'error'); return; }

    const { ok, data } = await Api.get(`/orders/track/${encodeURIComponent(input)}`);
    const resultDiv = Utils.$('#trackResult');
    if (!resultDiv) return;

    if (!ok) {
      resultDiv.innerHTML = `<div style="text-align:center;padding:24px;"><i class="fas fa-exclamation-circle" style="font-size:2rem;color:#C62828;margin-bottom:12px;display:block;"></i><p style="color:#C62828;font-weight:500;">${Utils.escapeHtml(Utils.extractError(data))}</p></div>`;
      resultDiv.classList.add('active');
      return;
    }

    const statusOrder = ['pending', 'confirmed', 'shipped', 'delivered'];
    const currentIndex = statusOrder.indexOf(data.status);
    const isCancelled = data.status === 'cancelled';

    resultDiv.innerHTML = `
      <div style="margin-top:24px;border-top:1px solid #eee;padding-top:24px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <span style="background:var(--gold-light);color:var(--primary-dark);padding:6px 14px;border-radius:50px;font-size:0.85rem;font-weight:600;">Tracking: ${Utils.escapeHtml(data.track_id)}</span>
          <span style="color:#666;font-size:0.85rem;">Placed: ${Utils.formatDate(data.created_at)}</span>
        </div>
        ${isCancelled ? `<div style="background:#FFEBEE;border-radius:12px;padding:16px;text-align:center;margin-bottom:20px;"><p style="color:#C62828;font-weight:600;">This order has been cancelled</p></div>` : `
          <div class="order-timeline">
            ${statusOrder.map((s, i) => `<div class="timeline-step ${i <= currentIndex ? 'active' : ''} ${i === currentIndex ? 'current' : ''}"><div class="timeline-dot"><i class="fas fa-${['check', 'clipboard-check', 'shipping-fast', 'home'][i]}"></i></div><span class="timeline-label">${['Placed', 'Confirmed', 'Shipped', 'Delivered'][i]}</span></div>`).join('')}
          </div>`}
        <div class="order-info-section">
          <h4><i class="fas fa-map-marker-alt"></i> Delivery Address</h4>
          <div class="delivery-info-card">
            <div class="info-row"><span class="label">Name</span><span class="value">${Utils.escapeHtml(data.customer_name)}</span></div>
            <div class="info-row"><span class="label">Phone</span><span class="value">${Utils.escapeHtml(data.customer_phone)}</span></div>
            <div class="info-row"><span class="label">Address</span><span class="value">${Utils.escapeHtml(data.customer_address)}</span></div>
          </div>
        </div>
        <div class="order-info-section">
          <h4><i class="fas fa-shopping-bag"></i> Items</h4>
          <div class="order-items-card">
            ${data.items && data.items.length > 0 ? data.items.map((i) => `
              <div class="order-item-row">
                <img src="${resolveImageUrl(i.image_url)}" alt="${Utils.escapeAttr(i.product_name)}" onerror="this.src='https://via.placeholder.com/50?text=Item'">
                <div class="item-details"><div class="item-name">${Utils.escapeHtml(i.product_name)}</div><div class="item-qty">Qty: ${i.quantity}</div></div>
                <div class="item-price">${Utils.formatCurrency(i.price * i.quantity)}</div>
              </div>`).join('') : '<p style="color:#999;">Items info not available</p>'}
          </div>
        </div>
        <div class="order-info-section">
          <h4><i class="fas fa-receipt"></i> Total</h4>
          <div class="price-summary"><div class="summary-row total"><span>Amount</span><span>${Utils.formatCurrency(data.total_amount)}</span></div></div>
        </div>
      </div>`;
    resultDiv.classList.add('active');
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function resolveImageUrl(url) {
    if (!url) return 'https://via.placeholder.com/400x500?text=Saree';
    if (url.startsWith('http')) return url;
    return CONFIG.API_BASE + url;
  }

  function toggleMobileMenu() {
    const links = Utils.$('.nav-links');
    if (!links) return;
    const isOpen = links.style.display === 'flex';
    links.style.display = isOpen ? 'none' : 'flex';
    if (!isOpen) {
      links.style.position = 'absolute';
      links.style.top = '100%';
      links.style.left = '0';
      links.style.right = '0';
      links.style.background = 'white';
      links.style.flexDirection = 'column';
      links.style.padding = '20px';
      links.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
      links.style.gap = '16px';
    }
  }

  function validatePhone(input) {
    const phone = input.value.replace(/[\s\-\(\)]/g, '');
    const help = Utils.$('#phoneHelp');
    if (!help) return;
    if (phone.length === 0) { help.textContent = 'Enter 10-digit Indian mobile number'; help.style.color = '#666'; }
    else if (Utils.isValidPhone(phone)) { help.textContent = '✓ Valid phone number'; help.style.color = '#2E7D32'; }
    else if (phone.length < 10) { help.textContent = `${10 - phone.length} more digits needed`; help.style.color = '#E65100'; }
    else { help.textContent = '✗ Invalid. Must start with 6-9, 10 digits'; help.style.color = '#C62828'; }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  return {
    init,
    filterByTab,
    filterByFabric,
    filterProducts,
    onColorFilterChange,
    viewProduct,
    closeProductModal,
    slideImage,
    switchDetailColor,
    switchCardColor,
    addToCart,
    updateQty,
    removeFromCart,
    openCart,
    closeCart,
    openCheckout,
    closeCheckout,
    placeOrder,
    closeOrderSuccess,
    copyTrackId,
    scrollToTrack,
    trackOrder,
    toggleMobileMenu,
    validatePhone,
    updateCartUI,
  };
})();
