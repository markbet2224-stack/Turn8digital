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
