const dateFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' });

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFmt.format(date);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateTimeFmt.format(date);
}

export function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return timeFmt.format(date);
}

export function relativeTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  return `${Math.round(months / 12)} yr ago`;
}

export function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function addDaysISO(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  const start = new Date(a);
  const end = new Date(b);
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-PH').format(Number(value) || 0);
}

export function initialsOf(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function isOverdue(expectedReturnDate, status) {
  if (status === 'Returned') return false;
  return new Date(expectedReturnDate).getTime() < Date.now();
}

const DATE_KEYS = new Set([
  'date',
  'dateAdded',
  'lastUpdated',
  'dateBorrowed',
  'expectedReturnDate',
  'actualReturnDate',
  'createdAt',
]);

function cellValue(value, key) {
  if (value === null || value === undefined) return '';
  if (key === 'recordedBy' || key === 'returnedBy') return value?.name || '';
  if (DATE_KEYS.has(key)) return formatDate(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvField(value) {
  let text = String(value ?? '');
  // Prevent spreadsheet software from evaluating untrusted report values as formulas.
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportCSV(filename, columns, rows) {
  const header = columns.map((column) => csvField(column.label)).join(',');
  const body = rows.map((row) =>
    columns
      .map((column) => csvField(cellValue(row[column.key], column.key)))
      .join(',')
  );
  const csv = [header, ...body].join('\r\n');
  downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }), filename);
}

export async function exportPDF({ filename, title, subtitle, columns, rows, summary = [], orientation = 'landscape' }) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('School Inventory Management System', 40, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Cavite State University — Don Severino de las Alas Campus · College of Engineering and Information Technology', 40, 52);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title, 40, 76);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(subtitle, 40, 89);

  const head = [columns.map((column) => column.label)];
  const body = rows.map((row) => columns.map((column) => cellValue(row[column.key], column.key)));

  autoTable(doc, {
    head,
    body,
    startY: 100,
    margin: { left: 40, right: 40 },
    styles: { fontSize: 7.5, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    didDrawPage: () => {
      doc.setFontSize(7.5);
      doc.setTextColor(120);
      doc.text('Generated by the School Inventory Management System', 40, doc.internal.pageSize.height - 22);
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, doc.internal.pageSize.width - 70, doc.internal.pageSize.height - 22);
    },
  });

  if (summary.length) {
    const pageHeight = doc.internal.pageSize.height;
    let y = (doc.lastAutoTable?.finalY || 120) + 18;
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 60;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Summary', 40, y);
    doc.setFont('helvetica', 'normal');
    summary.forEach((item, index) => {
      doc.text(`${item.label}: ${item.value}`, 40 + (index % 3) * 190, y + 14 + Math.floor(index / 3) * 13);
    });
  }

  doc.save(filename);
}
