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
  const BREAK_RATE_BASE = 0.012;         // per ms
  const SAVE_KEY = 'mysty_save_v1';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const hudEl = document.getElementById('hud');
  const hotbarEl = document.getElementById('hotbar');
  const dialogueBox = document.getElementById('dialogueBox');
  const startMenu = document.getElementById('startMenu');
  const continueBtn = document.getElementById('continueBtn');
  const newStoryBtn = document.getElementById('newStoryBtn');
  const pathwaysSection = document.getElementById('pathwaysSection');
  const pathwaysGrid = document.getElementById('pathwaysGrid');
  const invModal = document.getElementById('inventoryModal');
  const invGrid = document.getElementById('inventoryGrid');
  const closeInvBtn = document.getElementById('closeInventoryBtn');
  const timeOfDayEl = document.getElementById('timeOfDay');
  const fpsEl = document.getElementById('fps');

  // State
  const input = { left:false, right:false, up:false, down:false, jump:false, mine:false, place:false };
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

  const ItemId = {
    Dirt: 'Dirt', Stone: 'Stone', Log: 'Log', Plank: 'Plank', Workbench: 'Workbench'
  };
  const BlockItemMap = {
    [TileId.Dirt]: ItemId.Dirt,
    [TileId.Stone]: ItemId.Stone,
    [TileId.Log]: ItemId.Log,
    [TileId.Plank]: ItemId.Plank,
    [TileId.Workbench]: ItemId.Workbench,
  };

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
    edits: new Map(),  // key:"x,y" -> tileId
  };

  const player = {
    x: 0, y: 0, vx: 0, vy: 0, width: 0.7, height: 1.6,
    spawn: { x: 0, y: 0 },
    onGround: false,
    inventory: new Map(), // item -> count
    hotbar: [ItemId.Log, ItemId.Stone, ItemId.Dirt, ItemId.Plank, ItemId.Workbench, null, null, null, null],
    hotbarIndex: 0,
  };

  const story = {
    pathway: null,
    messages: [],
    nextAt: 0,
  };

  function pushMessage(text){
    story.messages.push(text);
    dialogueBox.style.display = 'block';
    dialogueBox.textContent = text;
    setTimeout(()=>{ if(story.messages[0]===text){ dialogueBox.style.display = 'none'; story.messages.shift(); } }, 6000);
  }

  function addInventory(item, n=1){ player.inventory.set(item, (player.inventory.get(item)||0) + n); rerenderHotbar(); }
  function takeInventory(item, n=1){ const c=(player.inventory.get(item)||0); if(c<n) return false; if(c===n) player.inventory.delete(item); else player.inventory.set(item,c-n); rerenderHotbar(); return true; }

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
    player.inventory = new Map();
    Object.entries(p.kit||{}).forEach(([item,count])=> addInventory(item, count));

    // spawn near height 0 crossing
    const spawnX = 0; const spawnY = terrainHeightAtX(spawnX) - 3;
    player.x = player.spawn.x = spawnX; player.y = player.spawn.y = spawnY;

    saveGame();
    hideStartMenu();

    pushMessage(`Pathway: ${p.name}. Place: ${p.place}.\nThe myst stirs as your tale begins.`);
    setTimeout(()=>{ pushMessage('Goal: Gather wood and craft a Workbench.'); }, 3500);
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
    if(!ch){ ch = { tiles: new Uint16Array(CHUNK_SIZE*CHUNK_SIZE) }; generateChunk(cx, cy, ch); world.chunks.set(key, ch); }
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
        // leaves
        for(let dy=-2; dy<=2; dy++){
          for(let dx=-2; dx<=2; dx++){
            if(Math.abs(dx)+Math.abs(dy) <= 3){ setTile(x+dx, h+height+dy, TileId.Leaves); }
          }
        }
      }
    }
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
    if(e.key==='e'||e.key==='E'){ toggleInventory(); }
    if(e.key==='p'||e.key==='P'){ paused=!paused; }
    if(e.key>='1'&&e.key<='9') { player.hotbarIndex = parseInt(e.key)-1; rerenderHotbar(); }
  });
  window.addEventListener('keyup', (e)=>{
    if(e.key==='a'||e.key==='A'||e.key==='ArrowLeft') input.left=false;
    if(e.key==='d'||e.key==='D'||e.key==='ArrowRight') input.right=false;
    if(e.key==='w'||e.key==='W'||e.key==='ArrowUp'||e.key===' ') input.jump=false;
    if(e.key==='s'||e.key==='S'||e.key==='ArrowDown') input.down=false;
  });

  let mouseWorld = { x:0, y:0 };
  let mouseDown = false; let breaking = null;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('mousedown', (e)=>{ mouseDown = true; if(e.button===0){ startBreaking(); } else if(e.button===2){ placeAtCursor(); } });
  window.addEventListener('mouseup', ()=>{ mouseDown = false; breaking = null; });
  window.addEventListener('mousemove', (e)=>{
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width * canvas.width;
    const my = (e.clientY - rect.top) / rect.height * canvas.height;
    mouseWorld.x = (mx / (TILE_SIZE*camera.scale)) + camera.x;
    mouseWorld.y = (my / (TILE_SIZE*camera.scale)) + camera.y;
  });

  function startBreaking(){
    const tx = Math.floor(mouseWorld.x), ty = Math.floor(mouseWorld.y);
    const id = getTile(tx, ty);
    if(id===TileId.Air||!TileProps[id].breakable) return;
    breaking = { tx, ty, id, progress:0, startedAt:performance.now() };
  }
  function placeAtCursor(){
    const tx = Math.floor(mouseWorld.x), ty = Math.floor(mouseWorld.y);
    const below = getTile(tx, ty);
    if(below!==TileId.Air) return;
    const item = player.hotbar[player.hotbarIndex];
    if(!item) return;
    let tile = TileId.Air;
    if(item===ItemId.Dirt) tile = TileId.Dirt;
    if(item===ItemId.Stone) tile = TileId.Stone;
    if(item===ItemId.Log) tile = TileId.Log;
    if(item===ItemId.Plank) tile = TileId.Plank;
    if(item===ItemId.Workbench) tile = TileId.Workbench;
    if(tile!==TileId.Air && takeInventory(item, 1)){
      setTile(tx, ty, tile);
      saveGameThrottled();
    }
  }

  // Inventory UI
  function rerenderHotbar(){
    hotbarEl.replaceChildren();
    for(let i=0;i<9;i++){
      const slot = document.createElement('div');
      slot.className = 'slot' + (player.hotbarIndex===i?' selected':'');
      const item = player.hotbar[i];
      if(item){
        const count = player.inventory.get(item)||0; slot.textContent = item.slice(0,2).toUpperCase() + (count?` ${count}`:'');
      } else { slot.textContent = ''; }
      slot.onclick = ()=>{ player.hotbarIndex=i; rerenderHotbar(); };
      hotbarEl.appendChild(slot);
    }
  }
  function toggleInventory(){
    if(invModal.classList.contains('visible')){ invModal.classList.remove('visible'); invModal.style.display='none'; }
    else{ invModal.classList.add('visible'); invModal.style.display='flex'; renderInventory(); }
  }
  closeInvBtn.onclick = ()=> toggleInventory();
  function renderInventory(){
    invGrid.replaceChildren();
    const items = Array.from(player.inventory.entries());
    items.sort((a,b)=> a[0].localeCompare(b[0]));
    items.forEach(([item,count])=>{
      const s = document.createElement('div'); s.className='inv-slot'; s.textContent = `${item} x${count}`; invGrid.appendChild(s);
    });
  }

  // Save/Load
  function saveGame(){
    const data = {
      v: GAME_VERSION,
      seed: world.seed,
      pathway: story.pathway?.id || null,
      player: { x: player.x, y: player.y, inv: Array.from(player.inventory.entries()), hotbar: player.hotbar, hotbarIndex: player.hotbarIndex },
      edits: Array.from(world.edits.entries()),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }
  let saveTimer = null; function saveGameThrottled(){ clearTimeout(saveTimer); saveTimer=setTimeout(saveGame, 400); }
  function loadGame(){ try{ const s=localStorage.getItem(SAVE_KEY); return s?JSON.parse(s):null; }catch{ return null; } }
  function loadIntoState(data){
    world.seed = data.seed || world.seed;
    story.pathway = PATHWAYS.find(p=>p.id===data.pathway) || PATHWAYS[0];
    player.x = data.player?.x ?? 0; player.y = data.player?.y ?? 0; player.vx=0; player.vy=0;
    player.inventory = new Map(data.player?.inv || []);
    player.hotbar = data.player?.hotbar || player.hotbar; player.hotbarIndex = data.player?.hotbarIndex || 0;
    world.edits.clear(); (data.edits||[]).forEach(([k,v])=>world.edits.set(k,v));
    rerenderHotbar();
  }

  // Crafting (very minimal)
  function craftWorkbench(){ if(takeInventory(ItemId.Log, 4)){ addInventory(ItemId.Workbench,1); pushMessage('Crafted: Workbench'); return true; } return false; }
  window.addEventListener('keydown',(e)=>{ if(e.key==='c'||e.key==='C'){ if(craftWorkbench()) saveGameThrottled(); }});

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

    // Mining
    if(mouseDown && breaking){
      const {tx,ty,id} = breaking; if(getTile(tx,ty)!==id){ breaking=null; }
      else { breaking.progress += dt * BREAK_RATE_BASE / Math.max(0.2, TileProps[id].hardness);
        if(breaking.progress >= 1){
          setTile(tx,ty,TileId.Air); const drop = BlockItemMap[id]; if(drop) addInventory(drop,1);
          breaking=null; saveGameThrottled();
          if(drop===ItemId.Log){ maybeAdvanceStory('wood'); }
        }
      }
    }

    // Camera
    camera.x = player.x - (canvas.width/(TILE_SIZE*camera.scale))/2 + player.width/2;
    camera.y = player.y - (canvas.height/(TILE_SIZE*camera.scale))/2 + player.height/2;
  }

  function maybeAdvanceStory(event){
    if(!story.pathway) return;
    if(event==='wood'){ pushMessage('The myst answers: craft a Workbench (press C).'); }
  }

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

    // selection highlight
    const selx = Math.floor(mouseWorld.x), sely = Math.floor(mouseWorld.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1/ (TILE_SIZE*camera.scale);
    ctx.strokeRect(selx, sely, 1, 1);

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
    rerenderHotbar();
    initStartMenu();
    const saved = loadGame(); if(saved){ startMenu.classList.add('visible'); startMenu.style.display='flex'; } else { startMenu.classList.add('visible'); startMenu.style.display='flex'; }
    requestAnimationFrame(frame);
  }

  bootstrap();
})();
