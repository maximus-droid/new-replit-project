/*
  Lord of the Mysty: Pathways (Canvas 2D, offline-capable, no WebGL)
  Version: 0.1.0
*/
(function(){
  'use strict';

  const GAME_VERSION = '0.1.0';
  const TILE_SIZE = 24;                  // pixels per tile
  const CHUNK_SIZE = 32;                 // tiles per chunk side
  const GRAVITY = 0.35;
  const MAX_FALL_SPEED = 10;
  const SAVE_KEY = 'mysty_save_v1';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  if(!ctx){
    // Fallback for very old browsers
    alert('Canvas 2D is not supported in this browser.');
    return;
  }
  const hudEl = document.getElementById('hud');
  const dialogueBox = document.getElementById('dialogueBox');
  const startMenu = document.getElementById('startMenu');
  const continueBtn = document.getElementById('continueBtn');
  const newStoryBtn = document.getElementById('newStoryBtn');
  const pathwaysSection = document.getElementById('pathwaysSection');
  const pathwaysGrid = document.getElementById('pathwaysGrid');
  const timeOfDayEl = document.getElementById('timeOfDay');
  const fpsEl = document.getElementById('fps');
  const objectiveEl = document.getElementById('objective');
  const journalModal = document.getElementById('journalModal');
  const journalEntriesEl = document.getElementById('journalEntries');
  const closeJournalBtn = document.getElementById('closeJournalBtn');

  // State
  const input = { left:false, right:false, up:false, down:false, jump:false };
  let camera = { x:0, y:0, scale:1 };
  let paused = false;
  let lastFrameTime = performance.now();
  let fps = 0, fpsAccumulator = 0, fpsCount = 0;

  const TileId = {
    Air: 0,
    Grass: 1,
    Dirt: 2,
    Stone: 3,
    Log: 4,
    Leaves: 5,
    Sand: 6,
    Water: 7,
    Plank: 8,
    Workbench: 9
  };
  const TileProps = {
    [TileId.Air]:   { solid:false, breakable:false, hardness:0, color:null },
    [TileId.Grass]: { solid:true,  breakable:true,  hardness:1, color:'#3d9b45' },
    [TileId.Dirt]:  { solid:true,  breakable:true,  hardness:1, color:'#6b4a2b' },
    [TileId.Stone]: { solid:true,  breakable:true,  hardness:3, color:'#8a8f98' },
    [TileId.Log]:   { solid:true,  breakable:true,  hardness:1, color:'#7b5a33' },
    [TileId.Leaves]:{ solid:false, breakable:true,  hardness:0.5, color:'rgba(90,148,67,0.9)' },
    [TileId.Sand]:  { solid:true,  breakable:true,  hardness:0.8, color:'#d2c48a' },
    [TileId.Water]: { solid:false, breakable:false, hardness:0, color:'rgba(87,140,200,0.5)' },
    [TileId.Plank]: { solid:true,  breakable:true,  hardness:1, color:'#caa06b' },
    [TileId.Workbench]:{ solid:true, breakable:true, hardness:1.2, color:'#b98a56' },
  };

  // No mining/crafting: items removed; world is immutable

  // 22 Pathways: place + archetype + flavor + start kit
  const PATHWAYS = [
    { id:'mist-warden', name:'Mist Warden', place:'Misty Highlands', arch:'Guardian', theme:'#8fb5ff', desc:'You keep watch over veiled peaks and hidden shrines.', kit:{ Log:6, Dirt:10 } },
    { id:'veil-nomad', name:'Veil Nomad', place:'Fogged Plains', arch:'Wanderer', theme:'#c5e1ff', desc:'A drifter charting currents of myst.', kit:{ Log:4, Dirt:6 } },
    { id:'crypt-scribe', name:'Crypt Scribe', place:'Obsidian Dales', arch:'Chronicler', theme:'#a7b0c4', desc:'Secrets etched beneath basalt arches.', kit:{ Log:2, Stone:6 } },
    { id:'river-seer', name:'River Seer', place:'Sapphire Marsh', arch:'Oracle', theme:'#94d0ff', desc:'Whispers carried by glassy waters.', kit:{ Log:3, Dirt:4 } },
    { id:'ember-ranger', name:'Ember Ranger', place:'Cinderwood Edge', arch:'Stalker', theme:'#ffb58b', desc:'Ashen groves and smoldering paths.', kit:{ Log:8 } },
    { id:'dune-keeper', name:'Dune Keeper', place:'Hollow Sands', arch:'Steward', theme:'#e8d79a', desc:'Echoes beneath rolling dunes.', kit:{ Dirt:12 } },
    { id:'spire-ascetic', name:'Spire Ascetic', place:'Needle Spires', arch:'Hermit', theme:'#b0c8e6', desc:'Thin air and solemn vows.', kit:{ Stone:8 } },
    { id:'fen-harbinger', name:'Fen Harbinger', place:'Moonfen', arch:'Herald', theme:'#b9e1ff', desc:'Marshlights and oaths unbroken.', kit:{ Log:4, Dirt:4 } },
    { id:'gale-cartographer', name:'Gale Cartographer', place:'Windswept Rise', arch:'Mapper', theme:'#a7cdf0', desc:'Lines across the world and mind.', kit:{ Log:4 } },
    { id:'gloam-binder', name:'Gloam Binder', place:'Gloamwood', arch:'Binder', theme:'#9fb7ff', desc:'Twilight threads and woven vows.', kit:{ Log:6 } },
    { id:'reef-hermit', name:'Reef Hermit', place:'Shale Reefs', arch:'Anchorite', theme:'#b1e0ff', desc:'Tide-chiseled halls.', kit:{ Stone:6 } },
    { id:'thicket-warden', name:'Thicket Warden', place:'Deep Thicket', arch:'Warden', theme:'#9cd38c', desc:'Vast roots, older than words.', kit:{ Log:10 } },
    { id:'haze-alchemist', name:'Haze Alchemist', place:'Vapormere', arch:'Alchemist', theme:'#c9d7ff', desc:'Tinctures of light and shade.', kit:{ Log:3, Stone:3 } },
    { id:'echo-ranger', name:'Echo Ranger', place:'Echoing Steppe', arch:'Ranger', theme:'#abc9ff', desc:'Footfalls count the miles.', kit:{ Dirt:8 } },
    { id:'moor-sentinel', name:'Moor Sentinel', place:'Verdant Moor', arch:'Sentinel', theme:'#a5d39b', desc:'Stillness that sees all.', kit:{ Log:5 } },
    { id:'shard-weaver', name:'Shard Weaver', place:'Crystal Runnel', arch:'Weaver', theme:'#bed8ff', desc:'Motes of song in stone.', kit:{ Stone:8 } },
    { id:'cairn-keeper', name:'Cairn Keeper', place:'Old Cairn', arch:'Keeper', theme:'#c9cbd6', desc:'Markers whispering names.', kit:{ Stone:6, Dirt:4 } },
    { id:'tarn-mystic', name:'Tarn Mystic', place:'Hidden Tarn', arch:'Mystic', theme:'#bde5ff', desc:'Still waters store old vows.', kit:{ Log:3, Dirt:3 } },
    { id:'hollow-warden', name:'Hollow Warden', place:'Root Hollows', arch:'Guardian', theme:'#a4c7ff', desc:'Vaults beneath the green.', kit:{ Log:8 } },
    { id:'mist-sailor', name:'Mist Sailor', place:'Pale Bay', arch:'Mariner', theme:'#b7deff', desc:'To fathom shallow stars.', kit:{ Log:5, Stone:3 } },
    { id:'ridge-scout', name:'Ridge Scout', place:'Frost Ridge', arch:'Scout', theme:'#c3d8ff', desc:'White breath, blue horizons.', kit:{ Dirt:4, Stone:4 } },
    { id:'vault-lorekeeper', name:'Vault Lorekeeper', place:'Veiled Vault', arch:'Lorekeeper', theme:'#d5e1ff', desc:'Keys for doors unseen.', kit:{ Log:4, Stone:4 } },
  ];

  // PRNG and Value noise
  function xorshift32(seed){
    let s = seed || 123456789;
    return function(){
      s ^= s << 13; s |= 0;
      s ^= s >>> 17; s |= 0;
      s ^= s << 5; s |= 0;
      return ((s >>> 0) / 4294967296);
    }
  }
  function hashInt(x){
    let h = x | 0; h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16; return h >>> 0;
  }
  function valueNoise1D(x, seed){
    const x0 = Math.floor(x); const x1 = x0 + 1;
    const r0 = (hashInt(x0 + seed) % 1000) / 1000;
    const r1 = (hashInt(x1 + seed) % 1000) / 1000;
    const t = x - x0; const u = t * t * (3 - 2 * t);
    return r0 * (1 - u) + r1 * u;
  }

  // World and chunks
  function chunkKey(cx, cy){ return cx + ':' + cy; }
  function tileChunkCoord(v){ return Math.floor(v / CHUNK_SIZE); }
  function positiveMod(a, n){ return ((a % n) + n) % n; }

  const world = {
    seed: 1337,
    chunks: new Map(), // key -> { tiles: Uint16Array(CHUNK_SIZE*CHUNK_SIZE) }
    edits: new Map(),  // reserved for future environment changes
    pois: new Map(),   // key -> array of POIs
  };

  const player = {
    x: 0, y: 0, vx: 0, vy: 0, width: 0.7, height: 1.6,
    spawn: { x: 0, y: 0 },
    onGround: false,
  };

  const story = {
    pathway: null,
    messages: [],
    nextAt: 0,
    questStage: 0,
    journal: [],
    visitedPoiIds: new Set(),
  };

  function pushMessage(text){
    story.messages.push(text);
    dialogueBox.style.display = 'block';
    dialogueBox.textContent = text;
    setTimeout(()=>{ if(story.messages[0]===text){ dialogueBox.style.display = 'none'; story.messages.shift(); } }, 6000);
  }

  // Journal helpers
  function addJournalEntry(text){
    story.journal.push({ t: Date.now(), text });
    if(journalModal.classList.contains('visible')) renderJournal();
  }
  function setObjective(text){ objectiveEl.textContent = text || ''; }

  function initStartMenu(){
    const saved = loadGame();
    continueBtn.hidden = !saved;
    continueBtn.onclick = ()=>{ if(saved){ loadIntoState(saved); hideStartMenu(); pushMessage('Continuing your tale...'); }};
    newStoryBtn.onclick = ()=>{
      pathwaysSection.classList.remove('hidden'); pathwaysGrid.replaceChildren();
      PATHWAYS.forEach(p=>{
        const card = document.createElement('div'); card.className='card';
        const title = document.createElement('h3'); title.textContent = p.name; title.style.color = p.theme; card.appendChild(title);
        const badge = document.createElement('div'); badge.className='badge'; badge.innerHTML = `<span class="dot" style="background:${p.theme}"></span><span>${p.place} • ${p.arch}</span>`; card.appendChild(badge);
        const desc = document.createElement('p'); desc.textContent = p.desc; card.appendChild(desc);
        const btn = document.createElement('button'); btn.className='primary startBtn'; btn.textContent = 'Begin Path';
        btn.onclick = ()=>{ beginNewStory(p); };
        card.appendChild(btn);
        pathwaysGrid.appendChild(card);
      });
    };
  }
  function hideStartMenu(){ startMenu.classList.remove('visible'); startMenu.style.display='none'; }

  function beginNewStory(p){
    // seed derived from pathway and time for uniqueness
    const seed = hashInt(Date.now() ^ hashInt([...p.id].reduce((a,c)=>a+ c.charCodeAt(0),0)));
    world.seed = seed;
    story.pathway = p;
    story.questStage = 0;
    story.journal = [];
    story.visitedPoiIds = new Set();

    // spawn near height 0 crossing
    const spawnX = 0; const spawnY = terrainHeightAtX(spawnX) - 3;
    player.x = player.spawn.x = spawnX; player.y = player.spawn.y = spawnY;

    saveGame();
    hideStartMenu();

    pushMessage(`Pathway: ${p.name}. Place: ${p.place}.\nThe myst stirs as your tale begins.`);
    addJournalEntry('You arrived in the ' + p.place + '. The myst is watchful.');
    setObjective('Seek a Shrine and press Enter to attune.');
  }

  // Terrain
  function terrainHeightAtX(x){
    const n = valueNoise1D(x*0.07, world.seed) * 12
            + valueNoise1D(x*0.21, world.seed+17) * 4
            + valueNoise1D(x*0.013, world.seed+101) * 24 - 12;
    return Math.round(n);
  }
  function biomeAtX(x){
    // simple biome switch with seed; could use story.pathway.place to bias
    const v = valueNoise1D(x*0.005, world.seed+999);
    if(!story.pathway) return 'temperate';
    const place = story.pathway.place;
    if(place.includes('Marsh')||place.includes('Tarn')||place.includes('Bay')||place.includes('Reefs')) return 'wet';
    if(place.includes('Spires')||place.includes('Ridge')||place.includes('Highlands')) return 'alpine';
    if(place.includes('Sands')) return 'desert';
    if(place.includes('Gloam')||place.includes('Thicket')||place.includes('Wood')||place.includes('Root')) return 'forest';
    return v<0.3?'forest':v<0.6?'temperate':'alpine';
  }

  function getChunk(cx, cy){
    const key = chunkKey(cx, cy);
    let ch = world.chunks.get(key);
    if(!ch){
      ch = { tiles: new Uint16Array(CHUNK_SIZE*CHUNK_SIZE) };
      world.chunks.set(key, ch); // insert before generation to avoid recursion issues
      generateChunk(cx, cy, ch);
    }
    return ch;
  }
  function setTile(x, y, id){
    const key = `${x},${y}`;
    if(id===TileId.Air) world.edits.delete(key); else world.edits.set(key, id);
    const cx = Math.floor(x/CHUNK_SIZE), cy = Math.floor(y/CHUNK_SIZE);
    const ch = getChunk(cx, cy);
    const lx = positiveMod(x, CHUNK_SIZE), ly = positiveMod(y, CHUNK_SIZE);
    ch.tiles[ly*CHUNK_SIZE + lx] = id;
  }
  function getTile(x, y){
    // edits override
    const editKey = `${x},${y}`; if(world.edits.has(editKey)) return world.edits.get(editKey);
    const cx = Math.floor(x/CHUNK_SIZE), cy = Math.floor(y/CHUNK_SIZE);
    const ch = getChunk(cx, cy);
    const lx = positiveMod(x, CHUNK_SIZE), ly = positiveMod(y, CHUNK_SIZE);
    return ch.tiles[ly*CHUNK_SIZE + lx] || TileId.Air;
  }
  function generateChunk(cx, cy, ch){
    for(let ly=0; ly<CHUNK_SIZE; ly++){
      for(let lx=0; lx<CHUNK_SIZE; lx++){
        const x = cx*CHUNK_SIZE + lx;
        const y = cy*CHUNK_SIZE + ly;
        const h = terrainHeightAtX(x);
        const biome = biomeAtX(x);
        let id = TileId.Air;
        if(y > h){
          const depth = y - h;
          if(depth === 1){
            if(biome==='desert') id = TileId.Sand; else id = TileId.Grass;
          }else if(depth <= 4){ id = biome==='desert'?TileId.Sand:TileId.Dirt; }
          else id = TileId.Stone;
        } else if(y === h && biome==='wet' && valueNoise1D(x*0.2 + y*0.2, world.seed+7) > 0.66){
          id = TileId.Water;
        }
        ch.tiles[ly*CHUNK_SIZE + lx] = id;
      }
    }
    // simple trees on surface tiles
    for(let lx=0; lx<CHUNK_SIZE; lx++){
      const x = cx*CHUNK_SIZE + lx; const h = terrainHeightAtX(x)+1;
      if(getTile(x, h)===TileId.Grass && valueNoise1D(x*0.13, world.seed+55) > 0.82){
        const height = 3 + Math.floor(valueNoise1D(x*0.5, world.seed+77)*3);
        for(let t=0;t<height;t++) setTile(x, h+t, TileId.Log);
        for(let dy=-2; dy<=2; dy++){
          for(let dx=-2; dx<=2; dx++){
            if(Math.abs(dx)+Math.abs(dy) <= 3){ setTile(x+dx, h+height+dy, TileId.Leaves); }
          }
        }
      }
    }
  }

  // Points of Interest (POIs)
  function poiId(x,y,type){ return `${type}:${x},${y}`; }
  function getPOIsForChunk(cx, cy){
    const key = chunkKey(cx, cy);
    if(world.pois.has(key)) return world.pois.get(key);
    const list = [];
    // 30% chance to spawn a shrine or marker per chunk
    const r = valueNoise1D((cx+1000)*0.71 + (cy-300)*0.33, world.seed+4242);
    if(r > 0.7){
      const lx = Math.floor(valueNoise1D(cx*3.13 + world.seed*0.001, world.seed+77) * CHUNK_SIZE);
      const x = cx*CHUNK_SIZE + lx;
      const ySurface = terrainHeightAtX(x);
      const type = r > 0.88 ? 'shrine' : 'marker';
      const y = ySurface - 1; // just above ground
      list.push({ id: poiId(x,y,type), x, y, type });
    }
    world.pois.set(key, list);
    return list;
  }

  // Physics
  function rectVsWorld(x, y, w, h){
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.ceil(x+w), y1 = Math.ceil(y+h);
    for(let ty=y0; ty<y1; ty++){
      for(let tx=x0; tx<x1; tx++){
        const id = getTile(tx, ty);
        if(TileProps[id]?.solid){ return true; }
      }
    }
    return false;
  }

  // Input
  window.addEventListener('keydown', (e)=>{
    if(e.key==='a'||e.key==='A'||e.key==='ArrowLeft') input.left=true;
    if(e.key==='d'||e.key==='D'||e.key==='ArrowRight') input.right=true;
    if(e.key==='w'||e.key==='W'||e.key==='ArrowUp'||e.key===' ') input.jump=true;
    if(e.key==='s'||e.key==='S'||e.key==='ArrowDown') input.down=true;
    if(e.key==='p'||e.key==='P'){ paused=!paused; }
    if(e.key==='j'||e.key==='J'){ toggleJournal(); }
    if(e.key==='Enter'){ interact(); }
  });
  window.addEventListener('keyup', (e)=>{
    if(e.key==='a'||e.key==='A'||e.key==='ArrowLeft') input.left=false;
    if(e.key==='d'||e.key==='D'||e.key==='ArrowRight') input.right=false;
    if(e.key==='w'||e.key==='W'||e.key==='ArrowUp'||e.key===' ') input.jump=false;
    if(e.key==='s'||e.key==='S'||e.key==='ArrowDown') input.down=false;
  });

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Interactions
  function interact(){
    const near = findNearbyPOI();
    if(!near) return;
    if(story.visitedPoiIds.has(near.id)){
      pushMessage(near.type==='shrine' ? 'The shrine hums softly.' : 'A weathered marker.');
      return;
    }
    story.visitedPoiIds.add(near.id);
    if(near.type==='shrine'){
      if(story.questStage===0){
        pushMessage('You attune to the Shrine. The myst knows your name.');
        addJournalEntry('Attuned at a Shrine. A thread tugged me toward the horizon.');
        story.questStage = 1;
        setObjective('Follow the myst: seek higher ground for a sign.');
      } else {
        pushMessage('The Shrine offers a quiet blessing.');
      }
    } else if(near.type==='marker'){
      pushMessage('Carved runes speak of storms and vows.');
      addJournalEntry('Found a weathered marker. Its runes mention storms and vows.');
    }
    saveGameThrottled();
  }
  function findNearbyPOI(){
    // look in current and neighboring chunks
    const cx = tileChunkCoord(Math.floor(player.x));
    const cy = tileChunkCoord(Math.floor(player.y));
    let nearest = null; let nd = 9999;
    for(let dy=-1; dy<=1; dy++){
      for(let dx=-1; dx<=1; dx++){
        const list = getPOIsForChunk(cx+dx, cy+dy);
        for(const poi of list){
          const px = player.x + player.width/2; const py = player.y + player.height/2;
          const d = Math.hypot(poi.x+0.5 - px, poi.y+0.5 - py);
          if(d < nd){ nd = d; nearest = poi; }
        }
      }
    }
    return nd <= 2.0 ? nearest : null;
  }

  // Journal UI
  function toggleJournal(){
    if(journalModal.classList.contains('visible')){ journalModal.classList.remove('visible'); journalModal.style.display='none'; }
    else { journalModal.classList.add('visible'); journalModal.style.display='flex'; renderJournal(); }
  }
  closeJournalBtn.onclick = ()=> toggleJournal();
  function renderJournal(){
    journalEntriesEl.replaceChildren();
    story.journal.forEach(entry => {
      const div = document.createElement('div'); div.className='entry';
      const d = new Date(entry.t); const hh = d.getHours().toString().padStart(2,'0'); const mm = d.getMinutes().toString().padStart(2,'0');
      div.textContent = `[${hh}:${mm}] ` + entry.text;
      journalEntriesEl.appendChild(div);
    });
  }

  // Save/Load
  function saveGame(){
    const data = {
      v: GAME_VERSION,
      seed: world.seed,
      pathway: story.pathway?.id || null,
      player: { x: player.x, y: player.y },
      story: { questStage: story.questStage, journal: story.journal, visited: Array.from(story.visitedPoiIds) },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }
  let saveTimer = null; function saveGameThrottled(){ clearTimeout(saveTimer); saveTimer=setTimeout(saveGame, 400); }
  function loadGame(){ try{ const s=localStorage.getItem(SAVE_KEY); return s?JSON.parse(s):null; }catch{ return null; } }
  function loadIntoState(data){
    world.seed = data.seed || world.seed;
    story.pathway = PATHWAYS.find(p=>p.id===data.pathway) || PATHWAYS[0];
    player.x = data.player?.x ?? 0; player.y = data.player?.y ?? 0; player.vx=0; player.vy=0;
    const s = data.story || {};
    story.questStage = s.questStage || 0;
    story.journal = Array.isArray(s.journal) ? s.journal : [];
    story.visitedPoiIds = new Set(Array.isArray(s.visited)? s.visited : []);
    setObjective(story.questStage===0 ? 'Seek a Shrine and press Enter to attune.' : 'Follow the myst: seek higher ground for a sign.');
  }

  // No crafting

  // Game loop
  function step(dt){
    if(paused) return;

    // Time of day
    const worldTime = (performance.now()/1000) % 120; // 2-minute cycle
    const p = worldTime/120; const sun = Math.sin(p*2*Math.PI);
    timeOfDayEl.textContent = sun>0.5? 'Day': sun>-0.5? 'Dusk/Dawn' : 'Night';

    // Input movement
    const ax = (input.right?1:0) - (input.left?1:0);
    player.vx += ax * 0.05; player.vx *= 0.86; // friction

    player.vy += GRAVITY; if(player.vy>MAX_FALL_SPEED) player.vy=MAX_FALL_SPEED;

    // Horizontal move + collide
    const nx = player.x + player.vx*dt*0.06;
    if(!rectVsWorld(nx, player.y, player.width, player.height)) player.x = nx; else player.vx = 0;

    // Jump
    if(input.jump && player.onGround){ player.vy = -7.2; player.onGround=false; }

    // Vertical move + collide
    const ny = player.y + player.vy*dt*0.06;
    if(!rectVsWorld(player.x, ny, player.width, player.height)){
      player.y = ny; player.onGround = false;
    } else {
      // resolve simple collision
      if(player.vy>0){ player.y = Math.floor(player.y + player.height) - player.height; player.onGround = true; }
      else { player.y = Math.ceil(player.y); }
      player.vy = 0;
    }

    // No mining

    // Camera
    camera.x = player.x - (canvas.width/(TILE_SIZE*camera.scale))/2 + player.width/2;
    camera.y = player.y - (canvas.height/(TILE_SIZE*camera.scale))/2 + player.height/2;
  }

  // Story advancement is handled via POI interactions

  function draw(){
    // sky background gradient based on time of day
    const worldTime = (performance.now()/1000) % 120; const p = worldTime/120; const sun = Math.sin(p*2*Math.PI);
    const top = sun>0? '#6ea4ff' : '#111827'; const bottom = sun>0? '#506b9e' : '#0b0d11';
    const g = ctx.createLinearGradient(0,0,0,canvas.height); g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.save();
    ctx.translate(Math.floor(-camera.x*TILE_SIZE*camera.scale), Math.floor(-camera.y*TILE_SIZE*camera.scale));
    ctx.scale(TILE_SIZE*camera.scale, TILE_SIZE*camera.scale);

    // visible bounds
    const x0 = Math.floor(camera.x) - 2; const y0 = Math.floor(camera.y) - 2;
    const x1 = Math.ceil(camera.x + canvas.width/(TILE_SIZE*camera.scale)) + 2;
    const y1 = Math.ceil(camera.y + canvas.height/(TILE_SIZE*camera.scale)) + 2;

    // draw tiles
    for(let ty=y0; ty<y1; ty++){
      for(let tx=x0; tx<x1; tx++){
        const id = getTile(tx,ty);
        if(id!==TileId.Air){
          ctx.fillStyle = TileProps[id].color || '#fff';
          ctx.fillRect(tx,ty,1,1);
        }
      }
    }

    // draw POIs
    const cx0 = tileChunkCoord(x0), cy0 = tileChunkCoord(y0);
    const cx1 = tileChunkCoord(x1), cy1 = tileChunkCoord(y1);
    for(let cy=cy0; cy<=cy1; cy++){
      for(let cx=cx0; cx<=cx1; cx++){
        const list = getPOIsForChunk(cx, cy);
        for(const poi of list){
          if(poi.x>=x0-2 && poi.x<=x1+2 && poi.y>=y0-6 && poi.y<=y1+6){
            if(poi.type==='shrine'){
              ctx.fillStyle = '#cfe4ff';
              ctx.fillRect(poi.x-0.2, poi.y-1.5, 1.4, 2.2);
              ctx.fillStyle = '#7acaff';
              ctx.fillRect(poi.x+0.1, poi.y-1.3, 0.8, 1.8);
            } else {
              ctx.fillStyle = '#b9c6d4';
              ctx.fillRect(poi.x+0.1, poi.y-1, 0.6, 1.4);
            }
          }
        }
      }
    }

    // player
    ctx.fillStyle = '#ffd28a';
    ctx.fillRect(player.x, player.y, player.width, player.height);

    ctx.restore();
  }

  function frame(t){
    const dt = Math.min(33, t - lastFrameTime); lastFrameTime = t;
    fpsAccumulator += dt; fpsCount++; if(fpsAccumulator >= 500){ fps = Math.round(1000 / (fpsAccumulator / fpsCount)); fpsAccumulator=0; fpsCount=0; fpsEl.textContent = `${fps} fps`; }

    if(!paused) step(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function ensureCanvasSize(){
    const dpr = Math.min(2, window.devicePixelRatio||1);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if(canvas.width!==w || canvas.height!==h){ canvas.width=w; canvas.height=h; }
  }

  window.addEventListener('resize', ensureCanvasSize);
  ensureCanvasSize();

  function bootstrap(){
    initStartMenu();
    const saved = loadGame(); if(saved){ startMenu.classList.add('visible'); startMenu.style.display='flex'; } else { startMenu.classList.add('visible'); startMenu.style.display='flex'; }
    requestAnimationFrame(frame);
  }

  bootstrap();
})();
