// Export the requests table: a CSV file for Excel / Google Sheets, or a printable sheet.
import { esc, formatDate, shortId } from './ui.js';

const COLUMNS = [
  ['Ref', (r) => shortId(r.id)],
  ['Issue type', (r) => r.issue_type],
  ['Category', (r) => r.category || ''],
  ['Description', (r) => r.description],
  ['Resident', (r) => r.resident_name],
  ['Resident email', (r) => r.resident_email || ''],
  ['Address', (r) => r.address || ''],
  ['Latitude', (r) => r.latitude],
  ['Longitude', (r) => r.longitude],
  ['Status', (r) => r.status],
  ['Assigned to', (r) => r.assigned_staff_name || ''],
  ['Department', (r) => r.assigned_department_name || ''],
  ['Rating', (r) => r.rating ?? ''],
  ['Feedback', (r) => r.feedback || ''],
  ['Submitted', (r) => r.created_at || ''],
  ['Resolved', (r) => r.resolved_at || ''],
];

// A cell that starts with = + - @ would be run as a formula by Excel, so it gets a leading apostrophe.
function cell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportCsv(rows) {
  const lines = [COLUMNS.map(([name]) => cell(name)).join(',')];
  for (const r of rows) lines.push(COLUMNS.map(([, get]) => cell(get(r))).join(','));
  // The byte order mark makes Excel read the file as UTF-8 (names with ñ, é, ...).
  const blob = new Blob([`﻿${lines.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `service-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const PRINT_COLUMNS = [
  ['Ref', (r) => shortId(r.id)],
  ['Issue', (r) => r.issue_type + (r.category ? ` (${r.category})` : '')],
  ['Resident', (r) => r.resident_name],
  ['Address', (r) => r.address || `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`],
  ['Status', (r) => r.status],
  ['Assigned to', (r) => r.assigned_staff_name || '—'],
  ['Rating', (r) => (r.rating ? `${r.rating}/5` : '—')],
  ['Submitted', (r) => formatDate(r.created_at)],
];

/** Prints every row (not just the visible page) as a plain table; the rest of the page is hidden while printing. */
export function printRows(rows, summary = '') {
  document.getElementById('print-sheet')?.remove();
  const sheet = document.createElement('div');
  sheet.id = 'print-sheet';
  sheet.innerHTML = `<h1>LOCAL COMMUNITY SERVICES: Service requests</h1>
    <p>${esc(summary)} ${rows.length} request${rows.length === 1 ? '' : 's'} · printed ${esc(formatDate(new Date().toISOString()))}</p>
    <table><thead><tr>${PRINT_COLUMNS.map(([name]) => `<th>${esc(name)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${PRINT_COLUMNS.map(([, get]) => `<td>${esc(get(r))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  document.body.append(sheet);
  const cleanup = () => sheet.remove();
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
}
