/* Turn8digital shared script: mobile menu, active nav link, recent-projects gallery */
(function () {
  'use strict';

  // ---- Mobile menu + active link ----
  var nav = document.getElementById('siteNav');
  var toggle = document.getElementById('navToggle');
  if (nav && toggle) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
    });
  }
  function slug(p) {
    var last = (p || '').split('?')[0].split('#')[0].split('/').pop().replace(/\.html$/, '');
    return last || 'index';
  }
  var here = slug(location.pathname);
  document.querySelectorAll('nav.links a').forEach(function (a) {
    if (slug(a.getAttribute('href')) === here) a.classList.add('active');
  });

  // ---- Recent projects (photos uploaded from /admin.html) ----
  var freshGrid = document.getElementById('freshGrid');
  var recentGrid = document.getElementById('recentGrid');
  if (!freshGrid && !recentGrid) return;

  var LABELS = { website: 'Websites', event: 'Event coverage', other: 'Other' };

  var box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = '<button type="button" aria-label="Close">&times;</button><img alt=""><p></p>';
  document.body.appendChild(box);
  var boxImg = box.querySelector('img'), boxCap = box.querySelector('p');
  function closeBox() { box.classList.remove('open'); }
  box.addEventListener('click', closeBox);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeBox(); });

  function tile(item) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'recent-tile';
    var img = document.createElement('img');
    img.src = '/api/image/' + item.id; img.loading = 'lazy';
    img.alt = item.title || item.caption || 'Project photo';
    b.appendChild(img);
    if (item.title) {
      var cap = document.createElement('span');
      cap.className = 'recent-cap'; cap.textContent = item.title; b.appendChild(cap);
    }
    b.addEventListener('click', function () {
      boxImg.src = img.src; boxImg.alt = img.alt;
      boxCap.textContent = [item.title, item.caption].filter(Boolean).join(' — ');
      box.classList.add('open');
    });
    return b;
  }
  function fill(grid, items) {
    grid.innerHTML = '';
    items.forEach(function (it) { grid.appendChild(tile(it)); });
  }

  fetch('/api/gallery', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(function (data) {
      var items = data.items || [];
      if (!items.length) return;

      if (freshGrid) {
        fill(freshGrid, items.slice(0, 3));
        document.getElementById('fresh').hidden = false;
      }
      if (recentGrid) {
        var chips = document.getElementById('recentChips');
        var cats = ['all'].concat(Object.keys(LABELS).filter(function (c) {
          return items.some(function (i) { return i.category === c; });
        }));
        var render = function (cat) {
          fill(recentGrid, cat === 'all' ? items : items.filter(function (i) { return i.category === cat; }));
          chips.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.cat === cat); });
        };
        chips.innerHTML = '';
        if (cats.length > 2) {
          cats.forEach(function (c) {
            var b = document.createElement('button');
            b.type = 'button'; b.dataset.cat = c; b.textContent = c === 'all' ? 'All' : LABELS[c];
            b.addEventListener('click', function () { render(c); });
            chips.appendChild(b);
          });
        }
        render('all');
        document.getElementById('recentSection').hidden = false;
      }
    })
    .catch(function () { /* not on Netlify, or offline: the section simply stays hidden */ });
})();


/* ===== Homepage animation (Signature) ===== */
(function () {
  'use strict';
  if (!document.body.classList.contains('home')) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1) Headline: split into words so they can rise in one by one
  var h1 = document.querySelector('.hero-copy h1');
  if (h1 && !reduce) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var s = document.createElement('span');
            s.className = 'w'; s.style.setProperty('--i', i++); s.textContent = part;
            frag.appendChild(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') { walk(n); }
      });
    })(h1);
    h1.classList.add('is-split');
  }

  // 2) Rotating services line
  var rot = document.querySelector('.rot-words');
  if (rot) {
    var words = (rot.getAttribute('data-words') || '').split('|').filter(Boolean);
    if (reduce) {
      rot.textContent = words.join(' · ');
    } else if (words.length > 1) {
      var idx = 0;
      setTimeout(function () {
        setInterval(function () {
          if (document.hidden) return;
          rot.classList.add('out');
          setTimeout(function () {
            idx = (idx + 1) % words.length;
            rot.textContent = words[idx];
            rot.classList.remove('out'); rot.classList.add('pre');
            void rot.offsetWidth;
            rot.classList.remove('pre');
          }, 360);
        }, 2800);
      }, 2800);
    }
  }

  // 3) Pause the turning 8 while the hero is off-screen
  var eight = document.querySelector('.eight'), hero = document.querySelector('.hero');
  if (eight && hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      eight.classList.toggle('paused', !entries[0].isIntersecting);
    }).observe(hero);
  }

  // 4) Scroll reveals
  if (reduce || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(document.querySelectorAll('.services h2, .fresh h2'), function (h) { h.classList.add('drawn'); });
    return;
  }
  var groups = [
    '.services .eyebrow', '.services h2', '.services .card', '.services .more-link',
    '.fresh .wrap > *', '.trust .eyebrow', '.trust-item', '.contact .wrap > *'
  ];
  var targets = [];
  groups.forEach(function (sel) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (el, k) {
      el.classList.add('reveal');
      if (sel === '.services .card') el.setAttribute('data-dir', k % 2 === 0 ? 'l' : 'r');
      el.style.setProperty('--d', (sel === '.services .card' || sel === '.trust-item' ? k * 90 : 0) + 'ms');
      targets.push(el);
    });
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target; io.unobserve(el);
      el.classList.add('in');
      if (el.tagName === 'H2') el.classList.add('drawn');
      // hand control back to the element's normal styles (keeps card hover transitions)
      var wait = 900 + (parseInt(el.style.getPropertyValue('--d'), 10) || 0);
      setTimeout(function () { el.classList.remove('reveal', 'in'); el.removeAttribute('data-dir'); el.style.removeProperty('--d'); }, wait);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  targets.forEach(function (el) { io.observe(el); });
})();


/* ===== Signature+ : site-wide touches ===== */
(function () {
  'use strict';
  // logo: wrap the "8" so it can spin on hover
  Array.prototype.forEach.call(document.querySelectorAll('.logo'), function (a) {
    var n = a.firstChild;
    if (n && n.nodeType === 3 && /^Turn8/.test(n.nodeValue)) {
      var rest = n.nodeValue.slice(5); n.nodeValue = 'Turn';
      var b = document.createElement('b'); b.className = 'logo8'; b.textContent = '8';
      a.insertBefore(b, n.nextSibling);
      if (rest) a.insertBefore(document.createTextNode(rest), b.nextSibling);
    }
  });
  // thin gold scroll-progress line
  var bar = document.createElement('div'); bar.className = 'scroll-progress'; bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  var ticking = false;
  function paint() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0).toFixed(4) + ')';
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
  window.addEventListener('resize', paint); paint();
})();

/* ===== Signature+ : homepage interactions ===== */
(function () {
  'use strict';
  if (!document.body.classList.contains('home')) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  var hero = document.querySelector('.hero');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // hero: cursor parallax on the 8, gentle tilt on the profile card, slower scroll for the 8
  if (hero) {
    var card = hero.querySelector('.avatar-card'), raf = 0, mx = 0, my = 0;
    if (fine) {
      hero.addEventListener('mousemove', function (e) {
        var r = hero.getBoundingClientRect();
        mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5;
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          hero.style.setProperty('--px', mx.toFixed(3)); hero.style.setProperty('--py', my.toFixed(3));
          if (card) {
            card.classList.remove('leaving');
            card.style.setProperty('--ry', (mx * 9).toFixed(2) + 'deg');
            card.style.setProperty('--rx', (-my * 7).toFixed(2) + 'deg');
          }
        });
      });
      hero.addEventListener('mouseleave', function () {
        hero.style.setProperty('--px', 0); hero.style.setProperty('--py', 0);
        if (card) { card.classList.add('leaving'); card.style.setProperty('--ry', '0deg'); card.style.setProperty('--rx', '0deg'); }
      });
    }
    var sTick = false;
    window.addEventListener('scroll', function () {
      if (sTick) return; sTick = true;
      requestAnimationFrame(function () { hero.style.setProperty('--sy', Math.min(window.scrollY, 700) * 0.18); sTick = false; });
    }, { passive: true });
  }

  // service cards: gold spotlight that follows the cursor
  if (fine) {
    Array.prototype.forEach.call(document.querySelectorAll('.home .card'), function (c) {
      c.addEventListener('mousemove', function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
    // main buttons: a light magnetic pull
    Array.prototype.forEach.call(document.querySelectorAll('.home .btn-primary'), function (b) {
      b.addEventListener('mousemove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.setProperty('--bx', ((e.clientX - r.left - r.width / 2) * 0.16).toFixed(1) + 'px');
        b.style.setProperty('--by', ((e.clientY - r.top - r.height / 2) * 0.22).toFixed(1) + 'px');
      });
      b.addEventListener('mouseleave', function () { b.style.setProperty('--bx', '0px'); b.style.setProperty('--by', '0px'); });
    });
  }

  // gold dust drifting in the hero (kept to a handful of specks, paused when off-screen)
  var canvas = document.querySelector('.dust');
  if (canvas && hero) {
    var ctx = canvas.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), parts = [], w = 0, h = 0, running = false, last = 0, vis = true;
    var N = window.innerWidth < 700 ? 10 : 22;
    var size = function () {
      var r = hero.getBoundingClientRect(); w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    var spawn = function (p, fresh) {
      p.x = Math.random() * w; p.y = fresh ? Math.random() * h : h + 10; p.r = 0.8 + Math.random() * 1.7;
      p.vy = -(6 + Math.random() * 10); p.vx = (Math.random() - 0.5) * 5; p.a = 0.3 + Math.random() * 0.5;
      p.t = Math.random() * 6.28; p.s = 0.6 + Math.random() * 1.2; return p;
    };
    var frame = function (ts) {
      if (!running) return;
      var dt = Math.min((ts - last) / 1000, 0.05); last = ts;
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#E4CE9C';
      parts.forEach(function (p) {
        p.t += dt * p.s; p.x += p.vx * dt + Math.sin(p.t) * 0.12; p.y += p.vy * dt;
        if (p.y < -10 || p.x < -10 || p.x > w + 10) spawn(p, false);
        ctx.globalAlpha = p.a * (0.55 + 0.45 * Math.sin(p.t * 2));
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      });
      ctx.globalAlpha = 1; requestAnimationFrame(frame);
    };
    var start = function () { if (running || !vis || document.hidden) return; running = true; last = performance.now(); requestAnimationFrame(frame); };
    size(); for (var k = 0; k < N; k++) parts.push(spawn({}, true));
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { size(); parts.forEach(function (p) { spawn(p, true); }); }, 200); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) running = false; else start(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { vis = en[0].isIntersecting; if (vis) start(); else running = false; }).observe(hero);
    }
    setTimeout(function () { canvas.classList.add('on'); }, 1200);
    start();
  }
})();
