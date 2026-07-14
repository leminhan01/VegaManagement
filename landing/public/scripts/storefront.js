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
  var productsRequestId = 0;

  // Phân trang sản phẩm. meta từ backend: total, page, limit, totalPages, hasNext, hasPrev.
  var pagination = { page: 1, limit: 8, total: 0, totalPages: 0 };

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
  // Phần trăm giảm giá (0 nếu không có khuyến mãi hợp lệ).
  function pctOff(p) {
    if (p.salePrice == null || Number(p.price) <= 0) return 0;
    if (Number(p.salePrice) >= Number(p.price)) return 0;
    return Math.round((1 - Number(p.salePrice) / Number(p.price)) * 100);
  }
  // Giá cho modal chi tiết: giá hiện tại + giá cũ gạch + tag "−XX%" khi có sale.
  function detailPriceHtml(p) {
    var final = priceNum(p);
    var off = pctOff(p);
    var html = '<span class="vf-s-detail-price-now">' + escapeHtml(formatVND(final)) + '</span>';
    if (p.salePrice != null && Number(p.salePrice) < Number(p.price)) {
      html += '<span class="vf-s-detail-price-old">' + escapeHtml(formatVND(p.price)) + '</span>';
      if (off > 0) html += '<span class="vf-s-detail-price-tag">−' + off + '%</span>';
    }
    return html;
  }

  // ── API helper ─────────────────────────────────
  async function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({}, opts.headers || {});
    // GET công khai không có body là simple request, không cần preflight CORS.
    if (opts.body !== undefined && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    var shouldAttachAuth = opts.auth !== false;
    if (shouldAttachAuth && auth.token) headers['Authorization'] = 'Bearer ' + auth.token;

    var res = await fetch(API_BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    if (res.status === 401 && shouldAttachAuth && auth.token && !opts._retried) {
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
    // Đang ở trang tài khoản → render lại sau khi đăng nhập (không cần reload).
    if (document.getElementById('vf-account-page')) renderAccount();
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
  function addToCart(p, qty) {
    qty = Math.max(1, Number(qty) || 1);
    var cart = getCart();
    var found = null;
    for (var i = 0; i < cart.length; i++) { if (cart[i].id === p.id) { found = cart[i]; break; } }
    if (found) found.quantity += qty;
    else cart.push({
      id: p.id, slug: p.slug, name: p.name, price: p.price,
      salePrice: p.salePrice, image: (p.images && p.images[0]) || '', unit: p.unit, quantity: qty,
    });
    setCart(cart);
    renderCart();
    toast('Đã thêm ' + qty + ' "' + p.name + '" vào giỏ');
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
      var json = await api('/categories', { auth: false });
      categories = json.data || [];
    } catch (e) { categories = []; }
    renderChips();
    renderLandingCategories();
  }

  async function loadProducts() {
    var requestId = ++productsRequestId;
    var grid = $('#vf-products');
    if (grid) grid.innerHTML = '<p class="store-empty">Đang tải sản phẩm...</p>';
    try {
      var params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        order: 'desc',
      });
      if (searchQuery) params.set('search', searchQuery);
      if (activeCategory) params.set('categoryId', activeCategory);
      var json = await api('/products?' + params.toString(), { auth: false });
      if (requestId !== productsRequestId) return;
      products = json.data || [];
      applyMeta(json.meta);
      renderProducts();
      renderPagination();
    } catch (e) {
      if (requestId !== productsRequestId) return;
      products = [];
      pagination.total = 0;
      pagination.totalPages = 0;
      if (grid) grid.innerHTML = '<p class="store-empty">Không tải được sản phẩm. Vui lòng thử lại sau.</p>';
      renderPagination();
    }
  }

  // Cập nhật trạng thái phân trang từ meta của backend.
  function applyMeta(meta) {
    if (!meta || typeof meta !== 'object') {
      pagination.total = products.length;
      pagination.totalPages = products.length ? 1 : 0;
      return;
    }
    pagination.total = Number(meta.total) || 0;
    pagination.totalPages = Number(meta.totalPages) || 0;
    pagination.page = Number(meta.page) || pagination.page;
  }

  // ── Rendering ──────────────────────────────────
  function renderChips() {
    var wrap = $('#vf-chips');
    if (!wrap) return;
    var html = '<button type="button" class="vf-s-chip' + (activeCategory === '' ? ' active' : '') + '" data-cat="" aria-pressed="' + (activeCategory === '' ? 'true' : 'false') + '">Tất cả</button>';
    categories.forEach(function (c) {
      html += '<button type="button" class="vf-s-chip' + (activeCategory === c.id ? ' active' : '') + '" data-cat="' + escapeHtml(c.id) + '" aria-pressed="' + (activeCategory === c.id ? 'true' : 'false') + '">' +
        escapeHtml(c.name) + '</button>';
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('.vf-s-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        selectCategory(chip.getAttribute('data-cat'), false);
      });
    });
  }

  function selectCategory(categoryId, shouldScroll) {
    activeCategory = categoryId || '';
    pagination.page = 1;
    renderChips();

    document.querySelectorAll('#vf-landing-categories .category-card').forEach(function (card) {
      var isActive = card.getAttribute('data-cat') === activeCategory;
      card.classList.toggle('is-active', isActive);
      card.setAttribute('aria-pressed', String(isActive));
    });

    loadProducts();

    if (shouldScroll) {
      var store = $('#store');
      if (store) store.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function fallbackCategoryImage(index) {
    var seeds = [
      'veg-fresh-greens',
      'veg-dried-beans',
      'veg-spice-pot',
      'veg-frozen-dumpling',
      'veg-drink-tea',
      'veg-snack-nuts',
      'veg-supplement',
      'veg-ready-meal',
    ];
    return 'https://picsum.photos/seed/' + seeds[index % seeds.length] + '/700/700';
  }

  function categoryIcon(c) {
    var key = String((c && (c.slug || c.name)) || '').toLowerCase();
    if (key.indexOf('tuoi') >= 0 || key.indexOf('fresh') >= 0 || key.indexOf('rau') >= 0) return 'ph-carrot';
    if (key.indexOf('kho') >= 0 || key.indexOf('dried') >= 0 || key.indexOf('hat') >= 0) return 'ph-plant';
    if (key.indexOf('gia') >= 0 || key.indexOf('season') >= 0) return 'ph-cooking-pot';
    if (key.indexOf('dong') >= 0 || key.indexOf('frozen') >= 0) return 'ph-snowflake';
    if (key.indexOf('uong') >= 0 || key.indexOf('beverage') >= 0) return 'ph-coffee';
    if (key.indexOf('snack') >= 0 || key.indexOf('an-vat') >= 0) return 'ph-cookie';
    if (key.indexOf('sung') >= 0 || key.indexOf('supplement') >= 0) return 'ph-pill';
    if (key.indexOf('san') >= 0 || key.indexOf('ready') >= 0) return 'ph-bowl-food';
    return 'ph-leaf';
  }

  function categoryDesc(c) {
    var key = String((c && (c.slug || c.name)) || '').toLowerCase();
    if (key.indexOf('tuoi') >= 0 || key.indexOf('fresh') >= 0 || key.indexOf('rau') >= 0) return 'Rau củ, trái cây sạch';
    if (key.indexOf('kho') >= 0 || key.indexOf('dried') >= 0 || key.indexOf('hat') >= 0) return 'Hạt, đậu, nấm khô';
    if (key.indexOf('gia') >= 0 || key.indexOf('season') >= 0) return 'Nước chấm, gia vị chay';
    if (key.indexOf('dong') >= 0 || key.indexOf('frozen') >= 0) return 'Món chay tiện lợi';
    if (key.indexOf('uong') >= 0 || key.indexOf('beverage') >= 0) return 'Trà, nước ép, sinh tố';
    if (key.indexOf('snack') >= 0 || key.indexOf('an-vat') >= 0) return 'Snack chay, hạt rang';
    if (key.indexOf('sung') >= 0 || key.indexOf('supplement') >= 0) return 'Dinh dưỡng thực vật';
    if (key.indexOf('san') >= 0 || key.indexOf('ready') >= 0) return 'Đồ hộp, món ăn nhanh';
    return 'Khám phá sản phẩm phù hợp';
  }

  function renderLandingCategories() {
    var grid = $('#vf-landing-categories');
    if (!grid || !categories.length) return;

    grid.innerHTML = categories.map(function (c, i) {
      var isWide = i === 0 || (categories.length > 5 && i === categories.length - 1);
      var image = c.image || fallbackCategoryImage(i);
      return (
        '<article class="category-card reveal reveal-delay-' + ((i % 4) + 1) + (isWide ? ' category-card--wide' : '') + '" data-cat="' + escapeHtml(c.id) + '" role="button" tabindex="0" aria-controls="vf-products" aria-pressed="false" aria-label="Xem sản phẩm ' + escapeHtml(c.name) + '">' +
          '<div class="category-image" aria-hidden="true">' +
            '<img src="' + escapeHtml(image) + '" alt="" loading="lazy" />' +
          '</div>' +
          '<div class="category-overlay" aria-hidden="true"></div>' +
          '<div class="category-content">' +
            '<span class="category-icon" aria-hidden="true"><i class="ph ' + categoryIcon(c) + '"></i></span>' +
            '<div class="category-meta">' +
              '<h3 class="category-title">' + escapeHtml(c.name) + '</h3>' +
              '<p class="category-desc">' + escapeHtml(categoryDesc(c)) + '</p>' +
            '</div>' +
            '<span class="category-arrow" aria-hidden="true"><i class="ph ph-arrow-up-right"></i></span>' +
          '</div>' +
        '</article>'
      );
    }).join('');

    grid.querySelectorAll('.category-card').forEach(function (card) {
      card.addEventListener('click', function () {
        selectCategory(card.getAttribute('data-cat'), true);
      });
      card.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectCategory(card.getAttribute('data-cat'), true);
      });
    });

    // Card vừa inject mang .reveal (opacity:0) nhưng được thêm SAU khi observer ở
    // Layout.astro đã quét xong → đăng ký lại để hiện ra + chạy animation fade-up.
    grid.querySelectorAll('.reveal').forEach(function (el) {
      if (typeof window.vfReveal === 'function') window.vfReveal(el);
      else el.classList.add('visible');
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
        '<article class="vf-s-card" data-slug="' + escapeHtml(p.slug) + '" tabindex="0" role="button" aria-label="Xem chi tiết ' + escapeHtml(p.name) + '">' +
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
    grid.querySelectorAll('.vf-s-card').forEach(function (card) {
      var open = function () { openProductDetail(card.getAttribute('data-slug')); };
      card.addEventListener('click', function (e) {
        // Click nút "Thêm vào giỏ" không mở modal chi tiết.
        if (e.target.closest('.vf-s-add-btn')) return;
        open();
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
    grid.querySelectorAll('.vf-s-add-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-id');
        var prod = products.find(function (p) { return p.id === id; });
        if (prod) addToCart(prod);
      });
    });
  }

  // ── Pagination ─────────────────────────────────
  // Tạo danh sách số trang có dấu "…" cho khoảng trống (luôn giữ trang đầu/cuối).
  function pageList(cur, total) {
    var span = 1; // số trang hai bên trang hiện tại
    var out = [];
    for (var i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= cur - span && i <= cur + span)) {
        out.push(i);
      } else if (out[out.length - 1] !== '…') {
        out.push('…');
      }
    }
    return out;
  }

  function renderPagination() {
    var wrap = $('#vf-pagination');
    if (!wrap) return;
    if (pagination.totalPages <= 1) { wrap.innerHTML = ''; return; }

    var cur = pagination.page;
    var total = pagination.totalPages;
    var pages = pageList(cur, total);

    var html = '';
    html += '<button class="vf-s-page-btn vf-s-page-nav" data-page="' + (cur - 1) + '"' +
      (cur <= 1 ? ' disabled' : '') + ' aria-label="Trang trước"><i class="ph ph-caret-left"></i></button>';
    pages.forEach(function (p) {
      if (p === '…') {
        html += '<span class="vf-s-page-ellipsis" aria-hidden="true">…</span>';
      } else {
        html += '<button class="vf-s-page-btn' + (p === cur ? ' active' : '') +
          '" data-page="' + p + '"' + (p === cur ? ' aria-current="page"' : '') + '>' + p + '</button>';
      }
    });
    html += '<button class="vf-s-page-btn vf-s-page-nav" data-page="' + (cur + 1) + '"' +
      (cur >= total ? ' disabled' : '') + ' aria-label="Trang sau"><i class="ph ph-caret-right"></i></button>';

    wrap.innerHTML = html;
    wrap.querySelectorAll('.vf-s-page-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var p = Number(btn.getAttribute('data-page'));
        if (p && p !== cur) goToPage(p);
      });
    });
  }

  function goToPage(p) {
    pagination.page = p;
    loadProducts();
    var store = document.getElementById('store');
    if (store) store.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Product detail modal ───────────────────────
  var detailQty = 1;
  var currentDetail = null; // sản phẩm đang mở trong modal chi tiết

  // Mở modal chi tiết. Ưu tiên lấy từ danh sách đã load (đủ field), fallback fetch theo slug.
  async function openProductDetail(slug) {
    if (!slug) return;
    var p = products.find(function (x) { return x.slug === slug; });
    if (!p) {
      var body = $('#vf-detail-body');
      if (body) body.innerHTML = '<p class="vf-s-detail-loading">Đang tải...</p>';
      openDetailModal();
      try {
        var json = await api('/products/' + encodeURIComponent(slug), { auth: false });
        p = json.data || json;
      } catch (e) {
        if (body) body.innerHTML = '<p class="vf-s-detail-loading">Không tải được thông tin sản phẩm.</p>';
        return;
      }
    }
    currentDetail = p;
    detailQty = 1;
    renderProductDetail(p);
    openDetailModal();
  }

  function openDetailModal() {
    var m = $('#vf-detail-modal');
    if (m) m.classList.add('show');
  }
  function closeProductDetail() {
    var m = $('#vf-detail-modal');
    if (m) m.classList.remove('show');
    currentDetail = null;
  }

  function detailStockState(p) {
    if (p.stock == null) return { label: '', cls: '', soldOut: false };
    var n = Number(p.stock);
    if (n <= 0) return { label: 'Hết hàng', cls: 'out', soldOut: true };
    if (n <= 5) return { label: 'Chỉ còn ' + n + ' sản phẩm', cls: 'low', soldOut: false };
    return { label: 'Còn hàng', cls: 'ok', soldOut: false };
  }

  function renderProductDetail(p) {
    var body = $('#vf-detail-body');
    if (!body || !p) return;

    var imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    var stock = detailStockState(p);
    var cat = p.category && p.category.name ? escapeHtml(p.category.name) : '';

    // Cột ảnh — ảnh chính (kèm badge %KM) + dải thumbnail nếu có nhiều ảnh.
    var off = pctOff(p);
    var saleBadge = off > 0 ? '<span class="vf-s-detail-sale-badge">−' + off + '%</span>' : '';
    var mainMedia = imgs.length
      ? '<img src="' + escapeHtml(imgs[0]) + '" alt="' + escapeHtml(p.name) + '">'
      : '<div class="vf-s-card-noimg">🌿</div>';
    var gallery =
      '<div class="vf-s-detail-gallery">' +
        '<div class="vf-s-detail-main" id="vf-detail-main">' + saleBadge + mainMedia + '</div>' +
        (imgs.length > 1
          ? '<div class="vf-s-detail-thumbs">' +
              imgs.map(function (src, i) {
                return '<button class="vf-s-detail-thumb' + (i === 0 ? ' active' : '') +
                  '" data-src="' + escapeHtml(src) + '"><img src="' + escapeHtml(src) + '" alt=""></button>';
              }).join('') +
            '</div>'
          : '') +
      '</div>';

    // Dải tin cậy — tín hiệu thương mại cho khách mua thực phẩm chay.
    var trust =
      '<ul class="vf-s-detail-trust">' +
        '<li><i class="ph ph-leaf"></i><span>100% thực vật</span></li>' +
        '<li><i class="ph ph-hand-coins"></i><span>Thanh toán khi nhận</span></li>' +
        '<li><i class="ph ph-truck"></i><span>Giao tận nơi</span></li>' +
      '</ul>';

    // Cột thông tin.
    var info =
      '<div class="vf-s-detail-info">' +
        (cat ? '<span class="vf-s-detail-cat">' + cat + '</span>' : '') +
        '<h2 class="vf-s-detail-name">' + escapeHtml(p.name) + '</h2>' +
        trust +
        '<div class="vf-s-detail-price">' + detailPriceHtml(p) + '</div>' +
        (stock.label ? '<span class="vf-s-detail-stock st-' + stock.cls + '"><i class="ph ' +
          (stock.soldOut ? 'ph-x-circle' : 'ph-check-circle') + '"></i> ' + escapeHtml(stock.label) + '</span>' : '') +
        (p.shortDesc ? '<p class="vf-s-detail-short">' + escapeHtml(p.shortDesc) + '</p>' : '') +
        renderDetailMeta(p) +
        (p.description
          ? '<div class="vf-s-detail-desc-block">' +
              '<h4 class="vf-s-detail-section-title">Mô tả sản phẩm</h4>' +
              '<p class="vf-s-detail-desc">' + escapeHtml(p.description) + '</p>' +
            '</div>'
          : '') +
        renderDetailActions(stock.soldOut) +
      '</div>';

    body.innerHTML = '<div class="vf-s-detail-grid">' + gallery + info + '</div>';

    // Thumbnail → đổi ảnh chính.
    body.querySelectorAll('.vf-s-detail-thumb').forEach(function (t) {
      t.addEventListener('click', function () {
        var main = $('#vf-detail-main');
        if (main) main.innerHTML = '<img src="' + escapeHtml(t.getAttribute('data-src')) + '" alt="' + escapeHtml(p.name) + '">';
        body.querySelectorAll('.vf-s-detail-thumb').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
      });
    });

    // Quantity + thêm vào giỏ.
    var dec = body.querySelector('[data-detail-act="dec"]');
    var inc = body.querySelector('[data-detail-act="inc"]');
    var addBtn = body.querySelector('[data-detail-act="add"]');
    var qtyEl = body.querySelector('#vf-detail-qty');
    if (dec) dec.addEventListener('click', function () { setDetailQty(-1, qtyEl); });
    if (inc) inc.addEventListener('click', function () { setDetailQty(1, qtyEl); });
    if (addBtn) addBtn.addEventListener('click', function () {
      addToCart(currentDetail, detailQty);
      closeProductDetail();
    });
  }

  function renderDetailMeta(p) {
    var rows = '';
    if (p.unit) rows += '<div><span>Đơn vị</span><strong>' + escapeHtml(p.unit) + '</strong></div>';
    if (p.origin) rows += '<div><span>Xuất xứ</span><strong>' + escapeHtml(p.origin) + '</strong></div>';
    if (Array.isArray(p.tags) && p.tags.length) {
      rows += '<div class="vf-s-detail-tags">' +
        p.tags.map(function (t) { return '<span class="vf-s-detail-tag">' + escapeHtml(t) + '</span>'; }).join('') +
      '</div>';
    }
    return rows ? '<dl class="vf-s-detail-meta">' + rows + '</dl>' : '';
  }

  function renderDetailActions(soldOut) {
    if (soldOut) {
      return '<div class="vf-s-detail-actions"><button class="vf-s-submit" disabled>Hết hàng</button></div>';
    }
    return (
      '<div class="vf-s-detail-actions">' +
        '<div class="vf-s-qty vf-s-detail-qty">' +
          '<button class="vf-s-qty-btn" data-detail-act="dec" aria-label="Giảm">−</button>' +
          '<span id="vf-detail-qty">1</span>' +
          '<button class="vf-s-qty-btn" data-detail-act="inc" aria-label="Tăng">+</button>' +
        '</div>' +
        '<button class="vf-s-submit" data-detail-act="add"><i class="ph ph-shopping-cart"></i> Thêm vào giỏ</button>' +
      '</div>'
    );
  }

  function setDetailQty(delta, qtyEl) {
    detailQty = Math.max(1, detailQty + delta);
    if (qtyEl) qtyEl.textContent = String(detailQty);
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
      body.innerHTML =
        '<div class="vf-s-cart-empty">' +
          '<div class="vf-s-cart-empty-icon"><i class="ph ph-shopping-cart"></i></div>' +
          '<h4 class="vf-s-cart-empty-title">Giỏ hàng của bạn đang trống</h4>' +
          '<p class="vf-s-cart-empty-sub">Khám phá các sản phẩm chay tươi sạch và thêm vào giỏ nhé!</p>' +
          '<button class="vf-s-cart-empty-btn" id="vf-cart-continue">Tiếp tục mua sắm</button>' +
        '</div>';
      var cont = $('#vf-cart-continue');
      if (cont) cont.addEventListener('click', closeCart);
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
    // Số loại SP ở header drawer + nhãn "Tạm tính (N sản phẩm)" ở footer.
    var countEl = $('#vf-cart-count');
    if (countEl) countEl.textContent = String(cart.length);
    var labelEl = $('#vf-cart-total-label');
    if (labelEl) {
      var items = cartCount();
      labelEl.textContent = 'Tạm tính (' + items + ' sản phẩm)';
    }
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
      if (btn) btn.addEventListener('click', function () {
        if (auth.customer) window.location.href = '/don-hang';
        else openAuth('login');
      });
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
        auth: false,
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
        auth: false,
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
  function orderSkeleton() {
    var html = '';
    for (var i = 0; i < 3; i++) {
      html +=
        '<div class="vf-s-ord-skeleton">' +
          '<div class="bar w45"></div>' +
          '<div class="bar w90 h8"></div>' +
          '<div class="bar w70 h8"></div>' +
          '<div class="bar w40"></div>' +
        '</div>';
    }
    return html;
  }
  function orderEmpty(icon, title, sub) {
    return (
      '<div class="vf-s-ord-empty">' +
        '<i class="ph ' + icon + '"></i>' +
        '<p class="vf-s-ord-empty-title">' + escapeHtml(title) + '</p>' +
        '<p class="vf-s-ord-empty-sub">' + escapeHtml(sub) + '</p>' +
      '</div>'
    );
  }
  // Vẽ danh sách đơn vào một container (dùng chung cho trang tài khoản).
  async function loadOrdersInto(body, sub) {
    if (!body) return;
    if (sub) sub.textContent = '';
    if (!auth.token) { body.innerHTML = ''; return; }
    body.innerHTML = orderSkeleton();
    try {
      var json = await api('/orders?page=1&limit=20');
      var orders = json.data || [];
      if (!orders.length) {
        body.innerHTML = orderEmpty('ph-package', 'Chưa có đơn hàng nào', 'Khi bạn đặt hàng, đơn sẽ hiển thị tại đây.');
        return;
      }
      if (sub) sub.textContent = orders.length + ' đơn hàng';
      body.innerHTML = orders.map(renderOrderCard).join('');
    } catch (e) {
      body.innerHTML = orderEmpty('ph-warning-circle', 'Không tải được đơn hàng', (e.message || 'Có lỗi xảy ra') + '. Vui lòng thử lại sau.');
    }
  }
  // Mở trang "Đơn hàng của tôi" (route riêng /don-hang) thay vì modal.
  function openMyOrders() {
    window.location.href = '/don-hang';
  }

  // ── Trang tài khoản (/don-hang) ────────────────
  function formatDateMember(v) {
    if (!v) return '';
    try { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(new Date(v)); }
    catch (e) { return v; }
  }
  function renderProfile(c) {
    var box = $('#vf-account-profile');
    if (!box) return;
    if (!c) { box.innerHTML = ''; return; }
    var initial = ((c.name || '?').trim().charAt(0) || '?').toUpperCase();
    var rows = '';
    if (c.email) rows += '<div><dt>Email</dt><dd>' + escapeHtml(c.email) + '</dd></div>';
    if (c.address) rows += '<div><dt>Địa chỉ</dt><dd>' + escapeHtml(c.address) + '</dd></div>';
    if (c.createdAt) rows += '<div><dt>Thành viên từ</dt><dd>' + escapeHtml(formatDateMember(c.createdAt)) + '</dd></div>';
    box.innerHTML =
      '<div class="vf-profile-top">' +
        '<div class="vf-profile-avatar" aria-hidden="true">' + escapeHtml(initial) + '</div>' +
        '<div class="vf-profile-id">' +
          '<h2 class="vf-profile-name">' + escapeHtml(c.name || 'Khách hàng') + '</h2>' +
          '<p class="vf-profile-phone"><i class="ph ph-phone"></i> ' + escapeHtml(c.phone || '') + '</p>' +
        '</div>' +
      '</div>' +
      '<dl class="vf-profile-meta">' + rows + '</dl>';
  }
  function showAccountGate(show) {
    var gate = $('#vf-account-gate');
    var content = $('#vf-account-content');
    if (gate) gate.hidden = !show;
    if (content) content.hidden = show;
  }
  // Gắn sự kiện một lần (.onclick tránh trùng listener khi render lại).
  function wireAccountPage() {
    var loginBtn = $('#vf-account-login');
    if (loginBtn) loginBtn.onclick = function () { openAuth('login'); };
    var lo = $('#vf-account-logout');
    if (lo) lo.onclick = function () { logout(); renderAccount(); };
  }
  async function renderAccount() {
    if (!auth.token) {
      showAccountGate(true);
      var b = $('#vf-orders-body'); if (b) b.innerHTML = '';
      var s = $('#vf-orders-sub'); if (s) s.textContent = '';
      return;
    }
    showAccountGate(false);
    var greet = $('#vf-account-greet');
    var profBox = $('#vf-account-profile');
    if (profBox) profBox.innerHTML =
      '<div class="vf-profile-loading"><span class="bar w40"></span><span class="bar w90 h8"></span><span class="bar w70 h8"></span></div>';
    try {
      var me = await api('/me');
      renderProfile(me.data);
      var nm = (me.data && me.data.name) || (auth.customer && auth.customer.name) || 'bạn';
      if (greet) greet.textContent = 'Xin chào, ' + nm;
    } catch (e) {
      renderProfile(auth.customer);
      if (greet) greet.textContent = auth.customer ? 'Xin chào, ' + (auth.customer.name || 'bạn') : '';
    }
    loadOrdersInto($('#vf-orders-body'), $('#vf-orders-sub'));
  }
  function initAccountPage() {
    wireAccountPage();
    renderAccount();
  }
  var ORDER_STATUS_ICON = {
    PENDING: 'ph-clock', CONFIRMED: 'ph-check-circle', PROCESSING: 'ph-cooking-pot',
    SHIPPED: 'ph-truck', DELIVERED: 'ph-package-check', CANCELLED: 'ph-x-circle',
    REFUNDING: 'ph-arrow-counter-clockwise', REFUNDED: 'ph-receipt',
  };

  function orderItemCount(o) {
    return (o.items || []).reduce(function (s, it) { return s + (Number(it.quantity) || 0); }, 0);
  }
  // Vị trí bước trên thanh tiến trình (0..4). undefined khi trạng thái không thuộc luồng chính.
  function orderStepIndex(status) {
    var map = { PENDING: 0, CONFIRMED: 1, PROCESSING: 2, SHIPPED: 3, DELIVERED: 4 };
    return map[status];
  }
  function renderOrderProgress(status) {
    var steps = ['Đặt hàng', 'Đã xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Đã giao'];
    var current = orderStepIndex(status);
    if (current == null) return '';
    var dots = '';
    for (var i = 0; i < steps.length; i++) {
      dots += '<span class="vf-s-ord-step ' + (i <= current ? 'done' : 'todo') + '"></span>';
    }
    return (
      '<div class="vf-s-order-progress" aria-label="Tiến trình đơn hàng">' +
        '<span class="vf-s-ord-track">' + dots + '</span>' +
        '<span class="vf-s-ord-step-label">' + escapeHtml(steps[current]) + '</span>' +
      '</div>'
    );
  }
  function renderOrderCard(o) {
    var items = o.items || [];
    var itemCount = orderItemCount(o);
    var status = String(o.status || '').toUpperCase();
    var statusLabel = ORDER_STATUS_LABEL[status] || o.status || '';
    var statusIcon = ORDER_STATUS_ICON[status] || 'ph-package';
    var statusCls = 'st-' + status.toLowerCase();
    var isNegative = status === 'CANCELLED' || status === 'REFUNDING' || status === 'REFUNDED';

    var itemRows = items.slice(0, 3).map(function (it) {
      var name = (it.product && it.product.name) || 'Sản phẩm';
      var qty = Number(it.quantity) || 0;
      return (
        '<li>' +
          '<span class="vf-s-ord-item-name">' + escapeHtml(name) + '</span>' +
          '<span class="vf-s-ord-item-qty">×' + qty + '</span>' +
        '</li>'
      );
    }).join('');
    var moreRow = items.length > 3
      ? '<li class="vf-s-ord-item-more">+' + (items.length - 3) + ' sản phẩm khác</li>'
      : '';

    var progressHtml = isNegative
      ? '<p class="vf-s-ord-note"><i class="ph ' + statusIcon + '"></i> ' +
        escapeHtml(status === 'CANCELLED' ? 'Đơn hàng đã bị hủy.' : 'Đơn hàng đang hoàn tiền.') + '</p>'
      : renderOrderProgress(status);

    return (
      '<article class="vf-s-order-card ' + statusCls + '">' +
        '<div class="vf-s-order-accent" aria-hidden="true"></div>' +
        '<div class="vf-s-order-main">' +
          '<div class="vf-s-order-head">' +
            '<span class="vf-s-order-status ' + statusCls + '">' +
              '<i class="ph ' + statusIcon + '"></i>' + escapeHtml(statusLabel) +
            '</span>' +
            '<span class="vf-s-order-code">' + escapeHtml(o.orderCode) + '</span>' +
          '</div>' +
          '<div class="vf-s-order-items-wrap">' +
            '<span class="vf-s-order-count"><i class="ph ph-package"></i> ' + itemCount + ' sản phẩm</span>' +
            '<ul class="vf-s-order-items">' + itemRows + moreRow + '</ul>' +
          '</div>' +
          progressHtml +
          '<div class="vf-s-order-foot">' +
            '<span class="vf-s-order-date"><i class="ph ph-calendar-blank"></i> ' + escapeHtml(formatDate(o.createdAt)) + '</span>' +
            '<span class="vf-s-order-total">' +
              '<span class="vf-s-order-total-label">Tổng</span>' +
              '<span class="vf-s-order-total-amount">' + escapeHtml(formatVND(o.finalAmount)) + '</span>' +
            '</span>' +
          '</div>' +
        '</div>' +
      '</article>'
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
        '<h3><i class="ph ph-shopping-cart"></i> Giỏ hàng <span class="vf-s-drawer-count" id="vf-cart-count">0</span></h3>' +
        '<button class="vf-s-close" id="vf-cart-close" aria-label="Đóng"><i class="ph ph-x"></i></button>' +
      '</div>' +
      '<div class="vf-s-cart-auth" id="vf-cart-auth"></div>' +
      '<div class="vf-s-drawer-body" id="vf-cart-body"></div>' +
      '<div class="vf-s-drawer-foot" id="vf-cart-footer">' +
        '<div class="vf-s-cart-freeship"><i class="ph ph-truck"></i> Miễn phí giao hàng từ 300.000đ</div>' +
        '<div class="vf-s-cart-total-row"><span id="vf-cart-total-label">Tạm tính</span><strong id="vf-cart-total">0đ</strong></div>' +
        '<button class="vf-s-checkout-btn" id="vf-checkout-open">Tiến hành thanh toán <i class="ph ph-arrow-right"></i></button>' +
        '<button class="vf-s-cart-orders" id="vf-cart-orders">Xem đơn hàng của tôi</button>' +
      '</div>';
    document.body.appendChild(drawer);

    $('#vf-cart-close').addEventListener('click', closeCart);
    $('#vf-checkout-open').addEventListener('click', openCheckout);
    $('#vf-cart-orders').addEventListener('click', openMyOrders);

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

    // Product detail modal — body được fill động bởi renderProductDetail().
    var detail = document.createElement('div');
    detail.id = 'vf-detail-modal';
    detail.className = 'vf-s-modal';
    detail.innerHTML =
      '<div class="vf-s-modal-card vf-s-modal-lg">' +
        '<button class="vf-s-close" id="vf-detail-close" aria-label="Đóng"><i class="ph ph-x"></i></button>' +
        '<div id="vf-detail-body"></div>' +
      '</div>';
    document.body.appendChild(detail);
    $('#vf-detail-close').addEventListener('click', closeProductDetail);

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
        pagination.page = 1; // đổi từ khoá tìm → về trang 1
        clearTimeout(timer);
        timer = setTimeout(loadProducts, 300);
      });
    }

    if (document.getElementById('vf-account-page')) {
      initAccountPage();
    } else {
      loadCategories();
      loadProducts();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
