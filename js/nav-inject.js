(function () {
  /* Single source of truth for the categories dropdown.
     Counts kept in sync automatically by scripts/add-product.js. */
  var CATEGORIES = [
    { slug: 'headphones',         icon: '🎧', label: 'Headphones',                count: 19 },
    { slug: 'kitchen',            icon: '🍳', label: 'Kitchen Appliances',         count: 24 },
    { slug: 'camping',            icon: '⛺', label: 'Outdoor & Camping',           count: 17 },
    { slug: 'software',           icon: '💻', label: 'Software',                   count: 13 },
    { slug: 'smart-home',         icon: '🏠', label: 'Smart Home',                 count: 11 },
    { slug: 'robot-vacuums',      icon: '🤖', label: 'Robot Vacuums',              count: 12 },
    { slug: 'fitness',            icon: '💪', label: 'Fitness Equipment',           count: 16 },
    { slug: 'pet-supplies',       icon: '🐾', label: 'Pet Supplies',               count: 13 },
    { slug: 'gaming',             icon: '🎮', label: 'Gaming',                     count: 16 },
    { slug: 'lawn-garden',        icon: '🌿', label: 'Lawn & Garden',              count: 14 },
    { slug: 'home-entertainment', icon: '📺', label: 'Home Entertainment',         count: 2  },
    { slug: 'outdoor-cooking',    icon: '🔥', label: 'Outdoor Cooking',            count: 3  },
    { slug: 'cameras',            icon: '📷', label: 'Cameras & Content Creation', count: 2  },
  ];

  function inject() {
    var menu = document.querySelector('.dropdown__menu');
    if (!menu) return;
    var isProduct = window.location.pathname.indexOf('/products/') !== -1;
    var pre = isProduct ? '../' : '';
    var page = window.location.pathname.split('/').pop() || 'index.html';
    menu.innerHTML = CATEGORIES.map(function (c) {
      var active = (page === c.slug + '.html') ? ' dropdown__item--active' : '';
      return '<a href="' + pre + c.slug + '.html" class="dropdown__item' + active + '">' +
        '<span class="dropdown__icon">' + c.icon + '</span>' +
        '<span class="dropdown__text">' +
        '<span class="dropdown__label">' + c.label + '</span>' +
        '<span class="dropdown__count">' + c.count + ' products</span>' +
        '</span></a>';
    }).join('');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
