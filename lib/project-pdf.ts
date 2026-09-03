import { format, parseISO } from 'date-fns';
import type { RowInput } from 'jspdf-autotable';

type ProjectPdfNote = {
  text: string;
  createdAt: string;
  authorName: string;
};

type ProjectPdfImage = {
  url: string;
};

type ProjectPdfData = {
  project: {
    name: string;
    notes: ProjectPdfNote[];
    images: ProjectPdfImage[];
  };
  client?: {
    name: string;
    contactPerson?: string;
    phone?: string;
    address?: string;
  };
  members: Array<{ user: { name: string } }>;
  materials: Array<{ name: string; quantity: string; categoryId: string | null; categoryName: string | null }>;
  assignments: Array<{
    userId: string;
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    details?: string;
  }>;
  userNames: Map<string, string>;
  createdBy?: string;
};

type PdfWithTablePosition = {
  lastAutoTable?: { finalY: number };
};

async function fetchDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Datei konnte nicht geladen werden (${response.status}).`);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function loadPrintableImage(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Bild konnte nicht geladen werden (${response.status}).`);
  const objectUrl = URL.createObjectURL(await response.blob());
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Bild konnte nicht dekodiert werden.'));
    image.src = objectUrl;
  });
  const scale = Math.min(1, 1600 / Math.max(source.naturalWidth, source.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Bild konnte nicht verarbeitet werden.');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(objectUrl);
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.86),
    width: canvas.width,
    height: canvas.height,
  };
}

function displayDate(value: string) {
  return format(parseISO(value), 'dd.MM.yyyy');
}

function displayTime(value?: string) {
  return value?.substring(0, 5) || '';
}

function buildMaterialRows(materials: ProjectPdfData['materials']): RowInput[] {
  if (materials.length === 0) return [['Kein Material erfasst', '']];

  const grouped = new Map<string, ProjectPdfData['materials']>();
  materials.forEach(material => {
    const category = material.categoryName || 'Ohne Kategorie';
    grouped.set(category, [...(grouped.get(category) || []), material]);
  });

  return [...grouped.entries()]
    .sort(([left], [right]) => {
      if (left === 'Ohne Kategorie') return 1;
      if (right === 'Ohne Kategorie') return -1;
      return left.localeCompare(right, 'de');
    })
    .flatMap(([category, entries]) => [
      [{ content: category, colSpan: 2, styles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' } }],
      ...entries.map(material => [material.name, material.quantity]),
    ]);
}

export async function exportProjectPdf(data: ProjectPdfData) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  let skippedImages = 0;

  try {
    const logo = await fetchDataUrl('/logo_neu.png');
    pdf.addImage(logo, 'PNG', pageWidth - 57, 10, 43, 19, undefined, 'FAST');
  } catch {
    // Der Export bleibt auch dann nutzbar, wenn das Logo kurzfristig nicht geladen werden kann.
  }

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(21);
  pdf.text('Auftrag', margin, 18);
  pdf.setFontSize(15);
  pdf.text(data.project.name, margin, 27, { maxWidth: 125 });
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Erstellt am: ${format(new Date(), 'dd.MM.yyyy HH:mm')} Uhr`, margin, 35);
  if (data.createdBy) pdf.text(`Erstellt von: ${data.createdBy}`, margin, 40);

  autoTable(pdf, {
    startY: data.createdBy ? 47 : 42,
    body: [
      ['Kunde', data.client?.name || 'Nicht hinterlegt'],
      ['Ansprechpartner', data.client?.contactPerson || 'Nicht hinterlegt'],
      ['Telefon', data.client?.phone || 'Nicht hinterlegt'],
      ['Adresse', data.client?.address || 'Nicht hinterlegt'],
    ],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 3, textColor: [51, 65, 85], overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold', fillColor: [239, 246, 255] } },
    margin: { left: margin, right: margin },
  });

  let cursorY = ((pdf as unknown as PdfWithTablePosition).lastAutoTable?.finalY || 75) + 10;
  const sectionTitle = (title: string) => {
    if (cursorY > pageHeight - 25) {
      pdf.addPage();
      cursorY = 18;
    }
    pdf.setFontSize(13);
    pdf.setTextColor(15, 23, 42);
    pdf.text(title, margin, cursorY);
    cursorY += 4;
  };
  const updateCursorAfterTable = () => {
    cursorY = ((pdf as unknown as PdfWithTablePosition).lastAutoTable?.finalY || cursorY) + 10;
  };

  sectionTitle('Zugewiesene Mitarbeiter');
  autoTable(pdf, {
    startY: cursorY,
    head: [['Name']],
    body: data.members.length ? data.members.map(member => [member.user.name]) : [['Keine Mitarbeiter zugewiesen']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5, textColor: [51, 65, 85] },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    margin: { left: margin, right: margin },
  });
  updateCursorAfterTable();

  sectionTitle('Einsatzplanung');
  autoTable(pdf, {
    startY: cursorY,
    head: [['Mitarbeiter', 'Zeitraum', 'Uhrzeit', 'Details']],
    body: data.assignments.length
      ? data.assignments.map(assignment => [
          data.userNames.get(assignment.userId) || 'Unbekannter Mitarbeiter',
          assignment.startDate === assignment.endDate
            ? displayDate(assignment.startDate)
            : `${displayDate(assignment.startDate)} bis ${displayDate(assignment.endDate)}`,
          assignment.startTime || assignment.endTime
            ? `${displayTime(assignment.startTime) || '-'} bis ${displayTime(assignment.endTime) || '-'}`
            : 'Ganztägig',
          assignment.details || '-',
        ])
      : [['Keine Einsätze geplant', '', '', '']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.3, textColor: [51, 65, 85], overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 42 }, 2: { cellWidth: 30 } },
    margin: { left: margin, right: margin },
  });
  updateCursorAfterTable();

  sectionTitle('Materialliste');
  autoTable(pdf, {
    startY: cursorY,
    head: [['Bezeichnung', 'Anzahl / Menge']],
    body: buildMaterialRows(data.materials),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5, textColor: [51, 65, 85], overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    columnStyles: { 1: { cellWidth: 55 } },
    margin: { left: margin, right: margin },
  });
  updateCursorAfterTable();

  sectionTitle('Auftrags-Dokumentation');
  autoTable(pdf, {
    startY: cursorY,
    head: [['Datum', 'Verfasser', 'Eintrag']],
    body: data.project.notes.length
      ? data.project.notes.map(note => [
          format(parseISO(note.createdAt), 'dd.MM.yyyy HH:mm'),
          note.authorName,
          note.text,
        ])
      : [['', '', 'Keine Notizen erfasst']],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5, textColor: [51, 65, 85], overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 38 } },
    margin: { left: margin, right: margin, bottom: 17 },
  });

  if (data.project.images.length) {
    pdf.addPage();
    cursorY = 18;
    sectionTitle(`Bilddokumentation (${data.project.images.length})`);
    cursorY += 4;

    for (let index = 0; index < data.project.images.length; index += 1) {
      try {
        const image = await loadPrintableImage(data.project.images[index].url);
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = 103;
        const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
        const width = image.width * ratio;
        const height = image.height * ratio;
        if (cursorY + height + 12 > pageHeight - 15) {
          pdf.addPage();
          cursorY = 18;
        }
        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105);
        pdf.text(`Auftragsbild ${index + 1}`, margin, cursorY);
        cursorY += 4;
        pdf.addImage(image.dataUrl, 'JPEG', margin, cursorY, width, height, undefined, 'FAST');
        cursorY += height + 9;
      } catch {
        skippedImages += 1;
      }
    }
  }

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text('Elektro Loidl', margin, pageHeight - 7);
    pdf.text(`Seite ${page} von ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  const safeName = data.project.name
    .normalize('NFKD')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'auftrag';
  pdf.save(`auftrag-${safeName}.pdf`);
  return { skippedImages };
}
