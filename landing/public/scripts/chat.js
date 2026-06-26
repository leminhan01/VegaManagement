/**
 * VegiFlow Chat Widget — Client-side JavaScript
 * Communicates with POST /webhooks/web/chat API
 */
(function () {
  'use strict';

  // Configurable API base — falls back to localhost:8000
  var API_BASE = (window.__CHATBOT_API_URL__ || 'http://localhost:8000') + '/webhooks/web';
  var SESSION_KEY = 'vegiflow_session_id';

  // ── State ──────────────────────────────────
  var sessionId = localStorage.getItem(SESSION_KEY) || null;
  var isOpen = false;
  var isLoading = false;

  // ── DOM Elements ───────────────────────────
  var chatBtn, chatWindow, messagesContainer, inputField, sendBtn, typingEl;

  function init() {
    // Create floating button
    chatBtn = document.createElement('button');
    chatBtn.className = 'vf-chat-btn';
    chatBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
    chatBtn.setAttribute('aria-label', 'Mở chat');
    chatBtn.addEventListener('click', toggleChat);
    document.body.appendChild(chatBtn);

    // Create chat window
    chatWindow = document.createElement('div');
    chatWindow.className = 'vf-chat-window';
    chatWindow.innerHTML =
      '<div class="vf-chat-header">' +
        '<div class="vf-chat-header-left">' +
          '<div class="vf-chat-header-avatar">🌿</div>' +
          '<div class="vf-chat-header-info">' +
            '<h3>VegiFlow Assistant</h3>' +
            '<span>Trực tuyến</span>' +
          '</div>' +
        '</div>' +
        '<button class="vf-chat-close" aria-label="Đóng chat">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">' +
            '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
          '</svg>' +
        '</button>' +
      '</div>' +
      '<div class="vf-chat-messages"></div>' +
      '<div class="vf-chat-input-area">' +
        '<input class="vf-chat-input" type="text" placeholder="Nhập tin nhắn..." autocomplete="off" />' +
        '<button class="vf-chat-send" aria-label="Gửi" disabled>' +
          '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
        '</button>' +
      '</div>';
    document.body.appendChild(chatWindow);

    // References
    messagesContainer = chatWindow.querySelector('.vf-chat-messages');
    inputField = chatWindow.querySelector('.vf-chat-input');
    sendBtn = chatWindow.querySelector('.vf-chat-send');

    // Events
    chatWindow.querySelector('.vf-chat-close').addEventListener('click', toggleChat);
    inputField.addEventListener('input', onInputChange);
    inputField.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    sendBtn.addEventListener('click', sendMessage);

    // Load existing session or show welcome
    loadSession();
  }

  function toggleChat() {
    isOpen = !isOpen;
    chatWindow.classList.toggle('open', isOpen);
    if (isOpen) {
      inputField.focus();
    }
  }

  function onInputChange() {
    sendBtn.disabled = !inputField.value.trim();
  }

  // ── Session Management ─────────────────────

  async function loadSession() {
    if (sessionId) {
      try {
        var res = await fetch(API_BASE + '/chat/' + sessionId);
        if (res.ok) {
          var data = await res.json();
          data.messages.forEach(function (msg) {
            appendMessage(msg.role, msg.content);
          });
          addNewChatButton();
          return;
        }
      } catch (e) {
        console.warn('Không tải được lịch sử chat:', e);
      }
    }
    // New session welcome
    await createNewSession();
  }

  async function createNewSession() {
    messagesContainer.innerHTML = '';
    sessionId = null;
    localStorage.removeItem(SESSION_KEY);

    try {
      var res = await fetch(API_BASE + '/chat/new', { method: 'POST' });
      if (res.ok) {
        var data = await res.json();
        sessionId = data.session_id;
        localStorage.setItem(SESSION_KEY, sessionId);
        appendMessage('assistant', data.welcome_message);
        addSuggestions();
        addNewChatButton();
      }
    } catch (e) {
      appendMessage('assistant', '🌿 Chào mừng bạn đến với VegiFlow! Em có thể giúp gì cho bạn ạ?');
      addSuggestions();
    }
  }

  function addNewChatButton() {
    var existing = messagesContainer.querySelector('.vf-new-chat-btn');
    if (existing) existing.remove();

    var btn = document.createElement('button');
    btn.className = 'vf-new-chat-btn';
    btn.textContent = '🔄 Chat mới';
    btn.addEventListener('click', function () {
      createNewSession();
    });
    messagesContainer.appendChild(btn);
  }

  function addSuggestions() {
    var suggestions = [
      '🥬 Tư vấn sản phẩm',
      '📍 Địa chỉ cửa hàng',
      '📦 Tra cứu đơn hàng',
    ];
    var container = document.createElement('div');
    container.className = 'vf-suggestions';
    suggestions.forEach(function (text) {
      var btn = document.createElement('button');
      btn.className = 'vf-suggestion-btn';
      btn.textContent = text;
      btn.addEventListener('click', function () {
        inputField.value = text;
        sendMessage();
      });
      container.appendChild(btn);
    });
    messagesContainer.appendChild(container);
    scrollToBottom();
  }

  // ── Messages ───────────────────────────────

  function appendMessage(role, content) {
    var div = document.createElement('div');
    div.className = 'vf-msg vf-msg-' + (role === 'user' ? 'user' : 'bot');
    if (role === 'user') {
      // Tin nhắn user: LUÔN textContent (chống XSS)
      div.textContent = content;
    } else {
      // Tin nhắn bot: render markdown → sanitize → innerHTML
      div.classList.add('vf-msg-md');
      div.innerHTML = renderBotContent(content);
      attachImageLightbox(div);
    }
    messagesContainer.appendChild(div);
    scrollToBottom();
  }

  // Parse markdown của bot thành HTML đã sanitize (chống XSS từ LLM/prompt-injection)
  function renderBotContent(md) {
    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
      // Fallback an toàn nếu thư viện chưa tải xong
      var el = document.createElement('div');
      el.textContent = md == null ? '' : String(md);
      return el.innerHTML.replace(/\n/g, '<br>');
    }
    marked.setOptions({ breaks: true, gfm: true });
    var raw = marked.parse(String(md == null ? '' : md));
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'code', 'img', 'a', 'span', 'div'],
      ALLOWED_ATTR: ['src', 'alt', 'href', 'title', 'class'],
      ALLOW_DATA_ATTR: false,
    });
  }

  // Click ảnh inline của bot → mở lightbox full-screen
  function attachImageLightbox(container) {
    var imgs = container.querySelectorAll('img');
    Array.prototype.forEach.call(imgs, function (img) {
      img.addEventListener('click', function () {
        var lb = document.createElement('div');
        lb.className = 'vf-lightbox';
        var big = document.createElement('img');
        big.src = img.src;
        lb.appendChild(big);
        lb.addEventListener('click', function () { lb.remove(); });
        document.body.appendChild(lb);
      });
    });
  }

  // Định dạng giá VNĐ (có gạch giá cũ nếu đang sale)
  function formatPrice(price, salePrice) {
    var final = salePrice != null ? salePrice : price;
    if (final == null || isNaN(final)) return '';
    var finalStr = Number(final).toLocaleString('vi-VN') + 'đ';
    if (salePrice != null && price != null && Number(salePrice) < Number(price)) {
      return '<span class="vf-pc-sale">' + finalStr + '</span>' +
        '<span class="vf-pc-old">' + Number(price).toLocaleString('vi-VN') + 'đ</span>';
    }
    return finalStr;
  }

  // Render gallery Product Cards (ảnh + tên + giá + nút "Xem chi tiết")
  function appendProductCards(products) {
    if (!products || !products.length) return;
    var gallery = document.createElement('div');
    gallery.className = 'vf-product-gallery';
    products.forEach(function (p) {
      var card = document.createElement('div');
      card.className = 'vf-product-card';
      var name = escapeHtml(p.name || '');
      var desc = escapeHtml(p.short_desc || p.shortDesc || '');
      var priceHtml = formatPrice(p.price, p.sale_price != null ? p.sale_price : p.salePrice);
      var imgHtml = p.image
        ? '<img class="vf-pc-img" src="' + escapeAttr(p.image) + '" alt="' + name + '" loading="lazy">'
        : '<div class="vf-pc-img vf-pc-noimg">🌿</div>';
      var btnHtml = p.slug
        ? '<a class="vf-pc-btn" href="/san-pham/' + escapeAttr(p.slug) + '" target="_blank" rel="noopener">Xem chi tiết</a>'
        : '';
      card.innerHTML = DOMPurify.sanitize(
        imgHtml +
        '<div class="vf-pc-body">' +
          '<div class="vf-pc-name">' + name + '</div>' +
          (priceHtml ? '<div class="vf-pc-price">' + priceHtml + '</div>' : '') +
          (desc ? '<div class="vf-pc-desc">' + desc + '</div>' : '') +
        '</div>' +
        btnHtml
      );
      gallery.appendChild(card);
    });
    messagesContainer.appendChild(gallery);
    scrollToBottom();
  }

  function escapeHtml(s) {
    var el = document.createElement('div');
    el.textContent = s == null ? '' : String(s);
    return el.innerHTML;
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  function showTyping() {
    typingEl = document.createElement('div');
    typingEl.className = 'vf-typing';
    typingEl.innerHTML = '<div class="vf-typing-dot"></div><div class="vf-typing-dot"></div><div class="vf-typing-dot"></div>';
    messagesContainer.appendChild(typingEl);
    scrollToBottom();
  }

  function hideTyping() {
    if (typingEl && typingEl.parentNode) {
      typingEl.remove();
      typingEl = null;
    }
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // ── Send Message ───────────────────────────

  async function sendMessage() {
    var text = inputField.value.trim();
    if (!text || isLoading) return;

    // Clear input
    inputField.value = '';
    sendBtn.disabled = true;

    // Remove suggestions
    var suggestions = messagesContainer.querySelector('.vf-suggestions');
    if (suggestions) suggestions.remove();

    // Show user message
    appendMessage('user', text);
    showTyping();
    isLoading = true;

    try {
      var res = await fetch(API_BASE + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          content: text,
        }),
      });

      hideTyping();

      if (res.ok) {
        var data = await res.json();
        if (!sessionId && data.session_id) {
          sessionId = data.session_id;
          localStorage.setItem(SESSION_KEY, sessionId);
        }
        appendMessage('assistant', data.reply);
        if (data.products && data.products.length) {
          appendProductCards(data.products);
        }
      } else {
        appendMessage('assistant', 'Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau nhé! 🙏');
      }
    } catch (e) {
      hideTyping();
      appendMessage('assistant', 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng và thử lại.');
      console.error('Chat error:', e);
    }

    isLoading = false;
    addNewChatButton();
  }

  // ── Init on DOM ready ──────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
