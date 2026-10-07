const API = '';
let appConfig = null;
let currentList = null;
let selectedMenuItemId = null;
let pollInterval = null;

// --- DOM refs ---
const $ = id => document.getElementById(id);
const viewNoList = $('view-no-list');
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

// --- Init ---
async function init() {
  appConfig = await api('/api/config');
  deadlineHour.value = appConfig.defaultDeadlineHour;
  deadlineMinute.value = String(appConfig.defaultDeadlineMinute).padStart(2, '0');

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];
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

  btnShowCreate.addEventListener('click', () => {
    createForm.classList.toggle('hidden');
  });
  btnCancelCreate.addEventListener('click', () => {
    createForm.classList.add('hidden');
  });
  btnCreateList.addEventListener('click', createList);
  btnAddEntry.addEventListener('click', addEntry);
  btnWhatsapp.addEventListener('click', sendWhatsapp);
  btnCopy.addEventListener('click', copyToClipboard);
  btnDeleteList.addEventListener('click', deleteList);

  customItem.addEventListener('input', () => {
    if (customItem.value.trim()) {
      clearMenuSelection();
    }
  });

  await loadActiveList();
  startPolling();
}

// --- API helper ---
async function api(url, options = {}) {
  const res = await fetch(API + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error de red' }));
    throw new Error(err.error || 'Error');
  }
  return res.json();
}

// --- Polling ---
function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(loadActiveList, 10000);
}

// --- List management ---
async function loadActiveList() {
  try {
    const list = await api('/api/list/active');
    if (list) {
      const changed = !currentList
        || currentList.id !== list.id
        || currentList.entries.length !== list.entries.length
        || JSON.stringify(currentList.entries) !== JSON.stringify(list.entries)
        || currentList.open !== list.open;
      currentList = list;
      if (changed) renderList();
      else showView('list');
    } else {
      currentList = null;
      showView('no-list');
    }
  } catch {
    // silent
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
  const hour = parseInt(deadlineHour.value) || 9;
  const minute = parseInt(deadlineMinute.value) || 0;
  const lunchDate = $('lunch-date').value;
  const lunchHour = parseInt($('lunch-hour').value) || 10;
  const lunchMinute = parseInt($('lunch-minute').value) || 0;
  const reservationName = $('reservation-name').value.trim();
  if (!reservationName) {
    toast('Escribe a nombre de quién va la reserva');
    $('reservation-name').focus();
    return;
  }

  try {
    currentList = await api('/api/list', {
      method: 'POST',
      body: JSON.stringify({ name, barId, deadlineDate: deadlineDateVal, deadlineHour: hour, deadlineMinute: minute, lunchDate, lunchHour, lunchMinute, reservationName }),
    });
    listName.value = '';
    createForm.classList.add('hidden');
    renderList();
    toast('Lista creada');
  } catch (e) {
    toast(e.message);
  }
}

async function deleteList() {
  if (!currentList) return;
  if (!confirm('¿Cerrar esta lista? Se perderán los datos.')) return;
  try {
    await api(`/api/list/${currentList.id}`, { method: 'DELETE' });
    currentList = null;
    showView('no-list');
    toast('Lista eliminada');
  } catch (e) {
    toast(e.message);
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
    });
    customItem.value = '';
    clearMenuSelection();
    renderList();
    toast('¡Apuntado!');
  } catch (e) {
    toast(e.message);
  }
}

async function removeEntry(name) {
  if (!currentList) return;
  try {
    currentList = await api(`/api/list/${currentList.id}/entry/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
    renderList();
    toast('Eliminado');
  } catch (e) {
    toast(e.message);
  }
}

// --- WhatsApp ---
async function sendWhatsapp() {
  if (!currentList) return;
  try {
    const data = await api(`/api/list/${currentList.id}/whatsapp`);
    window.location.href = data.whatsappDirect;
  } catch (e) {
    toast(e.message);
  }
}

async function copyToClipboard() {
  if (!currentList) return;
  try {
    const data = await api(`/api/list/${currentList.id}/whatsapp`);
    await navigator.clipboard.writeText(data.message);
    toast('Copiado al portapapeles');
  } catch (e) {
    toast(e.message);
  }
}

// --- Rendering ---
function showView(name) {
  viewNoList.classList.toggle('hidden', name !== 'no-list');
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
