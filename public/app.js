const API = '';
let appConfig = null;
let currentList = null;
let currentListId = null;
let selectedMenuItemId = null;
let pollInterval = null;

// --- DOM refs ---
const $ = id => document.getElementById(id);
const viewLanding = $('view-landing');
const viewList = $('view-list');
const createForm = $('create-form');
const btnShowCreate = $('btn-show-create');
const btnCancelCreate = $('btn-cancel-create');
const btnCreateList = $('btn-create-list');
const listBar = $('list-bar');
const listName = $('list-name');
const deadlineHour = $('deadline-hour');
const deadlineMinute = $('deadline-minute');
const listTitle = $('list-title');
const listBarName = $('list-bar-name');
const listLunchInfo = $('list-lunch-info');
const listReservationName = $('list-reservation-name');
const listDeadline = $('list-deadline');
const listStatus = $('list-status');
const entryForm = $('entry-form');
const personName = $('person-name');
const customItem = $('custom-item');
const menuOptions = $('menu-options');
const btnAddEntry = $('btn-add-entry');
const entriesList = $('entries-list');
const entriesEmpty = $('entries-empty');
const entryCount = $('entry-count');
const btnWhatsapp = $('btn-whatsapp');
const btnCopy = $('btn-copy');
const btnDeleteList = $('btn-delete-list');
const btnShare = $('btn-share');
const btnBack = $('btn-back');
const listsContainer = $('lists-container');
const codeModal = $('code-modal');
const codeInput = $('code-input');
const btnCodeSubmit = $('btn-code-submit');
const btnCodeCancel = $('btn-code-cancel');
const codeError = $('code-error');
const headerTitle = $('header-title');

// --- Access codes stored per list in sessionStorage ---
function getStoredCode(listId) {
  try { return sessionStorage.getItem('code-' + listId) || ''; } catch { return ''; }
}
function storeCode(listId, code) {
  try { sessionStorage.setItem('code-' + listId, code); } catch {}
}

function accessHeaders(listId) {
  const code = getStoredCode(listId || currentListId);
  return code ? { 'X-Access-Code': code } : {};
}

// --- Init ---
async function init() {
  appConfig = await api('/api/config');
  deadlineHour.value = appConfig.defaultDeadlineHour;
  deadlineMinute.value = String(appConfig.defaultDeadlineMinute).padStart(2, '0');

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  $('lunch-date').value = tomorrowStr;
  $('deadline-date').value = tomorrowStr;
  updateListNamePlaceholder();

  $('lunch-date').addEventListener('change', () => {
    updateDeadlineDate();
    updateListNamePlaceholder();
  });

  appConfig.bars.forEach(bar => {
    const opt = document.createElement('option');
    opt.value = bar.id;
    opt.textContent = bar.name;
    listBar.appendChild(opt);
  });

  const savedName = localStorage.getItem('almorzeitor-name');
  if (savedName) personName.value = savedName;

  btnShowCreate.addEventListener('click', () => createForm.classList.toggle('hidden'));
  btnCancelCreate.addEventListener('click', () => createForm.classList.add('hidden'));
  btnCreateList.addEventListener('click', createList);
  btnAddEntry.addEventListener('click', addEntry);
  btnWhatsapp.addEventListener('click', sendWhatsapp);
  btnCopy.addEventListener('click', copyToClipboard);
  btnDeleteList.addEventListener('click', deleteList);
  btnShare.addEventListener('click', shareLink);
  btnBack.addEventListener('click', navigateToLanding);
  headerTitle.addEventListener('click', navigateToLanding);
  headerTitle.style.cursor = 'pointer';

  $('btn-edit').addEventListener('click', openEditModal);
  $('btn-edit-save').addEventListener('click', saveEdit);
  $('btn-edit-cancel').addEventListener('click', () => $('edit-modal').classList.add('hidden'));

  btnCodeSubmit.addEventListener('click', submitAccessCode);
  btnCodeCancel.addEventListener('click', () => {
    codeModal.classList.add('hidden');
    pendingListId = null;
    navigateToLanding();
  });
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitAccessCode();
  });

  customItem.addEventListener('input', () => {
    if (customItem.value.trim()) clearMenuSelection();
  });

  route();
}

// --- Routing ---
function getListIdFromUrl() {
  const match = window.location.pathname.match(/^\/lista\/(.+)$/);
  return match ? match[1] : null;
}

function navigateToList(listId) {
  history.pushState(null, '', '/lista/' + listId);
  currentListId = listId;
  currentList = null;
  loadList();
  startPolling();
}

function navigateToLanding() {
  history.pushState(null, '', '/');
  currentListId = null;
  currentList = null;
  showView('landing');
  loadLists();
  startPolling();
}

function route() {
  const listId = getListIdFromUrl();
  if (listId) {
    currentListId = listId;
    loadList();
  } else {
    showView('landing');
    loadLists();
  }
  startPolling();
}

window.addEventListener('popstate', route);

// --- API helper ---
async function api(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(API + url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error de red' }));
    throw err;
  }
  return res.json();
}

// --- Polling ---
function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(() => {
    if (currentListId) loadList();
    else loadLists();
  }, 10000);
}

// --- Landing: List of lists ---
let cachedListsJson = null;

async function loadLists() {
  try {
    const lists = await api('/api/lists');
    const json = JSON.stringify(lists);
    if (json === cachedListsJson) return;
    cachedListsJson = json;
    renderLists(lists);
  } catch {
    // silent
  }
}

function renderLists(lists) {
  showView('landing');
  listsContainer.innerHTML = '';

  if (lists.length === 0) {
    listsContainer.innerHTML = '<p class="empty-state">No hay listas activas. ¡Crea una!</p>';
    return;
  }

  lists.forEach(list => {
    const card = document.createElement('div');
    card.className = 'card list-card';
    card.addEventListener('click', () => openList(list));

    const lunchDate = new Date(list.lunchDate + 'T00:00:00');
    const lunchTime = `${String(list.lunchHour).padStart(2, '0')}:${String(list.lunchMinute).padStart(2, '0')}`;
    const dateStr = lunchDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    const peopleLabel = list.entryCount === 1 ? '1 persona' : `${list.entryCount} personas`;

    card.innerHTML = `
      <div class="list-card-header">
        <span class="list-card-title">${escapeHtml(list.name)}</span>
        ${list.hasCode ? '<span class="list-card-lock">🔒</span>' : ''}
      </div>
      <div class="list-card-info">
        <span>${dateStr} a las ${lunchTime}</span>
        <span>${list.barName}</span>
        ${list.reservationName ? `<span>👤 ${escapeHtml(list.reservationName)}</span>` : ''}
        <span>${peopleLabel}</span>
        <span class="badge ${list.open ? 'badge-open' : 'badge-closed'}">${list.open ? 'Abierta' : 'Cerrada'}</span>
      </div>
    `;

    listsContainer.appendChild(card);
  });
}

// --- Access code modal ---
let pendingListId = null;

function openList(list) {
  if (list.hasCode && !getStoredCode(list.id)) {
    pendingListId = list.id;
    codeModal.classList.remove('hidden');
    codeError.classList.add('hidden');
    codeInput.value = '';
    codeInput.focus();
  } else {
    navigateToList(list.id);
  }
}

async function submitAccessCode() {
  const code = codeInput.value.trim();
  if (!code) return;
  try {
    await api(`/api/list/${pendingListId}/access`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    storeCode(pendingListId, code);
    codeModal.classList.add('hidden');
    navigateToList(pendingListId);
    pendingListId = null;
  } catch {
    codeError.classList.remove('hidden');
  }
}

// --- List management ---
async function loadList() {
  if (!currentListId) return;
  try {
    const list = await api(`/api/list/${currentListId}`, {
      headers: accessHeaders(currentListId),
    });
    const changed = !currentList
      || currentList.id !== list.id
      || currentList.entries.length !== list.entries.length
      || JSON.stringify(currentList.entries) !== JSON.stringify(list.entries)
      || currentList.open !== list.open;
    currentList = list;
    if (changed) renderList();
    else showView('list');
  } catch (e) {
    if (e.needsCode) {
      pendingListId = currentListId;
      codeModal.classList.remove('hidden');
      codeError.classList.add('hidden');
      codeInput.value = '';
      codeInput.focus();
    } else if (e.error === 'Lista no encontrada') {
      toast('La lista ya no existe');
      navigateToLanding();
    }
  }
}

function updateDeadlineDate() {
  $('deadline-date').value = $('lunch-date').value;
}

function updateListNamePlaceholder() {
  const dateVal = $('lunch-date').value;
  if (!dateVal) return;
  const [y, m, d] = dateVal.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const name = `Almuerzo ${date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`;
  listName.placeholder = name.charAt(0).toUpperCase() + name.slice(1);
}

async function createList() {
  const name = listName.value.trim();
  const barId = listBar.value;
  const deadlineDateVal = $('deadline-date').value;
  const dHour = parseInt(deadlineHour.value) || 8;
  const dMinute = parseInt(deadlineMinute.value) || 30;
  const [dY, dM, dD] = deadlineDateVal.split('-').map(Number);
  const deadlineISO = new Date(dY, dM - 1, dD, dHour, dMinute, 0).toISOString();
  const lunchDate = $('lunch-date').value;
  const lunchHour = parseInt($('lunch-hour').value) || 10;
  const lunchMinute = parseInt($('lunch-minute').value) || 0;
  const reservationName = $('reservation-name').value.trim();
  const accessCode = $('access-code').value.trim();
  if (!reservationName) {
    toast('Escribe a nombre de quién va la reserva');
    $('reservation-name').focus();
    return;
  }

  try {
    const list = await api('/api/list', {
      method: 'POST',
      body: JSON.stringify({ name, barId, deadlineISO, lunchDate, lunchHour, lunchMinute, reservationName, accessCode }),
    });
    if (accessCode) storeCode(list.id, accessCode);
    listName.value = '';
    $('access-code').value = '';
    $('reservation-name').value = '';
    createForm.classList.add('hidden');
    toast('Lista creada');
    navigateToList(list.id);
  } catch (e) {
    toast(e.error || e.message);
  }
}

// --- Edit list ---
function openEditModal() {
  if (!currentList || !currentList.open) return;
  $('edit-name').value = currentList.name;
  $('edit-reservation').value = currentList.reservationName || '';
  $('edit-lunch-date').value = currentList.lunchDate;
  $('edit-lunch-hour').value = currentList.lunchHour;
  $('edit-lunch-minute').value = String(currentList.lunchMinute).padStart(2, '0');
  const deadline = new Date(currentList.deadline);
  $('edit-deadline-date').value = `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, '0')}-${String(deadline.getDate()).padStart(2, '0')}`;
  $('edit-deadline-hour').value = deadline.getHours();
  $('edit-deadline-minute').value = String(deadline.getMinutes()).padStart(2, '0');
  $('edit-modal').classList.remove('hidden');
}

async function saveEdit() {
  const name = $('edit-name').value.trim();
  const reservationName = $('edit-reservation').value.trim();
  if (!reservationName) {
    toast('Escribe a nombre de quién va la reserva');
    return;
  }
  const lunchDate = $('edit-lunch-date').value;
  const lunchHour = parseInt($('edit-lunch-hour').value) || 10;
  const lunchMinute = parseInt($('edit-lunch-minute').value) || 0;
  const dDate = $('edit-deadline-date').value;
  const dHour = parseInt($('edit-deadline-hour').value) || 8;
  const dMinute = parseInt($('edit-deadline-minute').value) || 30;
  const [dY, dM, dD] = dDate.split('-').map(Number);
  const deadlineISO = new Date(dY, dM - 1, dD, dHour, dMinute, 0).toISOString();

  try {
    currentList = await api(`/api/list/${currentList.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, reservationName, lunchDate, lunchHour, lunchMinute, deadlineISO }),
      headers: accessHeaders(),
    });
    $('edit-modal').classList.add('hidden');
    renderList();
    toast('Lista actualizada');
  } catch (e) {
    toast(e.error || e.message);
  }
}

async function deleteList() {
  if (!currentList) return;
  if (!await showConfirm('Eliminar lista', '¿Eliminar esta lista? Se perderán todos los datos.')) return;
  try {
    await api(`/api/list/${currentList.id}`, {
      method: 'DELETE',
      headers: accessHeaders(),
    });
    currentList = null;
    toast('Lista eliminada');
    navigateToLanding();
  } catch (e) {
    toast(e.error || e.message);
  }
}

// --- Entries ---
async function addEntry() {
  if (!currentList) return;
  const name = personName.value.trim();
  if (!name) {
    toast('Escribe tu nombre');
    personName.focus();
    return;
  }

  localStorage.setItem('almorzeitor-name', name);

  const body = { personName: name };
  if (selectedMenuItemId) {
    body.itemId = selectedMenuItemId;
  } else if (customItem.value.trim()) {
    body.customItem = customItem.value.trim();
  }

  try {
    currentList = await api(`/api/list/${currentList.id}/entry`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: accessHeaders(),
    });
    customItem.value = '';
    clearMenuSelection();
    renderList();
    toast('¡Apuntado!');
  } catch (e) {
    toast(e.error || e.message);
  }
}

async function removeEntry(name) {
  if (!currentList) return;
  if (!await showConfirm('Eliminar persona', `¿Eliminar a ${name} de la lista?`)) return;
  try {
    currentList = await api(`/api/list/${currentList.id}/entry/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: accessHeaders(),
    });
    renderList();
    toast('Eliminado');
  } catch (e) {
    toast(e.error || e.message);
  }
}

// --- WhatsApp ---
async function sendWhatsapp() {
  if (!currentList) return;
  try {
    const data = await api(`/api/list/${currentList.id}/whatsapp`, {
      headers: accessHeaders(),
    });
    window.location.href = data.whatsappDirect;
  } catch (e) {
    toast(e.error || e.message);
  }
}

async function copyToClipboard() {
  if (!currentList) return;
  try {
    const data = await api(`/api/list/${currentList.id}/whatsapp`, {
      headers: accessHeaders(),
    });
    await navigator.clipboard.writeText(data.message);
    toast('Copiado al portapapeles');
  } catch (e) {
    toast(e.error || e.message);
  }
}

// --- Share ---
function shareLink() {
  if (!currentList) return;
  const url = window.location.origin + '/lista/' + currentList.id;
  if (navigator.share) {
    navigator.share({ title: currentList.name, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => toast('Enlace copiado')).catch(() => toast('No se pudo copiar'));
  }
}

// --- Confirm modal ---
function showConfirm(title, message) {
  return new Promise(resolve => {
    $('confirm-title').textContent = title;
    $('confirm-message').textContent = message;
    const modal = $('confirm-modal');
    modal.classList.remove('hidden');
    const yes = $('btn-confirm-yes');
    const no = $('btn-confirm-no');
    function cleanup() {
      modal.classList.add('hidden');
      yes.replaceWith(yes.cloneNode(true));
      no.replaceWith(no.cloneNode(true));
    }
    yes.addEventListener('click', () => { cleanup(); resolve(true); });
    no.addEventListener('click', () => { cleanup(); resolve(false); });
  });
}

// --- Rendering ---
function showView(name) {
  viewLanding.classList.toggle('hidden', name !== 'landing');
  viewList.classList.toggle('hidden', name !== 'list');
}

function renderList() {
  showView('list');

  listTitle.textContent = currentList.name;
  listBarName.textContent = currentList.barName;
  listBarName.className = 'badge';
  listBarName.style.background = '#eee';

  const lunchDate = new Date(currentList.lunchDate + 'T00:00:00');
  const lunchTime = `${String(currentList.lunchHour).padStart(2, '0')}:${String(currentList.lunchMinute).padStart(2, '0')}`;
  listLunchInfo.textContent = `📅 ${lunchDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} a las ${lunchTime}`;
  listLunchInfo.className = 'badge';
  listLunchInfo.style.background = '#eee';

  if (currentList.reservationName) {
    listReservationName.textContent = `👤 ${currentList.reservationName}`;
    listReservationName.className = 'badge';
    listReservationName.style.background = '#eee';
    listReservationName.classList.remove('hidden');
  } else {
    listReservationName.classList.add('hidden');
  }

  const deadline = new Date(currentList.deadline);
  const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const lunchDateOnly = new Date(lunchDate.getFullYear(), lunchDate.getMonth(), lunchDate.getDate());
  let deadlineLabel;
  if (deadlineDate.getTime() === lunchDateOnly.getTime()) {
    deadlineLabel = deadline.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } else {
    deadlineLabel = `${deadline.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })} ${deadline.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  }
  listDeadline.textContent = `⏰ Límite: ${deadlineLabel}`;
  listDeadline.className = 'badge';
  listDeadline.style.background = '#eee';

  const open = currentList.open;
  listStatus.textContent = open ? '🟢 Abierta' : '🔴 Cerrada';
  listStatus.className = `badge ${open ? 'badge-open' : 'badge-closed'}`;

  entryForm.classList.toggle('hidden', !open);
  $('btn-edit').classList.toggle('hidden', !open);
  renderMenu();
  renderEntries();
}

function renderMenu() {
  const bar = appConfig.bars.find(b => b.id === currentList.barId);
  if (!bar) return;

  menuOptions.innerHTML = '';
  bar.menu.forEach(item => {
    const div = document.createElement('div');
    div.className = `menu-item${selectedMenuItemId === item.id ? ' selected' : ''}`;
    div.innerHTML = `
      <span class="menu-item-name">${item.name}</span>
      <span class="menu-item-desc">${item.description}</span>
    `;
    div.addEventListener('click', () => {
      if (selectedMenuItemId === item.id) {
        clearMenuSelection();
      } else {
        selectedMenuItemId = item.id;
        customItem.value = '';
      }
      renderMenu();
    });
    menuOptions.appendChild(div);
  });
}

function clearMenuSelection() {
  selectedMenuItemId = null;
}

function renderEntries() {
  const entries = currentList.entries || [];
  entryCount.textContent = entries.length;
  entriesEmpty.classList.toggle('hidden', entries.length > 0);

  const bar = appConfig.bars.find(b => b.id === currentList.barId);

  entriesList.innerHTML = '';
  entries.forEach(entry => {
    let itemText = 'Sin bocadillo';
    if (entry.itemId && bar) {
      const menuItem = bar.menu.find(m => m.id === entry.itemId);
      itemText = menuItem ? menuItem.name : entry.itemId;
    } else if (entry.customItem) {
      itemText = entry.customItem;
    }

    const row = document.createElement('div');
    row.className = 'entry-row';
    row.innerHTML = `
      <div class="entry-info">
        <span class="entry-person">${escapeHtml(entry.personName)}</span>
        <span class="entry-item"> → ${escapeHtml(itemText)}</span>
      </div>
      ${currentList.open ? `<button class="entry-delete" title="Eliminar">✕</button>` : ''}
    `;

    if (currentList.open) {
      row.querySelector('.entry-delete').addEventListener('click', () => removeEntry(entry.personName));
    }

    entriesList.appendChild(row);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// --- Toast ---
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2500);
}

// --- Start ---
init();
