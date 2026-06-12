/* compare.js — ClearPick product comparison feature */
(function () {
  'use strict';

  let PRODUCTS = null;
  let currentProduct = null;
  // slots[0] = current product (fixed); slots[1-3] = user-added (null = empty)
  const slots = [null, null, null, null];

  /* ─── Utilities ─── */
  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function findCurrentProduct() {
    const path = window.location.pathname;
    return PRODUCTS.find(p => path.endsWith('/' + p.page) || path.includes(p.page));
  }

  /* ─── Bootstrap ─── */
  function init() {
    fetch('../products.json')
      .then(r => r.json())
      .then(data => {
        PRODUCTS = data;
        currentProduct = findCurrentProduct();
        if (!currentProduct) return;
        slots[0] = currentProduct;
        injectUI();
      })
      .catch(() => {}); // silent fail — compare is an enhancement
  }

  /* ─── Inject button + section into existing DOM ─── */
  function injectUI() {
    // Button: inserted after .clearpick-score-section
    const scoreSection = document.querySelector('.clearpick-score-section');
    if (!scoreSection) return;

    const btn = document.createElement('button');
    btn.id = 'compare-btn';
    btn.className = 'compare-btn';
    btn.type = 'button';
    btn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<rect x="2" y="3" width="8" height="8" rx="1"/><rect x="14" y="3" width="8" height="8" rx="1"/>' +
      '<rect x="14" y="13" width="8" height="8" rx="1"/><rect x="2" y="13" width="8" height="8" rx="1"/>' +
      '</svg> Compare';
    scoreSection.insertAdjacentElement('afterend', btn);
    btn.addEventListener('click', toggleCompare);

    // Section: injected after .product-hero, before .product-review
    const hero = document.querySelector('.product-hero');
    if (!hero) return;
    const section = document.createElement('section');
    section.id = 'compare-section';
    section.className = 'compare-section';
    section.setAttribute('hidden', '');
    hero.insertAdjacentElement('afterend', section);
  }

  /* ─── Toggle ─── */
  function toggleCompare() {
    const section = document.getElementById('compare-section');
    if (!section) return;
    if (section.hasAttribute('hidden')) {
      openCompare(section);
    } else {
      closeCompare(section);
    }
  }

  function openCompare(section) {
    // Reset slots 1-3 whenever opening fresh
    slots[1] = slots[2] = slots[3] = null;

    section.removeAttribute('hidden');
    renderSection(section);
    section.getBoundingClientRect(); // force reflow
    section.classList.add('compare-section--visible');

    const btn = document.getElementById('compare-btn');
    if (btn) { btn.classList.add('compare-btn--active'); btn.textContent = '✕ Close Compare'; }

    setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  function closeCompare(section) {
    section.classList.remove('compare-section--visible');
    setTimeout(() => section.setAttribute('hidden', ''), 280);

    const btn = document.getElementById('compare-btn');
    if (btn) {
      btn.classList.remove('compare-btn--active');
      btn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
        '<rect x="2" y="3" width="8" height="8" rx="1"/><rect x="14" y="3" width="8" height="8" rx="1"/>' +
        '<rect x="14" y="13" width="8" height="8" rx="1"/><rect x="2" y="13" width="8" height="8" rx="1"/>' +
        '</svg> Compare';
    }
  }

  /* ─── Render full compare section ─── */
  function renderSection(section) {
    section.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'container';

    // Heading
    const hdr = document.createElement('div');
    hdr.className = 'compare-section__header';
    hdr.innerHTML =
      '<h2 class="compare-section__title">Compare ' + esc(currentProduct.category) + '</h2>' +
      '<p class="compare-section__sub">Select up to 3 products to compare side by side</p>';
    container.appendChild(hdr);

    // Cards
    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'compare-cards-wrap';
    const cardsRow = document.createElement('div');
    cardsRow.className = 'compare-cards';
    cardsRow.id = 'compare-cards';
    for (let i = 0; i < 4; i++) cardsRow.appendChild(buildCard(i));
    cardsWrap.appendChild(cardsRow);
    container.appendChild(cardsWrap);

    // Table placeholder
    const tableWrap = document.createElement('div');
    tableWrap.className = 'compare-table-wrap';
    tableWrap.id = 'compare-table-wrap';
    container.appendChild(tableWrap);

    section.appendChild(container);
    renderTable();
  }

  /* ─── Card ─── */
  function buildCard(slotIdx) {
    const product = slots[slotIdx];
    const isFixed = slotIdx === 0;

    const card = document.createElement('div');
    card.className = 'compare-card' +
      (isFixed ? ' compare-card--current' : '') +
      (product ? ' compare-card--filled' : ' compare-card--empty');
    card.dataset.slot = slotIdx;

    if (!product) {
      const addBtn = document.createElement('button');
      addBtn.className = 'compare-card__add-btn';
      addBtn.type = 'button';
      addBtn.innerHTML = '<span class="compare-card__add-icon">+</span><span>Add Product</span>';
      addBtn.addEventListener('click', () => openPicker(slotIdx));
      card.appendChild(addBtn);
    } else {
      // Score badge
      const badge = document.createElement('div');
      badge.className = 'compare-card__score-badge';
      badge.textContent = product.score;
      card.appendChild(badge);

      // Remove button (not on fixed slot)
      if (!isFixed) {
        const rm = document.createElement('button');
        rm.className = 'compare-card__remove';
        rm.type = 'button';
        rm.setAttribute('aria-label', 'Remove ' + product.name);
        rm.textContent = '×';
        rm.addEventListener('click', () => removeSlot(slotIdx));
        card.appendChild(rm);
      }

      // Image
      const img = document.createElement('img');
      img.className = 'compare-card__img';
      img.src = product.image;
      img.alt = product.name;
      img.loading = 'lazy';
      card.appendChild(img);

      // Text
      const name = document.createElement('div');
      name.className = 'compare-card__name';
      name.textContent = product.name;
      card.appendChild(name);

      const tag = document.createElement('div');
      tag.className = 'compare-card__tag';
      tag.textContent = product.tag;
      card.appendChild(tag);

      const price = document.createElement('div');
      price.className = 'compare-card__price';
      price.textContent = product.price;
      card.appendChild(price);
    }

    return card;
  }

  function replaceCard(slotIdx) {
    const row = document.getElementById('compare-cards');
    if (!row) return;
    const oldCard = row.querySelector('[data-slot="' + slotIdx + '"]');
    if (oldCard) row.replaceChild(buildCard(slotIdx), oldCard);
  }

  function removeSlot(slotIdx) {
    slots[slotIdx] = null;
    replaceCard(slotIdx);
    renderTable();
  }

  /* ─── Picker overlay ─── */
  let activePickerSlot = -1;
  let pickerCandidates = [];

  function openPicker(slotIdx) {
    activePickerSlot = slotIdx;

    const usedIds = new Set(slots.filter(Boolean).map(p => p.id));
    pickerCandidates = PRODUCTS.filter(
      p => p.category === currentProduct.category && !usedIds.has(p.id)
    );

    let overlay = document.getElementById('compare-picker-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'compare-picker-overlay';
      overlay.className = 'compare-picker-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.addEventListener('click', e => { if (e.target === overlay) closePicker(); });
      document.body.appendChild(overlay);
    }

    // Rebuild picker HTML fresh each open (resets search + sort)
    overlay.innerHTML =
      '<div class="compare-picker">' +
        '<div class="compare-picker__header">' +
          '<h3 class="compare-picker__title">Add a ' + esc(currentProduct.category) + ' product</h3>' +
          '<button class="compare-picker__close" type="button" aria-label="Close">×</button>' +
        '</div>' +
        '<div class="compare-picker__controls">' +
          '<input class="compare-picker__search" type="search" placeholder="Search ' + esc(currentProduct.category) + '..." autocomplete="off"/>' +
          '<select class="compare-picker__sort">' +
            '<option value="score">ClearPick Score (High to Low)</option>' +
            '<option value="name">Name (A–Z)</option>' +
            '<option value="price">Price (Low to High)</option>' +
          '</select>' +
        '</div>' +
        '<div class="compare-picker__grid"></div>' +
      '</div>';

    overlay.querySelector('.compare-picker__close').addEventListener('click', closePicker);

    const searchInput = overlay.querySelector('.compare-picker__search');
    const sortSelect  = overlay.querySelector('.compare-picker__sort');

    searchInput.addEventListener('keyup', function () {
      renderPickerGrid(overlay, this.value, sortSelect.value);
    });
    sortSelect.addEventListener('change', function () {
      renderPickerGrid(overlay, searchInput.value, this.value);
    });

    renderPickerGrid(overlay, '', 'score');

    overlay.removeAttribute('hidden');
    document.addEventListener('keydown', pickerEscHandler);
    searchInput.focus();
  }

  function renderPickerGrid(overlay, query, sortKey) {
    const grid = overlay.querySelector('.compare-picker__grid');
    if (!grid) return;

    let visible = pickerCandidates.slice();

    if (query && query.length >= 1) {
      const q = query.toLowerCase();
      visible = visible.filter(p => p.name.toLowerCase().includes(q));
    }

    if (sortKey === 'score') {
      visible.sort((a, b) => b.score - a.score);
    } else if (sortKey === 'name') {
      visible.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortKey === 'price') {
      visible.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    }

    if (!visible.length) {
      grid.innerHTML = '<p class="compare-picker__empty">No products found.</p>';
      return;
    }

    grid.innerHTML = visible.map(p =>
      '<button class="compare-picker__item" type="button" data-id="' + esc(p.id) + '">' +
      '<img class="compare-picker__item-img" src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy"/>' +
      '<span class="compare-picker__item-score">' + esc(p.score) + '</span>' +
      '<span class="compare-picker__item-name">' + esc(p.name) + '</span>' +
      '</button>'
    ).join('');

    grid.querySelectorAll('.compare-picker__item').forEach(btn => {
      btn.addEventListener('click', function () {
        const product = PRODUCTS.find(p => p.id === this.dataset.id);
        if (product) {
          slots[activePickerSlot] = product;
          replaceCard(activePickerSlot);
          renderTable();
        }
        closePicker();
      });
    });
  }

  function parsePrice(priceStr) {
    const n = parseFloat(String(priceStr || '').replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function closePicker() {
    const overlay = document.getElementById('compare-picker-overlay');
    if (overlay) overlay.setAttribute('hidden', '');
    document.removeEventListener('keydown', pickerEscHandler);
    activePickerSlot = -1;
  }

  function pickerEscHandler(e) { if (e.key === 'Escape') closePicker(); }

  /* ─── Comparison table ─── */
  function renderTable() {
    const wrap = document.getElementById('compare-table-wrap');
    if (!wrap) return;

    const filled = slots.filter(Boolean);
    if (filled.length < 2) {
      wrap.innerHTML = '<p class="compare-table__hint">Add at least one product to see a comparison.</p>';
      return;
    }

    // Union of all keys, preserving order of first occurrence
    const subscoreKeys = unionKeys(filled, 'subscores');
    const specKeys     = unionKeys(filled, 'specs');
    const colCount     = filled.length;

    let html = '<div class="compare-table-inner">';

    // ── Subscores ──
    if (subscoreKeys.length) {
      html += buildTable('Score Breakdown', subscoreKeys, filled, colCount, (p, key) => {
        const val = getVal(p, 'subscores', key);
        if (val === null) return '<span class="compare-na">—</span>';
        const pct = Math.round((val / 10) * 100);
        return '<div class="compare-mini-bar"><div class="compare-mini-bar__fill" style="width:' + pct + '%"></div></div>' +
               '<span class="compare-val">' + val + '</span>';
      });
    }

    // ── Specs ──
    if (specKeys.length) {
      html += buildTable('Specs', specKeys, filled, colCount, (p, key) => {
        const val = getVal(p, 'specs', key);
        return val !== null ? '<span>' + esc(val) + '</span>' : '<span class="compare-na">—</span>';
      });
    }

    html += '</div>';
    wrap.innerHTML = html;
  }

  function unionKeys(products, field) {
    const keys = [];
    products.forEach(p => {
      const obj = p[field];
      if (obj) Object.keys(obj).forEach(k => { if (!keys.includes(k)) keys.push(k); });
    });
    return keys;
  }

  function getVal(product, field, key) {
    const obj = product[field];
    if (!obj) return null;
    const v = obj[key];
    return (v === undefined || v === null) ? null : v;
  }

  function buildTable(title, keys, filled, colCount, cellFn) {
    const colStyle = 'grid-template-columns: 150px repeat(' + colCount + ', 1fr)';

    let t = '<div class="compare-table">';
    t += '<div class="compare-table__title">' + esc(title) + '</div>';

    // Header
    t += '<div class="compare-table__row compare-table__row--head" style="' + colStyle + '">';
    t += '<div class="compare-table__cell compare-table__cell--label"></div>';
    filled.forEach(p => {
      t += '<div class="compare-table__cell compare-table__cell--head">' + esc(p.name) + '</div>';
    });
    t += '</div>';

    // Data rows
    keys.forEach((key, idx) => {
      t += '<div class="compare-table__row' + (idx % 2 === 0 ? ' compare-table__row--alt' : '') + '" style="' + colStyle + '">';
      t += '<div class="compare-table__cell compare-table__cell--label">' + esc(key) + '</div>';
      filled.forEach(p => {
        t += '<div class="compare-table__cell">' + cellFn(p, key) + '</div>';
      });
      t += '</div>';
    });

    t += '</div>';
    return t;
  }

  /* ─── Start ─── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
