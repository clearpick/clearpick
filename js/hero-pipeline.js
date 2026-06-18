(function () {
  if (!document.getElementById('cp-pipeline')) return;

  var SRCS = [
    { pid: 'cp-pr', qid: 'cp-qr', bid: 'cp-br', color: '#7F77DD', delay: 0 },
    { pid: 'cp-pa', qid: 'cp-qa', bid: 'cp-ba', color: '#EF9F27', delay: 380 },
    { pid: 'cp-pe', qid: 'cp-qe', bid: 'cp-be', color: '#378ADD', delay: 760 },
    { pid: 'cp-pf', qid: 'cp-qf', bid: 'cp-bf', color: '#3BAB6F', delay: 1140 },
  ];
  var CYCLE  = 5600;
  var TRAVEL = 720;

  function ease(x) {
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  }

  function ptAt(pathId, t) {
    var el = document.getElementById(pathId);
    return el.getPointAtLength(ease(t) * el.getTotalLength());
  }

  function moveParticle(qid, pid, color, startDelay) {
    var p = document.getElementById(qid);
    p.style.fill = color;
    var t0 = performance.now() + startDelay;
    function frame(now) {
      var raw = Math.max(now - t0, 0) / TRAVEL;
      if (now < t0) { requestAnimationFrame(frame); return; }
      var pos = ptAt(pid, Math.min(raw, 1));
      p.setAttribute('cx', pos.x);
      p.setAttribute('cy', pos.y);
      p.setAttribute('opacity', raw < 1 ? '1' : '0');
      if (raw < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function pulseEl(id, color) {
    var el = document.getElementById(id);
    if (!el) return;
    el.style.stroke = color;
    el.style.strokeWidth = '2';
    setTimeout(function () {
      el.style.stroke = '';
      el.style.strokeWidth = '';
    }, 700);
  }

  function fadeTo(id, to, dur, delay) {
    setTimeout(function () {
      var el = document.getElementById(id);
      if (!el) return;
      var from = parseFloat(el.getAttribute('opacity')) || 0;
      var t0 = performance.now();
      function f(now) {
        var prog = Math.min((now - t0) / dur, 1);
        el.setAttribute('opacity', from + (to - from) * prog);
        if (prog < 1) requestAnimationFrame(f);
      }
      requestAnimationFrame(f);
    }, delay || 0);
  }

  function showOutput() {
    fadeTo('cp-bo',     1, 350,   0);
    fadeTo('cp-snum',   1, 280, 220);
    fadeTo('cp-sdiv',   1, 280, 220);
    fadeTo('cp-slbl',   1, 280, 340);
    fadeTo('cp-sdline', 1, 200, 440);
    ['cp-sr1l','cp-sr1bg','cp-sr1f','cp-sr1v'].forEach(function(id){ fadeTo(id, 1, 200, 520); });
    ['cp-sr2l','cp-sr2bg','cp-sr2f','cp-sr2v'].forEach(function(id){ fadeTo(id, 1, 200, 640); });
    ['cp-sr3l','cp-sr3bg','cp-sr3f','cp-sr3v'].forEach(function(id){ fadeTo(id, 1, 200, 760); });
  }

  function hideOutput() {
    ['cp-bo','cp-snum','cp-sdiv','cp-slbl','cp-sdline',
     'cp-sr1l','cp-sr1bg','cp-sr1f','cp-sr1v',
     'cp-sr2l','cp-sr2bg','cp-sr2f','cp-sr2v',
     'cp-sr3l','cp-sr3bg','cp-sr3f','cp-sr3v'
    ].forEach(function(id){ fadeTo(id, 0, 280, 0); });
  }

  function runCycle() {
    SRCS.forEach(function (s) {
      setTimeout(function () {
        pulseEl(s.bid, s.color);
        moveParticle(s.qid, s.pid, s.color, 80);
      }, s.delay);
    });

    setTimeout(function () {
      pulseEl('cp-eng', '#1D9E75');
      var p = document.getElementById('cp-qo');
      p.style.fill = '#1D9E75';
      var t0 = performance.now() + 60;
      function f(now) {
        var raw = Math.max(now - t0, 0) / 480;
        var pos = ptAt('cp-po', Math.min(raw, 1));
        p.setAttribute('cx', pos.x);
        p.setAttribute('cy', pos.y);
        p.setAttribute('opacity', raw < 1 ? '1' : '0');
        if (raw < 1) requestAnimationFrame(f);
      }
      requestAnimationFrame(f);
      showOutput();
    }, 1970);

    setTimeout(hideOutput, CYCLE - 420);
  }

  setTimeout(runCycle, 600);
  setInterval(runCycle, CYCLE);
}());
