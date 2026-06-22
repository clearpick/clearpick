(function () {
  'use strict';

  var slug = window.location.pathname.split('/').pop().replace('.html', '');
  if (!slug || slug === 'guides') return;

  var CHART_JS_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';

  var COLORS = {
    positive: '#22c55e',
    neutral:  '#f59e0b',
    negative: '#ef4444',
    blue:     '#3b82f6',
    purple:   '#8b5cf6',
    bars:     ['#22c55e','#86efac','#f59e0b','#f87171','#ef4444'],
    amazon:   '#f97316',
    reddit:   '#ff4500',
    bestbuy:  '#0055a4'
  };

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function chartDefaults() {
    var dark = isDark();
    return {
      color: dark ? '#8b8fa8' : '#5c6080',
      borderColor: dark ? '#252836' : '#dde0ec',
      tickColor: dark ? '#4a4e65' : '#9ca3c0'
    };
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  function fmt(n) { return Number(n).toLocaleString(); }
  function pct(n) { return Math.round(n) + '%'; }

  /* ── Render: Data at a Glance ── */
  function renderGlance(data, container) {
    var s = data.sources || {};
    var cards = '';
    var totalPoints = 0;
    var sourceNames = [];

    if (s.amazon && s.amazon.reviewCount) {
      var a = s.amazon;
      totalPoints += a.reviewCount;
      sourceNames.push('Amazon.ca');
      cards += '<div class="stat-card">' +
        '<div class="stat-card-source">Amazon.ca</div>' +
        '<div class="stat-card-number">' + pct(a.satisfiedPct) + '</div>' +
        '<div class="stat-card-label">rated 4–5 stars</div>' +
        '<div class="stat-card-sub">' + fmt(a.reviewCount) + ' reviews &middot; ' + a.rating + '/5 avg</div>' +
        '</div>';
    }
    if (s.reddit && s.reddit.postCount) {
      var r = s.reddit;
      totalPoints += r.postCount;
      sourceNames.push('Reddit');
      cards += '<div class="stat-card">' +
        '<div class="stat-card-source">Reddit</div>' +
        '<div class="stat-card-number">' + pct(r.positivePct) + '</div>' +
        '<div class="stat-card-label">positive sentiment</div>' +
        '<div class="stat-card-sub">' + fmt(r.postCount) + ' posts</div>' +
        '</div>';
    }
    if (s.bestbuy && s.bestbuy.reviewCount) {
      var b = s.bestbuy;
      totalPoints += b.reviewCount;
      sourceNames.push('Best Buy Canada');
      cards += '<div class="stat-card">' +
        '<div class="stat-card-source">Best Buy Canada</div>' +
        '<div class="stat-card-number">' + b.rating + '/5</div>' +
        '<div class="stat-card-label">average rating</div>' +
        '<div class="stat-card-sub">' + fmt(b.reviewCount) + ' Canadian reviews</div>' +
        '</div>';
    }
    if (s.forum && s.forum.postCount) {
      var f = s.forum;
      totalPoints += f.postCount;
      sourceNames.push(f.source || 'Forum');
      cards += '<div class="stat-card">' +
        '<div class="stat-card-source">' + (f.source || 'Forum') + '</div>' +
        '<div class="stat-card-number">' + fmt(f.postCount) + '</div>' +
        '<div class="stat-card-label">owner discussions</div>' +
        '<div class="stat-card-sub">Overall tone: ' + (f.sentiment || 'mixed') + '</div>' +
        '</div>';
    }

    if (!cards) return; // no sources — render nothing

    var sec = el('div', 'guide-data-section data-at-a-glance');
    sec.innerHTML =
      '<h2 class="data-section-title">Data at a Glance</h2>' +
      '<p class="data-source-note">Aggregated from ' + sourceNames.join(', ') +
      ' &middot; ' + fmt(totalPoints) + ' data points analyzed</p>' +
      '<div class="stat-cards-row">' + cards + '</div>';
    container.prepend(sec);
  }

  /* ── Render: Amazon Rating Breakdown ── */
  function renderAmazon(data, container, Chart) {
    var a = (data.sources || {}).amazon;
    if (!a || !a.reviewCount) return;

    var id1 = 'donut-' + slug;
    var id2 = 'star-' + slug;
    var def = chartDefaults();

    var sec = el('div', 'guide-data-section');
    sec.innerHTML =
      '<h2 class="data-section-title">Amazon.ca Buyer Ratings</h2>' +
      '<p class="data-source-note">' + fmt(a.reviewCount) + ' verified ratings on Amazon.ca</p>' +
      '<div class="charts-row">' +
        '<div class="chart-block">' +
          '<h3>Satisfaction Split</h3>' +
          '<canvas id="' + id1 + '" height="240"></canvas>' +
          '<p class="chart-stat-callout"><strong>' + pct(a.satisfiedPct) + '</strong> satisfied (4–5&#9733;)</p>' +
        '</div>' +
        '<div class="chart-block">' +
          '<h3>Rating Breakdown</h3>' +
          '<canvas id="' + id2 + '" height="240"></canvas>' +
        '</div>' +
      '</div>';
    container.appendChild(sec);

    new Chart(document.getElementById(id1), {
      type: 'doughnut',
      data: {
        labels: ['Satisfied (4–5★)', 'Neutral (3★)', 'Critical (1–2★)'],
        datasets: [{ data: [a.satisfiedPct, a.neutralPct, a.criticalPct],
          backgroundColor: [COLORS.positive, COLORS.neutral, COLORS.negative], borderWidth: 0 }]
      },
      options: { plugins: { legend: { position: 'bottom', labels: { color: def.color } } }, cutout: '62%' }
    });

    var breakdown = a.starBreakdown || [0,0,0,0,0];
    new Chart(document.getElementById(id2), {
      type: 'bar',
      data: {
        labels: ['5★','4★','3★','2★','1★'],
        datasets: [{ label: '% of reviews', data: breakdown,
          backgroundColor: COLORS.bars, borderRadius: 4 }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { max: 100, ticks: { callback: function(v){ return v+'%'; }, color: def.tickColor },
               grid: { color: def.borderColor } },
          y: { ticks: { color: def.color }, grid: { color: def.borderColor } }
        }
      }
    });
  }

  /* ── Render: Reddit Sentiment ── */
  function renderReddit(data, container, Chart) {
    var r = (data.sources || {}).reddit;
    if (!r || !r.postCount) return;

    var id = 'reddit-' + slug;
    var def = chartDefaults();

    var themes = '';
    if (r.positiveThemes) {
      r.positiveThemes.slice(0,2).forEach(function(t) {
        themes += '<li>&#x2705; ' + t + '</li>';
      });
    }
    if (r.negativeThemes) {
      r.negativeThemes.slice(0,2).forEach(function(t) {
        themes += '<li>&#x26A0;&#xFE0F; ' + t + '</li>';
      });
    }

    var sec = el('div', 'guide-data-section');
    sec.innerHTML =
      '<h2 class="data-section-title">What Reddit Says</h2>' +
      '<p class="data-source-note">Across ' + fmt(r.postCount) + ' posts' +
      (r.subreddits ? ' in ' + r.subreddits.join(', ') : '') + ' over the past 12 months</p>' +
      '<div class="charts-row">' +
        '<div class="chart-block">' +
          '<h3>Post Sentiment</h3>' +
          '<canvas id="' + id + '" height="240"></canvas>' +
          '<p class="chart-stat-callout"><strong>' + pct(r.positivePct) + '</strong> positive or recommending</p>' +
        '</div>' +
        (themes ? '<div class="chart-block"><h3>What owners are discussing</h3>' +
          '<ul class="reddit-themes-list">' + themes + '</ul></div>' : '') +
      '</div>';
    container.appendChild(sec);

    new Chart(document.getElementById(id), {
      type: 'doughnut',
      data: {
        labels: ['Positive / Recommending', 'Mixed', 'Negative / Warning'],
        datasets: [{ data: [r.positivePct, r.mixedPct, r.negativePct],
          backgroundColor: [COLORS.positive, COLORS.neutral, COLORS.negative], borderWidth: 0 }]
      },
      options: { plugins: { legend: { position: 'bottom', labels: { color: def.color } } }, cutout: '62%' }
    });
  }

  /* ── Render: Cross-Platform Comparison ── */
  function renderPlatforms(data, container, Chart) {
    var s = data.sources || {};
    var labels = [], scores = [], colors = [];

    if (s.amazon && s.amazon.satisfiedPct) {
      labels.push('Amazon.ca'); scores.push(s.amazon.satisfiedPct); colors.push(COLORS.amazon);
    }
    if (s.bestbuy && s.bestbuy.rating) {
      labels.push('Best Buy Canada');
      scores.push(Math.round(s.bestbuy.rating / 5 * 100));
      colors.push(COLORS.bestbuy);
    }
    if (s.reddit && s.reddit.positivePct) {
      labels.push('Reddit sentiment'); scores.push(s.reddit.positivePct); colors.push(COLORS.reddit);
    }
    if (labels.length < 2) return;

    var id = 'platforms-' + slug;
    var def = chartDefaults();

    var sec = el('div', 'guide-data-section');
    sec.innerHTML =
      '<h2 class="data-section-title">Ratings Across Platforms</h2>' +
      '<p class="data-source-note">Same product, different communities — % satisfied or positive</p>' +
      '<canvas id="' + id + '" height="200"></canvas>';
    container.appendChild(sec);

    new Chart(document.getElementById(id), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{ label: 'Positive / satisfied rate (%)', data: scores,
          backgroundColor: colors, borderRadius: 6 }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 0, max: 100,
               ticks: { callback: function(v){ return v+'%'; }, color: def.tickColor },
               grid: { color: def.borderColor } },
          x: { ticks: { color: def.color }, grid: { display: false } }
        }
      }
    });
  }

  /* ── Render: Complaint Frequency ── */
  function renderComplaints(data, container, Chart) {
    var complaints = data.complaintsData;
    if (!complaints || !complaints.length) return;

    var id = 'complaints-' + slug;
    var def = chartDefaults();

    var sec = el('div', 'guide-data-section');
    sec.innerHTML =
      '<h2 class="data-section-title">Most Common Complaints (by frequency)</h2>' +
      '<p class="data-source-note">Derived from critical reviews across ' +
      (data.complaintSources || 'Amazon, Reddit') + '</p>' +
      '<canvas id="' + id + '" height="' + (complaints.length * 44) + '"></canvas>';
    container.appendChild(sec);

    new Chart(document.getElementById(id), {
      type: 'bar',
      data: {
        labels: complaints.map(function(c){ return c.label; }),
        datasets: [{ label: '% of critical reviews mentioning this',
          data: complaints.map(function(c){ return c.pct; }),
          backgroundColor: COLORS.negative, borderRadius: 4 }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { max: 100, ticks: { callback: function(v){ return v+'%'; }, color: def.tickColor },
               grid: { color: def.borderColor } },
          y: { ticks: { color: def.color }, grid: { display: false } }
        }
      }
    });
  }

  /* ── Render: Head-to-Head Radar (comparison guides) ── */
  function renderHeadToHead(data, container, Chart) {
    var h2h = data.headToHead;
    if (!h2h || !h2h.productA) return;

    var id = 'h2h-' + slug;
    var def = chartDefaults();

    var tableRows = '';
    var fields = [
      ['Amazon Rating', 'amazonRating', '/5'],
      ['Amazon Reviews', 'amazonCount', ''],
      ['Satisfied Rate', 'satisfiedPct', '%'],
      ['Critical Rate', 'criticalPct', '%'],
      ['Reddit Sentiment', 'redditPct', '%'],
      ['Best Buy Canada', 'bestbuyRating', '/5']
    ];
    fields.forEach(function(f) {
      var av = h2h.productA[f[1]];
      var bv = h2h.productB[f[1]];
      if (av == null && bv == null) return;
      tableRows += '<tr><td>' + f[0] + '</td>' +
        '<td>' + (av != null ? av + f[2] : '—') + '</td>' +
        '<td>' + (bv != null ? bv + f[2] : '—') + '</td>' +
        '</tr>';
    });

    var sec = el('div', 'guide-data-section');
    sec.innerHTML =
      '<h2 class="data-section-title">Head-to-Head: By the Numbers</h2>' +
      '<div class="charts-row">' +
        '<div class="chart-block" style="max-width:320px">' +
          '<canvas id="' + id + '" height="280"></canvas>' +
        '</div>' +
        '<div class="chart-block">' +
          '<table class="comparison-data-table">' +
            '<thead><tr><th></th><th>' + h2h.productA.name + '</th><th>' + h2h.productB.name + '</th></tr></thead>' +
            '<tbody>' + tableRows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
    container.appendChild(sec);

    var radarLabels = ['Amazon Rating','Satisfied Rate','Reddit Sentiment','Best Buy Rating','Review Volume'];
    new Chart(document.getElementById(id), {
      type: 'radar',
      data: {
        labels: radarLabels,
        datasets: [
          { label: h2h.productA.name, data: h2h.productA.radarData || [],
            borderColor: COLORS.blue, backgroundColor: 'rgba(59,130,246,0.15)', pointRadius: 3 },
          { label: h2h.productB.name, data: h2h.productB.radarData || [],
            borderColor: COLORS.purple, backgroundColor: 'rgba(139,92,246,0.15)', pointRadius: 3 }
        ]
      },
      options: {
        scales: { r: { min: 0, max: 100, ticks: { color: def.tickColor, backdropColor: 'transparent' },
          grid: { color: def.borderColor }, pointLabels: { color: def.color, font: { size: 11 } } } },
        plugins: { legend: { position: 'bottom', labels: { color: def.color } } }
      }
    });
  }

  /* ── Render: Satisfaction Over Time (sentiment/owner-report guides) ── */
  function renderTimeline(data, container, Chart) {
    var tl = data.timeline;
    if (!tl) return;

    var id = 'timeline-' + slug;
    var def = chartDefaults();

    var sec = el('div', 'guide-data-section');
    sec.innerHTML =
      '<h2 class="data-section-title">Owner Satisfaction Over Time</h2>' +
      '<p class="data-source-note">Estimated trend from owner reports at different ownership stages</p>' +
      '<p style="font-size:0.78rem;color:var(--color-text-faint);margin:0 0 1rem;">' +
      '<em>Approximate trend derived from review language and context — not a formal longitudinal survey.</em></p>' +
      '<canvas id="' + id + '" height="260"></canvas>';
    container.appendChild(sec);

    new Chart(document.getElementById(id), {
      type: 'line',
      data: {
        labels: tl.labels || ['Week 1','Month 1','Month 3','Month 6','Month 12'],
        datasets: [{
          label: 'Estimated owner satisfaction',
          data: tl.values,
          borderColor: COLORS.blue,
          backgroundColor: 'rgba(59,130,246,0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 6,
          pointBackgroundColor: COLORS.blue
        }]
      },
      options: {
        scales: {
          y: { min: 0, max: 100,
               ticks: { callback: function(v){ return v+'%'; }, color: def.tickColor },
               title: { display: true, text: 'Est. % satisfied', color: def.color },
               grid: { color: def.borderColor } },
          x: { ticks: { color: def.color }, grid: { color: def.borderColor } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  /* ── Main: load data → load Chart.js → render ── */
  function init() {
    var body = document.querySelector('.guide-article__body');
    if (!body) return;

    fetch('/guides/' + slug + '.data.json')
      .then(function(r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function(data) {
        if (!data) return; // no data file — nothing to render

        // Load Chart.js dynamically only when we have data
        var script = document.createElement('script');
        script.src = CHART_JS_CDN;
        script.onload = function() { renderAll(data, body); };
        document.head.appendChild(script);
      })
      .catch(function() {});
  }

  function renderAll(data, body) {
    var C = window.Chart;

    // Glance always goes first (no chart)
    renderGlance(data, body);

    // Charts go after glance, before existing content
    var chartContainer = el('div', 'guide-charts-container');
    var firstH2 = body.querySelector('h2');
    if (firstH2) {
      body.insertBefore(chartContainer, firstH2);
    } else {
      body.appendChild(chartContainer);
    }

    renderAmazon(data, chartContainer, C);
    renderReddit(data, chartContainer, C);
    renderPlatforms(data, chartContainer, C);
    renderComplaints(data, chartContainer, C);
    renderHeadToHead(data, chartContainer, C);
    renderTimeline(data, chartContainer, C);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
