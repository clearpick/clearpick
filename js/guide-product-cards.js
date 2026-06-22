(function () {
  var cards = document.querySelectorAll('.product-card-inline[data-slug]');
  if (!cards.length) return;

  fetch('/products.json')
    .then(function (r) { return r.json(); })
    .then(function (products) {
      var map = {};
      products.forEach(function (p) { map[p.id] = p; });

      [].forEach.call(cards, function (card) {
        var slug = card.getAttribute('data-slug');
        var p = map[slug];
        if (!p) return;

        var el = document.createElement('a');
        el.className = 'product-card-inline';
        el.href = '/products/' + slug + '.html';
        el.innerHTML =
          '<img src="' + (p.image || '/images/products/' + slug + '/hero.jpg') + '" ' +
          'class="product-card-inline__img" alt="' + p.name + '" loading="lazy" width="72" height="72" />' +
          '<div class="product-card-inline__body">' +
          '<div class="product-card-inline__name">' + p.name + '</div>' +
          '<div>' +
          '<span class="product-card-inline__score">' + p.score + '/10</span>' +
          '<span class="product-card-inline__price">' + (p.price || '') + '</span>' +
          '</div>' +
          '</div>';

        card.replaceWith(el);
      });
    })
    .catch(function () {});
})();
