// ## このコードは写真を元画質で保存し，セットごとの閲覧・並べ替えを行う．
const $ = id => document.getElementById(id);
const DB_NAME = 'photo-sets-v1';
let db, sets = [], photos = [], activeSetId = null, currentPhotoId = null;
let secretSession = false, secretProfile = null, privacyEpoch = 0;
const GATE_KEY = 'photo-sets-command-key';
function setProfile(set) { return set.secretGroup || 'primary'; }
function visibleSets() { return sets.filter(set => !set.hidden || (secretSession && setProfile(set) === secretProfile)); }
function visiblePhotos() { const ids = new Set(visibleSets().map(set => set.id)); return photos.filter(photo => ids.has(photo.setId)); }
function nextSetOrder() { return Math.max(-1, ...sets.map((set, index) => Number.isFinite(set.order) ? set.order : index)) + 1; }
function accessibleSet(id) { return visibleSets().find(set => set.id === id); }
// 設定も移行JSONと同じIndexedDBへ保存する．旧版の端末設定を引き継ぐ．
let preferenceCache = {}, prefsPending = Promise.resolve();
const PREF_KEYS = ['photo-order','active-photo-set',GATE_KEY,`${GATE_KEY}-secondary`];
const appStorage = {
 getItem(key) { return Object.hasOwn(preferenceCache,key) ? preferenceCache[key] : localStorage.getItem(key); },
 setItem(key,value) { preferenceCache[key]=String(value); try { localStorage.setItem(key,String(value)); } catch {} if(db) { const tx=db.transaction('settings','readwrite'); const done=txDone(tx); tx.objectStore('settings').put({id:'preferences',value:{...preferenceCache}}); prefsPending=done; done.catch(()=>{}); } }
};
async function loadPreferences() { const row=await request(db.transaction('settings').objectStore('settings').get('preferences')); if(row) preferenceCache=row.value; else for(const key of PREF_KEYS) { const value=localStorage.getItem(key); if(value!==null) preferenceCache[key]=value; } photoOrder=appStorage.getItem('photo-order')||'newest'; $('photoOrder').value=photoOrder; }
let photoOrder = 'newest';
try { photoOrder = appStorage.getItem('photo-order') || 'newest'; } catch {}
if (!['newest', 'oldest', 'name', 'custom'].includes(photoOrder)) photoOrder = 'newest';
$('photoOrder').value = photoOrder;
function orderedPhotos() {
  if (!accessibleSet(activeSetId)) return [];
  const saved = sets.find(s => s.id === activeSetId)?.customOrder || [];
  const ranks = new Map(saved.map((id, index) => [id, index]));
  return photos.filter(p => p.setId === activeSetId).sort((a, b) => {
    if (photoOrder === 'custom') {
      const rank = (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity);
      if (rank && !Number.isNaN(rank)) return rank;
    }
    if (photoOrder === 'name') return a.name.localeCompare(b.name, 'ja', { numeric: true }) || a.id.localeCompare(b.id);
    const difference = (Number(a.created) || 0) - (Number(b.created) || 0);
    return (photoOrder === 'oldest' ? difference : -difference) || a.id.localeCompare(b.id);
  });
}
let galleryUrls = [], viewerUrl = null, renderSerial = 0, toastTimer;

const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const request = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
const txDone = tx => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error('保存できませんでした')); });
const sizeText = size => size < 1024 * 1024 ? `${Math.round(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3500); }
function openDb() { return new Promise((resolve,reject)=>{ const req=indexedDB.open(DB_NAME,2); req.onupgradeneeded=()=>{ const d=req.result; if(!d.objectStoreNames.contains('sets')) d.createObjectStore('sets',{keyPath:'id'}); if(!d.objectStoreNames.contains('photos')) { const store=d.createObjectStore('photos',{keyPath:'id'}); store.createIndex('setId','setId'); } if(!d.objectStoreNames.contains('settings')) d.createObjectStore('settings',{keyPath:'id'}); }; req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); }); }

async function all(store) { return request(db.transaction(store).objectStore(store).getAll()); }
async function put(store, item) { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(item); await txDone(tx); }
function isPhoto(file) { return file.type.startsWith('image/') || /\.(heic|heif|avif|jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(file.name); }
function safeName(name) { return String(name || '').trim().slice(0, 40); }
function photoType(photo) { const extension = photo.name.split('.').pop()?.toLowerCase(); return photo.type || ({ heic: 'image/heic', heif: 'image/heif', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' }[extension] || 'application/octet-stream'); }
function photoFile(photo) { return new File([photo.blob], photo.name, { type: photoType(photo), lastModified: photo.created || Date.now() }); }

async function refresh() {
  sets = (await all('sets')).sort((a, b) => a.created - b.created);
  sets = sets.map((set, index) => ({ ...set, order: Number.isFinite(set.order) ? set.order : index })).sort((a, b) => a.order - b.order || a.created - b.created);
  if (!sets.some(set => !set.hidden)) { const first = { id: uid(), name: 'マイ写真', created: Date.now(), order: nextSetOrder() }; await put('sets', first); sets.push(first); }
  if (!accessibleSet(activeSetId)) activeSetId = visibleSets()[0]?.id || null;
  try { if (!sets.find(set => set.id === activeSetId)?.hidden) appStorage.setItem('active-photo-set', activeSetId); } catch {}
  photos = await all('photos');
  renderSets(); await renderGallery();
}
function renderSets() {
  const parent = $('setList'); parent.replaceChildren();
  $('setOrderButton').disabled = visibleSets().length < 2;
  for (const set of visibleSets()) {
    const button = document.createElement('button'); button.className = `set-card${set.id === activeSetId ? ' active' : ''}`;
    button.type = 'button'; button.setAttribute('aria-current', set.id === activeSetId ? 'true' : 'false');
    const title = document.createElement('span'); title.className = 'set-title'; title.textContent = set.name;
    const count = document.createElement('span'); count.className = 'set-count'; count.textContent = `${photos.filter(p => p.setId === set.id).length}枚`;
    button.append(title, count); button.onclick = () => { if (activeSetId !== set.id) { activeSetId = set.id; refresh(); } };
    parent.append(button);
  }
}
async function renderGallery() {
  const serial = ++renderSerial;
  galleryUrls.forEach(URL.revokeObjectURL); galleryUrls = [];
  const set = accessibleSet(activeSetId);
  $('albumName').textContent = set?.name || '';
  const items = orderedPhotos();
  $('reorderButton').disabled = items.length < 2;
  const bytes = items.reduce((sum, p) => sum + (p.size || p.blob?.size || 0), 0);
  $('albumMeta').textContent = `${items.length}枚 ・ ${sizeText(bytes)}`;
  $('emptyState').hidden = items.length > 0;
  const gallery = $('gallery'); gallery.replaceChildren();
  for (const photo of items) {
    if (serial !== renderSerial) return;
    const url = URL.createObjectURL(photo.blob); galleryUrls.push(url);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'photo-tile'; button.setAttribute('aria-label', `${photo.name} を開く`);
    const img = document.createElement('img'); img.src = url; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    button.append(img); button.onclick = () => viewPhoto(photo.id); gallery.append(button);
  }
}


// 並べ替えはセットのID一覧だけを保存し，写真の元ファイルは書き換えない．
let reorderIds = [], reorderSelected = null, reorderSetId = null, reorderUrls = [];
let reorderSaving = false;
function openReorder() {
  reorderSetId = activeSetId;
  reorderIds = orderedPhotos().map(photo => photo.id);
  reorderSelected = null;
  const grid = $('reorderGrid'); grid.replaceChildren();
  const photoById = new Map(photos.map(photo => [photo.id, photo]));
  for (const id of reorderIds) {
    const photo = photoById.get(id);
    const url = URL.createObjectURL(photo.blob); reorderUrls.push(url);
    const tile = document.createElement('button'); tile.type = 'button'; tile.className = 'photo-tile'; tile.dataset.id = id;
    const img = document.createElement('img'); img.src = url; img.alt = ''; img.draggable = false; img.loading = 'lazy'; img.decoding = 'async';
    const number = document.createElement('span'); number.className = 'order-number';
    tile.append(img, number);
    tile.onclick = () => {
      if (reorderSaving) return;
      if (!reorderSelected) reorderSelected = id;
      else if (reorderSelected === id) reorderSelected = null;
      else {
        const moving = reorderSelected;
        reorderIds.splice(reorderIds.indexOf(moving), 1);
        reorderIds.splice(reorderIds.indexOf(id), 0, moving);
        reorderSelected = null;
      }
      renderReorder();
    };
    grid.append(tile);
  }
  renderReorder(); $('reorderDialog').showModal(); $('reorderScroll').scrollTop = 0;
}
function renderReorder() {
  const grid = $('reorderGrid');
  const scroll = $('reorderScroll'), scrollTop = scroll.scrollTop;
  const tiles = new Map([...grid.children].map(tile => [tile.dataset.id, tile]));
  const photoById = new Map(photos.map(photo => [photo.id, photo]));
  // 選択だけならDOMの順番を変えない．移動時もスクロール位置を保つ．
  const orderChanged = reorderIds.some((id, index) => grid.children[index]?.dataset.id !== id);
  if (orderChanged) {
    const focused = document.activeElement;
    const fragment = document.createDocumentFragment();
    reorderIds.forEach(id => fragment.append(tiles.get(id)));
    grid.append(fragment);
    if (grid.contains(focused)) focused.focus({ preventScroll: true });
  }
  reorderIds.forEach((id, index) => {
    const tile = tiles.get(id);
    tile.classList.toggle('selected', id === reorderSelected);
    tile.setAttribute('aria-pressed', String(id === reorderSelected));
    tile.setAttribute('aria-label', `${index + 1}番目：${photoById.get(id)?.name}`);
    tile.querySelector('.order-number').textContent = index + 1;
  });
  $('reorderHelp').textContent = reorderSelected ? '移動先の写真をタップすると，その前に入ります．' : '動かしたい写真をタップしてください．';
  const index = reorderIds.indexOf(reorderSelected);
  $('reorderFirst').disabled = index <= 0;
  $('reorderLast').disabled = index < 0 || index === reorderIds.length - 1;
  scroll.scrollTop = scrollTop;
}
function moveReorderToEdge(last) {
  if (!reorderSelected || reorderSaving) return;
  const id = reorderSelected; reorderIds.splice(reorderIds.indexOf(id), 1);
  last ? reorderIds.push(id) : reorderIds.unshift(id);
  reorderSelected = null; renderReorder();
}
async function saveReorder() {
  if (reorderSaving) return;
  reorderSaving = true; $('reorderSave').disabled = true; $('reorderCancel').disabled = true;
  $('reorderSave').textContent = '保存中…';
  try {
    const set = sets.find(s => s.id === reorderSetId);
    if (!set) throw Error('セットが見つかりません');
    await put('sets', { ...set, customOrder: [...reorderIds] });
    photoOrder = 'custom'; $('photoOrder').value = photoOrder;
    try { appStorage.setItem('photo-order', photoOrder); } catch {}
    await refresh(); $('reorderDialog').close(); toast('並び順を保存しました');
  } catch (error) { console.error(error); $('reorderHelp').textContent = '保存できませんでした．もう一度保存してください．'; }
  finally { reorderSaving = false; $('reorderSave').disabled = false; $('reorderCancel').disabled = false; $('reorderSave').textContent = 'この順番で保存'; }
}
$('reorderButton').onclick = openReorder;
$('reorderFirst').onclick = () => moveReorderToEdge(false);
$('reorderLast').onclick = () => moveReorderToEdge(true);
$('reorderSave').onclick = saveReorder;
$('reorderDialog').addEventListener('cancel', event => { if (reorderSaving) event.preventDefault(); });
$('reorderDialog').addEventListener('close', () => { reorderUrls.forEach(URL.revokeObjectURL); reorderUrls = []; $('reorderGrid').replaceChildren(); });

let nameMode = 'create';
let nameTarget = null;
function openNameDialog(mode) {
  nameMode = mode; nameTarget = activeSetId;
  $('nameTitle').textContent = mode === 'create' ? '新しいセット' : mode === 'private' ? '隠しセットを作成' : mode === 'duplicate' ? '複製するセットの名前' : 'セット名を変更';
  const original = accessibleSet(nameTarget);
  $('setName').value = mode === 'rename' ? original?.name || '' : mode === 'duplicate' ? safeName(`${original?.name || ''} のコピー`) : '';
  $('nameDialog').showModal(); setTimeout(() => $('setName').focus(), 100);
}
async function saveName() {
  if ($('nameSubmit').disabled) return;
  const name = safeName($('setName').value); if (!name) return;
  const mode = nameMode;
  $('nameSubmit').disabled = true;
  try {
    if (mode === 'create' || mode === 'private') {
      if (mode === 'private' && !secretSession) throw Error('もう一度開いてください');
      const set = { id: uid(), name, created: Date.now(), order: nextSetOrder(), ...(mode === 'private' ? { hidden: true, secretGroup: secretProfile } : {}) }; await put('sets', set); activeSetId = set.id;
    }
    else if (mode === 'duplicate') await duplicateSet(nameTarget, name);
    else { const set = accessibleSet(nameTarget); if (!set) throw Error('セットが見つかりません'); await put('sets', { ...set, name }); }
    await refresh(); toast(mode === 'create' || mode === 'private' ? 'セットを作成しました' : mode === 'duplicate' ? 'セットを複製しました' : '名前を変更しました');
  } finally { $('nameSubmit').disabled = false; }
}

// 写真は独立したIDで複製する．片方を編集・削除しても元のセットに影響しない．
async function duplicateSet(sourceId, name) {
  const original = accessibleSet(sourceId); if (!original) throw Error('セットが見つかりません');
  const sourcePhotos = photos.filter(photo => photo.setId === sourceId);
  const ids = new Map(sourcePhotos.map(photo => [photo.id, uid()]));
  const copy = { ...original, id: uid(), name, created: Date.now(), customOrder: (original.customOrder || []).map(id => ids.get(id)).filter(Boolean) };
  const sequence = [...sets]; sequence.splice(sequence.findIndex(set => set.id === sourceId) + 1, 0, copy);
  const tx = db.transaction(['sets', 'photos'], 'readwrite');
  const done = txDone(tx);
  sequence.forEach((set, order) => tx.objectStore('sets').put({ ...set, order }));
  sourcePhotos.forEach(photo => tx.objectStore('photos').put({ ...photo, id: ids.get(photo.id), setId: copy.id }));
  await done;
  if (accessibleSet(sourceId)) activeSetId = copy.id;
}

let setOrderIds = [], setOrderSaving = false;
function openSetOrder() {
  setOrderIds = visibleSets().map(set => set.id);
  $('setOrderStatus').textContent = '';
  renderSetOrder(); $('setOrderDialog').showModal();
}
function renderSetOrder(focusId, direction) {
  const parent = $('setOrderList'), top = parent.scrollTop; parent.replaceChildren();
  setOrderIds.forEach((id, index) => {
    const set = accessibleSet(id); if (!set) return;
    const row = document.createElement('div'); row.className = 'set-order-row';
    const label = document.createElement('span'); label.className = 'set-order-name'; label.textContent = `${index + 1}．${set.name}`;
    row.append(label);
    for (const [step, text] of [[-1, '前へ'], [1, '後へ']]) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary-button'; button.textContent = text;
      button.disabled = setOrderSaving || index + step < 0 || index + step >= setOrderIds.length;
      button.setAttribute('aria-label', `${set.name}を${text}`);
      button.onclick = () => { if (setOrderSaving) return; [setOrderIds[index], setOrderIds[index + step]] = [setOrderIds[index + step], setOrderIds[index]]; renderSetOrder(id, step); };
      row.append(button);
      if (id === focusId && step === direction) button.dataset.restoreFocus = 'true';
    }
    parent.append(row);
  });
  parent.querySelector('[data-restore-focus]')?.focus({ preventScroll: true }); parent.scrollTop = top;
}
async function saveSetOrder() {
  if (setOrderSaving) return;
  setOrderSaving = true; $('setOrderSave').disabled = true; $('setOrderCancel').disabled = true;
  try {
    const visibleIds = new Set(visibleSets().map(set => set.id));
    if (setOrderIds.length !== visibleIds.size || setOrderIds.some(id => !visibleIds.has(id))) throw Error('一覧が変更されました');
    // 閉じているセットの位置は動かさず，表示中の位置だけを並べ替える．
    let cursor = 0;
    const sequence = sets.map(set => visibleIds.has(set.id) ? accessibleSet(setOrderIds[cursor++]) : set);
    const tx = db.transaction('sets', 'readwrite'), done = txDone(tx);
    sequence.forEach((set, order) => tx.objectStore('sets').put({ ...set, order })); await done;
    await refresh(); $('setOrderDialog').close(); toast('セットの順番を保存しました');
  } catch { $('setOrderStatus').textContent = '保存できませんでした．開き直してもう一度お試しください．'; }
  finally { setOrderSaving = false; $('setOrderSave').disabled = false; $('setOrderCancel').disabled = false; }
}
$('setOrderDialog').addEventListener('cancel', event => { if (setOrderSaving) event.preventDefault(); });

// 合言葉は平文で保存しない．表示の制御であり，写真自体の暗号化ではない．
function gateStorageKey(profile) { return profile === 'secondary' ? `${GATE_KEY}-secondary` : GATE_KEY; }
function getGate(profile = secretProfile || 'primary') { try { return JSON.parse(appStorage.getItem(gateStorageKey(profile)) || 'null'); } catch { return null; } }
function validGate(gate) { return gate?.version === 1 && /^[a-f0-9]{32}$/.test(gate.salt) && /^[a-f0-9]{64}$/.test(gate.hash) && (gate.space === undefined || /^[a-f0-9]{32}$/.test(gate.space)); }
async function gateHash(phrase, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(phrase), 'PBKDF2', false, ['deriveBits']);
  const bytes = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function verifyPhrase(phrase, profile = secretProfile || 'primary') { const gate = getGate(profile); return validGate(gate) && Boolean(phrase) && await gateHash(phrase, gate.salt) === gate.hash; }
async function phraseProfile(phrase) {
  const matches = await Promise.all(['primary', 'secondary'].map(async profile => await verifyPhrase(phrase, profile) ? profile : null));
  return matches.find(Boolean) || null;
}
async function storePhrase(phrase, profile = secretProfile || 'primary') {
  if ([...phrase].length < 4) throw Error('4文字以上で入力してください．');
  const epoch = privacyEpoch;
  const previous = getGate(profile);
  if (await verifyPhrase(phrase, profile === 'primary' ? 'secondary' : 'primary')) throw Error('別の合言葉にしてください．');
  const salt = [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const hash = await gateHash(phrase, salt);
  if (epoch !== privacyEpoch || document.visibilityState === 'hidden') throw Error('もう一度お試しください．');
  appStorage.setItem(gateStorageKey(profile), JSON.stringify({ version: 1, salt, hash, space: validGate(previous) ? previous.space || previous.salt : salt }));
}
function clearPrivateSurfaces(keepCommand = false) {
  for (const dialog of document.querySelectorAll('dialog[open]')) if (!keepCommand || dialog !== $('commandDialog')) dialog.close();
  closeViewer();
  for (const id of ['viewerFilename', 'viewerCounter', 'moveTargets', 'setOrderList', 'usageText']) $(id).replaceChildren();
  $('setName').value = ''; $('commandInput').value = ''; $('commandConfirm').value = ''; $('commandStatus').textContent = ''; $('commandSetName').textContent = ''; $('commandTools').hidden = true;
  clearTimeout(toastTimer); $('toast').textContent = ''; $('toast').classList.remove('show');
  reorderUrls.forEach(URL.revokeObjectURL); reorderUrls = []; $('reorderGrid').replaceChildren();
  setOrderIds = []; reorderIds = []; reorderSelected = null; nameTarget = null;
}
function lockSession() {
  privacyEpoch++; secretSession = false; secretProfile = null; clearPrivateSurfaces();
  if (!accessibleSet(activeSetId)) activeSetId = visibleSets()[0]?.id || null;
  renderSets(); renderGallery();
}
async function activateProfile(profile) {
  privacyEpoch++; clearPrivateSurfaces(true);
  galleryUrls.forEach(URL.revokeObjectURL); galleryUrls = []; $('gallery').replaceChildren(); $('albumName').textContent = ''; $('albumMeta').textContent = '';
  secretProfile = profile; secretSession = true;
  activeSetId = visibleSets().find(set => set.hidden)?.id || (accessibleSet(activeSetId) ? activeSetId : visibleSets()[0]?.id || null);
  await refresh();
}
let commandBusy = false, commandFailures = 0, commandRetryAt = 0;
async function runCommand(value) {
  const match = value.trim().match(/^(\/\w+)(?:\s+([\s\S]+))?$/);
  if (!match) throw Error('入力を確認してください．');
  const [, command, argument = ''] = match;
  if(command === '/exportall') return exportComplete(argument);
  if (command === '/lock') { lockSession(); return; }
  if (command === '/key') {
    if (getGate('primary')) throw Error('設定済みです．');
    await storePhrase(argument, 'primary');
    return;
  }
  // 追加の登録入口は画面や既存のメニューに表示しない．
  if (command === '/second') {
    const parts = argument.match(/^(.+)\s+(\S+)$/);
    if (!parts || getGate('secondary')) throw Error('入力を確認してください．');
    if (Date.now() < commandRetryAt) throw Error('少し待ってからお試しください．');
    const epoch = privacyEpoch;
    if (!await verifyPhrase(parts[1], 'primary')) { commandFailures++; if (commandFailures >= 5) { commandRetryAt = Date.now() + 30000; commandFailures = 0; } throw Error('入力を確認してください．'); }
    if (epoch !== privacyEpoch || document.visibilityState === 'hidden') throw Error('もう一度お試しください．');
    await storePhrase(parts[2], 'secondary'); commandFailures = 0;
    await activateProfile('secondary'); return;
  }
  if (command === '/new') {
    if (!secretSession || !safeName(argument)) throw Error('入力を確認してください．');
    const set = { id: uid(), name: safeName(argument), hidden: true, secretGroup: secretProfile, created: Date.now(), order: nextSetOrder() };
    await put('sets', set); activeSetId = set.id; await refresh(); return;
  }
  if (!['/open', '/hide', '/show'].includes(command)) throw Error('入力を確認してください．');
  if (Date.now() < commandRetryAt) throw Error('少し待ってからお試しください．');
  const epoch = privacyEpoch;
  const profile = await phraseProfile(argument);
  if (!profile) {
    commandFailures++; if (commandFailures >= 5) { commandRetryAt = Date.now() + 30000; commandFailures = 0; }
    throw Error('入力を確認してください．');
  }
  if (epoch !== privacyEpoch || document.visibilityState === 'hidden') throw Error('もう一度お試しください．');
  commandFailures = 0;
  if (command === '/open') { await activateProfile(profile); return; }
  if (command === '/show' && (!secretSession || secretProfile !== profile)) throw Error('入力を確認してください．');
  if (secretSession && secretProfile !== profile) throw Error('入力を確認してください．');
  if (!secretSession) secretProfile = profile;
  await changeSetVisibility(command === '/hide');
}
async function changeSetVisibility(hidden) {
  const set = accessibleSet(activeSetId); if (!set) throw Error('セットが見つかりません．');
  if (hidden) {
    if (!confirm(`「${set.name}」を通常の一覧から外しますか？`)) return;
    await put('sets', { ...set, hidden: true, secretGroup: secretProfile || 'primary' });
    sets = sets.map(item => item.id === set.id ? { ...item, hidden: true, secretGroup: secretProfile || 'primary' } : item);
    lockSession(); await refresh();
  } else {
    const { secretGroup, ...ordinary } = set;
    await put('sets', { ...ordinary, hidden: false }); await refresh();
  }
}
let commandMode = 'open';
function renderCommandPanel(mode = secretSession ? 'tools' : validGate(getGate('primary')) || validGate(getGate('secondary')) ? 'open' : 'setup') {
  commandMode = mode;
  $('commandInput').value = ''; $('commandConfirm').value = ''; $('commandStatus').textContent = '';
  $('commandForm').hidden = mode === 'tools'; $('commandTools').hidden = mode !== 'tools';
  $('commandConfirmRow').hidden = !['setup', 'change'].includes(mode);
  // 一致確認は送信時に行い，以前のスラッシュコマンドも受け付ける．
  $('commandConfirm').required = false;
  $('commandLabel').textContent = mode === 'change' ? '新しい合言葉（4文字以上）' : '合言葉（4文字以上）';
  $('commandSubmit').textContent = mode === 'setup' ? '設定して表示' : mode === 'change' ? '変更' : '表示';
  if (mode === 'tools') {
    const set = accessibleSet(activeSetId);
    $('commandSetName').textContent = set ? `選択中：${set.name}（${set.hidden ? '隠しセット' : '通常のセット'}）` : '';
    $('secretHide').disabled = !set || Boolean(set.hidden); $('secretShow').disabled = !set?.hidden;
  }
}
function openCommandPanel() {
  if (!db || commandBusy || $('commandDialog').open) return;
  renderCommandPanel(); $('commandDialog').showModal();
  if (commandMode !== 'tools') $('commandInput').focus({ preventScroll: true });
}
// 通常画面には入口を出さない．タイトル2秒長押し，または7回タップで開く．
let brandTaps = 0, brandLastTap = 0;
$('brand').addEventListener('click', () => {
  if (!db || commandBusy) return;
  const now = Date.now(); brandTaps = now - brandLastTap < 700 ? brandTaps + 1 : 1; brandLastTap = now;
  if (brandTaps < 7) return;
  brandTaps = 0; openCommandPanel();
});
let brandHoldTimer, brandHoldStart;
function cancelBrandHold() { clearTimeout(brandHoldTimer); brandHoldStart = null; }
$('brand').addEventListener('pointerdown', event => {
  cancelBrandHold(); if (event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
  brandHoldStart = { x: event.clientX, y: event.clientY };
  brandHoldTimer = setTimeout(() => { brandTaps = 0; openCommandPanel(); }, 2000);
});
$('brand').addEventListener('pointermove', event => { if (brandHoldStart && Math.hypot(event.clientX - brandHoldStart.x, event.clientY - brandHoldStart.y) > 12) cancelBrandHold(); });
for (const name of ['pointerup', 'pointercancel', 'pointerleave']) $('brand').addEventListener(name, cancelBrandHold);
$('brand').addEventListener('contextmenu', event => event.preventDefault());
$('commandForm').addEventListener('submit', async event => {
  event.preventDefault(); if (commandBusy) return;
  const value = $('commandInput').value.trim(), repeated = $('commandConfirm').value.trim(), mode = commandMode;
  $('commandInput').value = ''; $('commandConfirm').value = '';
  commandBusy = true; $('commandSubmit').disabled = true;
  try {
    if (value.startsWith('/')) { await runCommand(value); if ($('backupSaveDialog')?.open) return; if (secretSession && $('commandDialog').open) renderCommandPanel('tools'); else $('commandDialog').close(); }
    else {
      if (mode === 'setup' || mode === 'change') {
        if (value !== repeated) throw Error('合言葉が一致しません．もう一度入力してください．');
        if (mode === 'change' && !secretSession) throw Error('もう一度開いてください．');
        if (mode === 'setup' && getGate()) throw Error('設定済みです．');
        await storePhrase(value);
      }
      if (mode !== 'change') await runCommand(`/open ${value}`);
      if (secretSession && $('commandDialog').open) { renderCommandPanel('tools'); if (mode === 'change') $('commandStatus').textContent = '合言葉を変更しました．'; }
    }
  }
  catch (error) { if ($('commandDialog').open) $('commandStatus').textContent = error.message || '実行できませんでした．'; }
  finally { commandBusy = false; $('commandSubmit').disabled = false; }
});
$('commandBack').onclick = () => { if (commandBusy) return; if (commandMode === 'change' && secretSession) renderCommandPanel('tools'); else $('commandDialog').close(); };
async function runSecretAction(action) {
  if (!secretSession || commandBusy) return;
  commandBusy = true; const epoch = privacyEpoch; let errorMessage = '';
  const buttons = $('commandTools').querySelectorAll('button'); buttons.forEach(button => { button.disabled = true; });
  try { await action(); if (secretSession && epoch === privacyEpoch && $('commandDialog').open) renderCommandPanel('tools'); }
  catch { errorMessage = '実行できませんでした．もう一度お試しください．'; }
  finally { commandBusy = false; buttons.forEach(button => { button.disabled = false; }); if (secretSession && $('commandDialog').open && commandMode === 'tools') { renderCommandPanel('tools'); $('commandStatus').textContent = errorMessage; } }
}
$('secretHide').onclick = () => runSecretAction(() => changeSetVisibility(true));
$('secretShow').onclick = () => runSecretAction(() => changeSetVisibility(false));
$('secretNew').onclick = () => { if (!secretSession || commandBusy) return; $('commandDialog').close(); openNameDialog('private'); };
$('secretChangeKey').onclick = () => { if (secretSession && !commandBusy) { renderCommandPanel('change'); $('commandInput').focus({ preventScroll: true }); } };
$('secretLock').onclick = () => { if (!commandBusy) lockSession(); };
$('commandDialog').addEventListener('close', () => { $('commandInput').value = ''; $('commandConfirm').value = ''; $('commandStatus').textContent = ''; $('commandSetName').textContent = ''; $('commandTools').hidden = true; });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && (secretSession || $('commandDialog').open)) lockSession(); });
window.addEventListener('pagehide', () => { if (secretSession) lockSession(); });
window.addEventListener('pageshow', event => { if (event.persisted) lockSession(); });
async function deleteSet() {
  const set = sets.find(s => s.id === activeSetId);
  const count = photos.filter(p => p.setId === activeSetId).length;
  if (!confirm(`「${set.name}」と中の写真 ${count}枚を削除しますか？\nこの操作は取り消せません．`)) return;
  const tx = db.transaction(['sets', 'photos'], 'readwrite');
  tx.objectStore('sets').delete(set.id);
  const index = tx.objectStore('photos').index('setId');
  index.openCursor(IDBKeyRange.only(set.id)).onsuccess = event => { const cursor = event.target.result; if (cursor) { cursor.delete(); cursor.continue(); } };
  await txDone(tx); activeSetId = null; await refresh(); $('optionsDialog').close(); toast('セットを削除しました');
}
async function addFiles(fileList, target = activeSetId) {
  const files = [...fileList].filter(isPhoto); if (!files.length) { toast('画像ファイルを選んでください'); return; }
  if (!sets.some(set => set.id === target)) { toast('保存先を選び直してください'); return; }
  const button = $('addPhotosButton'); button.disabled = true; button.textContent = '保存しています…';
  let added = 0;
  try {
    for (const file of files) {
      await put('photos', { id: uid(), setId: target, name: file.name || `画像-${Date.now()}`, type: file.type, size: file.size, created: Date.now() + added, blob: file }); added++;
    }
    await refresh(); toast(accessibleSet(target) ? `${added}枚を保存しました` : '保存しました');
  } catch (error) {
    await refresh(); toast(added ? accessibleSet(target) ? `${added}枚保存しました．残りは容量を確認してください` : '一部を保存しました．空き容量を確認してください' : '保存できませんでした．端末の空き容量を確認してください');
    console.error(error);
  } finally { button.disabled = false; button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg>画像を追加'; $('photoInput').value = ''; }
}
function setViewerControls(visible) {
  const viewer = $('viewer');
  viewer.classList.toggle('controls-visible', visible);
  $('viewerStage').setAttribute('aria-label', visible ? '写真をタップして操作ボタンを隠す' : '写真をタップして操作ボタンを表示');
  for (const bar of [viewer.querySelector('.viewer-bar'), viewer.querySelector('.viewer-footer')]) {
    bar.setAttribute('aria-hidden', String(!visible));
    bar.querySelectorAll('button').forEach(button => { button.tabIndex = visible ? 0 : -1; });
  }
  if (!visible && viewer.contains(document.activeElement) && document.activeElement !== $('viewerStage')) $('viewerStage').focus({ preventScroll: true });
}
function viewPhoto(id) {
  const photo = photos.find(p => p.id === id); if (!photo || !accessibleSet(photo.setId)) return;
  currentPhotoId = id; if (viewerUrl) URL.revokeObjectURL(viewerUrl); viewerUrl = URL.createObjectURL(photo.blob);
  $('viewerImage').src = viewerUrl; $('viewerFilename').textContent = photo.name;
  const items = orderedPhotos();
  $('viewerCounter').textContent = `${items.findIndex(p => p.id === id) + 1} / ${items.length}`;
  const index = items.findIndex(p => p.id === id);
  $('previousPhoto').disabled = index <= 0;
  $('nextPhoto').disabled = index >= items.length - 1;
  if (!$('viewer').open) {
    setViewerControls(false);
    $('viewer').showModal();
    $('viewerStage').focus({ preventScroll: true });
  }
}
function stepPhoto(direction) {
  const items = orderedPhotos();
  const index = items.findIndex(p => p.id === currentPhotoId);
  const next = items[index + direction];
  if (index < 0 || !next) return;
  viewPhoto(next.id);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $('viewerImage').animate([{ opacity: .4, transform: `translateX(${direction * 22}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: 160 });
  }
}
let swipeStart = null, suppressViewerTap = false, swipeTapTimer;
$('viewerStage').addEventListener('touchstart', event => {
  swipeStart = event.touches.length === 1 && (window.visualViewport?.scale || 1) <= 1.05 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
}, { passive: true });
$('viewerStage').addEventListener('touchmove', event => { if (event.touches.length !== 1) swipeStart = null; }, { passive: true });
$('viewerStage').addEventListener('touchcancel', () => { swipeStart = null; }, { passive: true });
$('viewerStage').addEventListener('touchend', event => {
  const start = swipeStart; swipeStart = null;
  if (!start || event.touches.length || !event.changedTouches.length) return;
  const dx = event.changedTouches[0].clientX - start.x;
  const dy = event.changedTouches[0].clientY - start.y;
  if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    suppressViewerTap = true;
    clearTimeout(swipeTapTimer);
    swipeTapTimer = setTimeout(() => { suppressViewerTap = false; }, 400);
    stepPhoto(dx < 0 ? 1 : -1);
  }
}, { passive: true });
$('viewerStage').addEventListener('click', () => {
  if (suppressViewerTap) return;
  setViewerControls(!$('viewer').classList.contains('controls-visible'));
});
$('viewerStage').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    setViewerControls(!$('viewer').classList.contains('controls-visible'));
  }
});
$('previousPhoto').onclick = () => stepPhoto(-1);
$('nextPhoto').onclick = () => stepPhoto(1);
$('viewer').addEventListener('keydown', event => {
  if ($('photoOptionsDialog').open || $('moveDialog').open) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); stepPhoto(event.key === 'ArrowLeft' ? -1 : 1); }
});
$('photoOrder').onchange = async event => {
  photoOrder = event.target.value;
  try { appStorage.setItem('photo-order', photoOrder); } catch {}
  await renderGallery();
};
function closeViewer() { $('viewer').close(); $('viewerImage').removeAttribute('src'); if (viewerUrl) URL.revokeObjectURL(viewerUrl); viewerUrl = null; currentPhotoId = null; }
async function sharePhoto() {
  const photo = photos.find(p => p.id === currentPhotoId); if (!photo || !accessibleSet(photo.setId)) return;
  const file = photoFile(photo);
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
    const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = photo.name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast('ファイルに保存しました');
  } catch (error) { if (error.name !== 'AbortError') toast('共有できませんでした'); }
}
async function deletePhoto() {
  const photo = photos.find(p => p.id === currentPhotoId); if (!photo || !confirm(`「${photo.name}」を削除しますか？`)) return;
  const tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').delete(photo.id); await txDone(tx);
  $('photoOptionsDialog').close(); closeViewer(); await refresh(); toast('写真を削除しました');
}
function showMove() {
  $('photoOptionsDialog').close(); const parent = $('moveTargets'); parent.replaceChildren();
  const destinations = visibleSets().filter(s => s.id !== activeSetId);
  if (!destinations.length) { toast('先に新しいセットを作成してください'); return; }
  for (const set of destinations) { const button = document.createElement('button'); button.type = 'button'; button.className = 'option-button'; button.textContent = set.name; button.onclick = async () => { const photo = photos.find(p => p.id === currentPhotoId); await put('photos', { ...photo, setId: set.id }); $('moveDialog').close(); closeViewer(); await refresh(); toast(`「${set.name}」へ移動しました`); }; parent.append(button); }
  $('moveDialog').showModal();
}

function toBase64(blob) { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = () => reject(r.error); r.readAsDataURL(blob); }); }
function fromBase64(data, type) { const binary = atob(data); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i); return new Blob([bytes], { type }); }
async function backup() {
  const epoch = privacyEpoch;
  const selectedSets = visibleSets(), selectedIds = new Set(selectedSets.map(set => set.id));
  const selectedPhotos = photos.filter(photo => selectedIds.has(photo.setId));
  const includesPrivate = selectedSets.some(set => set.hidden);
  if (includesPrivate && !confirm('現在表示中のすべてのセットをバックアップします．このファイルは暗号化されず，開けば写真やセット名を確認できます．保存しますか？')) return;
  const button = $('exportButton'); button.disabled = true; button.textContent = 'バックアップを作成中…';
  try {
    const entries = [];
    for (const p of selectedPhotos) {
      entries.push({ id: p.id, setId: p.setId, name: p.name, type: p.type, created: p.created, data: await toBase64(p.blob) });
      if (epoch !== privacyEpoch) return;
    }
    if (epoch !== privacyEpoch) return;
    const data = { format: 'photo-sets-backup', version: 1, photoOrder, sets: selectedSets.map(s => ({ id: s.id, name: s.name, created: s.created, order: s.order, ...(s.hidden ? { hidden: true } : {}), customOrder: s.customOrder || [] })), photos: entries, ...(includesPrivate ? { commandKey: getGate() } : {}) };
    const file = new File([JSON.stringify(data)], `photo-sets-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
    showBackupSave(file);
  } catch (error) { if (error.name !== 'AbortError') { console.error(error); toast('バックアップを作れませんでした'); } }
  finally { button.disabled = false; button.textContent = '表示中のセットをバックアップ'; }
}
async function restore(file) {
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    if(raw.format==='photo-sets-complete') { await importComplete(raw); return; }
    if (raw.format !== 'photo-sets-backup' || raw.version !== 1 || !Array.isArray(raw.sets) || !Array.isArray(raw.photos)) throw Error('形式が異なります');
    if (raw.sets.length > 1000 || raw.photos.length > 5000) throw Error('件数が多すぎます');
    const originals = new Set(raw.sets.map(s => s.id));
    if (raw.sets.some(s => typeof s.name !== 'string' || !s.name.trim() || (s.hidden !== undefined && typeof s.hidden !== 'boolean')) || raw.photos.some(p => !originals.has(p.setId) || typeof p.data !== 'string' || !/^[a-zA-Z0-9+/]*={0,2}$/.test(p.data))) throw Error('内容が正しくありません');
    const includesHidden = raw.sets.some(set => set.hidden === true);
    let restoreProfile = null, installGate = false;
    if (includesHidden) {
      if (validGate(raw.commandKey)) restoreProfile = ['primary', 'secondary'].find(profile => { const gate = getGate(profile); return validGate(gate) && (gate.space || gate.salt) === (raw.commandKey.space || raw.commandKey.salt); }) || null;
      if (!restoreProfile && validGate(raw.commandKey)) {
        restoreProfile = ['primary', 'secondary'].find(profile => !validGate(getGate(profile))) || null;
        installGate = Boolean(restoreProfile);
      }
      if (!restoreProfile) throw Error('開いてから復元してください');
    }
    const restoredVisibleIds = new Set(raw.sets.filter(set => !set.hidden || (secretSession && restoreProfile === secretProfile)).map(set => set.id));
    const visibleCount = raw.photos.filter(photo => restoredVisibleIds.has(photo.setId)).length;
    if (!confirm(`セットを追加して復元しますか？\n今ある写真は残ります．`)) return;
    if (installGate) appStorage.setItem(gateStorageKey(restoreProfile), JSON.stringify(raw.commandKey));
    const orderedSets = [...raw.sets].map((set, index) => ({ ...set, backupOrder: Number.isFinite(set.order) ? set.order : index })).sort((a, b) => a.backupOrder - b.backupOrder);
    const baseOrder = nextSetOrder();
    const idMap = new Map(); const newSets = orderedSets.map((s, i) => { const id = uid(); idMap.set(s.id, id); return { id, name: safeName(s.name), created: Date.now() + i, order: baseOrder + i, ...(s.hidden === true ? { hidden: true, secretGroup: restoreProfile } : {}) }; });
    const photoIdMap = new Map();
    const restored = raw.photos.map((p, i) => { const blob = fromBase64(p.data, p.type || 'application/octet-stream'); const id = uid(); if (typeof p.id === 'string') photoIdMap.set(p.id, id); return { id, setId: idMap.get(p.setId), name: String(p.name || '画像').slice(0, 255), type: p.type || '', size: blob.size, created: Number(p.created) || Date.now() + i, blob }; });
    newSets.forEach((set, index) => { const order = orderedSets[index].customOrder; if (Array.isArray(order)) set.customOrder = order.map(id => photoIdMap.get(id)).filter(id => restored.some(p => p.id === id && p.setId === set.id)); });
    const tx = db.transaction(['sets', 'photos'], 'readwrite'); newSets.forEach(s => tx.objectStore('sets').put(s)); restored.forEach(p => tx.objectStore('photos').put(p)); await txDone(tx);
    if (raw.photoOrder === 'custom') { photoOrder = 'custom'; $('photoOrder').value = photoOrder; try { appStorage.setItem('photo-order', photoOrder); } catch {} }
    activeSetId = newSets.find(set => !set.hidden || (secretSession && setProfile(set) === secretProfile))?.id || activeSetId; await refresh(); $('settingsDialog').close(); toast(visibleCount ? `${visibleCount}枚を復元しました` : '復元しました');
  } catch (error) { console.error(error); toast('復元できませんでした．ファイルと空き容量を確認してください'); }
  finally { $('backupInput').value = ''; }
}
async function showUsage() {
  const items = visiblePhotos();
  const total = items.reduce((n, p) => n + (p.size || p.blob?.size || 0), 0);
  const message = `表示中の写真：${items.length}枚 ・ 約${sizeText(total)}．`;
  $('usageText').textContent = message;
  $('settingsDialog').showModal();
}

$('addSetButton').onclick = () => openNameDialog('create');
$('nameForm').addEventListener('submit', async event => { if (event.submitter?.value !== 'save') return; event.preventDefault(); try { await saveName(); $('nameDialog').close(); } catch (error) { console.error(error); toast('保存できませんでした'); } });
$('setOptionsButton').onclick = () => $('optionsDialog').showModal();
$('renameSetButton').onclick = () => { $('optionsDialog').close(); openNameDialog('rename'); };
$('duplicateSetButton').onclick = () => { $('optionsDialog').close(); openNameDialog('duplicate'); };
$('setOrderButton').onclick = openSetOrder;
$('setOrderSave').onclick = saveSetOrder;
$('deleteSetButton').onclick = () => deleteSet().catch(() => toast('削除できませんでした'));
let photoPickerTarget = null;
$('addPhotosButton').onclick = () => { photoPickerTarget = activeSetId; $('photoInput').click(); };
$('photoInput').onchange = event => { const target = photoPickerTarget; photoPickerTarget = null; addFiles(event.target.files, target); };
$('moreButton').onclick = showUsage;
$('exportButton').onclick = backup;
$('importButton').onclick = () => $('backupInput').click();
$('backupInput').onchange = event => restore(event.target.files[0]);
$('viewerClose').onclick = closeViewer;
$('viewerMenu').onclick = () => $('photoOptionsDialog').showModal();
$('shareButton').onclick = sharePhoto;
$('deletePhotoButton').onclick = () => deletePhoto().catch(() => toast('削除できませんでした'));
$('moveButton').onclick = showMove;
document.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => $(button.dataset.close).close(); });
$('viewer').addEventListener('close', () => { setViewerControls(false); if (viewerUrl) { $('viewerImage').removeAttribute('src'); URL.revokeObjectURL(viewerUrl); viewerUrl = null; currentPhotoId = null; } });
window.addEventListener('pagehide', () => { galleryUrls.forEach(URL.revokeObjectURL); if (viewerUrl) URL.revokeObjectURL(viewerUrl); });
(async () => { try { db = await openDb(); await loadPreferences(); try { activeSetId = appStorage.getItem('active-photo-set'); } catch {} try { await navigator.storage?.persist?.(); } catch {} await refresh(); } catch (error) { console.error(error); $('albumName').textContent = '保存領域を開けませんでした'; $('albumMeta').textContent = 'Safariの設定を確認してください．'; $('addPhotosButton').disabled = true; } })();
