'use strict';

/**
 * Centralized API Client
 * All HTTP communication with the backend goes through this module.
 * Handles token attachment, auto-refresh on 401, and error normalization.
 *
 * Token Strategy:
 *   - Access token: stored in sessionStorage (cleared on tab close — secure)
 *   - Refresh token: httpOnly cookie (set by backend, auto-sent with credentials)
 */

const Api = (() => {
  // ─── Token Management ────────────────────────────────────────────────────

  function getAccessToken() {
    return sessionStorage.getItem(CONFIG.ACCESS_TOKEN_KEY) || null;
  }

  function setAccessToken(token) {
    if (token) {
      sessionStorage.setItem(CONFIG.ACCESS_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(CONFIG.ACCESS_TOKEN_KEY);
    }
  }

  function clearTokens() {
    sessionStorage.removeItem(CONFIG.ACCESS_TOKEN_KEY);
  }

  /**
   * Decode JWT payload (without verification — that's the backend's job).
   * Used only to read role/email for UI routing.
   */
  function decodeToken(token) {
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  }

  function getCurrentUser() {
    const token = getAccessToken();
    if (!token) return null;
    const payload = decodeToken(token);
    if (!payload) return null;
    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearTokens();
      return null;
    }
    return { id: payload.sub, role: payload.role, email: payload.email };
  }

  function isLoggedIn() {
    return getCurrentUser() !== null;
  }

  function isAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin';
  }

  // ─── Core Request Method ─────────────────────────────────────────────────

  /**
   * Make an API request.
   * @param {string} method - HTTP method
   * @param {string} path - API path (e.g., '/auth/login')
   * @param {object|FormData|null} body - Request body
   * @param {object} options - { auth: boolean, raw: boolean }
   * @returns {Promise<{ok: boolean, status: number, data: any}>}
   */
  async function request(method, path, body = null, options = {}) {
    const { auth = false, raw = false } = options;
    const url = CONFIG.API_BASE + '/api' + path;

    const headers = {};
    const fetchOptions = {
      method,
      headers,
      credentials: 'include', // Always send cookies (for refresh token)
    };

    // Attach access token if auth required
    if (auth) {
      const token = getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    // Handle body
    if (body) {
      if (body instanceof FormData) {
        // Don't set Content-Type for FormData (browser sets boundary)
        fetchOptions.body = body;
      } else {
        headers['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify(body);
      }
    }

    try {
      const res = await fetch(url, fetchOptions);

      // If 401 and we have auth, try silent refresh
      if (res.status === 401 && auth) {
        const refreshed = await silentRefresh();
        if (refreshed) {
          // Retry original request with new token
          headers['Authorization'] = `Bearer ${getAccessToken()}`;
          const retryRes = await fetch(url, fetchOptions);
          if (raw) return retryRes;
          return await parseResponse(retryRes);
        }
        // Refresh failed — clear tokens
        clearTokens();
      }

      if (raw) return res;
      return await parseResponse(res);
    } catch (err) {
      // Network error
      return { ok: false, status: 0, data: { error: 'Network error. Please check your connection.' } };
    }
  }

  async function parseResponse(res) {
    let data;
    try {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = { message: await res.text() };
      }
    } catch {
      data = { error: 'Failed to parse server response.' };
    }
    return { ok: res.ok, status: res.status, data };
  }

  // ─── Silent Refresh ──────────────────────────────────────────────────────

  let _refreshPromise = null;

  /**
   * Attempt to refresh the access token using the httpOnly refresh cookie.
   * Deduplicates concurrent refresh attempts.
   */
  async function silentRefresh() {
    // Deduplicate: if a refresh is already in-flight, await it
    if (_refreshPromise) return _refreshPromise;

    _refreshPromise = (async () => {
      try {
        const res = await fetch(CONFIG.API_BASE + '/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        if (!res.ok) {
          clearTokens();
          return false;
        }

        const data = await res.json();
        if (data.accessToken) {
          setAccessToken(data.accessToken);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        _refreshPromise = null;
      }
    })();

    return _refreshPromise;
  }

  // ─── Convenience Methods ─────────────────────────────────────────────────

  function get(path, auth = false) {
    return request('GET', path, null, { auth });
  }

  function post(path, body, auth = false) {
    return request('POST', path, body, { auth });
  }

  function put(path, body, auth = false) {
    return request('PUT', path, body, { auth });
  }

  function del(path, auth = false) {
    return request('DELETE', path, null, { auth });
  }

  function upload(path, formData, auth = false) {
    return request('POST', path, formData, { auth });
  }

  function uploadPut(path, formData, auth = false) {
    return request('PUT', path, formData, { auth });
  }

  // ─── Auth Helpers ────────────────────────────────────────────────────────

  /**
   * Login — stores access token, cookie handled by backend.
   */
  async function login(identifier, password) {
    const { ok, data } = await post('/auth/login', { identifier, password });
    if (ok && data.accessToken) {
      setAccessToken(data.accessToken);
    }
    return { ok, data };
  }

  /**
   * Signup — stores access token after successful registration.
   */
  async function signup(payload) {
    const { ok, data } = await post('/auth/signup', payload);
    if (ok && data.accessToken) {
      setAccessToken(data.accessToken);
    }
    return { ok, data };
  }

  /**
   * Logout — clears tokens and cookie.
   */
  async function logout() {
    await post('/auth/logout', {});
    clearTokens();
  }

  /**
   * Initialize — try silent refresh on page load.
   * Returns true if user is authenticated.
   */
  async function init() {
    if (isLoggedIn()) return true;
    return await silentRefresh();
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  return {
    get,
    post,
    put,
    del,
    upload,
    uploadPut,
    request,
    login,
    signup,
    logout,
    init,
    silentRefresh,
    getAccessToken,
    setAccessToken,
    clearTokens,
    getCurrentUser,
    isLoggedIn,
    isAdmin,
    decodeToken,
  };
})();
