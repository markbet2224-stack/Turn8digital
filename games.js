/* Turn8 Arcade: Flappy T8, Tetris, Pong. Loaded on every page. */
document.body.insertAdjacentHTML('beforeend', `
<div class="game-modal-overlay" id="gameOverlay" role="dialog" aria-modal="true" aria-label="Turn8digital arcade">
  <div class="game-modal">
    <div class="game-modal-head">
      <button class="game-modal-back" id="backGameBtn" aria-label="Back to game menu" style="display:none;">&larr;</button>
      <div class="game-modal-title" id="gameTitle">Turn8 <span>Arcade</span></div>
      <button class="game-modal-close" id="closeGameBtn" aria-label="Close game">&times;</button>
    </div>

    <div class="game-select" id="gameSelect">
      <button class="game-pick" data-game="pong">
        <span class="game-pick-emoji">🏓</span>
        <span>Pong</span>
      </button>
      <button class="game-pick" data-game="tetris">
        <span class="game-pick-emoji">🧱</span>
        <span>Tetris</span>
      </button>
      <button class="game-pick" data-game="flappy">
        <span class="game-pick-emoji">🐦</span>
        <span>Flappy T8</span>
      </button>
    </div>

    <div class="game-stage" id="gameStage" style="display:none;">
      <canvas id="flappyCanvas" width="320" height="440"></canvas>
      <canvas id="tetrisCanvas" width="200" height="400" style="display:none;"></canvas>
      <canvas id="pongCanvas" width="300" height="200" style="display:none;"></canvas>
      <p class="game-modal-hint" id="gameHint"></p>
      <div class="tetris-controls" id="tetrisControls" style="display:none;">
        <button type="button" data-action="left" aria-label="Move left">◀</button>
        <button type="button" data-action="rotate" aria-label="Rotate">⟳</button>
        <button type="button" data-action="down" aria-label="Soft drop">▼</button>
        <button type="button" data-action="right" aria-label="Move right">▶</button>
      </div>
    </div>
  </div>
</div>
`);
(function(){
  var overlay = document.getElementById('gameOverlay');
  var openBtn = document.getElementById('openGameBtn');
  var closeBtn = document.getElementById('closeGameBtn');
  var backBtn = document.getElementById('backGameBtn');
  var titleEl = document.getElementById('gameTitle');
  var selectScreen = document.getElementById('gameSelect');
  var stage = document.getElementById('gameStage');
  var hint = document.getElementById('gameHint');
  var tetrisControls = document.getElementById('tetrisControls');

  var flappyCanvas = document.getElementById('flappyCanvas');
  var tetrisCanvas = document.getElementById('tetrisCanvas');
  var pongCanvas = document.getElementById('pongCanvas');

  var GOLD = '#C9A15A';
  var GOLD_LIGHT = '#E4CE9C';
  var TEAL_DARK = '#0B2E2B';
  var TEAL_MID = '#12433D';
  var TEAL_SOFT = '#1F6358';
  var CREAM = '#F6F1E7';
  var BG_FLAT = '#0A1210';

  var loop = null;
  var currentGame = null; // 'flappy' | 'tetris'

  /* ---------------- FLAPPY T8 ---------------- */
  var Flappy = (function(){
    var canvas = flappyCanvas, ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var birdImg = new Image();
    birdImg.src = 'apple-touch-icon.png';

    var state, bird, pipes, frame, score, best = 0;
    var GRAVITY = 0.45, FLAP = -7.6, PIPE_GAP = 132, PIPE_W = 52, PIPE_SPEED = 2.4, PIPE_INTERVAL = 95;

    function reset(){
      bird = { x: W*0.28, y: H/2, vy: 0, r: 16 };
      pipes = [];
      frame = 0;
      score = 0;
      state = 'ready';
      hint.textContent = 'Tap, click, or press space to flap';
    }

    function input(){
      if(state === 'ready'){ state = 'playing'; hint.textContent = ''; }
      else if(state === 'playing'){ bird.vy = FLAP; }
      else if(state === 'over'){ reset(); }
    }

    function spawnPipe(){
      var margin = 40;
      var top = margin + Math.random() * (H - PIPE_GAP - margin*2);
      pipes.push({ x: W + 10, top: top, passed: false });
    }

    function gameOver(){
      state = 'over';
      if(score > best) best = score;
      hint.textContent = 'Game over — tap to try again';
    }

    function update(){
      if(state !== 'playing') return;
      frame++;
      bird.vy += GRAVITY;
      bird.y += bird.vy;
      if(frame % PIPE_INTERVAL === 0) spawnPipe();

      for(var i = pipes.length - 1; i >= 0; i--){
        var p = pipes[i];
        p.x -= PIPE_SPEED;
        if(!p.passed && p.x + PIPE_W < bird.x - bird.r){ p.passed = true; score++; }
        var hitX = bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W;
        var hitY = bird.y - bird.r < p.top || bird.y + bird.r > p.top + PIPE_GAP;
        if(hitX && hitY) gameOver();
        if(p.x + PIPE_W < -10) pipes.splice(i, 1);
      }
      if(bird.y + bird.r > H || bird.y - bird.r < 0) gameOver();
    }

    function draw(){
      ctx.fillStyle = BG_FLAT;
      ctx.fillRect(0,0,W,H);

      pipes.forEach(function(p){
        ctx.fillStyle = TEAL_SOFT; ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
        ctx.fillRect(p.x, 0, PIPE_W, p.top);
        ctx.strokeRect(p.x, 0, PIPE_W, p.top);
        ctx.fillRect(p.x, p.top + PIPE_GAP, PIPE_W, H - (p.top + PIPE_GAP));
        ctx.strokeRect(p.x, p.top + PIPE_GAP, PIPE_W, H - (p.top + PIPE_GAP));
        ctx.fillStyle = GOLD;
        ctx.fillRect(p.x - 3, p.top - 10, PIPE_W + 6, 10);
        ctx.fillRect(p.x - 3, p.top + PIPE_GAP, PIPE_W + 6, 10);
      });

      ctx.save();
      ctx.translate(bird.x, bird.y);
      var angle = Math.max(-0.5, Math.min(0.9, bird.vy / 10));
      ctx.rotate(angle);

      var wingFlap = Math.sin(frame * 0.35) * 0.5;
      [-1, 1].forEach(function(side){
        ctx.save();
        ctx.translate(side * bird.r * 0.8, bird.r * 0.1);
        ctx.rotate(side * wingFlap);
        ctx.beginPath();
        ctx.ellipse(0, 0, bird.r * 0.55, bird.r * 0.28, 0, 0, Math.PI * 2);
        ctx.fillStyle = GOLD;
        ctx.fill();
        ctx.strokeStyle = GOLD_LIGHT;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      });

      ctx.beginPath(); ctx.arc(0, 0, bird.r, 0, Math.PI*2);
      ctx.fillStyle = GOLD_LIGHT; ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke();
      if(birdImg.complete && birdImg.naturalWidth){
        ctx.save(); ctx.beginPath(); ctx.arc(0,0,bird.r-2,0,Math.PI*2); ctx.clip();
        ctx.drawImage(birdImg, -bird.r, -bird.r, bird.r*2, bird.r*2);
        ctx.restore();
      }
      ctx.restore();

      ctx.fillStyle = CREAM; ctx.font = '600 26px Fraunces, serif'; ctx.textAlign = 'center';
      ctx.fillText(score, W/2, 50);
      ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = GOLD_LIGHT; ctx.globalAlpha = 0.85;
      ctx.fillText('BEST ' + best, W/2, 68); ctx.globalAlpha = 1;

      if(state === 'ready'){
        ctx.fillStyle = CREAM; ctx.font = '600 20px Fraunces, serif';
        ctx.fillText('Flappy T8', W/2, H/2 - 20);
        ctx.font = '12px "IBM Plex Mono", monospace'; ctx.fillStyle = GOLD_LIGHT;
        ctx.fillText('tap / click / space to start', W/2, H/2 + 10);
      }
      if(state === 'over'){
        ctx.fillStyle = 'rgba(11,46,43,0.55)'; ctx.fillRect(0,0,W,H);
        ctx.fillStyle = CREAM; ctx.font = '600 22px Fraunces, serif';
        ctx.fillText('Game over', W/2, H/2 - 8);
        ctx.font = '12px "IBM Plex Mono", monospace'; ctx.fillStyle = GOLD_LIGHT;
        ctx.fillText('tap to try again', W/2, H/2 + 18);
      }
    }

    function onKey(e){
      if(e.code === 'Space'){ e.preventDefault(); input(); }
    }

    return { reset: reset, update: update, draw: draw, input: input, onKey: onKey, canvas: canvas };
  })();

  /* ---------------- TETRIS T8 ---------------- */
  var Tetris = (function(){
    var canvas = tetrisCanvas, ctx = canvas.getContext('2d');
    var COLS = 10, ROWS = 20, BLOCK = 20;
    var W = canvas.width, H = canvas.height;

    var SHAPES = {
      I: [[1,1,1,1]],
      O: [[1,1],[1,1]],
      T: [[0,1,0],[1,1,1]],
      S: [[0,1,1],[1,1,0]],
      Z: [[1,1,0],[0,1,1]],
      J: [[1,0,0],[1,1,1]],
      L: [[0,0,1],[1,1,1]]
    };
    var COLORS = {
      I: GOLD, O: GOLD_LIGHT, T: TEAL_SOFT, S: '#2C7A6C', Z: '#8C6239', J: '#5FA79A', L: '#D9B978'
    };
    var KEYS = Object.keys(SHAPES);

    var board, piece, score, best = 0, dropTimer, dropInterval, state;

    function newPiece(){
      var key = KEYS[Math.floor(Math.random()*KEYS.length)];
      var shape = SHAPES[key].map(function(row){ return row.slice(); });
      return { shape: shape, key: key, x: Math.floor(COLS/2) - Math.ceil(shape[0].length/2), y: 0 };
    }

    function reset(){
      board = [];
      for(var r=0;r<ROWS;r++) board.push(new Array(COLS).fill(0));
      piece = newPiece();
      score = 0;
      dropInterval = 45;
      dropTimer = 0;
      state = 'ready';
      hint.textContent = 'Tap ⟳ or Up to start · swipe or use buttons to move';
    }

    function collide(shape, ox, oy){
      for(var y=0;y<shape.length;y++){
        for(var x=0;x<shape[y].length;x++){
          if(!shape[y][x]) continue;
          var by = oy + y, bx = ox + x;
          if(bx < 0 || bx >= COLS || by >= ROWS) return true;
          if(by >= 0 && board[by][bx]) return true;
        }
      }
      return false;
    }

    function merge(){
      piece.shape.forEach(function(row, y){
        row.forEach(function(val, x){
          if(val){
            var by = piece.y + y, bx = piece.x + x;
            if(by >= 0) board[by][bx] = piece.key;
          }
        });
      });
    }

    function clearLines(){
      var cleared = 0;
      for(var r = ROWS - 1; r >= 0; r--){
        if(board[r].every(function(c){ return c; })){
          board.splice(r,1);
          board.unshift(new Array(COLS).fill(0));
          cleared++; r++;
        }
      }
      if(cleared){
        score += cleared * 100;
        dropInterval = Math.max(12, dropInterval - cleared * 2);
      }
    }

    function rotateShape(shape){
      var rows = shape.length, cols = shape[0].length;
      var res = [];
      for(var x=0;x<cols;x++){
        var row = [];
        for(var y=rows-1;y>=0;y--) row.push(shape[y][x]);
        res.push(row);
      }
      return res;
    }

    function lockPiece(){
      merge();
      clearLines();
      piece = newPiece();
      if(collide(piece.shape, piece.x, piece.y)){
        gameOver();
      }
    }

    function gameOver(){
      state = 'over';
      if(score > best) best = score;
      hint.textContent = 'Game over — tap ⟳ to try again';
    }

    function moveLeft(){ if(state==='playing' && !collide(piece.shape, piece.x-1, piece.y)) piece.x--; }
    function moveRight(){ if(state==='playing' && !collide(piece.shape, piece.x+1, piece.y)) piece.x++; }
    function softDrop(){ if(state==='playing' && !collide(piece.shape, piece.x, piece.y+1)) piece.y++; else if(state==='playing') lockPiece(); }
    function rotate(){
      if(state !== 'playing') return;
      var r = rotateShape(piece.shape);
      var kicks = [0,-1,1,-2,2];
      for(var i=0;i<kicks.length;i++){
        if(!collide(r, piece.x+kicks[i], piece.y)){
          piece.shape = r; piece.x += kicks[i]; return;
        }
      }
    }

    function input(action){
      if(state === 'ready' || state === 'over'){
        if(state === 'over') reset();
        state = 'playing';
        hint.textContent = '';
        return;
      }
      if(action === 'left') moveLeft();
      else if(action === 'right') moveRight();
      else if(action === 'down') softDrop();
      else if(action === 'rotate') rotate();
    }

    function update(){
      if(state !== 'playing') return;
      dropTimer++;
      if(dropTimer >= dropInterval){
        dropTimer = 0;
        if(!collide(piece.shape, piece.x, piece.y+1)) piece.y++;
        else lockPiece();
      }
    }

    function drawCell(x, y, color){
      ctx.fillStyle = color;
      ctx.fillRect(x*BLOCK+1, y*BLOCK+1, BLOCK-2, BLOCK-2);
      ctx.strokeStyle = 'rgba(11,18,16,0.4)';
      ctx.strokeRect(x*BLOCK+1, y*BLOCK+1, BLOCK-2, BLOCK-2);
    }

    function draw(){
      ctx.fillStyle = BG_FLAT;
      ctx.fillRect(0,0,W,H);

      ctx.strokeStyle = 'rgba(246,241,231,0.05)';
      ctx.lineWidth = 1;
      for(var gx=1; gx<COLS; gx++){
        ctx.beginPath(); ctx.moveTo(gx*BLOCK, 0); ctx.lineTo(gx*BLOCK, H); ctx.stroke();
      }
      for(var gy=1; gy<ROWS; gy++){
        ctx.beginPath(); ctx.moveTo(0, gy*BLOCK); ctx.lineTo(W, gy*BLOCK); ctx.stroke();
      }

      for(var y=0;y<ROWS;y++){
        for(var x=0;x<COLS;x++){
          if(board[y][x]) drawCell(x,y,COLORS[board[y][x]]);
        }
      }
      if(state === 'playing' || state === 'ready'){
        piece.shape.forEach(function(row, y){
          row.forEach(function(val, x){
            if(val) drawCell(piece.x+x, piece.y+y, COLORS[piece.key]);
          });
        });
      }

      ctx.fillStyle = CREAM; ctx.font = '600 16px Fraunces, serif'; ctx.textAlign = 'left';
      ctx.fillText('Score ' + score, 8, 20);
      ctx.font = '10px "IBM Plex Mono", monospace'; ctx.fillStyle = GOLD_LIGHT; ctx.globalAlpha = 0.85;
      ctx.fillText('BEST ' + best, 8, 34); ctx.globalAlpha = 1;

      if(state === 'ready'){
        ctx.fillStyle = 'rgba(11,46,43,0.55)'; ctx.fillRect(0,0,W,H);
        ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.font = '600 18px Fraunces, serif';
        ctx.fillText('Tetris', W/2, H/2 - 10);
        ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = GOLD_LIGHT;
        ctx.fillText('tap ⟳ or ↑ to start', W/2, H/2 + 12);
      }
      if(state === 'over'){
        ctx.fillStyle = 'rgba(11,46,43,0.55)'; ctx.fillRect(0,0,W,H);
        ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.font = '600 18px Fraunces, serif';
        ctx.fillText('Game over', W/2, H/2 - 10);
        ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = GOLD_LIGHT;
        ctx.fillText('tap ⟳ to try again', W/2, H/2 + 12);
      }
    }

    function onKey(e){
      var map = { ArrowLeft:'left', ArrowRight:'right', ArrowDown:'down', ArrowUp:'rotate' };
      if(map[e.code] || e.code === 'ArrowUp'){
        e.preventDefault();
        input(map[e.code]);
      }
    }

    return { reset: reset, update: update, draw: draw, input: input, onKey: onKey, canvas: canvas };
  })();

  /* ---------------- PONG T8 ---------------- */
  var Pong = (function(){
    var canvas = pongCanvas, ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var PAD_W = 8, PAD_H = 44, PAD_SPEED_AI = 3.2, WIN_SCORE = 5;

    var player, ai, ball, scorePlayer, scoreAi, state;

    function centerBall(dir){
      var speed = 3.2;
      var angle = (Math.random() * 0.6 - 0.3);
      return {
        x: W/2, y: H/2, r: 5,
        vx: Math.cos(angle) * speed * dir,
        vy: Math.sin(angle) * speed
      };
    }

    function reset(){
      player = { y: H/2 - PAD_H/2 };
      ai = { y: H/2 - PAD_H/2 };
      ball = centerBall(Math.random() < 0.5 ? 1 : -1);
      scorePlayer = 0; scoreAi = 0;
      state = 'ready';
      hint.textContent = 'Drag/tap to move your paddle — tap to serve';
    }

    function input(){
      if(state === 'ready' || state === 'over'){
        if(state === 'over') reset();
        state = 'playing';
        hint.textContent = '';
      }
    }

    function drag(y){
      player.y = Math.max(0, Math.min(H - PAD_H, y - PAD_H/2));
    }

    function serveAfterScore(dir){
      ball = centerBall(dir);
    }

    function endGame(){
      state = 'over';
      hint.textContent = (scorePlayer > scoreAi ? 'You win!' : 'AI wins') + ' — tap to play again';
    }

    function update(){
      if(state !== 'playing') return;

      var target = ball.y - PAD_H/2 + (Math.random()-0.5) * 8;
      if(ai.y < target) ai.y = Math.min(ai.y + PAD_SPEED_AI, target);
      else if(ai.y > target) ai.y = Math.max(ai.y - PAD_SPEED_AI, target);
      ai.y = Math.max(0, Math.min(H - PAD_H, ai.y));

      ball.x += ball.vx;
      ball.y += ball.vy;

      if(ball.y - ball.r < 0){ ball.y = ball.r; ball.vy *= -1; }
      if(ball.y + ball.r > H){ ball.y = H - ball.r; ball.vy *= -1; }

      var pX = 14;
      if(ball.vx < 0 && ball.x - ball.r < pX + PAD_W && ball.x - ball.r > pX - 6 &&
         ball.y > player.y && ball.y < player.y + PAD_H){
        ball.x = pX + PAD_W + ball.r;
        ball.vx = Math.abs(ball.vx) * 1.05;
        var hit = (ball.y - (player.y + PAD_H/2)) / (PAD_H/2);
        ball.vy = hit * 4;
      }

      var aX = W - 14 - PAD_W;
      if(ball.vx > 0 && ball.x + ball.r > aX && ball.x + ball.r < aX + 6 + PAD_W &&
         ball.y > ai.y && ball.y < ai.y + PAD_H){
        ball.x = aX - ball.r;
        ball.vx = -Math.abs(ball.vx) * 1.05;
        var hitA = (ball.y - (ai.y + PAD_H/2)) / (PAD_H/2);
        ball.vy = hitA * 4;
      }

      if(ball.x < -10){
        scoreAi++;
        if(scoreAi >= WIN_SCORE) endGame(); else serveAfterScore(1);
      }
      if(ball.x > W + 10){
        scorePlayer++;
        if(scorePlayer >= WIN_SCORE) endGame(); else serveAfterScore(-1);
      }
    }

    function draw(){
      ctx.fillStyle = BG_FLAT;
      ctx.fillRect(0,0,W,H);

      ctx.strokeStyle = 'rgba(246,241,231,0.12)';
      ctx.setLineDash([5,7]);
      ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = GOLD_LIGHT;
      ctx.fillRect(14, player.y, PAD_W, PAD_H);
      ctx.fillStyle = GOLD;
      ctx.fillRect(W - 14 - PAD_W, ai.y, PAD_W, PAD_H);

      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
      ctx.fillStyle = CREAM;
      ctx.fill();

      ctx.fillStyle = CREAM; ctx.font = '600 22px Fraunces, serif'; ctx.textAlign = 'center';
      ctx.fillText(scorePlayer, W/2 - 40, 30);
      ctx.fillStyle = GOLD_LIGHT;
      ctx.fillText(scoreAi, W/2 + 40, 30);

      if(state === 'ready'){
        ctx.fillStyle = CREAM; ctx.font = '600 18px Fraunces, serif';
        ctx.fillText('Pong', W/2, H/2 - 6);
        ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = GOLD_LIGHT;
        ctx.fillText('tap to serve', W/2, H/2 + 14);
      }
      if(state === 'over'){
        ctx.fillStyle = 'rgba(11,18,16,0.6)'; ctx.fillRect(0,0,W,H);
        ctx.fillStyle = CREAM; ctx.font = '600 18px Fraunces, serif';
        ctx.fillText(scorePlayer > scoreAi ? 'You win!' : 'AI wins', W/2, H/2 - 6);
        ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = GOLD_LIGHT;
        ctx.fillText('tap to play again', W/2, H/2 + 14);
      }
    }

    function onKey(e){
      if(e.code === 'ArrowUp'){ e.preventDefault(); drag(player.y + PAD_H/2 - 18); }
      if(e.code === 'ArrowDown'){ e.preventDefault(); drag(player.y + PAD_H/2 + 18); }
    }

    return { reset: reset, update: update, draw: draw, input: input, onKey: onKey, drag: drag, canvas: canvas };
  })();

  /* ---------------- SHARED MODAL / LOOP LOGIC ---------------- */
  var games = { flappy: Flappy, tetris: Tetris, pong: Pong };

  function tick(){
    if(currentGame){
      games[currentGame].update();
      games[currentGame].draw();
    }
    loop = requestAnimationFrame(tick);
  }

  function showSelect(){
    currentGame = null;
    selectScreen.style.display = 'flex';
    stage.style.display = 'none';
    backBtn.style.display = 'none';
    tetrisControls.style.display = 'none';
    titleEl.innerHTML = 'Turn8 <span>Arcade</span>';
    hint.textContent = '';
  }

  function playGame(name){
    currentGame = name;
    selectScreen.style.display = 'none';
    stage.style.display = 'flex';
    backBtn.style.display = 'inline-flex';
    flappyCanvas.style.display = name === 'flappy' ? 'block' : 'none';
    tetrisCanvas.style.display = name === 'tetris' ? 'block' : 'none';
    pongCanvas.style.display = name === 'pong' ? 'block' : 'none';
    tetrisControls.style.display = name === 'tetris' ? 'flex' : 'none';
    titleEl.innerHTML = name === 'flappy' ? 'Flappy <span>T8</span>' : name === 'tetris' ? 'Tetris <span>T8</span>' : 'Pong <span>T8</span>';
    games[name].reset();
  }

  function openModal(){
    overlay.classList.add('open');
    showSelect();
    document.addEventListener('keydown', onKeydown);
    if(!loop) tick();
  }

  function closeModal(){
    overlay.classList.remove('open');
    document.removeEventListener('keydown', onKeydown);
    if(loop){ cancelAnimationFrame(loop); loop = null; }
  }

  function onKeydown(e){
    if(e.code === 'Escape'){ closeModal(); return; }
    if(!currentGame) return;
    games[currentGame].onKey(e);
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  backBtn.addEventListener('click', showSelect);
  overlay.addEventListener('click', function(e){ if(e.target === overlay) closeModal(); });

  selectScreen.querySelectorAll('.game-pick').forEach(function(btn){
    btn.addEventListener('click', function(){ playGame(btn.getAttribute('data-game')); });
  });

  flappyCanvas.addEventListener('mousedown', function(){ if(currentGame==='flappy') Flappy.input(); });
  flappyCanvas.addEventListener('touchstart', function(e){ e.preventDefault(); if(currentGame==='flappy') Flappy.input(); }, { passive:false });

  tetrisCanvas.addEventListener('mousedown', function(){ if(currentGame==='tetris') Tetris.input('rotate'); });

  tetrisControls.querySelectorAll('button').forEach(function(btn){
    var action = btn.getAttribute('data-action');
    btn.addEventListener('click', function(){ if(currentGame==='tetris') Tetris.input(action); });
    btn.addEventListener('touchstart', function(e){ e.preventDefault(); if(currentGame==='tetris') Tetris.input(action); }, { passive:false });
  });

  function pongY(clientY){
    var rect = pongCanvas.getBoundingClientRect();
    var scale = pongCanvas.height / rect.height;
    return (clientY - rect.top) * scale;
  }
  pongCanvas.addEventListener('mousedown', function(e){
    if(currentGame!=='pong') return;
    Pong.input();
    Pong.drag(pongY(e.clientY));
  });
  pongCanvas.addEventListener('mousemove', function(e){
    if(currentGame==='pong') Pong.drag(pongY(e.clientY));
  });
  pongCanvas.addEventListener('touchstart', function(e){
    if(currentGame!=='pong') return;
    e.preventDefault();
    Pong.input();
    Pong.drag(pongY(e.touches[0].clientY));
  }, { passive:false });
  pongCanvas.addEventListener('touchmove', function(e){
    if(currentGame!=='pong') return;
    e.preventDefault();
    Pong.drag(pongY(e.touches[0].clientY));
  }, { passive:false });
})();
