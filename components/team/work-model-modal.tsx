'use client';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { formatHours, workTimeApi, type HolidayProfile, type WorkModel, type WorkModelPreview } from '@/lib/work-time-api';

const weekdays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const labels: Record<string,string> = { vacation: 'Urlaub', comp_time: 'Zeitausgleich', sick: 'Krankheit' };
export function WorkModelModal({ user, model, onClose }: { user: { id: string; name: string }; model?: WorkModel; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const [hours, setHours] = useState(() => (model?.daily_minutes || [510,510,510,510,300,0,0]).map(minutes => String(minutes / 60).replace('.', ',')));
  const [region, setRegion] = useState<HolidayProfile | ''>(model?.holiday_profile || '');
  const [preview, setPreview] = useState<WorkModelPreview | null>(null);
  const [inputError, setInputError] = useState('');
  const values = hours.map(value => value.trim() === '' ? NaN : Number(value.replace(',', '.')));
  const minutes = values.map(value => Math.round(value * 60));
  const valid = values.every(value => Number.isFinite(value) && value >= 0 && value <= 24 && Math.abs(value * 60 - Math.round(value * 60)) < 0.001);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  const previewMutation = useMutation({ mutationFn: () => workTimeApi.preview(user.id, minutes, region as HolidayProfile), onSuccess: setPreview });
  const saveMutation = useMutation({
    mutationFn: () => workTimeApi.save(user.id, minutes, region as HolidayProfile, preview!.token),
    onSuccess: async () => {
      await Promise.all(['workModels','workBalances','users','currentUser','absences'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
      toast.success('Wochenmodell gespeichert und Konten aktualisiert'); onClose();
    }, onError: () => setPreview(null),
  });
  const pending = previewMutation.isPending || saveMutation.isPending;
  const resetPreview = () => { setPreview(null); setInputError(''); previewMutation.reset(); saveMutation.reset(); };
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!pending) onClose(); }} aria-labelledby="work-model-title" className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50">
    <div className="flex justify-between gap-4 border-b border-slate-200 p-6"><div><h2 id="work-model-title" className="text-lg font-bold">Arbeitszeitmodell</h2><p className="mt-1 text-sm text-slate-500">{user.name}</p></div><button type="button" onClick={onClose} disabled={pending} aria-label="Schließen" className="px-3 text-xl disabled:opacity-50">×</button></div>
    <form className="space-y-5 p-6" onSubmit={event => { event.preventDefault(); if (!valid || !region) { setInputError('Bitte je Tag 0 bis 24 Stunden minutengenau und ein Feiertagsprofil angeben.'); return; } setInputError(''); previewMutation.mutate(); }}>
      <p className="text-sm text-slate-600">{model?.daily_minutes ? 'Wochenmodell ändern' : 'Auf ein individuelles Wochenmodell umstellen'}. Die Änderung gilt ab dem ersten Tag des laufenden Monats. Ältere Monate bleiben unverändert.</p>
      {!model?.daily_minutes && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Aktuell: {formatHours(Number(model?.monthly_hours ?? 160))} h/Monat. Die vorgeschlagenen 39 Wochenstunden werden erst nach Vorschau und Bestätigung übernommen.</p>}
      <fieldset disabled={pending} className="grid grid-cols-2 gap-3 sm:grid-cols-4"><legend className="mb-3 text-sm font-semibold">Sollstunden je Wochentag</legend>
        {weekdays.map((day,index) => <label key={day} className="block text-sm text-slate-700">{day}<input required inputMode="decimal" value={hours[index]} onChange={event => { setHours(hours.map((value,i) => i === index ? event.target.value : value)); resetPreview(); }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>)}
      </fieldset>
      <p className="text-sm font-semibold">Wochensumme: {valid ? `${formatHours(minutes.reduce((sum,value) => sum + value,0) / 60)} h` : 'Bitte Eingaben prüfen'}</p>
      <label className="block text-sm font-semibold">Feiertagsprofil am Arbeitsort<select required disabled={pending} value={region} onChange={event => { setRegion(event.target.value as HolidayProfile); resetPreview(); }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal">
        <option value="" disabled>Bitte auswählen</option><option value="BY">Bayern – landesweite Feiertage</option><option value="BY_MARIA">Bayern – einschließlich Mariä Himmelfahrt</option><option value="BY_AUGSBURG">Stadt Augsburg – einschließlich Friedensfest und Mariä Himmelfahrt</option>
      </select></label>
      <p className="text-xs text-slate-500">Mariä Himmelfahrt gilt nicht in jeder Gemeinde. <a className="underline" href="https://www.statistik.bayern.de/statistik/gebiet_bevoelkerung/zensus/himmelfahrt/index.php" target="_blank" rel="noreferrer">Gemeinde amtlich prüfen</a>. Das Friedensfest gilt nur in der Stadt Augsburg. Feiertage und Tage mit 0 Stunden verbrauchen keinen Urlaub oder Zeitausgleich.</p>
      {(inputError || previewMutation.error || saveMutation.error) && <p role="alert" className="text-sm text-red-600">{inputError || previewMutation.error?.message || saveMutation.error?.message}</p>}
      {preview && <section aria-label="Vorschau der Kontenkorrektur" className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <h3 className="font-bold">Vorschau ab {format(parseISO(preview.effective_from), 'dd.MM.yyyy')}</h3>
        <p>Monatssoll: {formatHours(preview.before.month_target_hours)} → <strong>{formatHours(preview.after.month_target_hours)} h</strong></p>
        <p>Überstundenkonto: {formatHours(preview.before.balance_hours)} → <strong>{formatHours(preview.after.balance_hours)} h</strong></p>
        <p>Urlaubskorrektur: {preview.vacation_refund_days >= 0 ? '+' : ''}{preview.vacation_refund_days} verfügbare Tage</p>
        <ul className="space-y-2">{preview.absence_changes.map(change => <li key={change.id} className="border-t border-slate-200 pt-2">{labels[change.type]} · {format(parseISO(change.start_date),'dd.MM.yyyy')}–{format(parseISO(change.end_date),'dd.MM.yyyy')}
          {change.type === 'comp_time' && <p>Abzug: {formatHours(change.old_hours)} → {formatHours(change.new_hours)} h</p>}{change.type === 'vacation' && <p>Urlaubstage: {change.old_days} → {change.new_days}</p>}
        </li>)}</ul>
        <p className="text-xs text-slate-500">Modell und Korrekturen werden gemeinsam gespeichert. Bereits abgezogene Stunden werden nicht doppelt gebucht.</p>
      </section>}
      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4"><button type="button" disabled={pending} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">Abbrechen</button>
        {!preview ? <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{previewMutation.isPending ? 'Vorschau wird berechnet…' : 'Auswirkungen prüfen'}</button> : <button type="button" disabled={pending} onClick={() => saveMutation.mutate()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saveMutation.isPending ? 'Wird gespeichert…' : 'Umstellung verbindlich speichern'}</button>}
      </div>
    </form>
  </dialog>;
}
