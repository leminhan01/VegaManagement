/**
 * VegiFlow Storefront — Client-side JavaScript
 * Quản lý: hiển thị sản phẩm, giỏ hàng (localStorage), đăng nhập/đăng ký khách,
 * đặt hàng (COD), xem đơn của tôi. Gọi /api/storefront/* (NestJS).
 * Pattern theo chat.js: IIFE, vanilla DOM, localStorage, textContent chống XSS.
 */
(function () {
  'use strict';

  var API_BASE = (window.__STOREFRONT_API__ || 'http://localhost:3000/api/storefront').replace(/\/$/, '');

  // ── State ──────────────────────────────────────
  var auth = {
    token: localStorage.getItem('vf_access_token'),
    refresh: localStorage.getItem('vf_refresh_token'),
    customer: JSON.parse(localStorage.getItem('vf_customer') || 'null'),
  };
  var products = [];
  var categories = [];
  var activeCategory = ''; // '' = tất cả
  var searchQuery = '';

  var CART_KEY = 'vf_cart';

  // ── Helpers ────────────────────────────────────
  function $(sel, root) { return (root || document).querySelector(sel); }
  function escapeHtml(s) {
    var el = document.createElement('div');
    el.textContent = s == null ? '' : String(s);
    return el.innerHTML;
  }
  function priceNum(p) {
    return p.salePrice != null && Number(p.salePrice) < Number(p.price)
      ? Number(p.salePrice)
      : Number(p.price);
  }
  function formatVND(n) {
    return Number(n || 0).toLocaleString('vi-VN') + 'đ';
  }
  function priceHtml(p) {
    var final = priceNum(p);
    var html = '<span class="vf-s-price-now">' + escapeHtml(formatVND(final)) + '</span>';
    if (p.salePrice != null && Number(p.salePrice) < Number(p.price)) {
      html += '<span class="vf-s-price-old">' + escapeHtml(formatVND(p.price)) + '</span>';
    }
    return html;
  }

  // ── API helper ─────────────────────────────────
  async function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (auth.token) headers['Authorization'] = 'Bearer ' + auth.token;

    var res = await fetch(API_BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    if (res.status === 401 && auth.token && !opts._retried) {
      var refreshed = await tryRefresh();
      if (refreshed) {
        opts._retried = true;
        return api(path, opts);
      }
      clearAuth();
      openAuth('login');
      throw new Error('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại');
    }

    var json = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      throw new Error(json.message || 'Có lỗi xảy ra (' + res.status + ')');
    }
    return json;
  }

  async function tryRefresh() {
    if (!auth.refresh) return false;
    try {
      var res = await fetch(API_BASE + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: auth.refresh }),
      });
      if (!res.ok) return false;
      var json = await res.json();
      auth.token = json.data.accessToken;
      localStorage.setItem('vf_access_token', auth.token);
      return true;
    } catch (e) {
      return false;
    }
  }

  function setAuth(d) {
    auth.token = d.accessToken;
    auth.refresh = d.refreshToken;
    auth.customer = d.customer;
    localStorage.setItem('vf_access_token', auth.token);
    localStorage.setItem('vf_refresh_token', auth.refresh);
    localStorage.setItem('vf_customer', JSON.stringify(auth.customer));
    renderAuth();
  }

  function clearAuth() {
    auth.token = null;
    auth.refresh = null;
    auth.customer = null;
    localStorage.removeItem('vf_access_token');
    localStorage.removeItem('vf_refresh_token');
    localStorage.removeItem('vf_customer');
    renderAuth();
  }

  // ── Cart ───────────────────────────────────────
  function getCart() { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
  function setCart(c) {
    localStorage.setItem(CART_KEY, JSON.stringify(c));
    renderCartBadge();
  }
  function cartCount() { return getCart().reduce(function (s, i) { return s + i.quantity; }, 0); }
  function cartTotal() {
    return getCart().reduce(function (s, i) { return s + priceNum(i) * i.quantity; }, 0);
  }
  function addToCart(p) {
    var cart = getCart();
    var found = null;
    for (var i = 0; i < cart.length; i++) { if (cart[i].id === p.id) { found = cart[i]; break; } }
    if (found) found.quantity += 1;
    else cart.push({
      id: p.id, slug: p.slug, name: p.name, price: p.price,
      salePrice: p.salePrice, image: (p.images && p.images[0]) || '', unit: p.unit, quantity: 1,
    });
    setCart(cart);
    renderCart();
    toast('Đã thêm "' + p.name + '" vào giỏ');
  }
  function changeQty(id, delta) {
    var cart = getCart();
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === id) { cart[i].quantity += delta; if (cart[i].quantity <= 0) cart.splice(i, 1); break; }
    }
    setCart(cart);
    renderCart();
  }
  function removeFromCart(id) {
    setCart(getCart().filter(function (i) { return i.id !== id; }));
    renderCart();
  }

  // ── Toast ──────────────────────────────────────
  var toastTimer = null;
  function toast(msg) {
    var el = $('#vf-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  // ── Data loading ───────────────────────────────
  async function loadCategories() {
    try {
      var json = await api('/categories');
      categories = json.data || [];
    } catch (e) { categories = []; }
    renderChips();
  }

  async function loadProducts() {
    var grid = $('#vf-products');
    if (grid) grid.innerHTML = '<p class="store-empty">Đang tải sản phẩm...</p>';
    try {
      var params = new URLSearchParams({ page: '1', limit: '24', order: 'desc' });
      if (searchQuery) params.set('search', searchQuery);
      if (activeCategory) params.set('categoryId', activeCategory);
      var json = await api('/products?' + params.toString());
      products = json.data || [];
      renderProducts();
    } catch (e) {
      if (grid) grid.innerHTML = '<p class="store-empty">Không tải được sản phẩm. Vui lòng thử lại sau.</p>';
    }
  }

  // ── Rendering ──────────────────────────────────
  function renderChips() {
    var wrap = $('#vf-chips');
    if (!wrap) return;
    var html = '<button class="vf-s-chip' + (activeCategory === '' ? ' active' : '') + '" data-cat="">Tất cả</button>';
    categories.forEach(function (c) {
      html += '<button class="vf-s-chip' + (activeCategory === c.id ? ' active' : '') + '" data-cat="' + escapeHtml(c.id) + '">' +
        escapeHtml(c.name) + '</button>';
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('.vf-s-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        activeCategory = chip.getAttribute('data-cat');
        renderChips();
        loadProducts();
      });
    });
  }

  function renderProducts() {
    var grid = $('#vf-products');
    if (!grid) return;
    if (!products.length) {
      grid.innerHTML = '<p class="store-empty">Không tìm thấy sản phẩm phù hợp.</p>';
      return;
    }
    var html = '';
    products.forEach(function (p) {
      var img = (p.images && p.images[0])
        ? '<img src="' + escapeHtml(p.images[0]) + '" alt="' + escapeHtml(p.name) + '" loading="lazy">'
        : '<div class="vf-s-card-noimg">🌿</div>';
      var soldOut = p.stock != null && Number(p.stock) <= 0;
      html +=
        '<article class="vf-s-card">' +
          '<div class="vf-s-card-img">' + img + (soldOut ? '<span class="vf-s-card-badge">Hết hàng</span>' : '') + '</div>' +
          '<div class="vf-s-card-body">' +
            '<h3 class="vf-s-card-name">' + escapeHtml(p.name) + '</h3>' +
            (p.shortDesc ? '<p class="vf-s-card-desc">' + escapeHtml(p.shortDesc) + '</p>' : '') +
            '<div class="vf-s-card-price">' + priceHtml(p) + '</div>' +
            '<button class="vf-s-add-btn" data-id="' + escapeHtml(p.id) + '"' + (soldOut ? ' disabled' : '') + '>' +
              (soldOut ? 'Hết hàng' : '<i class="ph ph-shopping-cart"></i> Thêm vào giỏ') +
            '</button>' +
          '</div>' +
        '</article>';
    });
    grid.innerHTML = html;
    grid.querySelectorAll('.vf-s-add-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var prod = products.find(function (p) { return p.id === id; });
        if (prod) addToCart(prod);
      });
    });
  }

  function renderCartBadge() {
    var badge = $('#vf-cart-fab .vf-s-fab-badge');
    if (!badge) return;
    var n = cartCount();
    badge.textContent = String(n);
    badge.style.display = n > 0 ? 'flex' : 'none';
  }

  function renderCart() {
    var body = $('#vf-cart-body');
    if (!body) return;
    var cart = getCart();
    if (!cart.length) {
      body.innerHTML = '<p class="vf-s-cart-empty">Giỏ hàng trống</p>';
    } else {
      var html = '';
      cart.forEach(function (i) {
        var img = i.image
          ? '<img src="' + escapeHtml(i.image) + '" alt="">'
          : '<div class="vf-s-cart-noimg">🌿</div>';
        html +=
          '<div class="vf-s-cart-item">' +
            '<div class="vf-s-cart-thumb">' + img + '</div>' +
            '<div class="vf-s-cart-info">' +
              '<p class="vf-s-cart-name">' + escapeHtml(i.name) + '</p>' +
              '<p class="vf-s-cart-unit">' + escapeHtml(formatVND(priceNum(i))) + (i.unit ? ' / ' + escapeHtml(i.unit) : '') + '</p>' +
              '<div class="vf-s-qty">' +
                '<button class="vf-s-qty-btn" data-act="dec" data-id="' + escapeHtml(i.id) + '" aria-label="Giảm">−</button>' +
                '<span>' + i.quantity + '</span>' +
                '<button class="vf-s-qty-btn" data-act="inc" data-id="' + escapeHtml(i.id) + '" aria-label="Tăng">+</button>' +
              '</div>' +
            '</div>' +
            '<div class="vf-s-cart-right">' +
              '<p class="vf-s-cart-line">' + escapeHtml(formatVND(priceNum(i) * i.quantity)) + '</p>' +
              '<button class="vf-s-cart-remove" data-act="rm" data-id="' + escapeHtml(i.id) + '" aria-label="Xóa"><i class="ph ph-trash"></i></button>' +
            '</div>' +
          '</div>';
      });
      body.innerHTML = html;
      body.querySelectorAll('[data-act]').forEach(function (el) {
        el.addEventListener('click', function () {
          var id = el.getAttribute('data-id');
          var act = el.getAttribute('data-act');
          if (act === 'inc') changeQty(id, 1);
          else if (act === 'dec') changeQty(id, -1);
          else if (act === 'rm') removeFromCart(id);
        });
      });
    }
    var totalEl = $('#vf-cart-total');
    if (totalEl) totalEl.textContent = formatVND(cartTotal());
    renderCartFooter();
  }

  function renderCartFooter() {
    var footer = $('#vf-cart-footer');
    if (!footer) return;
    footer.style.display = getCart().length ? '' : 'none';
  }

  function renderAuth() {
    // Trong drawer header
    var slot = $('#vf-cart-auth');
    if (slot) {
      slot.innerHTML = auth.customer
        ? '<span class="vf-s-auth-hello">Xin chào, <strong>' + escapeHtml(auth.customer.name) + '</strong></span>' +
          '<button class="vf-s-link" id="vf-my-orders">Đơn của tôi</button>' +
          '<button class="vf-s-link" id="vf-logout">Đăng xuất</button>'
        : '<button class="vf-s-link" id="vf-open-login">Đăng nhập</button>' +
          '<button class="vf-s-link" id="vf-open-register">Đăng ký</button>';
      var login = $('#vf-open-login'); if (login) login.addEventListener('click', function () { openAuth('login'); });
      var reg = $('#vf-open-register'); if (reg) reg.addEventListener('click', function () { openAuth('register'); });
      var lo = $('#vf-logout'); if (lo) lo.addEventListener('click', logout);
      var mo = $('#vf-my-orders'); if (mo) mo.addEventListener('click', openMyOrders);
    }
    // Trong nav (desktop)
    var nav = $('#vf-nav-account');
    if (nav) {
      nav.innerHTML = auth.customer
        ? '<button class="vf-s-nav-account" id="vf-nav-account-btn"><i class="ph ph-user-circle"></i> ' + escapeHtml(auth.customer.name.split(' ')[0]) + '</button>'
        : '<button class="vf-s-nav-account" id="vf-nav-account-btn"><i class="ph ph-sign-in"></i> Tài khoản</button>';
      var btn = $('#vf-nav-account-btn');
      if (btn) btn.addEventListener('click', function () { openAuth(auth.customer ? 'orders' : 'login'); });
    }
  }

  function logout() {
    clearAuth();
    toast('Đã đăng xuất');
  }

  // ── Drawer ─────────────────────────────────────
  function openCart() {
    var drawer = $('#vf-cart-drawer');
    var overlay = $('#vf-cart-overlay');
    if (drawer) drawer.classList.add('open');
    if (overlay) overlay.classList.add('show');
    renderCart();
  }
  function closeCart() {
    var drawer = $('#vf-cart-drawer');
    var overlay = $('#vf-cart-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
  }

  // ── Auth modal ─────────────────────────────────
  function openAuth(tab) {
    tab = tab === 'register' ? 'register' : 'login';
    var modal = $('#vf-auth-modal');
    if (!modal) return;
    modal.classList.add('show');
    switchAuthTab(tab);
  }
  function closeAuth() { var m = $('#vf-auth-modal'); if (m) m.classList.remove('show'); }
  function switchAuthTab(tab) {
    var tabs = document.querySelectorAll('.vf-s-auth-tab');
    tabs.forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-tab') === tab); });
    var loginF = $('#vf-login-form'); if (loginF) loginF.style.display = tab === 'login' ? '' : 'none';
    var regF = $('#vf-register-form'); if (regF) regF.style.display = tab === 'register' ? '' : 'none';
  }

  async function submitLogin(e) {
    e.preventDefault();
    var form = e.target;
    setAuthError('');
    try {
      var json = await api('/auth/login', {
        method: 'POST',
        body: { phone: form.phone.value.trim(), password: form.password.value },
      });
      setAuth(json.data);
      closeAuth();
      toast('Đăng nhập thành công');
    } catch (err) { setAuthError(err.message); }
  }

  async function submitRegister(e) {
    e.preventDefault();
    var form = e.target;
    setAuthError('');
    if (form.password.value !== form.confirm.value) { setAuthError('Xác nhận mật khẩu không khớp'); return; }
    try {
      var json = await api('/auth/register', {
        method: 'POST',
        body: { phone: form.phone.value.trim(), password: form.password.value, name: form.name.value.trim() },
      });
      setAuth(json.data);
      closeAuth();
      toast('Đăng ký thành công');
    } catch (err) { setAuthError(err.message); }
  }
  function setAuthError(msg) {
    var el = $('#vf-auth-error');
    if (el) { el.textContent = msg || ''; el.style.display = msg ? '' : 'none'; }
  }

  // ── Checkout ───────────────────────────────────
  function openCheckout() {
    if (!getCart().length) { toast('Giỏ hàng đang trống'); return; }
    if (!auth.token) { closeCart(); openAuth('login'); toast('Vui lòng đăng nhập để đặt hàng'); return; }
    closeCart();
    var modal = $('#vf-checkout-modal');
    if (!modal) return;
    var form = $('#vf-checkout-form');
    if (form && auth.customer) {
      form.phone.value = auth.customer.phone || '';
      form.address.value = auth.customer.address || '';
    }
    $('#vf-checkout-total').textContent = formatVND(cartTotal());
    modal.classList.add('show');
  }
  function closeCheckout() { var m = $('#vf-checkout-modal'); if (m) m.classList.remove('show'); }

  async function submitCheckout(e) {
    e.preventDefault();
    var form = e.target;
    var cart = getCart();
    if (!cart.length) return;
    var phone = form.phone.value.trim();
    var address = form.address.value.trim();
    if (!phone || !address) { setCheckoutError('Vui lòng nhập SĐT và địa chỉ giao hàng'); return; }
    setCheckoutError('');
    var btn = $('#vf-checkout-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang đặt hàng...'; }
    try {
      var json = await api('/orders', {
        method: 'POST',
        body: {
          items: cart.map(function (i) { return { productId: i.id, quantity: i.quantity }; }),
          shippingAddress: address,
          shippingPhone: phone,
          paymentMethod: 'COD',
          note: form.note.value.trim(),
        },
      });
      setCart([]);
      closeCheckout();
      showOrderSuccess(json.data);
    } catch (err) {
      setCheckoutError(err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Xác nhận đặt hàng'; }
    }
  }
  function setCheckoutError(msg) {
    var el = $('#vf-checkout-error');
    if (el) { el.textContent = msg || ''; el.style.display = msg ? '' : 'none'; }
  }

  function showOrderSuccess(order) {
    var modal = $('#vf-success-modal');
    var code = $('#vf-success-code');
    if (modal && code) {
      code.textContent = order.orderCode;
      modal.classList.add('show');
    }
  }

  // ── My orders ──────────────────────────────────
  async function openMyOrders() {
    var modal = $('#vf-orders-modal');
    if (!modal) return;
    modal.classList.add('show');
    var body = $('#vf-orders-body');
    if (body) body.innerHTML = '<p class="vf-s-cart-empty">Đang tải...</p>';
    if (!auth.token) { if (body) body.innerHTML = '<p class="vf-s-cart-empty">Vui lòng đăng nhập để xem đơn hàng.</p>'; return; }
    try {
      var json = await api('/orders?page=1&limit=20');
      var orders = json.data || [];
      if (!orders.length) { body.innerHTML = '<p class="vf-s-cart-empty">Bạn chưa có đơn hàng nào.</p>'; return; }
      body.innerHTML = orders.map(renderOrderCard).join('');
    } catch (e) { body.innerHTML = '<p class="vf-s-cart-empty">' + escapeHtml(e.message) + '</p>'; }
  }
  function closeMyOrders() { var m = $('#vf-orders-modal'); if (m) m.classList.remove('show'); }
  function renderOrderCard(o) {
    var items = (o.items || []).map(function (it) {
      return escapeHtml((it.product && it.product.name || 'Sản phẩm') + ' ×' + it.quantity);
    }).join(', ');
    var statusLabel = ORDER_STATUS_LABEL[o.status] || o.status;
    return (
      '<div class="vf-s-order-card">' +
        '<div class="vf-s-order-head">' +
          '<span class="vf-s-order-code">' + escapeHtml(o.orderCode) + '</span>' +
          '<span class="vf-s-order-status st-' + escapeHtml(String(o.status).toLowerCase()) + '">' + escapeHtml(statusLabel) + '</span>' +
        '</div>' +
        '<p class="vf-s-order-items">' + escapeHtml(items) + '</p>' +
        '<div class="vf-s-order-foot">' +
          '<span>' + escapeHtml(formatDate(o.createdAt)) + '</span>' +
          '<strong>' + escapeHtml(formatVND(o.finalAmount)) + '</strong>' +
        '</div>' +
      '</div>'
    );
  }
  function formatDate(v) {
    if (!v) return '';
    try { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v)); }
    catch (e) { return v; }
  }
  var ORDER_STATUS_LABEL = {
    PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', PROCESSING: 'Đang chuẩn bị',
    SHIPPED: 'Đang giao', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy',
    REFUNDING: 'Đang hoàn', REFUNDED: 'Đã hoàn',
  };

  // ── Build UI shells (cart drawer, FAB, modals) ─
  function buildShell() {
    // Toast
    var toastEl = document.createElement('div');
    toastEl.id = 'vf-toast';
    toastEl.className = 'vf-s-toast';
    document.body.appendChild(toastEl);

    // Cart FAB
    var fab = document.createElement('button');
    fab.id = 'vf-cart-fab';
    fab.className = 'vf-s-fab';
    fab.setAttribute('aria-label', 'Mở giỏ hàng');
    fab.innerHTML = '<i class="ph ph-shopping-cart"></i><span class="vf-s-fab-badge">0</span>';
    fab.addEventListener('click', openCart);
    document.body.appendChild(fab);

    // Overlay
    var overlay = document.createElement('div');
    overlay.id = 'vf-cart-overlay';
    overlay.className = 'vf-s-overlay';
    overlay.addEventListener('click', closeCart);
    document.body.appendChild(overlay);

    // Cart drawer
    var drawer = document.createElement('aside');
    drawer.id = 'vf-cart-drawer';
    drawer.className = 'vf-s-drawer';
    drawer.innerHTML =
      '<div class="vf-s-drawer-head">' +
        '<h3><i class="ph ph-shopping-cart"></i> Giỏ hàng</h3>' +
        '<button class="vf-s-close" id="vf-cart-close" aria-label="Đóng"><i class="ph ph-x"></i></button>' +
      '</div>' +
      '<div class="vf-s-cart-auth" id="vf-cart-auth"></div>' +
      '<div class="vf-s-drawer-body" id="vf-cart-body"></div>' +
      '<div class="vf-s-drawer-foot" id="vf-cart-footer">' +
        '<div class="vf-s-cart-total-row"><span>Tổng cộng</span><strong id="vf-cart-total">0đ</strong></div>' +
        '<button class="vf-s-checkout-btn" id="vf-checkout-open">Thanh toán <i class="ph ph-arrow-right"></i></button>' +
      '</div>';
    document.body.appendChild(drawer);

    $('#vf-cart-close').addEventListener('click', closeCart);
    $('#vf-checkout-open').addEventListener('click', openCheckout);

    // Auth modal
    var authModal = document.createElement('div');
    authModal.id = 'vf-auth-modal';
    authModal.className = 'vf-s-modal';
    authModal.innerHTML =
      '<div class="vf-s-modal-card">' +
        '<button class="vf-s-close" id="vf-auth-close" aria-label="Đóng"><i class="ph ph-x"></i></button>' +
        '<div class="vf-s-auth-tabs">' +
          '<button class="vf-s-auth-tab active" data-tab="login">Đăng nhập</button>' +
          '<button class="vf-s-auth-tab" data-tab="register">Đăng ký</button>' +
        '</div>' +
        '<p class="vf-s-error" id="vf-auth-error"></p>' +
        '<form id="vf-login-form">' +
          '<label>Số điện thoại<input name="phone" type="tel" required placeholder="VD: 0901234567" pattern="0[0-9]{9,10}"></label>' +
          '<label>Mật khẩu<input name="password" type="password" required minlength="6" placeholder="Ít nhất 6 ký tự"></label>' +
          '<button type="submit" class="vf-s-submit">Đăng nhập</button>' +
        '</form>' +
        '<form id="vf-register-form" style="display:none">' +
          '<label>Họ tên<input name="name" type="text" required placeholder="Nguyễn Văn A"></label>' +
          '<label>Số điện thoại<input name="phone" type="tel" required placeholder="0901234567" pattern="0[0-9]{9,10}"></label>' +
          '<label>Mật khẩu<input name="password" type="password" required minlength="6" placeholder="Ít nhất 6 ký tự"></label>' +
          '<label>Nhập lại mật khẩu<input name="confirm" type="password" required minlength="6"></label>' +
          '<button type="submit" class="vf-s-submit">Đăng ký</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(authModal);
    $('#vf-auth-close').addEventListener('click', closeAuth);
    document.querySelectorAll('.vf-s-auth-tab').forEach(function (t) {
      t.addEventListener('click', function () { switchAuthTab(t.getAttribute('data-tab')); });
    });
    $('#vf-login-form').addEventListener('submit', submitLogin);
    $('#vf-register-form').addEventListener('submit', submitRegister);

    // Checkout modal
    var co = document.createElement('div');
    co.id = 'vf-checkout-modal';
    co.className = 'vf-s-modal';
    co.innerHTML =
      '<div class="vf-s-modal-card">' +
        '<button class="vf-s-close" id="vf-checkout-close" aria-label="Đóng"><i class="ph ph-x"></i></button>' +
        '<h3 class="vf-s-modal-title">Thanh toán khi nhận hàng (COD)</h3>' +
        '<p class="vf-s-error" id="vf-checkout-error"></p>' +
        '<form id="vf-checkout-form">' +
          '<label>Số điện thoại nhận hàng<input name="phone" type="tel" required pattern="0[0-9]{9,10}"></label>' +
          '<label>Địa chỉ giao hàng<textarea name="address" rows="2" required placeholder="Số nhà, đường, phường/xã, quận/huyện, TP"></textarea></label>' +
          '<label>Ghi chú (tuỳ chọn)<textarea name="note" rows="2" placeholder="Thời gian giao, ghi chú cho shop..."></textarea></label>' +
          '<div class="vf-s-cart-total-row"><span>Tổng thanh toán</span><strong id="vf-checkout-total">0đ</strong></div>' +
          '<button type="submit" class="vf-s-submit" id="vf-checkout-submit">Xác nhận đặt hàng</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(co);
    $('#vf-checkout-close').addEventListener('click', closeCheckout);
    $('#vf-checkout-form').addEventListener('submit', submitCheckout);

    // Success modal
    var succ = document.createElement('div');
    succ.id = 'vf-success-modal';
    succ.className = 'vf-s-modal';
    succ.innerHTML =
      '<div class="vf-s-modal-card vf-s-modal-sm">' +
        '<div class="vf-s-success-icon"><i class="ph ph-check-circle"></i></div>' +
        '<h3 class="vf-s-modal-title">Đặt hàng thành công!</h3>' +
        '<p class="vf-s-success-text">Mã đơn của bạn: <strong id="vf-success-code"></strong></p>' +
        '<p class="vf-s-success-sub">Shop sẽ liên hệ xác nhận sớm. Cảm ơn bạn đã ủng hộ VegiFlow! 🌿</p>' +
        '<button class="vf-s-submit" id="vf-success-close">Đóng</button>' +
      '</div>';
    document.body.appendChild(succ);
    $('#vf-success-close').addEventListener('click', function () {
      var m = $('#vf-success-modal'); if (m) m.classList.remove('show');
      openMyOrders();
    });

    // My orders modal
    var om = document.createElement('div');
    om.id = 'vf-orders-modal';
    om.className = 'vf-s-modal';
    om.innerHTML =
      '<div class="vf-s-modal-card">' +
        '<button class="vf-s-close" id="vf-orders-close" aria-label="Đóng"><i class="ph ph-x"></i></button>' +
        '<h3 class="vf-s-modal-title">Đơn hàng của tôi</h3>' +
        '<div id="vf-orders-body"></div>' +
      '</div>';
    document.body.appendChild(om);
    $('#vf-orders-close').addEventListener('click', closeMyOrders);

    // Đóng modal khi click ra ngoài card
    document.querySelectorAll('.vf-s-modal').forEach(function (m) {
      m.addEventListener('click', function (e) { if (e.target === m) m.classList.remove('show'); });
    });
  }

  // ── Init ───────────────────────────────────────
  function init() {
    buildShell();
    renderCartBadge();
    renderAuth();

    var search = $('#vf-search');
    if (search) {
      var timer = null;
      search.addEventListener('input', function () {
        searchQuery = search.value.trim();
        clearTimeout(timer);
        timer = setTimeout(loadProducts, 300);
      });
    }

    loadCategories();
    loadProducts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
