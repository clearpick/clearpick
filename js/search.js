(function () {
  var inSubdir = /\/(products|blog)\//.test(window.location.pathname);
  var jsonPath = inSubdir ? '../products.json' : 'products.json';
  var pagePrefix = inSubdir ? '../' : '';

  var PRODUCTS = [];
  fetch(jsonPath)
    .then(function (r) { return r.json(); })
    .then(function (data) { PRODUCTS = data; })
    .catch(function () { PRODUCTS = []; });

  function hl(text, q) {
    return text.replace(
      new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'),
      '<mark>$1</mark>'
    );
  }

  function initSearch(wrapId, inputId, resultsId, clearId) {
    var wrapEl = document.getElementById(wrapId);
    var inputEl = document.getElementById(inputId);
    var resultsEl = document.getElementById(resultsId);
    var clearEl = document.getElementById(clearId);
    if (!wrapEl || !inputEl || !resultsEl) return;

    var activeIdx = -1;

    function runSearch(query) {
      if (!query || query.length < 2) { closeResults(); return; }
      var q = query.toLowerCase();
      var matches = PRODUCTS.filter(function (p) {
        return p.name.toLowerCase().includes(q) ||
               p.tag.toLowerCase().includes(q) ||
               p.category.toLowerCase().includes(q);
      }).slice(0, 8);

      if (!matches.length) {
        resultsEl.innerHTML = '<li class="search-results__empty">No results for <strong>' + query + '</strong></li>';
        resultsEl.hidden = false;
        inputEl.setAttribute('aria-expanded', 'true');
        return;
      }
      resultsEl.innerHTML = matches.map(function (p, i) {
        return '<li class="search-results__item" role="option" data-idx="' + i + '" data-page="' + pagePrefix + p.page + '">' +
          '<span class="search-results__icon">' + p.icon + '</span>' +
          '<span class="search-results__text">' +
            '<span class="search-results__name">' + hl(p.name, query) + '</span>' +
            '<span class="search-results__meta">' + p.tag + ' · ' + p.category + '</span>' +
          '</span>' +
          '<span class="search-results__arrow">→</span></li>';
      }).join('');
      resultsEl.hidden = false;
      inputEl.setAttribute('aria-expanded', 'true');
      activeIdx = -1;
      resultsEl.querySelectorAll('.search-results__item').forEach(function (item) {
        item.addEventListener('mousedown', function (e) {
          e.preventDefault();
          window.location.href = item.dataset.page;
          closeResults();
        });
      });
    }

    function closeResults() {
      resultsEl.hidden = true;
      inputEl.setAttribute('aria-expanded', 'false');
      activeIdx = -1;
    }

    function setActive(idx) {
      resultsEl.querySelectorAll('.search-results__item').forEach(function (el, i) {
        el.classList.toggle('search-results__item--active', i === idx);
      });
      activeIdx = idx;
    }

    inputEl.addEventListener('input', function () {
      var v = inputEl.value.trim();
      if (clearEl) clearEl.hidden = !v;
      runSearch(v);
    });

    inputEl.addEventListener('keydown', function (e) {
      var items = resultsEl.querySelectorAll('.search-results__item');
      if (e.key === 'ArrowDown') {
        e.preventDefault(); setActive(Math.min(activeIdx + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); setActive(Math.max(activeIdx - 1, 0));
      } else if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault();
        var pg = items[activeIdx] && items[activeIdx].dataset.page;
        if (pg) { window.location.href = pg; closeResults(); }
      } else if (e.key === 'Escape') {
        closeResults();
      }
    });

    if (clearEl) {
      clearEl.addEventListener('click', function () {
        inputEl.value = ''; clearEl.hidden = true; closeResults(); inputEl.focus();
      });
    }

    inputEl.addEventListener('focus', function () {
      if (inputEl.value.trim().length >= 2) runSearch(inputEl.value.trim());
    });

    document.addEventListener('click', function (e) {
      if (!wrapEl.contains(e.target)) closeResults();
    });
  }

  function ready(fn) {
    if (document.readyState !== 'loading') { fn(); }
    else { document.addEventListener('DOMContentLoaded', fn); }
  }

  ready(function () {
    var headerBtn = document.getElementById('header-search-btn');
    var headerWrap = document.getElementById('header-search-wrap');
    if (headerBtn && headerWrap) {
      headerBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = headerWrap.classList.toggle('is-open');
        if (isOpen) {
          var inp = document.getElementById('header-search-input');
          if (inp) setTimeout(function () { inp.focus(); }, 50);
        }
      });
      document.addEventListener('click', function (e) {
        if (headerWrap.classList.contains('is-open') &&
            !headerWrap.contains(e.target) &&
            !headerBtn.contains(e.target)) {
          headerWrap.classList.remove('is-open');
        }
      });
    }

    initSearch('header-search-wrap', 'header-search-input', 'header-search-results', 'header-search-clear');
    initSearch('search-wrap', 'search-input', 'search-results', 'search-clear');
  });
})();
