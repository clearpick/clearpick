(function () {
  var grid = document.querySelector('.product-grid');
  if (!grid) return;

  var allCards = Array.from(grid.querySelectorAll('a.product-card'));
  if (!allCards.length) return;
  var defaultOrder = allCards.slice();

  var sortSel  = document.getElementById('sort-select');
  var brandSel = document.getElementById('brand-select');
  var tagSel   = document.getElementById('tag-select');
  var resetBtn = document.getElementById('filter-reset');
  var countEl  = document.getElementById('filter-count');

  if (!sortSel || !brandSel || !tagSel) return;

  // Populate Brand and Best For dropdowns from data attributes
  var brands = [], tags = [];
  allCards.forEach(function (card) {
    var b = card.dataset.brand;
    var t = card.dataset.tag;
    if (b && brands.indexOf(b) === -1) brands.push(b);
    if (t && tags.indexOf(t)   === -1) tags.push(t);
  });
  brands.sort(function (a, b) { return a.localeCompare(b); });
  tags.sort(function (a, b)   { return a.localeCompare(b); });

  brands.forEach(function (b) {
    var o = document.createElement('option');
    o.value = b; o.textContent = b;
    brandSel.appendChild(o);
  });
  tags.forEach(function (t) {
    var o = document.createElement('option');
    o.value = t; o.textContent = t;
    tagSel.appendChild(o);
  });

  function apply() {
    var sortVal  = sortSel.value;
    var brandVal = brandSel.value;
    var tagVal   = tagSel.value;

    var visible = allCards.filter(function (c) {
      var okBrand = !brandVal || c.dataset.brand === brandVal;
      var okTag   = !tagVal   || c.dataset.tag   === tagVal;
      return okBrand && okTag;
    });
    var hidden = allCards.filter(function (c) { return visible.indexOf(c) === -1; });

    visible.forEach(function (c) { c.style.display = ''; });
    hidden.forEach(function (c)  { c.style.display = 'none'; });

    var toSort = visible.slice();
    if (sortVal === 'default') {
      toSort.sort(function (a, b) { return defaultOrder.indexOf(a) - defaultOrder.indexOf(b); });
    } else if (sortVal === 'score-desc') {
      toSort.sort(function (a, b) { return parseFloat(b.dataset.score || 0) - parseFloat(a.dataset.score || 0); });
    } else if (sortVal === 'price-asc') {
      toSort.sort(function (a, b) { return parseFloat(a.dataset.price || 0) - parseFloat(b.dataset.price || 0); });
    } else if (sortVal === 'price-desc') {
      toSort.sort(function (a, b) { return parseFloat(b.dataset.price || 0) - parseFloat(a.dataset.price || 0); });
    } else if (sortVal === 'name-asc') {
      toSort.sort(function (a, b) {
        var na = (a.querySelector('.product-card__name') || {}).textContent || '';
        var nb = (b.querySelector('.product-card__name') || {}).textContent || '';
        return na.localeCompare(nb);
      });
    }

    toSort.forEach(function (c) { grid.appendChild(c); });
    hidden.forEach(function (c) { grid.appendChild(c); });

    if (countEl) {
      countEl.textContent = visible.length < allCards.length
        ? visible.length + ' of ' + allCards.length + ' shown'
        : allCards.length + ' products';
    }
  }

  // Initialise count display
  if (countEl) countEl.textContent = allCards.length + ' products';

  sortSel.addEventListener('change', apply);
  brandSel.addEventListener('change', apply);
  tagSel.addEventListener('change', apply);
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      sortSel.value  = 'default';
      brandSel.value = '';
      tagSel.value   = '';
      apply();
    });
  }
})();
