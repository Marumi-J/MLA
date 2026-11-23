const seedSongs = [
  { id: 'one-look', title: '一個眼神', album: '單曲', year: '2024', lyrics: '' },
  { id: 'camel', title: '駱駝', album: '單曲', year: '2023', lyrics: '' },
  { id: 'lunch', title: 'LUNCH', album: '單曲', year: '2022', lyrics: '' },
  { id: 'joking', title: '跟你開玩笑', album: '跟你開玩笑', year: '2022', lyrics: '' },
  { id: 'sabina', title: 'SABINA 之淚', album: 'SABINA 之淚', year: '2021', lyrics: '' },
  { id: 'walk-year', title: '散步之年', album: '單曲', year: '2021', lyrics: '' },
  { id: 'after', title: '你說之後會找我', album: '你說之後會找我', year: '2018', lyrics: '' },
  { id: 'fo-tan', title: '火炭麗琪', album: '火炭麗琪', year: '2016', lyrics: '' },
  { id: 'marriage-age', title: '適婚的年齡', album: '適婚的年齡', year: '2014', lyrics: '' },
  { id: 'lonely-friday', title: '寂寞的星期五', album: '寂寞的星期五', year: '2012', lyrics: '' },
  { id: 'mall', title: '香港是個大商場', album: '香港是個大商場', year: '2011', lyrics: '' },
  { id: 'france-mongkok', title: '介乎法國與旺角的詩意', album: '介乎法國與旺角的詩意', year: '2009', lyrics: '' },
  { id: 'summer', title: '我們在炎熱與抑鬱的夏天，無法停止抽煙', album: '同名專輯', year: '2007', lyrics: '' },
  { id: 'nervous', title: '只因當時太緊張', album: '只因當時太緊張', year: '2005', lyrics: '' },
  { id: 'zoo', title: '在動物園散步才是正經事', album: '在動物園散步才是正經事', year: '2004', lyrics: '' }
];

const toHongKongTraditional = globalThis.OpenCC?.Converter({ from: 'cn', to: 'hk' }) || (text => text);
let songs = loadSongs();
let route = { name: 'home', id: null };
let query = '';
let saved = JSON.parse(localStorage.getItem('mll-saved') || '[]');
let fetching = new Set();
let randomQuote = null;

const app = document.querySelector('#app');
const dialog = document.querySelector('#managerDialog');
const form = document.querySelector('#songForm');
const toast = document.querySelector('#toast');

function traditionalSong(song) {
  return {
    ...song,
    title: toHongKongTraditional(song.title || ''),
    album: toHongKongTraditional(song.album || ''),
    lyrics: toHongKongTraditional(song.lyrics || '')
  };
}

function loadSongs() {
  const stored = JSON.parse(localStorage.getItem('mll-songs') || 'null');
  if (!stored) {
    const initial = seedSongs.map(traditionalSong);
    localStorage.setItem('mll-songs', JSON.stringify(initial));
    return initial;
  }
  const byId = new Map(stored.map(song => [song.id, song]));
  seedSongs.forEach(song => { if (!byId.has(song.id)) byId.set(song.id, song); });
  const converted = [...byId.values()].map(traditionalSong);
  localStorage.setItem('mll-songs', JSON.stringify(converted));
  return converted;
}

function persist() { localStorage.setItem('mll-songs', JSON.stringify(songs)); }
function normalize(text = '') {
  const map = { '个':'個','驼':'駝','泪':'淚','说':'說','后':'後','会':'會','丽':'麗','龄':'齡','寂':'寂','场':'場','国':'國','诗':'詩','张':'張','动':'動','园':'園','紧':'緊','烟':'煙','热':'熱','郁':'鬱','开':'開','话':'話','间':'間','这':'這','没':'沒','关':'關','系':'係','长':'長','线':'線','过':'過','相':'相','处':'處','来':'來','们':'們','书':'書','气':'氣','见':'見','发':'發','为':'為','么':'麼','里':'裡' };
  return text.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '').split('').map(c => map[c] || c).join('');
}
function pickRandomLyric(pool = songs) {
  const candidates = [];
  for (const song of pool) {
    if (!song.lyrics?.trim()) continue;
    for (const rawLine of song.lyrics.split('\n')) {
      const line = rawLine.trim();
      if (line.length >= 4 && line.length <= 42 && !/^\[/.test(line) && !/^(作詞|作曲|編曲|監製)[:：]/.test(line)) {
        candidates.push({ text: line, songId: song.id });
      }
    }
  }
  return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
}
function esc(value = '') { return value.replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch])); }
function slug() { return `song-${Date.now().toString(36)}`; }
function showToast(message) { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 1700); }
function setSyncStatus(message = '') { document.querySelector('#syncStatus').textContent = message; }

async function syncCatalog() {
  try {
    const response = await fetch('tracks.json?v=1');
    if (!response.ok) return;
    const catalog = await response.json();
    const known = new Set(songs.map(song => normalize(song.title)));
    for (const item of catalog) {
      if (!known.has(normalize(item.title))) {
        songs.push(item);
        known.add(normalize(item.title));
      }
    }
    persist();
    if (route.name === 'library' || route.name === 'home') render();
  } catch (_) {}
}

function getAttempted() { return new Set(JSON.parse(localStorage.getItem('mll-lrclib-attempted-v1') || '[]')); }
function saveAttempted(set) { localStorage.setItem('mll-lrclib-attempted-v1', JSON.stringify([...set])); }

async function fetchLyrics(song, attempted = getAttempted()) {
  if (!song || song.lyrics?.trim() || fetching.has(song.id)) return false;
  fetching.add(song.id);
  try {
    const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(song.title)}`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error('lyrics request failed');
    const matches = await response.json();
    const exact = matches.find(item => normalize(item.trackName) === normalize(song.title) && normalize(item.artistName).includes('mylittleairport'));
    const fallback = matches.find(item => normalize(item.artistName).includes('mylittleairport'));
    const match = exact || fallback;
    if (match?.plainLyrics?.trim()) {
      song.lyrics = toHongKongTraditional(match.plainLyrics.trim());
      song.lyricsSource = 'LRCLIB';
      persist();
      if (!randomQuote) {
        randomQuote = pickRandomLyric([song]);
        if (randomQuote && route.name === 'home' && !query) setTimeout(render, 0);
      }
      return true;
    }
    return false;
  } catch (_) {
    return false;
  } finally {
    attempted.add(song.id);
    saveAttempted(attempted);
    fetching.delete(song.id);
  }
}

async function prepareOfflineLyrics() {
  const attempted = getAttempted();
  const queue = songs.filter(song => !song.lyrics?.trim() && !attempted.has(song.id));
  if (!queue.length) return;
  let completed = 0;
  const total = queue.length;
  setSyncStatus(`准备曲库 0/${total}`);
  const worker = async () => {
    while (queue.length) {
      const song = queue.shift();
      await fetchLyrics(song, attempted);
      completed += 1;
      setSyncStatus(`准备曲库 ${completed}/${total}`);
      await new Promise(resolve => setTimeout(resolve, 180));
    }
  };
  await Promise.all([worker(), worker()]);
  setSyncStatus('');
  if (route.name === 'home' || route.name === 'library') render();
}

function go(name, id = null) {
  route = { name, id };
  window.scrollTo({ top: 0, behavior: 'smooth' });
  render();
}

function filteredSongs() {
  const q = normalize(query);
  if (!q) return songs;
  return songs.filter(song => normalize(`${song.title}${song.album}${song.year}${song.lyrics}`).includes(q));
}

function songCard(song) {
  const hasLyrics = Boolean(song.lyrics.trim());
  const rawSnippet = hasLyrics ? song.lyrics.split(/\n+/).find(line => normalize(line).includes(normalize(query))) || song.lyrics.split(/\n+/)[0] : '';
  return `<button class="song-card" data-song="${esc(song.id)}">
    <h3 lang="zh-Hant">${esc(song.title)}</h3>
    <span class="meta">${esc(song.album)} · ${esc(song.year)}</span>
    ${rawSnippet ? `<span class="snippet" lang="zh-Hant">${esc(rawSnippet.slice(0, 68))}</span>` : ''}
  </button>`;
}

function renderHome() {
  const results = filteredSongs();
  if (!randomQuote) randomQuote = pickRandomLyric();
  return `<section class="hero">
      <h1><button class="hero-title" id="refreshQuote" aria-label="换一句随机歌词">some words<br>we kept.</button></h1>
      <div class="search-wrap"><input id="searchInput" value="${esc(query)}" autocomplete="off" placeholder="歌名 / 一句歌词" aria-label="搜索歌词"><span class="search-icon">⌕</span></div>
    </section>
    ${query ? `<section><div class="section-head"><h2>搜索结果</h2></div><div class="result-list">${results.map(songCard).join('') || '<div class="empty">没有找到。</div>'}</div></section>` : (randomQuote ? `
    <section class="random-quote-wrap"><button class="random-quote" data-song="${esc(randomQuote.songId)}" lang="zh-Hant">${esc(randomQuote.text)}</button></section>` : '')}`;
}

function renderLibrary(list = songs, title = '全部曲目') {
  const sorted = [...list].sort((a,b) => (b.year || '').localeCompare(a.year || '') || a.title.localeCompare(b.title, 'zh-Hant'));
  return `<section><div class="section-head"><h2>${title}</h2></div><div class="library-list">${sorted.map(songCard).join('') || '<div class="empty">这里还是空的。</div>'}</div></section>`;
}

function renderLyrics() {
  const song = songs.find(s => s.id === route.id);
  if (!song) return renderLibrary();
  const isSaved = saved.includes(song.id);
  return `<section class="lyrics-top">
      <button class="back-button" data-route="library">返回曲库</button>
      <p class="eyebrow">${esc(song.album)} · ${esc(song.year)}</p>
      <h1 lang="zh-Hant">${esc(song.title)}</h1>
      <p class="lyrics-meta">my little airport</p>
    </section>
    <div class="toolbar">
      <button class="chip" id="saveSong">${isSaved ? '已收藏' : '收藏'}</button>
      <button class="chip" id="editSong">编辑</button>
    </div>
    ${song.lyrics.trim() ? `<article class="lyrics-typewriter" lang="zh-Hant">${esc(song.lyrics)}</article>` : `<div class="missing-lyrics"><p>这首歌还没有歌词。</p><button class="primary-button" id="addThisSong">添加歌词</button></div>`}`;
}

function render() {
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.route === route.name || (route.name === 'lyrics' && btn.dataset.route === 'library')));
  app.innerHTML = route.name === 'home' ? renderHome() : route.name === 'library' ? renderLibrary() : route.name === 'saved' ? renderLibrary(songs.filter(s => saved.includes(s.id)), '我的收藏') : renderLyrics();
  bindView();
  if (route.name === 'lyrics') {
    const song = songs.find(item => item.id === route.id);
    if (song && !song.lyrics?.trim() && !fetching.has(song.id)) {
      fetchLyrics(song).then(found => { if (found && route.id === song.id) render(); });
    }
  }
}

function bindView() {
  document.querySelector('#refreshQuote')?.addEventListener('click', () => {
    const previous = randomQuote;
    let next = pickRandomLyric();
    for (let i = 0; i < 5 && next && previous && next.text === previous.text && next.songId === previous.songId; i += 1) next = pickRandomLyric();
    if (!next) return;
    randomQuote = next;
    const quote = document.querySelector('.random-quote');
    if (quote) {
      quote.textContent = next.text;
      quote.dataset.song = next.songId;
    }
  });
  const search = document.querySelector('#searchInput');
  if (search) {
    let composing = false;
    let justCommitted = false;
    const updateSearch = value => {
      query = value;
      render();
      requestAnimationFrame(() => {
        const next = document.querySelector('#searchInput');
        next?.focus();
        next?.setSelectionRange(query.length, query.length);
      });
    };
    search.addEventListener('compositionstart', () => { composing = true; });
    search.addEventListener('compositionend', e => {
      composing = false;
      justCommitted = true;
      updateSearch(e.currentTarget.value);
      setTimeout(() => { justCommitted = false; }, 0);
    });
    search.addEventListener('input', e => {
      if (composing || e.isComposing || justCommitted) return;
      updateSearch(e.currentTarget.value);
    });
  }
  document.querySelectorAll('[data-song]').forEach(btn => btn.addEventListener('click', () => go('lyrics', btn.dataset.song)));
  document.querySelector('#saveSong')?.addEventListener('click', () => {
    saved = saved.includes(route.id) ? saved.filter(id => id !== route.id) : [...saved, route.id];
    localStorage.setItem('mll-saved', JSON.stringify(saved)); render(); showToast(saved.includes(route.id) ? '已收藏' : '已取消收藏');
  });
  document.querySelector('#editSong')?.addEventListener('click', () => openManager(route.id));
  document.querySelector('#addThisSong')?.addEventListener('click', () => openManager(route.id));
}

function openManager(id = null) {
  const song = songs.find(s => s.id === id);
  document.querySelector('#dialogTitle').textContent = song ? '编辑歌词' : '添加歌词';
  document.querySelector('#songId').value = song?.id || '';
  document.querySelector('#songTitle').value = song?.title || '';
  document.querySelector('#songAlbum').value = song?.album || '';
  document.querySelector('#songYear').value = song?.year || '';
  document.querySelector('#songLyrics').value = song?.lyrics || '';
  document.querySelector('#deleteSong').classList.toggle('hidden', !song || seedSongs.some(seed => seed.id === song.id));
  dialog.showModal();
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const titleInput = document.querySelector('#songTitle');
  if (!titleInput.value.trim()) { titleInput.focus(); return; }
  const id = document.querySelector('#songId').value || slug();
  const next = {
    id,
    title: toHongKongTraditional(titleInput.value.trim()),
    album: toHongKongTraditional(document.querySelector('#songAlbum').value.trim() || '未分类'),
    year: document.querySelector('#songYear').value.trim(),
    lyrics: toHongKongTraditional(document.querySelector('#songLyrics').value.trim())
  };
  const index = songs.findIndex(song => song.id === id);
  if (index >= 0) songs[index] = next; else songs.unshift(next);
  persist(); dialog.close(); go('lyrics', id); showToast('已保存在此浏览器');
});
document.querySelector('#deleteSong').addEventListener('click', () => {
  const id = document.querySelector('#songId').value;
  songs = songs.filter(song => song.id !== id); persist(); dialog.close(); go('library'); showToast('已删除');
});
document.querySelector('#cancelManager').addEventListener('click', () => dialog.close());
document.querySelector('#closeManager').addEventListener('click', () => dialog.close());
document.querySelector('#openManager').addEventListener('click', () => openManager());
document.addEventListener('click', e => { const target = e.target.closest('[data-route]'); if (target) go(target.dataset.route); });

async function init() {
  render();
  await syncCatalog();
  prepareOfflineLyrics();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=15');
}

init();

