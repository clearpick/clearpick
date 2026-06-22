(function () {
  'use strict';

  var slug = window.location.pathname.split('/').pop().replace('.html', '');
  if (!slug || slug === 'guides') return;

  var STORAGE_KEY = 'cp_sub_' + slug;

  function init() {
    var body = document.querySelector('.guide-article__body');
    if (!body) return;

    // Check if already submitted
    var existing = null;
    try { existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch(e) {}

    var widget = document.createElement('div');
    widget.className = 'user-submission-widget';
    widget.id = 'guide-submission-' + slug;

    if (existing) {
      widget.innerHTML =
        '<h2>Thanks for sharing</h2>' +
        '<p class="submission-thanks">Your rating was recorded. We add community data to our reports over time.</p>' +
        '<p class="submitted-count">You rated this ' + existing.rating + '/5' +
        (existing.buyAgain ? ' &middot; ' + buyAgainLabel(existing.buyAgain) : '') + '</p>';
    } else {
      widget.innerHTML =
        '<h2>Own this? Share your experience</h2>' +
        '<p>ClearPick is built on real owner data. Your rating gets added to our numbers.</p>' +
        '<div class="submission-stars" id="sub-stars-' + slug + '">' +
          starButtons() +
        '</div>' +
        '<div class="buy-again-buttons" id="sub-buyagain-' + slug + '">' +
          '<button class="buy-again-btn" data-answer="yes">&#x2705; Would buy again</button>' +
          '<button class="buy-again-btn" data-answer="no">&#x274C; Wouldn\'t buy again</button>' +
          '<button class="buy-again-btn" data-answer="maybe">&#x1F914; It depends</button>' +
        '</div>' +
        '<textarea class="submission-textarea" id="sub-comment-' + slug +
          '" placeholder="What do you wish you knew before buying? (optional)" maxlength="500" rows="3"></textarea>' +
        '<button class="submit-rating-btn" id="sub-submit-' + slug + '">Submit My Rating</button>' +
        '<p class="submission-disclaimer">Anonymous &middot; shown in aggregate only &middot; no account needed</p>' +
        '<div id="sub-thanks-' + slug + '" style="display:none">' +
          '<p class="submission-thanks">&#x2705; Thanks — your rating has been recorded.</p>' +
        '</div>';

      body.appendChild(widget);
      bindEvents();
      return;
    }

    body.appendChild(widget);
  }

  function starButtons() {
    var html = '';
    for (var i = 1; i <= 5; i++) {
      html += '<button class="star-btn" data-value="' + i + '" aria-label="' + i + ' stars">&#9733;</button>';
    }
    return html;
  }

  function buyAgainLabel(a) {
    return a === 'yes' ? 'Would buy again' : a === 'no' ? "Wouldn't buy again" : 'It depends';
  }

  function bindEvents() {
    var selectedRating = 0;
    var selectedBuyAgain = '';

    var starsEl = document.getElementById('sub-stars-' + slug);
    if (starsEl) {
      starsEl.querySelectorAll('.star-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          selectedRating = parseInt(btn.dataset.value, 10);
          starsEl.querySelectorAll('.star-btn').forEach(function(b, i) {
            b.classList.toggle('active', i < selectedRating);
          });
        });
      });
    }

    var buyEl = document.getElementById('sub-buyagain-' + slug);
    if (buyEl) {
      buyEl.querySelectorAll('.buy-again-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          selectedBuyAgain = btn.dataset.answer;
          buyEl.querySelectorAll('.buy-again-btn').forEach(function(b) {
            b.classList.remove('active');
          });
          btn.classList.add('active');
        });
      });
    }

    var submitBtn = document.getElementById('sub-submit-' + slug);
    if (submitBtn) {
      submitBtn.addEventListener('click', function() {
        if (!selectedRating) {
          submitBtn.textContent = 'Please select a star rating first';
          setTimeout(function() { submitBtn.textContent = 'Submit My Rating'; }, 2000);
          return;
        }
        var commentEl = document.getElementById('sub-comment-' + slug);
        var submission = {
          rating: selectedRating,
          buyAgain: selectedBuyAgain,
          comment: commentEl ? commentEl.value.trim() : '',
          ts: Date.now()
        };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(submission)); } catch(e) {}

        var widget = document.getElementById('guide-submission-' + slug);
        var thanksEl = document.getElementById('sub-thanks-' + slug);
        if (widget) {
          widget.querySelector('.submission-stars') &&
            (widget.querySelector('.submission-stars').style.display = 'none');
          widget.querySelector('.buy-again-buttons') &&
            (widget.querySelector('.buy-again-buttons').style.display = 'none');
          widget.querySelector('.submission-textarea') &&
            (widget.querySelector('.submission-textarea').style.display = 'none');
          submitBtn.style.display = 'none';
          widget.querySelector('.submission-disclaimer') &&
            (widget.querySelector('.submission-disclaimer').style.display = 'none');
          if (thanksEl) thanksEl.style.display = 'block';
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
