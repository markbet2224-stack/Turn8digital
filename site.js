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
  if (reduce || !('IntersectionObserver' in window)) return;
  var groups = [
    '.services .eyebrow', '.services h2', '.services .card', '.services .more-link',
    '.fresh .wrap > *', '.trust .eyebrow', '.trust-item', '.contact .wrap > *'
  ];
  var targets = [];
  groups.forEach(function (sel) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (el, k) {
      el.classList.add('reveal');
      el.style.setProperty('--d', (sel === '.services .card' || sel === '.trust-item' ? k * 90 : 0) + 'ms');
      targets.push(el);
    });
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target; io.unobserve(el);
      el.classList.add('in');
      // hand control back to the element's normal styles (keeps card hover transitions)
      var wait = 900 + (parseInt(el.style.getPropertyValue('--d'), 10) || 0);
      setTimeout(function () { el.classList.remove('reveal', 'in'); el.style.removeProperty('--d'); }, wait);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  targets.forEach(function (el) { io.observe(el); });
})();
