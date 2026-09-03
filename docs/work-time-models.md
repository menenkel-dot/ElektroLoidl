# Arbeitszeitmodelle und Admin-Übersichten

## Bedienung

- Dashboard: „Letzte Auftragsnotizen“ ist nur für Admins sichtbar. Zehn Notizen pro Seite; Text aufklappen oder Auftrag öffnen.
- Auftrag: „Gebuchte Arbeitszeiten“ zeigt Admins 25 Buchungen pro Seite sowie Gesamt- und Mitarbeitersummen über alle Seiten.
- Team → Arbeitszeitmodell: Stunden Montag–Sonntag und Feiertagsprofil auswählen, Auswirkungen prüfen, danach verbindlich speichern. Die Umstellung erfolgt je Person; bestehende Monatsmodelle bleiben bis dahin bestehen. Neue Benutzer zunächst anlegen, anschließend ihr Arbeitszeitmodell einstellen.
- Änderungen am Wochenmodell gelten ab Monatsanfang. Frühere Modellversionen und Tagesbelastungen bleiben erhalten. Die Auswahl für Mariä Himmelfahrt ist anhand des amtlichen Gemeindeverzeichnisses zu prüfen.

## Berechnung und Grenzen

Die serverseitige Berechnung beginnt für bestehende Benutzer am 01.09.2026, für neue Benutzer am Anlagetag. Der bisherige Ausgangssaldo einschließlich bereits gebuchter Zeitausgleichsbelastungen wird übernommen. Frühere Monatsdifferenzen werden nicht ohne belegten Eröffnungssaldo rekonstruiert.

Der Saldo besteht aus Ausgangssaldo plus Arbeitszeit und genehmigten Abwesenheitsgutschriften minus aufgelaufenem Soll. Genehmigter Zeitausgleich belastet den Ausgangssaldo sofort, auch bei zukünftigen Abwesenheiten. Die Gutschrift am Abwesenheitstag verhindert einen zweiten Abzug. Ohne bisherige Zeiterfassungsaktivität im Berechnungszeitraum bleibt der Ausgangssaldo erhalten.

Wochenmodelle speichern ganze Minuten je Tag; der Monatswert wird aus den tatsächlichen Kalendertagen und dem Feiertagsprofil berechnet. Monatliche Altmodelle behalten die bisherige Verteilung auf Montag–Freitag ohne automatische Feiertagsanpassung. Nullstunden werden nicht durch einen Standardwert ersetzt.

Bei genehmigten Abwesenheiten werden Stunden und Urlaubstage je Datum gespeichert. Löschen/Zurücknehmen erstattet die tatsächlich verbuchten Werte. Umstellungen korrigieren nur den betroffenen Zeitraum. Fehlt eine eindeutige historische Tagesaufteilung, verweigert die Umstellung eine automatische Korrektur und fordert eine Prüfung an. Bereits genehmigte überlappende Abwesenheiten müssen vor einer Umstellung bereinigt werden; neue überlappende Genehmigungen werden abgelehnt.

## Sicherheit und Einführung

- Die RPCs für Notizen- und Auftragszeitenübersicht prüfen Adminrechte. Mitarbeiter können ausschließlich ihr eigenes berechnetes Konto lesen.
- Modelländerungen erfolgen über geschützte RPCs mit Vorschau-Token; veraltete Vorschauen werden abgelehnt. Das Modell und die Kontenkorrektur werden in einer Transaktion gespeichert.
- Direkte Client-Schreibrechte auf Arbeitszeitmodelle sind entzogen. Die Überstundenbasis und das Konten-Startdatum sind im Profiltrigger vor Mitarbeiteränderungen geschützt.
- `private.work_model_audit` protokolliert Vorzustand und Korrekturvorschau und ist für Clients vollständig gesperrt. Die Advisor-Information „RLS Enabled No Policy“ ist für diese interne, absichtlich unzugängliche Tabelle erwartet.
- Die beiden neuen Migrationsdateien entsprechen den live angewandten Versionen. Ältere Bestandsmigrationen enthalten teils andere lokale Zeitstempel als die Remote-Historie; daher kein ungeprüftes `db push` über die gesamte Historie.
- Ein Frontend-Rollback allein rollt gespeicherte Wochenmodelle nicht zurück. Nach Umstellungen keine alte, rein clientseitige Kontenberechnung veröffentlichen; Korrekturen durch neue Migrationen und anhand des Auditprotokolls durchführen.

## Tests

`pnpm test` führt die Migrationen in einer isolierten PGlite/PostgreSQL-Instanz aus: Tagesstunden, Feiertage, Kontenübertrag, Erstattung, Vorschaukonflikte, Rollen/RLS, historische Mehrmonatsfälle und paginierte Auftragsdaten. Keine produktiven Daten werden dafür verändert.

Browserprüfung: Anwendung auf localhost:3100 starten und in einer separaten `agent-browser --session loidl-verify`-Sitzung öffnen. Mit `agent-browser --session loidl-verify get cdp-url` den lokalen Debug-Port ermitteln und `node tests/browser-fixtures.mjs <Port> admin` starten. Der Prozess ersetzt ausschließlich in diesem lokalen Tab Supabase-Aufrufe durch Testdaten und umgeht dessen Service Worker. Nach Abschluss stoppen; mit Rolle `employee` erneut prüfen. Anschließend die isolierte Browsersitzung schließen. Diese Prüfung ersetzt keine Datenbank-Berechtigungstests.
