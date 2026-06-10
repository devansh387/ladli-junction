// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});

// ===== API HELPER =====
async function api(url, options = {}) {
  const res = await fetch(url, options);
  return res.json();
}

// ===== AUTH =====
async function checkAuth() {
  const result = await api('/api/admin/status');
  if (result.isAdmin) {
    showDashboard();
  }
}

async function login(e) {
  e.preventDefault();
  const username = document.getElementById('loginUser').value;
  const password = document.getElementById('loginPass').value;

  const result = await api('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (result.success) {
    showDashboard();
  } else {
    document.getElementById('loginError').textContent = result.error || 'Login failed';
  }
}

async function logout() {
  await api('/api/admin/logout', { method: 'POST' });
  document.getElementById('adminDashboard').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'flex';
  loadStats();
  loadAdminProducts();
  loadAdminOrders();
  loadAdminCategories();
}

// ===== NAVIGATION =====
function showSection(name) {
  // Hide all sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target
  document.getElementById(`sec-${name}`).classList.add('active');
  event.currentTarget.classList.add('active');
}

// ===== DASHBOARD STATS =====
async function loadStats() {
  const stats = await api('/api/admin/stats');
  document.getElementById('statProducts').textContent = stats.totalProducts;
  document.getElementById('statOrders').textContent = stats.totalOrders;
  document.getElementById('statPending').textContent = stats.pendingOrders;
  document.getElementById('statRevenue').textContent = `₹${Number(stats.totalRevenue).toLocaleString()}`;
}

// ===== PRODUCTS =====
async function loadAdminProducts() {
  const products = await api('/api/admin/products');
  const tbody = document.getElementById('productsTable');

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#999;">No products yet. Add your first product!</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td><img src="${p.image_url || 'https://via.placeholder.com/50?text=No+Img'}" alt="${p.name}"></td>
      <td>
        <strong>${p.name}</strong>
        ${p.colors ? `<div style="display:flex;gap:3px;margin-top:4px;">${p.colors.split(',').slice(0,5).map(c => { const hex = c.trim().split(':')[1] || c.trim(); return `<span style="width:12px;height:12px;border-radius:50%;background:${hex};display:inline-block;box-shadow:0 0 0 1px rgba(0,0,0,0.15);"></span>`; }).join('')}</div>` : ''}
      </td>
      <td>${p.category_name || '-'}</td>
      <td>₹${Number(p.price).toLocaleString()}</td>
      <td>${p.stock}</td>
      <td>${p.featured ? '⭐' : '-'}</td>
      <td>
        <div class="action-btns">
          <button class="btn-sm btn-edit" onclick="editProduct(${p.id})"><i class="fas fa-edit"></i></button>
          <button class="btn-sm btn-delete" onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openProductForm() {
  document.getElementById('productFormTitle').textContent = 'Add Product';
  document.getElementById('productForm').reset();
  document.getElementById('editProductId').value = '';
  document.getElementById('colorUploadArea').style.display = 'none';
  document.getElementById('colorImagePreview').innerHTML = '';
  colorVariants = [];
  currentEditColor = null;
  pendingFiles = [];
  loadCategoryOptions();
  renderVariantsList();
  document.getElementById('productFormModal').classList.add('active');
}

function closeProductForm() {
  document.getElementById('productFormModal').classList.remove('active');
}

async function loadCategoryOptions() {
  const cats = await api('/api/admin/categories');
  const mainCats = cats.filter(c => !c.parent_id);
  const subCats = cats.filter(c => c.parent_id);

  const container = document.getElementById('categoryCheckboxes');
  container.innerHTML = mainCats.map(main => {
    const children = subCats.filter(s => s.parent_id === main.id);
    return `
      <div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #f0f0f0;">
        <label style="display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:0.85rem;cursor:pointer;margin-bottom:6px;">
          <input type="checkbox" class="cat-main-cb" value="${main.id}" onchange="toggleSubCats(${main.id})" style="width:16px;height:16px;accent-color:#1A1A1A;"> ${main.name}
        </label>
        <div id="subs-${main.id}" style="display:none;padding:4px 0 0 24px;display:none;flex-wrap:wrap;gap:6px 16px;">
          ${children.map(c => `
            <label style="display:inline-flex;align-items:center;gap:5px;font-size:0.78rem;color:#555;cursor:pointer;min-width:100px;">
              <input type="checkbox" class="cat-sub-cb" value="${c.id}" data-parent="${main.id}" style="width:14px;height:14px;accent-color:#555;"> ${c.name}
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Render admin color picker
  renderAdminColorPicker();
}

function toggleSubCats(mainId) {
  const subsDiv = document.getElementById('subs-' + mainId);
  const mainCb = document.querySelector(`.cat-main-cb[value="${mainId}"]`);
  if (mainCb.checked) {
    subsDiv.style.display = 'flex';
  } else {
    subsDiv.style.display = 'none';
    // Uncheck all subs when main is unchecked
    subsDiv.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
  }
}

function getSelectedCategories() {
  const mains = Array.from(document.querySelectorAll('.cat-main-cb:checked')).map(cb => Number(cb.value));
  const subs = Array.from(document.querySelectorAll('.cat-sub-cb:checked')).map(cb => Number(cb.value));
  return { mains, subs, all: [...mains, ...subs] };
}

let adminSelectedColors = [];

function renderAdminColorPicker() {
  const container = document.getElementById('adminColorPicker');
  const palette = ColorPalette.PALETTE;
  container.innerHTML = palette.map(c => {
    const isAdded = colorVariants.some(v => v.hex === c.hex);
    return `<span 
      style="width:26px;height:26px;border-radius:50%;background:${c.hex};cursor:pointer;display:inline-flex;align-items:center;justify-content:center;border:2px solid ${isAdded ? '#1A1A1A' : 'transparent'};box-shadow:0 0 0 1px rgba(0,0,0,0.1);transition:all 0.2s;"
      title="${c.name}${isAdded ? ' (added)' : ' — click to add'}"
      onclick="selectColorForUpload('${c.name}','${c.hex}')"
    >${isAdded ? '<i class="fas fa-check" style="font-size:0.5rem;color:white;text-shadow:0 1px 2px rgba(0,0,0,0.5);"></i>' : ''}</span>`;
  }).join('');
}

// Color variants: [{name, hex, images: [File,...], existingImages: [url,...]}]
let colorVariants = [];
let currentEditColor = null;

function selectColorForUpload(name, hex) {
  currentEditColor = { name, hex };
  
  // Show upload area
  document.getElementById('colorUploadArea').style.display = 'block';
  document.getElementById('currentColorDot').style.background = hex;
  document.getElementById('currentColorName').textContent = name;
  document.getElementById('colorImagePreview').innerHTML = '';
  document.getElementById('colorImages').value = '';

  // If this color already has images, show them
  const existing = colorVariants.find(v => v.hex === hex);
  if (existing) {
    const preview = document.getElementById('colorImagePreview');
    (existing.existingImages || []).forEach((url, i) => {
      addImagePreviewToColor(preview, url, null, i);
    });
  }
}

function addImagePreviewToColor(container, src, file, index) {
  const div = document.createElement('div');
  div.style.cssText = 'position:relative;display:inline-block;';
  div.innerHTML = `
    <img src="${src}" style="width:55px;height:55px;object-fit:cover;border-radius:4px;border:1px solid #ddd;">
    <button type="button" style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;background:#C62828;color:white;border:none;border-radius:50%;font-size:0.5rem;cursor:pointer;">✗</button>
  `;
  div.querySelector('button').onclick = () => div.remove();
  container.appendChild(div);
}

// Handle file selection for current color
document.addEventListener('change', (e) => {
  if (e.target.id === 'colorImages' && currentEditColor) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const preview = document.getElementById('colorImagePreview');

    // Find or create variant
    let variant = colorVariants.find(v => v.hex === currentEditColor.hex);
    if (!variant) {
      variant = { name: currentEditColor.name, hex: currentEditColor.hex, files: [], existingImages: [] };
      colorVariants.push(variant);
    }

    files.forEach(file => {
      if (file.size > 20 * 1024 * 1024) { showToast('File too large (max 20MB)', 'error'); return; }
      variant.files.push(file);
      const reader = new FileReader();
      reader.onload = (ev) => addImagePreviewToColor(preview, ev.target.result, file, variant.files.length - 1);
      reader.readAsDataURL(file);
    });

    e.target.value = '';
    renderAdminColorPicker();
    renderVariantsList();
  }
});

function renderVariantsList() {
  const container = document.getElementById('variantsList');
  if (colorVariants.length === 0) {
    container.innerHTML = '<p style="font-size:0.75rem;color:#999;">No color variants added yet</p>';
    return;
  }
  container.innerHTML = colorVariants.map((v, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f0f0;">
      <span style="width:18px;height:18px;border-radius:50%;background:${v.hex};box-shadow:0 0 0 1px rgba(0,0,0,0.15);"></span>
      <span style="font-size:0.8rem;font-weight:500;">${v.name}</span>
      <span style="font-size:0.7rem;color:#999;">${(v.files || []).length + (v.existingImages || []).length} image(s)</span>
      <button type="button" onclick="removeVariant(${i})" style="margin-left:auto;background:#FFEBEE;border:none;color:#C62828;padding:4px 8px;border-radius:4px;font-size:0.65rem;cursor:pointer;">Remove</button>
    </div>
  `).join('');
}

function removeVariant(index) {
  colorVariants.splice(index, 1);
  renderAdminColorPicker();
  renderVariantsList();
}

function toggleAdminColor(name, hex) {
  selectColorForUpload(name, hex);
}

async function editProduct(id) {
  const products = await api('/api/admin/products');
  const p = products.find(prod => prod.id === id);
  if (!p) return;

  await loadCategoryOptions();

  document.getElementById('productFormTitle').textContent = 'Edit Product';
  document.getElementById('editProductId').value = p.id;
  document.getElementById('pName').value = p.name;
  document.getElementById('pDesc').value = p.description || '';
  document.getElementById('pPrice').value = p.price;
  document.getElementById('pOrigPrice').value = p.original_price || '';
  
  // Check the right category checkboxes
  setTimeout(() => {
    // Check main category
    if (p.category_id) {
      const mainCb = document.querySelector(`.cat-main-cb[value="${p.category_id}"]`);
      if (mainCb) { mainCb.checked = true; toggleSubCats(p.category_id); }
    }
    // Check sub-category
    if (p.sub_category_id) {
      const subCb = document.querySelector(`.cat-sub-cb[value="${p.sub_category_id}"]`);
      if (subCb) { subCb.checked = true; }
    }
  }, 100);
  
  document.getElementById('pStock').value = p.stock;
  document.getElementById('pTags').value = p.tags || '';
  document.getElementById('pFeatured').checked = !!p.featured;

  // Parse existing color variants
  colorVariants = [];
  currentEditColor = null;
  if (p.color_variants) {
    try {
      const variants = JSON.parse(p.color_variants);
      colorVariants = variants.map(v => ({ name: v.name, hex: v.hex, files: [], existingImages: v.images || [] }));
    } catch (e) {}
  } else if (p.colors) {
    p.colors.split(',').forEach(c => {
      const parts = c.trim().split(':');
      if (parts.length === 2) colorVariants.push({ name: parts[0].trim(), hex: parts[1].trim(), files: [], existingImages: [] });
    });
  }
  renderAdminColorPicker();
  renderVariantsList();
  document.getElementById('colorUploadArea').style.display = 'none';
  document.getElementById('colorImagePreview').innerHTML = '';

  document.getElementById('productFormModal').classList.add('active');
}

async function saveProduct(e) {
  e.preventDefault();

  const editId = document.getElementById('editProductId').value;
  const formData = new FormData();

  formData.append('name', document.getElementById('pName').value);
  formData.append('description', document.getElementById('pDesc').value);
  formData.append('price', document.getElementById('pPrice').value);
  formData.append('original_price', document.getElementById('pOrigPrice').value);
  
  // Categories from checkboxes
  const cats = getSelectedCategories();
  formData.append('category_id', cats.mains[0] || '');
  formData.append('sub_category_id', cats.subs[0] || '');
  formData.append('categories', JSON.stringify(cats.all));
  
  formData.append('stock', document.getElementById('pStock').value);
  formData.append('featured', document.getElementById('pFeatured').checked ? '1' : '');
  formData.append('tags', document.getElementById('pTags').value);

  // Build color variants metadata (without files — files sent separately)
  const variantsMeta = colorVariants.map(v => ({
    name: v.name,
    hex: v.hex,
    existingImages: v.existingImages || [],
    fileCount: (v.files || []).length
  }));
  formData.append('color_variants_meta', JSON.stringify(variantsMeta));

  // Also build old-format colors for backwards compat
  formData.append('colors', colorVariants.map(v => `${v.name}:${v.hex}`).join(', '));

  // Append all image files (in order: variant0-files, variant1-files, etc.)
  for (const variant of colorVariants) {
    for (const file of (variant.files || [])) {
      formData.append('images', file);
    }
  }

  const url = editId ? `/api/admin/products/${editId}` : '/api/admin/products';
  const method = editId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, { method, body: formData });
    const result = await res.json();

    if (result.success || result.id) {
      closeProductForm();
      loadAdminProducts();
      loadStats();
      showToast(editId ? 'Product updated!' : 'Product added!', 'success');
    } else {
      showToast(result.error || 'Failed to save product', 'error');
    }
  } catch (err) {
    showToast('Network error. Please try again.', 'error');
  }
}

async function deleteProduct(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

  const result = await api(`/api/admin/products/${id}`, { method: 'DELETE' });
  if (result.success) {
    loadAdminProducts();
    loadStats();
    showToast('Product deleted', 'success');
  }
}

// ===== ORDERS =====
async function loadAdminOrders() {
  const orders = await api('/api/admin/orders');
  const tbody = document.getElementById('ordersTable');

  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#999;">No orders yet.</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><strong>${o.track_id || '#' + o.id}</strong></td>
      <td>${o.customer_name}</td>
      <td>${o.customer_phone}</td>
      <td>₹${Number(o.total_amount).toLocaleString()}</td>
      <td><span class="status-badge status-${o.status}">${o.status}</span></td>
      <td>${new Date(o.created_at).toLocaleDateString()}</td>
      <td>
        <div class="action-btns">
          <button class="btn-sm btn-view" onclick="viewOrder(${o.id})" title="View"><i class="fas fa-eye"></i></button>
          <button class="btn-sm btn-edit" onclick="window.open('/api/bill/generate/${o.track_id || o.id}', '_blank')" title="Download Bill"><i class="fas fa-file-invoice"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function viewOrder(id) {
  const order = await api(`/api/admin/orders/${id}`);
  if (order.error) { showToast(order.error, 'error'); return; }
  const content = document.getElementById('orderDetailContent');

  content.innerHTML = `
    <div class="order-detail-grid">
      <div class="info-row"><span class="label">Tracking ID</span><span class="value"><strong>${order.track_id || '#' + order.id}</strong></span></div>
      <div class="info-row"><span class="label">Customer</span><span class="value">${order.customer_name}</span></div>
      <div class="info-row"><span class="label">Phone</span><span class="value">${order.customer_phone}</span></div>
      <div class="info-row"><span class="label">Email</span><span class="value">${order.customer_email || '-'}</span></div>
      <div class="info-row"><span class="label">Address</span><span class="value">${order.customer_address}</span></div>
      <div class="info-row"><span class="label">Notes</span><span class="value">${order.notes || '-'}</span></div>
      <div class="info-row"><span class="label">Total</span><span class="value" style="font-weight:700;color:var(--primary);">₹${Number(order.total_amount).toLocaleString()}</span></div>
      <div class="info-row"><span class="label">Date</span><span class="value">${new Date(order.created_at).toLocaleString()}</span></div>
      <div class="info-row"><span class="label">Status</span><span class="value"><span class="status-badge status-${order.status}">${order.status}</span></span></div>
    </div>
    <div class="order-items-list">
      <h4>Items Ordered:</h4>
      ${order.items && order.items.length > 0 ? order.items.map(i => `
        <div class="order-item-row">
          <img src="${i.image_url || 'https://via.placeholder.com/40?text=Item'}" alt="">
          <span style="flex:1;">${i.product_name}</span>
          <span>x${i.quantity}</span>
          <span style="font-weight:600;">₹${(i.price * i.quantity).toLocaleString()}</span>
        </div>
      `).join('') : '<p style="color:#999;">No items data</p>'}
    </div>
    <div style="margin-top:16px;">
      <label style="font-size:0.8rem;font-weight:600;display:block;margin-bottom:6px;">Change Status:</label>
      <select class="status-select" onchange="updateOrderStatus(${order.id}, this.value)" style="width:100%;padding:10px;border:2px solid #eee;border-radius:8px;font-size:0.9rem;cursor:pointer;">
        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
        <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
        <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
        <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
      </select>
    </div>
  `;

  document.getElementById('orderDetailModal').classList.add('active');
}

function closeOrderDetail() {
  document.getElementById('orderDetailModal').classList.remove('active');
}

async function updateOrderStatus(id, status) {
  const result = await api(`/api/admin/orders/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });

  if (result.success) {
    loadAdminOrders();
    loadStats();
    showToast(`Order #${id} marked as ${status}`, 'success');
  }
}

// ===== CATEGORIES =====
let allAdminCategories = [];

async function loadAdminCategories() {
  allAdminCategories = await api('/api/admin/categories');
  const tbody = document.getElementById('categoriesTable');

  const mainCats = allAdminCategories.filter(c => !c.parent_id);
  const subCats = allAdminCategories.filter(c => c.parent_id);

  let html = '';

  // Show main categories first
  mainCats.forEach(c => {
    const children = subCats.filter(s => s.parent_id === c.id);
    html += `
      <tr style="background:#f9f9f9;">
        <td>${c.id}</td>
        <td><strong>${c.name}</strong></td>
        <td><span style="background:#E3F2FD;color:#1565C0;padding:2px 8px;border-radius:4px;font-size:0.7rem;">Main</span></td>
        <td>—</td>
        <td><button class="btn-sm btn-delete" onclick="deleteCategory(${c.id}, '${c.name.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button></td>
      </tr>
    `;
    // Show its sub-categories indented
    children.forEach(s => {
      html += `
        <tr>
          <td>${s.id}</td>
          <td style="padding-left:24px;">↳ ${s.name}</td>
          <td><span style="background:#FFF3E0;color:#E65100;padding:2px 8px;border-radius:4px;font-size:0.7rem;">Sub</span></td>
          <td>${c.name}</td>
          <td><button class="btn-sm btn-delete" onclick="deleteCategory(${s.id}, '${s.name.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button></td>
        </tr>
      `;
    });
  });

  tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center;padding:20px;color:#999;">No categories</td></tr>';
}

function openCategoryForm() {
  // Populate parent dropdown with main categories only (those without a parent)
  const select = document.getElementById('catParent');
  select.innerHTML = '<option value="">— None (Main Category) —</option>';
  allAdminCategories.forEach(c => {
    // Only show categories that have NO parent (main ones)
    if (!c.parent_id && c.parent_id !== 0) {
      select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    }
  });
  document.getElementById('catName').value = '';
  document.getElementById('catDesc').value = '';
  document.getElementById('categoryFormModal').classList.add('active');
}

function closeCategoryForm() {
  document.getElementById('categoryFormModal').classList.remove('active');
}

async function saveCategory(e) {
  e.preventDefault();

  const result = await api('/api/admin/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: document.getElementById('catName').value,
      description: document.getElementById('catDesc').value,
      parent_id: document.getElementById('catParent').value || null
    })
  });

  if (result.success) {
    closeCategoryForm();
    await loadAdminCategories();
    document.getElementById('catName').value = '';
    document.getElementById('catDesc').value = '';
    document.getElementById('catParent').value = '';
    showToast('Category added!', 'success');
  } else {
    showToast(result.error || 'Failed to add category', 'error');
  }
}

async function deleteCategory(id, name) {
  if (!confirm(`Delete category "${name}"?`)) return;
  const result = await api(`/api/admin/categories/${id}`, { method: 'DELETE' });
  if (result.success) {
    loadAdminCategories();
    showToast('Category deleted', 'success');
  }
}

// ===== CHANGE PASSWORD =====
async function changePassword(e) {
  e.preventDefault();

  const result = await api('/api/admin/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentPassword: document.getElementById('currentPass').value,
      newPassword: document.getElementById('newPass').value
    })
  });

  if (result.success) {
    showToast('Password changed successfully!', 'success');
    document.getElementById('currentPass').value = '';
    document.getElementById('newPass').value = '';
  } else {
    showToast(result.error || 'Failed to change password', 'error');
  }
}

// ===== HERO MEDIA =====
async function uploadHeroMedia(e) {
  e.preventDefault();
  const file = document.getElementById('heroFile').files[0];
  if (!file) { showToast('Select a file', 'error'); return; }

  const formData = new FormData();
  formData.append('heroFile', file);

  try {
    const res = await fetch('/api/admin/hero-media', { method: 'POST', body: formData });
    const result = await res.json();
    if (result.success) {
      showToast('Hero media updated!', 'success');
      document.getElementById('heroForm').reset();
    } else {
      showToast(result.error || 'Upload failed', 'error');
    }
  } catch (err) {
    showToast('Upload failed', 'error');
  }
}

// ===== BILL GENERATION =====
function generateOrderBill() {
  const trackId = document.getElementById('billTrackId').value.trim();
  if (!trackId) { showToast('Enter a tracking ID', 'error'); return; }
  window.open(`/api/bill/generate/${encodeURIComponent(trackId)}`, '_blank');
}

function addBillItem() {
  const container = document.getElementById('billItems');
  const row = document.createElement('div');
  row.className = 'bill-item-row';
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center;';
  row.innerHTML = `
    <input type="text" placeholder="Item name" class="bill-item-name" style="flex:2;padding:8px 12px;border:2px solid #eee;border-radius:6px;font-size:0.85rem;">
    <input type="number" placeholder="Qty" class="bill-item-qty" min="1" value="1" style="width:60px;padding:8px;border:2px solid #eee;border-radius:6px;font-size:0.85rem;text-align:center;">
    <input type="number" placeholder="Price" class="bill-item-price" min="1" style="width:100px;padding:8px;border:2px solid #eee;border-radius:6px;font-size:0.85rem;">
    <button type="button" onclick="this.parentElement.remove()" style="background:#FFEBEE;border:none;color:#C62828;padding:8px 10px;border-radius:6px;cursor:pointer;font-size:0.8rem;">✗</button>
  `;
  container.appendChild(row);
}

async function generateManualBill(e) {
  e.preventDefault();

  const names = document.querySelectorAll('.bill-item-name');
  const qtys = document.querySelectorAll('.bill-item-qty');
  const prices = document.querySelectorAll('.bill-item-price');

  const items = [];
  names.forEach((el, i) => {
    if (el.value.trim() && prices[i].value) {
      items.push({ name: el.value.trim(), qty: Number(qtys[i].value) || 1, price: Number(prices[i].value) });
    }
  });

  if (items.length === 0) { showToast('Add at least one item', 'error'); return; }

  const data = {
    customer_name: document.getElementById('billCustName').value,
    customer_phone: document.getElementById('billCustPhone').value,
    customer_address: document.getElementById('billCustAddress').value,
    notes: document.getElementById('billNotes').value,
    items
  };

  // POST and download PDF
  const res = await fetch('/api/bill/manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Bill.pdf';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Bill generated!', 'success');
  } else {
    const err = await res.json();
    showToast(err.error || 'Failed to generate bill', 'error');
  }
}

// ===== TOAST =====
function showToast(message, type = '') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('active'), 50);
  setTimeout(() => {
    toast.classList.remove('active');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}
