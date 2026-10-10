const express = require('express');
const path = require('path');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Data store (in-memory) ---
const lists = new Map();

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

function getBar(barId) {
  return config.bars.find(b => b.id === barId);
}

function isListOpen(list) {
  return new Date() < new Date(list.deadline);
}

function publicListSummary(list) {
  return {
    id: list.id,
    name: list.name,
    barName: list.barName,
    lunchDate: list.lunchDate,
    lunchHour: list.lunchHour,
    lunchMinute: list.lunchMinute,
    deadline: list.deadline,
    reservationName: list.reservationName || '',
    hasCode: !!list.accessCode,
    entryCount: list.entries.length,
    open: isListOpen(list),
  };
}

function checkAccessCode(list, req) {
  if (!list.accessCode) return true;
  const code = req.headers['x-access-code'] || '';
  return code === list.accessCode;
}

// Auto-cleanup: remove lists 2h after lunch date/time
setInterval(() => {
  const now = Date.now();
  for (const [id, list] of lists) {
    const lunchDateTime = new Date(list.lunchDate + 'T00:00:00');
    lunchDateTime.setHours(list.lunchHour, list.lunchMinute, 0, 0);
    const expiry = lunchDateTime.getTime() + 2 * 60 * 60 * 1000;
    if (now > expiry) {
      lists.delete(id);
    }
  }
}, 60 * 1000);

// --- API ---

app.get('/api/config', (_req, res) => {
  res.json({
    bars: config.bars.map(b => ({ id: b.id, name: b.name, menu: b.menu })),
    defaultBarId: config.defaultBarId,
    defaultDeadlineHour: config.defaultDeadlineHour,
    defaultDeadlineMinute: config.defaultDeadlineMinute,
  });
});

// All active lists (public summaries)
app.get('/api/lists', (_req, res) => {
  const result = [];
  for (const list of lists.values()) {
    result.push(publicListSummary(list));
  }
  result.sort((a, b) => {
    const da = new Date(a.lunchDate + 'T00:00:00');
    const db = new Date(b.lunchDate + 'T00:00:00');
    return da - db;
  });
  res.json(result);
});

// Get list by ID (requires access code if protected)
app.get('/api/list/:id', (req, res) => {
  const list = lists.get(req.params.id);
  if (!list) return res.status(404).json({ error: 'Lista no encontrada' });
  if (!checkAccessCode(list, req)) {
    return res.status(403).json({ error: 'Código incorrecto', needsCode: true });
  }
  res.json({ ...list, open: isListOpen(list), hasCode: !!list.accessCode });
});

// Verify access code
app.post('/api/list/:id/access', (req, res) => {
  const list = lists.get(req.params.id);
  if (!list) return res.status(404).json({ error: 'Lista no encontrada' });
  const { code } = req.body;
  if (list.accessCode && code !== list.accessCode) {
    return res.status(403).json({ error: 'Código incorrecto' });
  }
  res.json({ ok: true });
});

// Create new list
app.post('/api/list', (req, res) => {
  const { name, barId, deadlineISO, lunchDate, lunchHour, lunchMinute, reservationName, accessCode } = req.body;
  const bar = getBar(barId || config.defaultBarId);
  if (!bar) return res.status(400).json({ error: 'Bar no encontrado' });

  const now = new Date();
  const deadline = deadlineISO ? new Date(deadlineISO) : new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const id = generateId();
  const list = {
    id,
    name: name || (() => {
      const ld = lunchDate ? new Date(lunchDate + 'T00:00:00') : now;
      return `Almuerzo ${ld.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`;
    })(),
    barId: bar.id,
    barName: bar.name,
    barPhone: bar.phone,
    deadline: deadline.toISOString(),
    lunchDate: lunchDate || now.toISOString().split('T')[0],
    lunchHour: lunchHour ?? 10,
    lunchMinute: lunchMinute ?? 0,
    reservationName: reservationName || '',
    accessCode: accessCode || null,
    entries: [],
    createdAt: Date.now(),
  };

  lists.set(id, list);
  res.status(201).json({ ...list, open: isListOpen(list), hasCode: !!list.accessCode });
});

// Update list
app.put('/api/list/:id', (req, res) => {
  const list = lists.get(req.params.id);
  if (!list) return res.status(404).json({ error: 'Lista no encontrada' });
  if (!checkAccessCode(list, req)) {
    return res.status(403).json({ error: 'Código incorrecto', needsCode: true });
  }
  if (!isListOpen(list)) return res.status(403).json({ error: 'La lista está cerrada' });

  const { name, reservationName, lunchDate, lunchHour, lunchMinute, deadlineISO } = req.body;
  if (name !== undefined) list.name = name;
  if (reservationName !== undefined) list.reservationName = reservationName;
  if (lunchDate !== undefined) list.lunchDate = lunchDate;
  if (lunchHour !== undefined) list.lunchHour = lunchHour;
  if (lunchMinute !== undefined) list.lunchMinute = lunchMinute;
  if (deadlineISO !== undefined) list.deadline = new Date(deadlineISO).toISOString();

  res.json({ ...list, open: isListOpen(list), hasCode: !!list.accessCode });
});

// Delete list
app.delete('/api/list/:id', (req, res) => {
  const list = lists.get(req.params.id);
  if (!list) return res.status(404).json({ error: 'Lista no encontrada' });
  if (!checkAccessCode(list, req)) {
    return res.status(403).json({ error: 'Código incorrecto', needsCode: true });
  }
  lists.delete(req.params.id);
  res.json({ ok: true });
});

// Add/update entry
app.post('/api/list/:id/entry', (req, res) => {
  const list = lists.get(req.params.id);
  if (!list) return res.status(404).json({ error: 'Lista no encontrada' });
  if (!checkAccessCode(list, req)) {
    return res.status(403).json({ error: 'Código incorrecto', needsCode: true });
  }
  if (!isListOpen(list)) return res.status(403).json({ error: 'La lista está cerrada' });

  const { personName, itemId, customItem } = req.body;
  if (!personName || !personName.trim()) return res.status(400).json({ error: 'Nombre requerido' });

  const existing = list.entries.findIndex(e => e.personName.toLowerCase() === personName.trim().toLowerCase());
  const entry = {
    personName: personName.trim(),
    itemId: itemId || null,
    customItem: customItem || null,
  };

  if (existing >= 0) {
    list.entries[existing] = entry;
  } else {
    list.entries.push(entry);
  }

  res.json({ ...list, open: isListOpen(list), hasCode: !!list.accessCode });
});

// Remove entry
app.delete('/api/list/:id/entry/:personName', (req, res) => {
  const list = lists.get(req.params.id);
  if (!list) return res.status(404).json({ error: 'Lista no encontrada' });
  if (!checkAccessCode(list, req)) {
    return res.status(403).json({ error: 'Código incorrecto', needsCode: true });
  }
  if (!isListOpen(list)) return res.status(403).json({ error: 'La lista está cerrada' });

  const name = decodeURIComponent(req.params.personName);
  list.entries = list.entries.filter(e => e.personName.toLowerCase() !== name.toLowerCase());
  res.json({ ...list, open: isListOpen(list), hasCode: !!list.accessCode });
});

// Generate WhatsApp message
app.get('/api/list/:id/whatsapp', (req, res) => {
  const list = lists.get(req.params.id);
  if (!list) return res.status(404).json({ error: 'Lista no encontrada' });
  if (!checkAccessCode(list, req)) {
    return res.status(403).json({ error: 'Código incorrecto', needsCode: true });
  }

  const bar = getBar(list.barId);
  const totalPeople = list.entries.length;

  const lunchDate = new Date(list.lunchDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((lunchDate - today) / (1000 * 60 * 60 * 24));
  let dayLabel;
  if (diffDays === 0) dayLabel = 'hoy';
  else if (diffDays === 1) dayLabel = 'mañana';
  else dayLabel = `el ${lunchDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}`;

  const lunchTime = `${String(list.lunchHour).padStart(2, '0')}:${String(list.lunchMinute).padStart(2, '0')}`;
  const nameClause = list.reservationName ? ` a nombre de ${list.reservationName}` : '';

  const peopleLabel = totalPeople === 1 ? '1 persona' : `${totalPeople} personas`;
  const lines = [`Hola! Quiero hacer una reserva para ${peopleLabel}${nameClause} para ${dayLabel} a las ${lunchTime}h.`, ''];

  const allItems = {};

  for (const entry of list.entries) {
    if (entry.itemId) {
      const menuItem = bar.menu.find(m => m.id === entry.itemId);
      const label = menuItem ? menuItem.name.replace(/^\d+\.\s*/, '') : entry.itemId;
      allItems[label] = (allItems[label] || 0) + 1;
    } else if (entry.customItem) {
      allItems[entry.customItem] = (allItems[entry.customItem] || 0) + 1;
    }
  }

  for (const [item, count] of Object.entries(allItems)) {
    lines.push(`${count}x ${item}`);
  }

  lines.push('', 'Gracias!');

  const message = lines.join('\n');
  const whatsappUrl = `https://wa.me/${list.barPhone}?text=${encodeURIComponent(message)}`;
  const whatsappDirect = `whatsapp://send?phone=${list.barPhone}&text=${encodeURIComponent(message)}`;

  res.json({ message, whatsappUrl, whatsappDirect });
});

// SPA routing: serve index.html for /lista/:id
app.get('/lista/:id', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Almorzeitor running on http://localhost:${PORT}`);
});
