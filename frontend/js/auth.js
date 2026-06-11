'use strict';

/**
 * Auth UI Module
 * Handles the account page: login, signup (with OTP), forgot password.
 * All logic is API calls — no direct DB access.
 */

const AuthUI = (() => {
  let emailVerified = false;

  function init() {
    // Try silent refresh — if already logged in, show dashboard
    Api.init().then((loggedIn) => {
      if (loggedIn) {
        const user = Api.getCurrentUser();
        if (user && user.role === 'admin') {
          Utils.redirectToAdmin();
        } else {
          showDashboard();
        }
      } else {
        showAuthForm();
      }
    });
  }

  function showAuthForm() {
    const authSection = Utils.$('#authSection');
    const dashSection = Utils.$('#dashSection');
    if (authSection) authSection.style.display = 'block';
    if (dashSection) dashSection.classList.remove('active');
  }

  async function showDashboard() {
    const authSection = Utils.$('#authSection');
    const dashSection = Utils.$('#dashSection');
    if (authSection) authSection.style.display = 'none';
    if (dashSection) dashSection.classList.add('active');

    // Load user profile
    const { ok, data } = await Api.get('/user/me', true);
    if (!ok) {
      showAuthForm();
      return;
    }

    const user = data.user;
    const greeting = Utils.$('#dashGreeting');
    const phone = Utils.$('#dashPhone');
    if (greeting) greeting.textContent = `Hello, ${Utils.escapeHtml(user.name.split(' ')[0])}!`;
    if (phone) phone.innerHTML = `<i class="fas fa-phone"></i> ${Utils.escapeHtml(user.phone)}`;

    // Fill profile form
    const profileName = Utils.$('#profileName');
    const profilePhone = Utils.$('#profilePhone');
    const profileEmail = Utils.$('#profileEmail');
    const profileAddress = Utils.$('#profileAddress');
    if (profileName) profileName.value = user.name || '';
    if (profilePhone) profilePhone.value = user.phone || '';
    if (profileEmail) profileEmail.value = user.email || '';
    if (profileAddress) profileAddress.value = user.address || '';

    // Store phone for order lookup
    if (user.phone) Utils.setStoredPhone(user.phone);

    // Load user orders
    loadUserOrders();
  }

  async function loadUserOrders() {
    const container = Utils.$('#userOrdersList');
    if (!container) return;

    const { ok, data } = await Api.get('/orders/user-orders', true);
    if (!ok || !data.length) {
      container.innerHTML = `
        <div class="empty-box">
          <i class="fas fa-box-open"></i>
          <p>No orders yet. Start shopping!</p>
          <a href="/" style="display:inline-block;margin-top:16px;padding:10px 20px;background:var(--primary);color:white;border-radius:8px;text-decoration:none;">Browse Sarees</a>
        </div>`;
      return;
    }

    container.innerHTML = data.map((order) => `
      <div class="order-card-mini">
        <div class="order-mini-header">
          <span class="track-code">${Utils.escapeHtml(order.track_id || '#' + order.id)}</span>
          <span class="date">${Utils.formatDate(order.created_at)}</span>
          <span class="status-pill ${order.status}">${order.status}</span>
        </div>
        <div class="order-mini-items">
          ${order.items.map((i) => `<img src="${CONFIG.API_BASE}${i.image_url || ''}" alt="${Utils.escapeAttr(i.product_name)}" title="${Utils.escapeAttr(i.product_name)} x${i.quantity}" onerror="this.src='https://via.placeholder.com/44'">`).join('')}
        </div>
        <div class="order-mini-footer">
          <span class="total">${Utils.formatCurrency(order.total_amount)}</span>
          <a href="/#track" onclick="localStorage.setItem('track_id','${Utils.escapeAttr(order.track_id || order.id)}')"><i class="fas fa-map-marker-alt"></i> Track</a>
        </div>
      </div>
    `).join('');
  }

  // ─── Auth Tab Switching ──────────────────────────────────────────────────

  function showAuthTab(tab) {
    Utils.$$('.auth-tab').forEach((t) => t.classList.remove('active'));
    Utils.$$('.auth-form').forEach((f) => f.classList.remove('active'));

    if (tab === 'login') {
      document.querySelectorAll('.auth-tab')[0]?.classList.add('active');
      Utils.$('#loginForm')?.classList.add('active');
    } else if (tab === 'signup') {
      document.querySelectorAll('.auth-tab')[1]?.classList.add('active');
      Utils.$('#signupForm')?.classList.add('active');
    } else if (tab === 'forgot') {
      Utils.$('#forgotForm')?.classList.add('active');
    }
  }

  // ─── Login ───────────────────────────────────────────────────────────────

  async function handleLogin(e) {
    e.preventDefault();
    const errEl = Utils.$('#loginError');
    if (errEl) { errEl.classList.remove('show'); errEl.textContent = ''; }

    const identifier = Utils.$('#loginId')?.value.trim();
    const password = Utils.$('#loginPass')?.value;

    if (!identifier || !password) {
      if (errEl) { errEl.textContent = 'Please fill in all fields.'; errEl.classList.add('show'); }
      return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    Utils.setLoading(btn, true);

    const { ok, data } = await Api.login(identifier, password);

    Utils.setLoading(btn, false);

    if (!ok) {
      if (errEl) { errEl.textContent = Utils.extractError(data); errEl.classList.add('show'); }
      return;
    }

    // Check role and redirect
    if (data.user && data.user.role === 'admin') {
      Utils.redirectToAdmin();
    } else {
      showDashboard();
    }
  }

  // ─── OTP for Signup ──────────────────────────────────────────────────────

  async function sendOtp() {
    const email = Utils.$('#signupEmail')?.value.trim();
    if (!email || !Utils.isValidEmail(email)) {
      Utils.$('#otpStatus').textContent = 'Enter a valid email first';
      Utils.$('#otpStatus').style.color = '#C62828';
      return;
    }

    const btn = Utils.$('#otpBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    Utils.$('#otpStatus').textContent = '';

    const { ok, data } = await Api.post('/auth/send-otp', { email, purpose: 'signup_verification' });

    if (ok) {
      Utils.$('#otpGroup').style.display = 'block';
      Utils.$('#otpStatus').textContent = 'OTP sent! Check your inbox.';
      Utils.$('#otpStatus').style.color = '#2E7D32';
      startOtpCountdown(btn, 60);
    } else {
      Utils.$('#otpStatus').textContent = Utils.extractError(data);
      Utils.$('#otpStatus').style.color = '#C62828';
      btn.disabled = false;
      btn.textContent = 'Send OTP';
    }
  }

  async function verifyOtp() {
    const email = Utils.$('#signupEmail')?.value.trim();
    const otp = Utils.$('#signupOtp')?.value.trim();
    const statusEl = Utils.$('#otpVerifyStatus');

    if (!otp || otp.length !== 6) {
      statusEl.textContent = 'Enter 6-digit OTP';
      statusEl.style.color = '#C62828';
      return;
    }

    const { ok, data } = await Api.post('/auth/verify-otp', { email, otp, purpose: 'signup_verification' });

    if (ok) {
      emailVerified = true;
      statusEl.textContent = '✓ Email verified!';
      statusEl.style.color = '#2E7D32';
      const signupBtn = Utils.$('#signupBtn');
      if (signupBtn) { signupBtn.disabled = false; signupBtn.style.opacity = '1'; signupBtn.style.cursor = 'pointer'; }
      Utils.$('#signupEmail').disabled = true;
      Utils.$('#signupOtp').disabled = true;
      Utils.$('#verifyBtn').disabled = true;
      Utils.$('#otpBtn').disabled = true;
    } else {
      statusEl.textContent = Utils.extractError(data);
      statusEl.style.color = '#C62828';
    }
  }

  // ─── Signup ──────────────────────────────────────────────────────────────

  async function handleSignup(e) {
    e.preventDefault();
    const errEl = Utils.$('#signupError');
    if (errEl) { errEl.classList.remove('show'); errEl.textContent = ''; }

    if (!emailVerified) {
      if (errEl) { errEl.textContent = 'Please verify your email with OTP first.'; errEl.classList.add('show'); }
      return;
    }

    const name = Utils.$('#signupName')?.value.trim();
    const email = Utils.$('#signupEmail')?.value.trim();
    const phone = Utils.cleanPhone(Utils.$('#signupPhone')?.value || '');
    const address = Utils.$('#signupAddress')?.value.trim();
    const password = Utils.$('#signupPass')?.value;

    if (!name || !email || !phone || !password) {
      if (errEl) { errEl.textContent = 'Please fill in all required fields.'; errEl.classList.add('show'); }
      return;
    }

    if (!Utils.isValidPhone(phone)) {
      if (errEl) { errEl.textContent = 'Enter a valid 10-digit Indian phone number.'; errEl.classList.add('show'); }
      return;
    }

    if (password.length < 8) {
      if (errEl) { errEl.textContent = 'Password must be at least 8 characters.'; errEl.classList.add('show'); }
      return;
    }

    const btn = Utils.$('#signupBtn');
    Utils.setLoading(btn, true);

    const { ok, data } = await Api.signup({ name, email, phone, password, address });

    Utils.setLoading(btn, false);

    if (!ok) {
      if (errEl) { errEl.textContent = Utils.extractError(data); errEl.classList.add('show'); }
      return;
    }

    Utils.setStoredPhone(phone);
    showDashboard();
  }

  // ─── Forgot Password ────────────────────────────────────────────────────

  async function sendResetOtp() {
    const email = Utils.$('#forgotEmail')?.value.trim();
    if (!email || !Utils.isValidEmail(email)) {
      Utils.$('#resetOtpStatus').textContent = 'Enter a valid email';
      Utils.$('#resetOtpStatus').style.color = '#C62828';
      return;
    }

    const btn = Utils.$('#resetOtpBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    const { ok, data } = await Api.post('/auth/forgot-password', { email });

    if (ok) {
      Utils.$('#resetOtpStatus').textContent = '✓ OTP sent! Check your inbox.';
      Utils.$('#resetOtpStatus').style.color = '#2E7D32';
      Utils.$('#resetOtpGroup').style.display = 'block';
      Utils.$('#newPassGroup').style.display = 'block';
      Utils.$('#resetBtn').style.display = 'block';
      startOtpCountdown(btn, 60);
    } else {
      Utils.$('#resetOtpStatus').textContent = Utils.extractError(data);
      Utils.$('#resetOtpStatus').style.color = '#C62828';
      btn.disabled = false;
      btn.textContent = 'Send OTP';
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    const errEl = Utils.$('#forgotError');
    if (errEl) { errEl.classList.remove('show'); errEl.textContent = ''; }

    const email = Utils.$('#forgotEmail')?.value.trim();
    const otp = Utils.$('#resetOtp')?.value.trim();
    const newPassword = Utils.$('#resetNewPass')?.value;

    if (!email || !otp || !newPassword) {
      if (errEl) { errEl.textContent = 'All fields are required.'; errEl.classList.add('show'); }
      return;
    }

    if (newPassword.length < 8) {
      if (errEl) { errEl.textContent = 'Password must be at least 8 characters.'; errEl.classList.add('show'); }
      return;
    }

    const { ok, data } = await Api.post('/auth/reset-password', { email, otp, newPassword });

    if (ok) {
      Utils.showToast('Password reset successful! Please login.', 'success');
      showAuthTab('login');
    } else {
      if (errEl) { errEl.textContent = Utils.extractError(data); errEl.classList.add('show'); }
    }
  }

  // ─── Logout ──────────────────────────────────────────────────────────────

  async function handleLogout() {
    await Api.logout();
    showAuthForm();
  }

  // ─── Profile Update ──────────────────────────────────────────────────────

  async function updateProfile(e) {
    e.preventDefault();
    const name = Utils.$('#profileName')?.value.trim();
    const email = Utils.$('#profileEmail')?.value.trim();
    const address = Utils.$('#profileAddress')?.value.trim();

    const { ok, data } = await Api.put('/user/profile', { name, email, address }, true);

    if (ok) {
      Utils.showToast('Profile updated!', 'success');
      const greeting = Utils.$('#dashGreeting');
      if (greeting && name) greeting.textContent = `Hello, ${name.split(' ')[0]}!`;
    } else {
      Utils.showToast(Utils.extractError(data), 'error');
    }
  }

  // ─── Dashboard Tab Switching ─────────────────────────────────────────────

  function showDashTab(tab) {
    Utils.$$('.dash-tab').forEach((t) => t.classList.remove('active'));
    Utils.$$('.dash-section').forEach((s) => s.classList.remove('active'));
    event.currentTarget.classList.add('active');
    const section = Utils.$(`#tab-${tab}`);
    if (section) section.classList.add('active');
  }

  // ─── OTP Countdown Helper ───────────────────────────────────────────────

  function startOtpCountdown(btn, seconds) {
    let sec = seconds;
    const timer = setInterval(() => {
      sec--;
      btn.textContent = `Resend (${sec}s)`;
      if (sec <= 0) {
        clearInterval(timer);
        btn.disabled = false;
        btn.textContent = 'Resend OTP';
      }
    }, 1000);
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  return {
    init,
    showAuthTab,
    handleLogin,
    sendOtp,
    verifyOtp,
    handleSignup,
    sendResetOtp,
    handleForgot,
    handleLogout,
    updateProfile,
    showDashTab,
    loadUserOrders,
  };
})();
