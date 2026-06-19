(function () {
  /* Counts kept in sync automatically by scripts/add-product.js via regex on slug+count. */
  var CATEGORIES = [
    { slug: 'headphones',             icon: '🎧', label: 'Headphones',                count: 28, desc: 'Earbuds, over-ear & wireless'      },
    { slug: 'kitchen',                icon: '🍳', label: 'Kitchen Appliances',         count: 24, desc: 'Air fryers, coffee & blenders'      },
    { slug: 'camping',                icon: '⛺', label: 'Outdoor & Camping',           count: 17, desc: 'Tents, gear & apparel'              },
    { slug: 'software',               icon: '💻', label: 'Software',                   count: 13, desc: 'Productivity & subscriptions'        },
    { slug: 'smart-home',             icon: '🏠', label: 'Smart Home',                 count: 32, desc: 'Speakers, cameras & automation'      },
    { slug: 'robot-vacuums',          icon: '🤖', label: 'Robot Vacuums',              count: 12, desc: 'Smart vacuums & mops'                },
    { slug: 'fitness',                icon: '💪', label: 'Fitness Equipment',          count: 32, desc: 'Cardio, weights & recovery'          },
    { slug: 'pet-supplies',           icon: '🐾', label: 'Pet Supplies',               count: 27, desc: 'Food, beds & accessories'            },
    { slug: 'gaming',                 icon: '🎮', label: 'Gaming',                     count: 35, desc: 'Peripherals, gear & monitors'        },
    { slug: 'lawn-garden',            icon: '🌿', label: 'Lawn & Garden',              count: 29, desc: 'Mowers, trimmers & more'             },
    { slug: 'home-entertainment',     icon: '📺', label: 'Home Entertainment',         count: 31, desc: 'TVs, soundbars & streaming'          },
    { slug: 'outdoor-cooking',        icon: '🔥', label: 'Outdoor Cooking',            count: 3                                              },
    { slug: 'cameras',                icon: '📷', label: 'Cameras & Content Creation', count: 2                                              },
    { slug: 'kitchen-dining',         icon: '🍽️', label: 'Kitchen & Dining',           count: 44, desc: 'Appliances, cookware & more'         },
    { slug: 'outdoor-garden',         icon: '🌳', label: 'Outdoor & Garden',           count: 3                                              },
    { slug: 'sports-fitness',         icon: '🏃', label: 'Sports & Fitness',           count: 2                                              },
    { slug: 'photography-video',      icon: '📷', label: 'Photography & Video',        count: 3                                              },
    { slug: 'health-beauty',          icon: '💄', label: 'Health & Beauty',            count: 20, desc: 'Skincare, dental & grooming'         },
    { slug: 'office-work',            icon: '💼', label: 'Office & Work',              count: 20, desc: 'Monitors, desks & accessories'       },
    { slug: 'tools-home-improvement', icon: '🔧', label: 'Tools & Home Improvement',   count: 20, desc: 'Power tools & storage'               },
    { slug: 'bbq-outdoor-cooking',    icon: '🍖', label: 'BBQ & Outdoor Cooking',      count: 17, desc: 'Grills, smokers & griddles'          },
    { slug: 'sports-outdoors',        icon: '⛰️', label: 'Sports & Outdoors',          count: 20, desc: 'Running, hiking & cycling'           },
    { slug: 'baby-kids',              icon: '🍼', label: 'Baby & Kids',                count: 20                    ,  desc: 'Safety, toys & essentials'           },
    { slug: 'luggage-travel',         icon: '🧳', label: 'Luggage & Travel',           count: 19                   ,  desc: 'Bags, cases & accessories'           },
    { slug: 'automotive',             icon: '🚗', label: 'Automotive',                 count: 19                   ,  desc: 'Accessories & car tech'              },
  ];

  var GROUPS = [
    {
      label: 'Kitchen & Home',
      slugs: ['kitchen-dining', 'kitchen', 'bbq-outdoor-cooking'],
    },
    {
      label: 'Tech & Entertainment',
      slugs: ['home-entertainment', 'gaming', 'headphones', 'smart-home', 'office-work'],
    },
    {
      label: 'Health & Wellness',
      slugs: ['fitness', 'health-beauty', 'sports-outdoors'],
    },
    {
      label: 'Home & Garden',
      slugs: ['tools-home-improvement', 'lawn-garden', 'robot-vacuums', 'pet-supplies'],
    },
    {
      label: 'Lifestyle',
      slugs: ['camping', 'software', 'baby-kids', 'luggage-travel', 'automotive'],
    },
  ];

  var catMap = {};
  CATEGORIES.forEach(function (c) { catMap[c.slug] = c; });

  var chevronSvg = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="dropdown-chevron" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  var mobChevronSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="mob-chevron" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  function inject() {
    var details = document.querySelector('details.nav__dropdown');
    if (!details) return;

    var isProduct = window.location.pathname.indexOf('/products/') !== -1;
    var pre = isProduct ? '../' : '';
    var page = window.location.pathname.split('/').pop() || 'index.html';

    /* ── Desktop mega groups (replace <details>) ── */
    var groupsHtml = GROUPS.map(function (g) {
      var items = g.slugs.map(function (slug) {
        var cat = catMap[slug];
        if (!cat) return '';
        var isActive = (page === slug + '.html');
        var countLabel = cat.count > 0 ? cat.count + ' products' : 'Coming soon';
        return '<a href="' + pre + slug + '.html"' +
          ' class="nav__mega-item' + (isActive ? ' nav__mega-item--active' : '') + '">' +
          '<span class="nav__mega-icon">' + cat.icon + '</span>' +
          '<span class="nav__mega-text">' +
          '<span class="nav__mega-label">' + cat.label + '</span>' +
          '<span class="nav__mega-sub">' + countLabel + '</span>' +
          '</span></a>';
      }).join('');
      return '<div class="nav__mega-group">' +
        '<button class="nav__link nav__mega-trigger" type="button" aria-expanded="false" aria-haspopup="true">' +
        g.label + ' ' + chevronSvg +
        '</button>' +
        '<div class="nav__mega-panel" role="menu">' +
        items +
        '<a href="' + pre + 'index.html" class="nav__mega-view-all">View all categories →</a>' +
        '</div></div>';
    }).join('');

    var megaEl = document.createElement('div');
    megaEl.className = 'nav__mega-groups';
    megaEl.innerHTML = groupsHtml;
    details.parentNode.replaceChild(megaEl, details);

    /* ── Mobile drawer (append to body) ── */
    if (!document.getElementById('mob-nav')) {
      var mobGroups = GROUPS.map(function (g) {
        var items = g.slugs.map(function (slug) {
          var cat = catMap[slug];
          if (!cat) return '';
          var badge = cat.count > 0
            ? '<span class="mob-nav__count">' + cat.count + '</span>'
            : '<span class="mob-nav__soon">Soon</span>';
          return '<a href="' + pre + slug + '.html" class="mob-nav__link">' +
            '<span class="mob-nav__link-icon">' + cat.icon + '</span>' +
            '<span class="mob-nav__link-label">' + cat.label + '</span>' +
            badge + '</a>';
        }).join('');
        return '<div class="mob-nav__group">' +
          '<button class="mob-nav__trigger" type="button" aria-expanded="false">' +
          g.label + mobChevronSvg +
          '</button>' +
          '<div class="mob-nav__panel">' + items + '</div>' +
          '</div>';
      }).join('');

      var mobNavEl = document.createElement('div');
      mobNavEl.className = 'mob-nav';
      mobNavEl.id = 'mob-nav';
      mobNavEl.setAttribute('aria-hidden', 'true');
      mobNavEl.innerHTML =
        '<div class="mob-nav__header">' +
        '<span class="mob-nav__title">Browse Categories</span>' +
        '<button class="mob-nav__close" id="mob-nav-close" aria-label="Close navigation">&#10005;</button>' +
        '</div>' +
        '<div class="mob-nav__body">' + mobGroups + '</div>' +
        '<nav class="mob-nav__footer" aria-label="Site links">' +
        '<a href="' + pre + 'index.html" class="mob-nav__footer-link">Home</a>' +
        '<a href="' + pre + 'blog/index.html" class="mob-nav__footer-link">Blog</a>' +
        '<a href="' + pre + 'about.html" class="mob-nav__footer-link">About</a>' +
        '<a href="' + pre + 'faq.html" class="mob-nav__footer-link">How It Works</a>' +
        '<a href="' + pre + 'methodology.html" class="mob-nav__footer-link">Methodology</a>' +
        '<a href="/compare/" class="mob-nav__footer-link">Compare</a>' +
        '</nav>';
      document.body.appendChild(mobNavEl);

      var backdropEl = document.createElement('div');
      backdropEl.className = 'mob-nav__backdrop';
      backdropEl.id = 'mob-nav-backdrop';
      document.body.appendChild(backdropEl);
    }

    /* ── Hamburger (append to header-actions) ── */
    var headerActions = document.querySelector('.header-actions');
    if (headerActions && !document.getElementById('mob-nav-toggle')) {
      var btn = document.createElement('button');
      btn.className = 'mobile-menu-btn';
      btn.id = 'mob-nav-toggle';
      btn.setAttribute('aria-label', 'Open navigation');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
      headerActions.appendChild(btn);
    }

    initMega();
    initMobNav();
  }

  function closeAllMega() {
    [].forEach.call(document.querySelectorAll('.nav__mega-group.is-open'), function (g) {
      g.classList.remove('is-open');
      var t = g.querySelector('.nav__mega-trigger');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  }

  function initMega() {
    [].forEach.call(document.querySelectorAll('.nav__mega-group'), function (group) {
      var trigger = group.querySelector('.nav__mega-trigger');

      group.addEventListener('mouseenter', function () {
        closeAllMega();
        group.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      });
      group.addEventListener('mouseleave', function () {
        group.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
      });
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var wasOpen = group.classList.contains('is-open');
        closeAllMega();
        if (!wasOpen) {
          group.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    });

    document.addEventListener('click', closeAllMega);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAllMega();
    });
  }

  function initMobNav() {
    var mobNav   = document.getElementById('mob-nav');
    var backdrop = document.getElementById('mob-nav-backdrop');
    var toggle   = document.getElementById('mob-nav-toggle');
    var closeBtn = document.getElementById('mob-nav-close');
    if (!mobNav) return;

    function openNav() {
      mobNav.classList.add('is-open');
      backdrop.classList.add('is-visible');
      mobNav.setAttribute('aria-hidden', 'false');
      document.body.classList.add('mob-nav-open');
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
    }
    function closeNav() {
      mobNav.classList.remove('is-open');
      backdrop.classList.remove('is-visible');
      mobNav.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('mob-nav-open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }

    if (toggle)   toggle.addEventListener('click', function () {
      mobNav.classList.contains('is-open') ? closeNav() : openNav();
    });
    if (closeBtn) closeBtn.addEventListener('click', closeNav);
    if (backdrop) backdrop.addEventListener('click', closeNav);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobNav.classList.contains('is-open')) closeNav();
    });

    /* Accordion — only one group open at a time */
    var mobGroups = document.querySelectorAll('.mob-nav__group');
    [].forEach.call(mobGroups, function (group) {
      var trigger = group.querySelector('.mob-nav__trigger');
      trigger.addEventListener('click', function () {
        var wasOpen = group.classList.contains('is-open');
        [].forEach.call(mobGroups, function (g) {
          g.classList.remove('is-open');
          g.querySelector('.mob-nav__trigger').setAttribute('aria-expanded', 'false');
        });
        if (!wasOpen) {
          group.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
