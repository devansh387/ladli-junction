'use strict';

/**
 * Admin Module
 * Handles the admin panel: dashboard stats, product CRUD, order management,
 * categories, settings, hero media, bill generation.
 * All data goes through the backend API — no direct DB access.
 */

// ─── Color Palette Data (used for product color variant picker) ────────────
const COLOR_PALETTE = [
  { name: 'Red', hex: '#D32F2F' }, { name: 'Dark Red', hex: '#8B0000' },
  { name: 'Maroon', hex: '#800020' }, { name: 'Wine', hex: '#722F37' },
  { name: 'Pink', hex: '#E91E8C' }, { name: 'Light Pink', hex: '#F8BBD0' },
  { name: 'Magenta', hex: '#C2185B' }, { name: 'Orange', hex: '#E65100' },
  { name: 'Peach', hex: '#FFAB91' }, { name: 'Rust', hex: '#A0522D' },
  { name: 'Yellow', hex: '#F9A825' }, { name: 'Mustard', hex: '#C6951C' },
  { name: 'Gold', hex: '#B8860B' }, { name: 'Green', hex: '#2E7D32' },
  { name: 'Light Green', hex: '#81C784' }, { name: 'Olive', hex: '#6B8E23' },
  { name: 'Teal', hex: '#00897B' }, { name: 'Sky Blue', hex: '#64B5F6' },
  { name: 'Blue', hex: '#1565C0' }, { name: 'Navy', hex: '#0D1B3E' },
  { name: 'Purple', hex: '#6A1B9A' }, { name: 'Lavender', hex: '#B39DDB' },
  { name: 'Brown', hex: '#5D4037' }, { name: 'Copper', hex: '#B87333' },
  { name: 'Beige', hex: '#D7CCC8' }, { name: 'Cream', hex: '#FFF8E1' },
  { name: 'White', hex: '#FFFFFF' }, { name: 'Silver', hex: '#C0C0C0' },
  { name: 'Grey', hex: '#757575' }, { name: 'Black', hex: '#212121' },
];

const Admin = (() => {
  let allAdminCategories = [];

  // ─── Initialization ──────────────────────────────────────────────────────

  async function init() {
    const loggedIn = await Api.init();
    if (!loggedIn || !Api.isAdmin()) {
      window.location.href = '/account.html';
      return;
    }
    showDashboard();
  }

  function showDashboard() {
    Utils.$('#loginScreen').style.display = 'none';
    Utils.$('#adminDashboard').style.display = 'flex';
    loadStats();
    loadAdminProducts();
    loadAdminOrders();
    loadAdminCategories();
  }

  async function logout() {
    await Api.logout();
    window.location.href = '/account.html';
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  function showSection(name) {
    Utils.$$('.section').forEach((s) => s.classList.remove('active'));
    Utils.$$('.nav-item').forEach((n) => n.classList.remove('active'));
    const section = Utils.$(`#sec-${name}`);
    if (section) section.classList.add('active');
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
  }

  // ─── Dashboard Stats ─────────────────────────────────────────────────────

  async function loadStats() {
    const { ok, data } = await Api.get('/admin/stats', true);
    if (!ok) return;
    Utils.$('#statProducts').textContent = data.totalProducts;
    Utils.$('#statOrders').textContent = data.totalOrders;
    Utils.$('#statPending').textContent = data.pendingOrders;
    Utils.$('#statRevenue').textContent = Utils.formatCurrency(data.totalRevenue);
  }

  // ─── Products ────────────────────────────────────────────────────────────

  async function loadAdminProducts() {
    const { ok, data } = await Api.get('/admin/products', true);
    const tbody = Utils.$('#productsTable');
    if (!tbody) return;

    if (!ok || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#999;">No products yet. Add your first product!</td></tr>';
      return;
    }

    tbody.innerHTML = data.map((p) => {
      const colors = p.colors ? p.colors.split(',').slice(0, 5) : [];
      return `
        <tr>
          <td><img src="${resolveImg(p.image_url)}" alt="${Utils.escapeAttr(p.name)}" onerror="this.src='https://via.placeholder.com/50?text=Img'"></td>
          <td>
            <strong>${Utils.escapeHtml(p.name)}</strong>
            ${colors.length > 0 ? `<div style="display:flex;gap:3px;margin-top:4px;">${colors.map((c) => { const hex = c.trim().split(':')[1] || c.trim(); return `<span style="width:12px;height:12px;border-radius:50%;background:${hex};display:inline-block;box-shadow:0 0 0 1px rgba(0,0,0,0.15);"></span>`; }).join('')}</div>` : ''}
          </td>
          <td>${Utils.escapeHtml(p.category_name || '-')}</td>
          <td>${Utils.formatCurrency(p.price)}</td>
          <td>${p.stock}</td>
          <td>${p.featured ? '⭐' : '-'}</td>
          <td>
            <div class="action-btns">
              <button class="btn-sm btn-edit" onclick="Admin.editProduct(${p.id})"><i class="fas fa-edit"></i></button>
              <button class="btn-sm btn-delete" onclick="Admin.deleteProduct(${p.id}, '${Utils.escapeAttr(p.name)}')"><i class="fas fa-trash"></i></button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  function openProductForm() {
    Utils.$('#productFormTitle').textContent = 'Add Product';
    Utils.$('#productForm').reset();
    Utils.$('#editProductId').value = '';
    Utils.$('#colorUploadArea').style.display = 'none';
    Utils.$('#colorImagePreview').innerHTML = '';
    colorVariants = [];
    currentEditColor = null;
    loadCategoryOptions();
    renderVariantsList();
    Utils.$('#productFormModal').classList.add('active');
  }

  function closeProductForm() {
    Utils.$('#productFormModal').classList.remove('active');
  }

  async function loadCategoryOptions() {
    const { ok, data } = await Api.get('/admin/categories', true);
    if (!ok) return;
    const cats = data;
    const mainCats = cats.filter((c) => !c.parent_id);
    const subCats = cats.filter((c) => c.parent_id);

    const container = Utils.$('#categoryCheckboxes');
    if (!container) return;

    container.innerHTML = mainCats.map((main) => {
      const children = subCats.filter((s) => s.parent_id === main.id);
      return `
        <div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #f0f0f0;">
          <label style="display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:0.85rem;cursor:pointer;margin-bottom:6px;">
            <input type="checkbox" class="cat-main-cb" value="${main.id}" onchange="Admin.toggleSubCats(${main.id})" style="width:16px;height:16px;accent-color:#1A1A1A;"> ${Utils.escapeHtml(main.name)}
          </label>
          <div id="subs-${main.id}" style="display:none;padding:4px 0 0 24px;flex-wrap:wrap;gap:6px 16px;">
            ${children.map((c) => `
              <label style="display:inline-flex;align-items:center;gap:5px;font-size:0.78rem;color:#555;cursor:pointer;min-width:100px;">
                <input type="checkbox" class="cat-sub-cb" value="${c.id}" data-parent="${main.id}" style="width:14px;height:14px;accent-color:#555;"> ${Utils.escapeHtml(c.name)}
              </label>`).join('')}
          </div>
        </div>`;
    }).join('');

    renderAdminColorPicker();
  }

  function toggleSubCats(mainId) {
    const subsDiv = Utils.$('#subs-' + mainId);
    const mainCb = Utils.$(`.cat-main-cb[value="${mainId}"]`);
    if (mainCb && mainCb.checked) {
      subsDiv.style.display = 'flex';
    } else {
      subsDiv.style.display = 'none';
      subsDiv.querySelectorAll('input[type=checkbox]').forEach((cb) => cb.checked = false);
    }
  }

  function getSelectedCategories() {
    const mains = Array.from(Utils.$$('.cat-main-cb:checked')).map((cb) => Number(cb.value));
    const subs = Array.from(Utils.$$('.cat-sub-cb:checked')).map((cb) => Number(cb.value));
    return { mains, subs, all: [...mains, ...subs] };
  }

  // ─── Color Variants ──────────────────────────────────────────────────────

  let colorVariants = [];
  let currentEditColor = null;

  function renderAdminColorPicker() {
    const container = Utils.$('#adminColorPicker');
    if (!container) return;
    const palette = COLOR_PALETTE;
    container.innerHTML = palette.map((c) => {
      const isAdded = colorVariants.some((v) => v.hex === c.hex);
      return `<span style="width:26px;height:26px;border-radius:50%;background:${c.hex};cursor:pointer;display:inline-flex;align-items:center;justify-content:center;border:2px solid ${isAdded ? '#1A1A1A' : 'transparent'};box-shadow:0 0 0 1px rgba(0,0,0,0.1);transition:all 0.2s;" title="${Utils.escapeAttr(c.name)}${isAdded ? ' (added)' : ''}" onclick="Admin.selectColorForUpload('${Utils.escapeAttr(c.name)}','${c.hex}')">${isAdded ? '<i class="fas fa-check" style="font-size:0.5rem;color:white;text-shadow:0 1px 2px rgba(0,0,0,0.5);"></i>' : ''}</span>`;
    }).join('');
  }

  function selectColorForUpload(name, hex) {
    currentEditColor = { name, hex };
    Utils.$('#colorUploadArea').style.display = 'block';
    Utils.$('#currentColorDot').style.background = hex;
    Utils.$('#currentColorName').textContent = name;
    Utils.$('#colorImagePreview').innerHTML = '';
    Utils.$('#colorImages').value = '';
  }

  function renderVariantsList() {
    const container = Utils.$('#variantsList');
    if (!container) return;
    if (colorVariants.length === 0) {
      container.innerHTML = '<p style="font-size:0.75rem;color:#999;">No color variants added yet</p>';
      return;
    }
    container.innerHTML = colorVariants.map((v, i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f0f0;">
        <span style="width:18px;height:18px;border-radius:50%;background:${v.hex};box-shadow:0 0 0 1px rgba(0,0,0,0.15);"></span>
        <span style="font-size:0.8rem;font-weight:500;">${Utils.escapeHtml(v.name)}</span>
        <span style="font-size:0.7rem;color:#999;">${(v.files || []).length + (v.existingImages || []).length} image(s)</span>
        <button type="button" onclick="Admin.removeVariant(${i})" style="margin-left:auto;background:#FFEBEE;border:none;color:#C62828;padding:4px 8px;border-radius:4px;font-size:0.65rem;cursor:pointer;">Remove</button>
      </div>`).join('');
  }

  function removeVariant(index) {
    colorVariants.splice(index, 1);
    renderAdminColorPicker();
    renderVariantsList();
  }

  function handleColorImageUpload(e) {
    if (!currentEditColor) return;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    const preview = Utils.$('#colorImagePreview');

    let variant = colorVariants.find((v) => v.hex === currentEditColor.hex);
    if (!variant) {
      variant = { name: currentEditColor.name, hex: currentEditColor.hex, files: [], existingImages: [] };
      colorVariants.push(variant);
    }

    files.forEach((file) => {
      if (file.size > 20 * 1024 * 1024) { Utils.showToast('File too large (max 20MB)', 'error'); return; }
      variant.files.push(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const div = document.createElement('div');
        div.style.cssText = 'position:relative;display:inline-block;';
        div.innerHTML = `<img src="${ev.target.result}" style="width:55px;height:55px;object-fit:cover;border-radius:4px;border:1px solid #ddd;"><button type="button" style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;background:#C62828;color:white;border:none;border-radius:50%;font-size:0.5rem;cursor:pointer;">✗</button>`;
        div.querySelector('button').onclick = () => div.remove();
        preview.appendChild(div);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
    renderAdminColorPicker();
    renderVariantsList();
  }

  async function saveProduct(e) {
    e.preventDefault();
    const editId = Utils.$('#editProductId').value;
    const formData = new FormData();

    formData.append('name', Utils.$('#pName').value);
    formData.append('description', Utils.$('#pDesc').value);
    formData.append('price', Utils.$('#pPrice').value);
    formData.append('original_price', Utils.$('#pOrigPrice').value || '');
    const cats = getSelectedCategories();
    formData.append('category_id', cats.mains[0] || '');
    formData.append('sub_category_id', cats.subs[0] || '');
    formData.append('categories', JSON.stringify(cats.all));
    formData.append('stock', Utils.$('#pStock').value);
    formData.append('featured', Utils.$('#pFeatured').checked ? '1' : '');
    formData.append('tags', Utils.$('#pTags').value);

    const variantsMeta = colorVariants.map((v) => ({
      name: v.name, hex: v.hex, existingImages: v.existingImages || [], fileCount: (v.files || []).length,
    }));
    formData.append('color_variants_meta', JSON.stringify(variantsMeta));
    formData.append('colors', colorVariants.map((v) => `${v.name}:${v.hex}`).join(', '));

    for (const variant of colorVariants) {
      for (const file of (variant.files || [])) {
        formData.append('images', file);
      }
    }

    const path = editId ? `/admin/products/${editId}` : '/admin/products';
    const { ok, data } = editId
      ? await Api.uploadPut(path, formData, true)
      : await Api.upload(path, formData, true);

    if (ok) {
      closeProductForm();
      loadAdminProducts();
      loadStats();
      Utils.showToast(editId ? 'Product updated!' : 'Product added!', 'success');
    } else {
      Utils.showToast(Utils.extractError(data), 'error');
    }
  }

  async function editProduct(id) {
    const { ok, data: products } = await Api.get('/admin/products', true);
    if (!ok) return;
    const p = products.find((prod) => prod.id === id);
    if (!p) return;

    await loadCategoryOptions();

    Utils.$('#productFormTitle').textContent = 'Edit Product';
    Utils.$('#editProductId').value = p.id;
    Utils.$('#pName').value = p.name;
    Utils.$('#pDesc').value = p.description || '';
    Utils.$('#pPrice').value = p.price;
    Utils.$('#pOrigPrice').value = p.original_price || '';
    Utils.$('#pStock').value = p.stock;
    Utils.$('#pTags').value = p.tags || '';
    Utils.$('#pFeatured').checked = !!p.featured;

    setTimeout(() => {
      if (p.category_id) {
        const mainCb = Utils.$(`.cat-main-cb[value="${p.category_id}"]`);
        if (mainCb) { mainCb.checked = true; toggleSubCats(p.category_id); }
      }
      if (p.sub_category_id) {
        const subCb = Utils.$(`.cat-sub-cb[value="${p.sub_category_id}"]`);
        if (subCb) subCb.checked = true;
      }
    }, 100);

    colorVariants = [];
    currentEditColor = null;
    let cv = [];
    try { cv = typeof p.color_variants === 'string' ? JSON.parse(p.color_variants) : (p.color_variants || []); } catch {}
    if (cv.length > 0) {
      colorVariants = cv.map((v) => ({ name: v.name, hex: v.hex, files: [], existingImages: v.images || [] }));
    } else if (p.colors) {
      p.colors.split(',').forEach((c) => {
        const parts = c.trim().split(':');
        if (parts.length === 2) colorVariants.push({ name: parts[0].trim(), hex: parts[1].trim(), files: [], existingImages: [] });
      });
    }
    renderAdminColorPicker();
    renderVariantsList();
    Utils.$('#colorUploadArea').style.display = 'none';
    Utils.$('#colorImagePreview').innerHTML = '';
    Utils.$('#productFormModal').classList.add('active');
  }

  async function deleteProduct(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const { ok } = await Api.del(`/admin/products/${id}`, true);
    if (ok) { loadAdminProducts(); loadStats(); Utils.showToast('Product deleted', 'success'); }
  }

  // ─── Orders ──────────────────────────────────────────────────────────────

  async function loadAdminOrders() {
    const { ok, data } = await Api.get('/admin/orders', true);
    const tbody = Utils.$('#ordersTable');
    if (!tbody) return;

    if (!ok || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#999;">No orders yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map((o) => `
      <tr>
        <td><strong>${Utils.escapeHtml(o.track_id || '#' + o.id)}</strong></td>
        <td>${Utils.escapeHtml(o.customer_name)}</td>
        <td>${Utils.escapeHtml(o.customer_phone)}</td>
        <td>${Utils.formatCurrency(o.total_amount)}</td>
        <td><span class="status-badge status-${o.status}">${o.status}</span></td>
        <td>${Utils.formatDate(o.created_at)}</td>
        <td>
          <div class="action-btns">
            <button class="btn-sm btn-view" onclick="Admin.viewOrder(${o.id})" title="View"><i class="fas fa-eye"></i></button>
            <button class="btn-sm btn-edit" onclick="window.open(CONFIG.API_BASE + '/api/bill/generate/${Utils.escapeAttr(o.track_id || o.id)}', '_blank')" title="Download Bill"><i class="fas fa-file-invoice"></i></button>
          </div>
        </td>
      </tr>`).join('');
  }

  async function viewOrder(id) {
    const { ok, data: order } = await Api.get(`/admin/orders/${id}`, true);
    if (!ok) { Utils.showToast('Failed to load order.', 'error'); return; }

    const content = Utils.$('#orderDetailContent');
    content.innerHTML = `
      <div class="order-detail-grid">
        <div class="info-row"><span class="label">Tracking ID</span><span class="value"><strong>${Utils.escapeHtml(order.track_id || '#' + order.id)}</strong></span></div>
        <div class="info-row"><span class="label">Customer</span><span class="value">${Utils.escapeHtml(order.customer_name)}</span></div>
        <div class="info-row"><span class="label">Phone</span><span class="value">${Utils.escapeHtml(order.customer_phone)}</span></div>
        <div class="info-row"><span class="label">Email</span><span class="value">${Utils.escapeHtml(order.customer_email || '-')}</span></div>
        <div class="info-row"><span class="label">Address</span><span class="value">${Utils.escapeHtml(order.customer_address)}</span></div>
        <div class="info-row"><span class="label">Notes</span><span class="value">${Utils.escapeHtml(order.notes || '-')}</span></div>
        <div class="info-row"><span class="label">Total</span><span class="value" style="font-weight:700;color:var(--primary);">${Utils.formatCurrency(order.total_amount)}</span></div>
        <div class="info-row"><span class="label">Date</span><span class="value">${Utils.formatDateTime(order.created_at)}</span></div>
        <div class="info-row"><span class="label">Status</span><span class="value"><span class="status-badge status-${order.status}">${order.status}</span></span></div>
      </div>
      <div class="order-items-list">
        <h4>Items Ordered:</h4>
        ${order.items && order.items.length > 0 ? order.items.map((i) => `
          <div class="order-item-row">
            <img src="${resolveImg(i.image_url)}" alt="" onerror="this.src='https://via.placeholder.com/40?text=Item'">
            <span style="flex:1;">${Utils.escapeHtml(i.product_name)}</span>
            <span>x${i.quantity}</span>
            <span style="font-weight:600;">${Utils.formatCurrency(i.price * i.quantity)}</span>
          </div>`).join('') : '<p style="color:#999;">No items data</p>'}
      </div>
      <div style="margin-top:16px;">
        <label style="font-size:0.8rem;font-weight:600;display:block;margin-bottom:6px;">Change Status:</label>
        <select class="status-select" onchange="Admin.updateOrderStatus(${order.id}, this.value)" style="width:100%;padding:10px;border:2px solid #eee;border-radius:8px;font-size:0.9rem;cursor:pointer;">
          ${['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((s) => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
        </select>
      </div>`;

    Utils.$('#orderDetailModal').classList.add('active');
  }

  function closeOrderDetail() {
    Utils.$('#orderDetailModal')?.classList.remove('active');
  }

  async function updateOrderStatus(id, status) {
    const { ok } = await Api.put(`/admin/orders/${id}/status`, { status }, true);
    if (ok) { loadAdminOrders(); loadStats(); Utils.showToast(`Order marked as ${status}`, 'success'); }
  }

  // ─── Categories ──────────────────────────────────────────────────────────

  async function loadAdminCategories() {
    const { ok, data } = await Api.get('/admin/categories', true);
    if (!ok) return;
    allAdminCategories = data;
    const tbody = Utils.$('#categoriesTable');
    if (!tbody) return;

    const mainCats = data.filter((c) => !c.parent_id);
    const subCats = data.filter((c) => c.parent_id);

    let html = '';
    mainCats.forEach((c) => {
      const children = subCats.filter((s) => s.parent_id === c.id);
      html += `<tr style="background:#f9f9f9;"><td>${c.id}</td><td><strong>${Utils.escapeHtml(c.name)}</strong></td><td><span style="background:#E3F2FD;color:#1565C0;padding:2px 8px;border-radius:4px;font-size:0.7rem;">Main</span></td><td>—</td><td><button class="btn-sm btn-delete" onclick="Admin.deleteCategory(${c.id}, '${Utils.escapeAttr(c.name)}')"><i class="fas fa-trash"></i></button></td></tr>`;
      children.forEach((s) => {
        html += `<tr><td>${s.id}</td><td style="padding-left:24px;">↳ ${Utils.escapeHtml(s.name)}</td><td><span style="background:#FFF3E0;color:#E65100;padding:2px 8px;border-radius:4px;font-size:0.7rem;">Sub</span></td><td>${Utils.escapeHtml(c.name)}</td><td><button class="btn-sm btn-delete" onclick="Admin.deleteCategory(${s.id}, '${Utils.escapeAttr(s.name)}')"><i class="fas fa-trash"></i></button></td></tr>`;
      });
    });

    tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center;padding:20px;color:#999;">No categories</td></tr>';
  }

  function openCategoryForm() {
    const select = Utils.$('#catParent');
    select.innerHTML = '<option value="">— None (Main Category) —</option>';
    allAdminCategories.filter((c) => !c.parent_id).forEach((c) => {
      select.innerHTML += `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`;
    });
    Utils.$('#catName').value = '';
    Utils.$('#catDesc').value = '';
    Utils.$('#categoryFormModal').classList.add('active');
  }

  function closeCategoryForm() {
    Utils.$('#categoryFormModal')?.classList.remove('active');
  }

  async function saveCategory(e) {
    e.preventDefault();
    const { ok, data } = await Api.post('/admin/categories', {
      name: Utils.$('#catName').value,
      description: Utils.$('#catDesc').value,
      parent_id: Utils.$('#catParent').value || null,
    }, true);

    if (ok) {
      closeCategoryForm();
      loadAdminCategories();
      Utils.showToast('Category added!', 'success');
    } else {
      Utils.showToast(Utils.extractError(data), 'error');
    }
  }

  async function deleteCategory(id, name) {
    if (!confirm(`Delete category "${name}"?`)) return;
    const { ok } = await Api.del(`/admin/categories/${id}`, true);
    if (ok) { loadAdminCategories(); Utils.showToast('Category deleted', 'success'); }
  }

  // ─── Settings ────────────────────────────────────────────────────────────

  async function changePassword(e) {
    e.preventDefault();
    const currentPassword = Utils.$('#currentPass').value;
    const newPassword = Utils.$('#newPass').value;

    if (!currentPassword || !newPassword) { Utils.showToast('Both fields required.', 'error'); return; }
    if (newPassword.length < 8) { Utils.showToast('New password must be at least 8 characters.', 'error'); return; }

    const { ok, data } = await Api.post('/admin/change-password', { currentPassword, newPassword }, true);
    if (ok) {
      Utils.showToast('Password changed!', 'success');
      Utils.$('#currentPass').value = '';
      Utils.$('#newPass').value = '';
    } else {
      Utils.showToast(Utils.extractError(data), 'error');
    }
  }

  // ─── Hero Media ──────────────────────────────────────────────────────────

  async function uploadHeroMedia(e) {
    e.preventDefault();
    const files = Utils.$('#heroFiles').files;
    if (!files || files.length === 0) { Utils.showToast('Select files', 'error'); return; }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('heroFiles', files[i]);
    }

    const { ok, data } = await Api.upload('/admin/hero-media', formData, true);
    if (ok) {
      Utils.showToast('Hero media updated!', 'success');
      const preview = Utils.$('#heroPreview');
      if (preview && data.files) {
        preview.innerHTML = data.files.map((f) => {
          if (f.type === 'video') return `<video src="${CONFIG.API_BASE}${f.url}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;" muted></video>`;
          return `<img src="${CONFIG.API_BASE}${f.url}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;">`;
        }).join('');
      }
    } else {
      Utils.showToast(Utils.extractError(data), 'error');
    }
  }

  // ─── Billing ─────────────────────────────────────────────────────────────

  function generateOrderBill() {
    const trackId = Utils.$('#billTrackId')?.value.trim();
    if (!trackId) { Utils.showToast('Enter a tracking ID', 'error'); return; }
    // Bill endpoints require auth — open with token in header via fetch
    const token = Api.getAccessToken();
    window.open(`${CONFIG.API_BASE}/api/bill/generate/${encodeURIComponent(trackId)}?token=${token}`, '_blank');
  }

  function addBillItem() {
    const container = Utils.$('#billItems');
    const row = document.createElement('div');
    row.className = 'bill-item-row';
    row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center;';
    row.innerHTML = `
      <input type="text" placeholder="Item name" class="bill-item-name" style="flex:2;padding:8px 12px;border:2px solid #eee;border-radius:6px;font-size:0.85rem;">
      <input type="number" placeholder="Qty" class="bill-item-qty" min="1" value="1" style="width:60px;padding:8px;border:2px solid #eee;border-radius:6px;font-size:0.85rem;text-align:center;">
      <input type="number" placeholder="Price" class="bill-item-price" min="1" style="width:100px;padding:8px;border:2px solid #eee;border-radius:6px;font-size:0.85rem;">
      <button type="button" onclick="this.parentElement.remove()" style="background:#FFEBEE;border:none;color:#C62828;padding:8px 10px;border-radius:6px;cursor:pointer;font-size:0.8rem;">✗</button>`;
    container.appendChild(row);
  }

  async function generateManualBill(e) {
    e.preventDefault();
    const names = Utils.$$('.bill-item-name');
    const qtys = Utils.$$('.bill-item-qty');
    const prices = Utils.$$('.bill-item-price');

    const items = [];
    names.forEach((el, i) => {
      if (el.value.trim() && prices[i].value) {
        items.push({ name: el.value.trim(), qty: Number(qtys[i].value) || 1, price: Number(prices[i].value) });
      }
    });
    if (items.length === 0) { Utils.showToast('Add at least one item', 'error'); return; }

    const body = {
      customer_name: Utils.$('#billCustName').value,
      customer_phone: Utils.$('#billCustPhone').value,
      customer_address: Utils.$('#billCustAddress').value,
      notes: Utils.$('#billNotes').value,
      items,
    };

    const res = await Api.request('POST', '/bill/manual', body, { auth: true, raw: true });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'Bill.pdf'; a.click();
      URL.revokeObjectURL(url);
      Utils.showToast('Bill generated!', 'success');
    } else {
      Utils.showToast('Failed to generate bill.', 'error');
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function resolveImg(url) {
    if (!url) return 'https://via.placeholder.com/50?text=Img';
    if (url.startsWith('http')) return url;
    return CONFIG.API_BASE + url;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  return {
    init,
    logout,
    showSection,
    loadStats,
    loadAdminProducts,
    openProductForm,
    closeProductForm,
    toggleSubCats,
    selectColorForUpload,
    removeVariant,
    handleColorImageUpload,
    saveProduct,
    editProduct,
    deleteProduct,
    loadAdminOrders,
    viewOrder,
    closeOrderDetail,
    updateOrderStatus,
    loadAdminCategories,
    openCategoryForm,
    closeCategoryForm,
    saveCategory,
    deleteCategory,
    changePassword,
    uploadHeroMedia,
    generateOrderBill,
    addBillItem,
    generateManualBill,
  };
})();
