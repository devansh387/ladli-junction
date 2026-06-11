'use strict';

/**
 * Cart Module
 * Manages shopping cart state in localStorage.
 * Pure data layer — no DOM manipulation (that's in shop.js).
 */

const Cart = (() => {
  function getItems() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.CART_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function save(items) {
    localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(items));
    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: { items } }));
  }

  function addItem(product, quantity = 1) {
    const items = getItems();
    const existing = items.find((i) => i.id === product.id);

    if (existing) {
      const newQty = existing.qty + quantity;
      if (product.stock && newQty > product.stock) {
        return { success: false, error: `Only ${product.stock} available.` };
      }
      existing.qty = newQty;
    } else {
      items.push({
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        image: product.image_url || '',
        originalPrice: parseFloat(product.original_price || product.price),
        qty: quantity,
        maxStock: product.stock || 999,
      });
    }

    save(items);
    return { success: true };
  }

  function updateQuantity(productId, delta) {
    const items = getItems();
    const item = items.find((i) => i.id === productId);
    if (!item) return;

    const newQty = item.qty + delta;
    if (newQty <= 0) {
      removeItem(productId);
      return;
    }
    if (newQty > item.maxStock) {
      return { success: false, error: `Only ${item.maxStock} available.` };
    }

    item.qty = newQty;
    save(items);
    return { success: true };
  }

  function removeItem(productId) {
    const items = getItems().filter((i) => i.id !== productId);
    save(items);
  }

  function clear() {
    save([]);
  }

  function getTotal() {
    return getItems().reduce((sum, i) => sum + i.price * i.qty, 0);
  }

  function getCount() {
    return getItems().reduce((sum, i) => sum + i.qty, 0);
  }

  function isEmpty() {
    return getItems().length === 0;
  }

  /**
   * Validate cart items against live stock before checkout.
   */
  async function validateStock() {
    const items = getItems();
    for (const item of items) {
      const { ok, data } = await Api.get(`/shop/products/${item.id}`);
      if (!ok) {
        return { valid: false, error: `Could not verify stock for "${item.name}".` };
      }
      if (data.stock <= 0) {
        return { valid: false, error: `"${data.name}" is now out of stock. Please remove it.` };
      }
      if (item.qty > data.stock) {
        item.qty = data.stock;
        item.maxStock = data.stock;
        save(items);
        return { valid: false, error: `Only ${data.stock} of "${data.name}" available. Cart updated.` };
      }
    }
    return { valid: true };
  }

  return {
    getItems,
    addItem,
    updateQuantity,
    removeItem,
    clear,
    getTotal,
    getCount,
    isEmpty,
    validateStock,
  };
})();
