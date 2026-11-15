import { ExerciseType } from '../exercises/models/exercise.model';
import { bodyweightSetText } from '../shared/bodyweight';
import { formatNumber, shortDate } from '../shared/format';

type Translator = (key: string, params?: Record<string, string | number>) => string;

/** Shape of GET /account/export (only the parts the CSV and PDF use). */
export interface AccountExport {
  exportedAt: string;
  profile: { email: string; firstName: string | null; lastName: string | null };
  templates: { name: string; exercises: { name: string; targetSets: number | null; targetReps: number | null }[] }[];
  workouts: {
    date: string;
    name: string;
    notes: string | null;
    exercises: {
      name: string;
      muscleGroup: string | null;
      type?: string;
      notes: string | null;
      sets: { reps: number; weightKg: number | null; warmUp: boolean }[];
    }[];
  }[];
}

const csvCell = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '""')}"`;

/**
 * One row per logged set, ready for Excel or Sheets. A workout or exercise
 * without sets still gets a row, so nothing silently goes missing.
 */
export function exportToCsv(data: AccountExport, t: Translator, locale: string): Blob {
  const header = [
    'csv.date',
    'csv.workout',
    'csv.workoutNotes',
    'csv.exercise',
    'csv.muscleGroup',
    'csv.set',
    'csv.reps',
    'csv.weightKg',
    'csv.warmUp',
    'csv.exerciseNotes',
  ].map((k) => t(k));
  const rows: unknown[][] = [];
  for (const w of data.workouts) {
    const base = [w.date, w.name, w.notes];
    if (!w.exercises.length) rows.push([...base, '', '', '', '', '', '', '']);
    for (const e of w.exercises) {
      const ex = [e.name, e.muscleGroup];
      if (!e.sets.length) rows.push([...base, ...ex, '', '', '', '', e.notes]);
      e.sets.forEach((s, i) =>
        rows.push([
          ...base,
          ...ex,
          i + 1,
          s.reps,
          s.weightKg ?? '',
          s.warmUp ? t('csv.yes') : '',
          e.notes,
        ]),
      );
    }
  }
  // Excel follows the system's list separator: Dutch Excel expects ";" and a
  // decimal comma, so match the user's language and it opens in columns.
  const sep = locale === 'nl' ? ';' : ',';
  const cell = (v: unknown) => csvCell(typeof v === 'number' ? formatNumber(v, locale) : v);
  const text = [header, ...rows].map((r) => r.map(cell).join(sep)).join('\r\n');
  // The BOM makes Excel read the file as UTF-8 (otherwise "e" with accents breaks).
  return new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
}

/** A readable training log: header with totals, then every workout with its sets. */
export async function exportToPdf(
  data: AccountExport,
  t: Translator,
  locale: string,
): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const name =
    [data.profile.firstName, data.profile.lastName].filter(Boolean).join(' ') || data.profile.email;
  const exported = shortDate(data.exportedAt.slice(0, 10), locale, true);
  const setCount = data.workouts.reduce(
    (n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length, 0),
    0,
  );

  doc.setFont('helvetica', 'bold').setFontSize(20).text(t('pdf.title'), margin, 56);
  doc
    .setFont('helvetica', 'normal')
    .setFontSize(10)
    .setTextColor(100)
    .text(`${name}  |  ${t('pdf.exported', { date: exported })}`, margin, 74)
    .text(
      t('pdf.totals', { workouts: data.workouts.length, sets: setCount }),
      margin,
      88,
    );
  doc.setTextColor(0);

  const setText = (e: AccountExport['workouts'][number]['exercises'][number], s: { reps: number; weightKg: number | null; warmUp: boolean }) => {
    const main =
      e.type === ExerciseType.BODYWEIGHT || s.weightKg == null
        ? bodyweightSetText(s.reps, s.weightKg ?? 0, t, locale)
        : `${formatNumber(s.reps, locale)} x ${formatNumber(s.weightKg, locale)} ${t('unit.kg')}`;
    return s.warmUp ? `${main} (${t('pdf.warmUp')})` : main;
  };

  let y = 112;
  // Newest first: that is what you look for in a training log.
  for (const w of [...data.workouts].reverse()) {
    if (y > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      y = 56;
    }
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(13)
      .text(`${shortDate(w.date, locale, true)}  ${w.name}`, margin, y);
    y += 6;
    if (w.notes) {
      const lines = doc.setFont('helvetica', 'italic').setFontSize(9).splitTextToSize(w.notes, 515);
      doc.text(lines, margin, y + 10);
      y += 10 + lines.length * 11;
    }
    autoTable(doc, {
      startY: y + 4,
      margin: { left: margin, right: margin },
      head: [[t('pdf.exercise'), t('pdf.sets')]],
      body: w.exercises.map((e) => [
        [e.name, e.notes].filter(Boolean).join('\n'),
        e.sets.length
          ? e.sets.map((s) => setText(e, s)).join('\n')
          : t('pdf.noSets'),
      ]),
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [40, 40, 48] },
      columnStyles: { 0: { cellWidth: 200 } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  }
  if (!data.workouts.length) {
    doc.setFont('helvetica', 'normal').setFontSize(11).text(t('pdf.empty'), margin, y);
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i).setFontSize(8).setTextColor(130);
    doc.text(`${i} / ${pages}`, doc.internal.pageSize.getWidth() - margin, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }
  return doc.output('blob');
}
