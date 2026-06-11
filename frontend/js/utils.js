'use strict';

/**
 * Shared UI utilities used across all frontend pages.
 * Escape functions, toast notifications, formatting, phone validation.
 */

const Utils = (() => {
  // ─── XSS-Safe HTML Escaping ──────────────────────────────────────────────

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ─── Toast Notifications ─────────────────────────────────────────────────

  function showToast(message, type = '') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('active'));

    setTimeout(() => {
      toast.classList.remove('active');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  // ─── Phone Validation ────────────────────────────────────────────────────

  const PHONE_REGEX = /^(\+91|91|0)?[6-9]\d{9}$/;

  function isValidPhone(phone) {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    return PHONE_REGEX.test(cleaned);
  }

  function cleanPhone(phone) {
    return phone.replace(/[\s\-\(\)]/g, '');
  }

  // ─── Email Validation ────────────────────────────────────────────────────

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ─── Formatting ──────────────────────────────────────────────────────────

  function formatCurrency(amount) {
    return '₹' + Number(amount).toLocaleString('en-IN');
  }

  function formatDate(isoDate) {
    return new Date(isoDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatDateTime(isoDate) {
    return new Date(isoDate).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ─── Error Extraction ────────────────────────────────────────────────────

  /**
   * Extract user-friendly error message from API response.
   */
  function extractError(data) {
    if (!data) return 'Something went wrong.';
    if (typeof data.error === 'string') return data.error;
    if (data.details && Array.isArray(data.details)) {
      return data.details.map((d) => d.message).join(', ');
    }
    if (typeof data.message === 'string') return data.message;
    return 'Something went wrong.';
  }

  // ─── DOM Helpers ─────────────────────────────────────────────────────────

  function $(selector) {
    return document.querySelector(selector);
  }

  function $$(selector) {
    return document.querySelectorAll(selector);
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Please wait...';
    } else if (btn.dataset.originalText) {
      btn.innerHTML = btn.dataset.originalText;
    }
  }

  // ─── Redirect Helpers ────────────────────────────────────────────────────

  function redirectToLogin() {
    window.location.href = '/account.html';
  }

  function redirectToAdmin() {
    window.location.href = '/admin.html';
  }

  function redirectToHome() {
    window.location.href = '/';
  }

  // ─── Local Storage Helpers ───────────────────────────────────────────────

  function getStoredPhone() {
    return localStorage.getItem(CONFIG.PHONE_KEY) || '';
  }

  function setStoredPhone(phone) {
    localStorage.setItem(CONFIG.PHONE_KEY, phone);
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  return {
    escapeHtml,
    escapeAttr,
    showToast,
    isValidPhone,
    cleanPhone,
    isValidEmail,
    formatCurrency,
    formatDate,
    formatDateTime,
    extractError,
    $,
    $$,
    setLoading,
    redirectToLogin,
    redirectToAdmin,
    redirectToHome,
    getStoredPhone,
    setStoredPhone,
  };
})();
