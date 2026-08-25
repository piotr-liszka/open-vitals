/**
 * Polish catalog — the SOURCE OF TRUTH for the app's copy (spec 055).
 *
 * The key union every `t()` call is checked against comes from this object, and `en.ts` is typed
 * against that union, so this file decides what messages exist. Keys are dotted and namespaced by
 * surface (`nav.*`, `insights.*`, `sport.*`); shared vocabulary lives under `common.*` so a word
 * like "Zapisz" is written once and translated once.
 *
 * A message whose wording depends on a count is written as its plural forms (`{ one, few, many,
 * other }`) — Polish needs three, and `Intl.PluralRules` picks between them at render time.
 */
export const pl = {
  /* ------------------------------------------------------------------ *
   * Shared vocabulary
   * ------------------------------------------------------------------ */
  'common.save': 'Zapisz',
  'common.cancel': 'Anuluj',
  'common.close': 'Zamknij',
  'common.delete': 'Usuń',
  'common.edit': 'Edytuj',
  'common.add': 'Dodaj',
  'common.refresh': 'Odśwież',
  'common.retry': 'Spróbuj ponownie',
  'common.back': 'Wstecz',
  'common.more': 'Więcej',
  'common.less': 'Mniej',
  'common.all': 'Wszystkie',
  'common.none': 'Brak',
  'common.yes': 'Tak',
  'common.no': 'Nie',
  'common.on': 'Włączone',
  'common.off': 'Wyłączone',
  'common.loading': 'Ładowanie…',
  'common.error': 'Błąd',
  'common.noData': 'Brak danych',
  'common.today': 'Dziś',
  'common.yesterday': 'Wczoraj',
  'common.copy': 'Kopiuj',
  'common.copied': 'Skopiowano',
  'common.show': 'Pokaż',
  'common.hide': 'Ukryj',
  'common.days': { one: '{count} dzień', few: '{count} dni', many: '{count} dni', other: '{count} dnia' },
  'common.weeks': {
    one: '{count} tydzień',
    few: '{count} tygodnie',
    many: '{count} tygodni',
    other: '{count} tygodnia'
  },
  'common.activities': {
    one: '{count} aktywność',
    few: '{count} aktywności',
    many: '{count} aktywności',
    other: '{count} aktywności'
  },

  /* ------------------------------------------------------------------ *
   * App chrome
   * ------------------------------------------------------------------ */
  'shell.brand': 'OpenVitals',
  'shell.sidebarLabel': 'Nawigacja główna',
  'shell.openMenu': 'Otwórz menu',
  'shell.closeMenu': 'Zamknij menu',
  'shell.version': 'Wersja',
  'shell.builtAt': 'Zbudowano: {at}',
  'shell.builtAtCommit': 'Zbudowano: {at} · commit {sha}',
  'shell.logout': 'Wyloguj',

  'theme.toLight': 'Przełącz na tryb jasny',
  'theme.toDark': 'Przełącz na tryb ciemny',
  'theme.label': 'Tryb ciemny',

  'lang.label': 'Język',
  'lang.pl': 'Polski',
  'lang.en': 'Angielski',
  'lang.plShort': 'PL',
  'lang.enShort': 'EN',
  'lang.switchTo': 'Przełącz na język {language}',

  /* ------------------------------------------------------------------ *
   * Navigation (spec 048 groups)
   * ------------------------------------------------------------------ */
  'nav.group.training': 'Trening',
  'nav.group.health': 'Zdrowie',
  'nav.group.system': 'System',
  'nav.start': 'Start',
  'nav.training': 'Trening',
  /* The two halves of the training section (spec 088): what already happened, and what is going to.
     Also used as the section name in the page title, so the sidebar entry and the topbar cannot
     drift apart. */
  'nav.analysis': 'Analiza',
  'nav.plan': 'Plan treningowy',
  'nav.activities': 'Aktywności',
  'nav.insights': 'Wnioski',
  'nav.data': 'Dane',
  'nav.settings': 'Ustawienia',
  'nav.dashboard': 'Panel',

  /* ------------------------------------------------------------------ *
   * Global range switch (spec 047)
   * ------------------------------------------------------------------ */
  'range.label': 'Zakres',
  'range.7': '7 dni',
  'range.14': '14 dni',
  'range.30': '30 dni',
  'range.365': '1 rok',
  'range.all': 'cały czas',
  'range.7.short': '7d',
  'range.14.short': '14d',
  'range.30.short': '30d',
  'range.365.short': '1r',
  'range.all.short': '∞',
  'range.allFrom': 'cały czas (od {start})',

  /* ------------------------------------------------------------------ *
   * Daily metrics
   * ------------------------------------------------------------------ */
  'metric.steps': 'Kroki',
  'metric.resting_heart_rate': 'Tętno spoczynkowe',
  'metric.hrv': 'HRV',
  'metric.body_battery': 'Body Battery',
  'metric.sleep': 'Sen',
  'metric.stress': 'Stres',
  'metric.spo2': 'SpO₂',
  'metric.respiration': 'Oddech',
  'metric.calories': 'Kalorie',
  'metric.training_readiness': 'Gotowość (Garmin)',

  /* ------------------------------------------------------------------ *
   * Shared UI components (lib/ui)
   * ------------------------------------------------------------------ */
  'bucket.day': 'dzień',
  'bucket.week': 'tydzień',
  'bucket.month': 'miesiąc',

  'ui.spinnerLabel': 'Ładowanie',
  'ui.moreCount': '+ {count} więcej',
  'ui.dismissNotification': 'Zamknij powiadomienie',
  'ui.mapLabel': 'Mapa aktywności',
  'ui.chartNoData': 'Brak danych',

  'rangeBadge.tooltip':
    'Ta karta pokazuje dane z wybranego zakresu: {range}. Zakres zmienisz przełącznikiem na górze strony.',
  'rangeBadge.bucketHint': 'Jeden punkt to {noun}.',

  'sparkline.trend': 'trend',
  'sparkline.trendOf': 'trend: {label}',
  'sparkline.summaryEmpty': '{prefix}, brak danych',
  'sparkline.summary': {
    one: '{prefix}, {count} punkt, ostatnio {latest}',
    few: '{prefix}, {count} punkty, ostatnio {latest}',
    many: '{prefix}, {count} punktów, ostatnio {latest}',
    other: '{prefix}, {count} punktu, ostatnio {latest}'
  },

  'yearGrid.label': 'Aktywność w ciągu roku',
  'yearGrid.summary': {
    one: '{label}: {count} dzień z aktywnością w {year}',
    few: '{label}: {count} dni z aktywnością w {year}',
    many: '{label}: {count} dni z aktywnością w {year}',
    other: '{label}: {count} dnia z aktywnością w {year}'
  },
  'yearGrid.dayEmpty': '{day}: brak aktywności',
  'yearGrid.dayValue': '{day}: {value}',
  'yearGrid.less': 'mniej',
  'yearGrid.more': 'więcej',

  'tier.base': 'Podstawowy',
  'tier.advanced': 'Zaawansowany',
  'tier.baseTooltip': 'Tryb podstawowy — tylko połączenie i adres MCP',
  'tier.advancedTooltip': 'Tryb zaawansowany — przetwarzanie danych włączone',

  /* ------------------------------------------------------------------ *
   * Sync + data freshness (spec 027)
   * ------------------------------------------------------------------ */
  'sync.lastSync': 'Ostatnia synchronizacja',
  'sync.never': 'nigdy',
  'sync.syncNow': 'Synchronizuj teraz',
  'sync.inProgress': 'Synchronizacja w toku',
  'sync.syncing': 'Synchronizuję',
  'sync.lastAttemptFailed': 'Ostatnia próba nie powiodła się',
  'sync.details': 'szczegóły',
  'sync.autoImminent': 'Auto: w każdej chwili',
  'sync.autoIn': 'Auto za ~{minutes} min',
  'sync.unchangedAt': 'bez zmian {at}',
  'sync.checkedUnchanged': 'Sprawdzono {at} · bez zmian',

  /* ------------------------------------------------------------------ *
   * Consent (spec 011/014)
   * ------------------------------------------------------------------ */
  'consent.genericError': 'Coś poszło nie tak. Spróbuj ponownie.',
  'consent.networkError': 'Nie udało się połączyć z serwerem. Spróbuj ponownie.',
  'consent.accepted': 'Zaakceptowano',
  'consent.enabledByDefault': 'Domyślnie włączone',
  'consent.showTerms': 'Pokaż warunki',
  'consent.hideTerms': 'Ukryj warunki',
  'consent.acceptAndEnable': 'Zaakceptuj i włącz',
  'consent.badRequest': 'Oczekiwano pól { featureId, termsVersion, accept }.',
  'consent.unknownFeature': 'Nieznana funkcja.',
  'consent.termsChanged': 'Warunki się zmieniły — odśwież stronę i zapoznaj się z nową wersją.',

  'advanced.enabled': 'Włączony',
  'advanced.disabled': 'Wyłączony',
  'advanced.toggleLabel': 'Przełącz tryb zaawansowany',
  'advanced.enableTitle': 'Włącz tryb zaawansowany',
  'advanced.disableTitle': 'Wyłączyć tryb zaawansowany?',
  'advanced.disableBody':
    'Wrócisz do trybu podstawowego — zostaje samo połączenie z Garminem i Twój adres MCP. Pulpit, analityka ' +
    'i wnioski zostaną ukryte, a pobieranie zakresów danych zatrzymane. Możesz włączyć tryb zaawansowany ' +
    'ponownie w każdej chwili.',
  'advanced.disableConfirm': 'Wyłącz tryb zaawansowany',

  /* ------------------------------------------------------------------ *
   * Garmin connection + setup (spec 003/012)
   * ------------------------------------------------------------------ */
  'connection.title': 'Połączenie z Garmin',
  'connection.subtitle': 'Nie przechowujemy Twojego loginu — tylko zaszyfrowane tokeny, które zwraca Garmin.',
  'connection.unreachable': 'Niedostępny',
  'connection.connected': 'Połączono',
  'connection.disconnected': 'Nie połączono',
  'connection.sessionValidUntil': 'Sesja ważna do',
  'connection.detailsLabel': 'Szczegóły',
  'connection.unreachableDetail':
    'Nie udało się połączyć z usługą Garmin. Spróbujemy ponownie automatycznie.',
  'connection.disconnectConfirm': 'Rozłączyć i usunąć zapisane tokeny?',
  'connection.disconnect': 'Rozłącz',
  'connection.disconnectGarmin': 'Rozłącz Garmina',
  'connection.fullSubtitle':
    'Źródło wszystkich danych w tej aplikacji. Nie przechowujemy Twojego loginu — tylko zaszyfrowane tokeny, które zwraca Garmin.',

  'setup.emailLabel': 'E-mail Garmin',
  'setup.passwordLabel': 'Hasło Garmin',
  'setup.passwordPlaceholder': 'Twoje hasło do Garmin Connect',
  'setup.mfaLabel': 'Kod weryfikacyjny',
  'setup.mfaHelp': 'Wysłany przez Garmin e-mailem lub w aplikacji uwierzytelniającej.',
  'setup.startOver': 'Zacznij od nowa',
  'setup.verifyAndConnect': 'Zweryfikuj i połącz',
  'setup.connect': 'Połącz Garmina',
  'setup.connected': 'Połączono konto Garmin.',
  'setup.mfaPrompt': 'Wpisz kod weryfikacyjny, który właśnie wysłał Garmin.',
  'setup.rejectedWithCode': 'Garmin odrzucił te dane. Sprawdź adres e-mail, hasło i kod.',
  'setup.rejected': 'Garmin odrzucił te dane. Sprawdź adres e-mail i hasło.',
  'setup.failed': 'Konfiguracja nie powiodła się. Spróbuj ponownie.',
  'setup.networkError': 'Nie udało się połączyć z serwerem.',
  'setup.keyMismatch':
    'Błąd konfiguracji serwera: web i sidecar nie mają wspólnego INTERNAL_API_KEY. To nie jest problem z Twoim hasłem.',

  'setup.invalidCredentials': 'Wymagany jest prawidłowy adres e-mail i hasło.',
  'setup.serviceUnavailable': 'Usługa Garmin jest niedostępna. Spróbuj za chwilę.',

  /* ------------------------------------------------------------------ *
   * Personal MCP URL (spec 012)
   * ------------------------------------------------------------------ */
  'mcp.title': 'Twój adres MCP',
  'mcp.subtitle': 'Dodaj go jako konektor w Claude lub ChatGPT',
  'mcp.ready': 'Gotowe',
  'mcp.connectFirst': 'Najpierw połącz Garmina',
  'mcp.rotate': 'Wymień',
  'mcp.copyFailed': 'Nie udało się skopiować — zaznacz i skopiuj ręcznie.',
  'mcp.rotated': 'Token wymieniony — stary adres już nie działa.',
  'mcp.rotateFailed': 'Nie udało się wymienić tokenu. Spróbuj ponownie.',
  'mcp.networkError': 'Nie udało się połączyć z serwerem. Spróbuj ponownie.',
  'mcp.warning':
    'Ten adres jest przypisany tylko do Twojego konta i zawiera sekretny token — traktuj go jak hasło. Każdy, ' +
    'kto go ma, może przez tę usługę czytać Twoje dane z Garmina. Użyj przycisku {rotate}, aby wygenerować ' +
    'nowy token; poprzedni adres przestaje działać natychmiast.',
  'mcp.copied': 'Skopiowano adres MCP do schowka.',
  'mcp.urlAriaLabel': 'Adres MCP',
  'mcp.infoLabel': 'Co to za adres?',

  /* ------------------------------------------------------------------ *
   * Profil atlety: FTP, tętno maksymalne, masa ciała (spec 090)
   * ------------------------------------------------------------------ */
  'profile.section': 'Atleta',
  'settings.integrationsSection': 'Integracje',
  'settings.appSection': 'Aplikacja',
  'settings.accountSection': 'Moje konto',
  'profile.title': 'Profil',
  'profile.subtitle': 'Trzy liczby, od których liczy się reszta',
  'profile.intro':
    'Każde pole możesz zostawić puste — wtedy szacujemy wartość z samego treningu. Zapisana liczba zastępuje to oszacowanie.',
  'profile.ftp.label': 'FTP (W)',
  'profile.ftp.help': 'Używane do IF, TSS i stref mocy.',
  'profile.ftp.empty':
    'Teraz szacujemy: 95% najlepszej 20-minutowej mocy każdej sesji, więc próg zmienia się z jazdy na jazdę.',
  'profile.maxHr.label': 'Tętno maksymalne (bpm)',
  'profile.maxHr.help': 'Używane do podziału tętna na strefy i do modelu obciążenia.',
  'profile.maxHr.empty':
    'Teraz szacujemy: za maksimum bierzemy najwyższe tętno danej sesji, więc najwyższa strefa jest niemal pewna.',
  'profile.weight.label': 'Masa ciała (kg)',
  'profile.weight.help': 'Używana do kolumny W/kg w tabeli najlepszej mocy.',
  'profile.weight.empty': 'Teraz pusta: kolumna W/kg w ogóle się nie pokazuje.',
  'profile.placeholder': 'Szacujemy',
  'profile.saved': 'Zapisano profil.',
  'profile.saveFailed': 'Nie udało się zapisać profilu.',
  'profile.networkError': 'Nie udało się połączyć z serwerem. Spróbuj ponownie.',
  'profile.error.number': 'Podaj liczbę.',
  'profile.error.range': 'Podaj wartość od {min} do {max}.',

  /* ------------------------------------------------------------------ *
   * Workout planner vocabulary (specs 066/081) — steps, targets, completion
   * ------------------------------------------------------------------ */
  'workout.stepKind.repeat': 'Powtórz',
  'workout.durationType.lap': 'Przycisk lap',
  'workout.durationValueLabel.time': 'Sekundy',
  'workout.durationValueLabel.distance': 'Metry',
  'workout.durationValueLabel.lap': 'Wartość',
  'workout.target.none': 'Bez celu',
  'workout.target.speed': 'Prędkość',
  'workout.target.cadence': 'Kadencja',
  'workout.lapEnd': 'do przycisku lap',
  'workout.completionBadge.done': 'Zrobione',
  'workout.completionBadge.shortened': 'Skrócone',
  'workout.adherencePct': '{pct} % planu',
  'workout.dayShift.later': 'wykonane {days} później',
  'workout.dayShift.earlier': 'wykonane {days} wcześniej',
  'workout.matchedHeuristic': 'dopasowane orientacyjnie — po dniu i dystansie',
  'workout.editor.nameLabel': 'Nazwa',
  'workout.editor.namePlaceholder': 'np. Interwały 5×1 km',
  'workout.editor.sportLabel': 'Sport',
  'workout.editor.timeLabel': 'Godzina',
  'workout.editor.timeHelp': 'Puste = kiedykolwiek tego dnia',
  'workout.editor.libraryScopeNote':
    'Zmiany dotyczą tylko biblioteki. Treningi już zaplanowane w kalendarzu zostaną bez zmian.',
  'workout.editor.stepsHeading': 'Kroki',
  'workout.editor.stepKindAriaLabel': 'Rodzaj kroku',
  'workout.editor.repeatsLabel': 'Powtórzeń',
  'workout.editor.durationTypeAriaLabel': 'Zakończ krok po',
  'workout.editor.targetAriaLabel': 'Cel',
  'workout.editor.targetLowAriaLabel': 'Cel od',
  'workout.editor.targetHighAriaLabel': 'Cel do',
  'workout.editor.moveUp': 'W górę',
  'workout.editor.moveDown': 'W dół',
  'workout.editor.removeStep': 'Usuń krok',
  'workout.editor.addStepInBlock': '+ Krok w bloku',
  'workout.editor.addStep': '+ Krok',
  'workout.editor.addRepeat': '+ Powtórzenie',
  'workout.editor.noteLabel': 'Notatka',
  'workout.editor.notePlaceholder': 'Opcjonalny opis sesji',
  'workout.editor.noteHint': 'Notatka trafia do opisu treningu w Garmin Connect razem z sesją.',
  'workout.editor.notSaved': 'Nie zapisano',
  'workout.editor.saving': 'Zapisuję…',
  'workout.editor.saveChanges': 'Zapisz zmiany',
  'workout.editor.addWorkout': 'Dodaj trening',
  'workout.saveFailed': 'Nie udało się zapisać treningu.',
  'workout.deleteFailed': 'Nie udało się usunąć treningu.',
  'workout.scheduleFailed': 'Nie udało się zaplanować treningu.',
  'workout.library.saved': 'Zapisano w bibliotece',
  'workout.library.added': 'Dodano do biblioteki',
  'workout.library.removed': 'Usunięto z biblioteki',
  'workout.scheduledToast': 'Zaplanowano „{title}” na {date}',
  'workout.saved': 'Zapisano zmiany',
  'workout.added': 'Dodano trening',
  'workout.pushFailed': 'Nie udało się wysłać treningu',
  'workout.pushedToast': 'Wysłano „{title}” na Garmina',
  'workout.pushRejected': 'Garmin nie przyjął tego treningu',
  'workout.deletedToast': 'Usunięto trening',
  'workout.pushState.pending': 'W kolejce',
  'workout.pushState.pushed': 'Na zegarku',
  'workout.pushState.failed': 'Błąd wysyłki',
  'workout.pushState.unsupported': 'Niewspierane',
  'workout.addButton': '+ Trening',
  'workout.readOnlyTitle': 'Tryb tylko do odczytu',
  'workout.readOnlyBody':
    'Zapis treningów jest wyłączony. Włącz „Zapis treningów do Garmina” na karcie Garmin w',
  'workout.readOnlyBodyTail': ', aby dodawać i edytować sesje tutaj.',
  'workout.emptyDay': 'Nic nie zaplanowano na ten dzień.',
  'workout.emptyDayHint': ' Dodaj trening przyciskiem powyżej albo przez asystenta (MCP).',
  'workout.onGarmin': 'Na Garminie',
  'workout.pushing': 'Wysyłam…',
  'workout.pushNow': 'Wyślij na Garmina',
  'workout.pushAgain': 'Wyślij ponownie',
  'workout.staleOnGarmin': 'Na Garminie może być starsza wersja',
  'workout.fromCalendar': 'Z kalendarza',
  'workout.fromGarminBadge': 'Z Garmina',
  // spec 093: shown on an authored session once Garmin has echoed the same push back onto its own
  // calendar — the separate read-only "Z Garmina" card for that echo is folded into this one instead.
  'workout.syncedBackBadge': 'Zsynchronizowano',
  'workout.confirmDeleteTitle': 'Usunąć „{title}”?',
  'workout.confirmDeleteBody.onGarmin':
    'Trening zniknie z tej listy od razu. Z zegarka usunie go dopiero najbliższa synchronizacja.',
  'workout.confirmDeleteBody.notOnGarmin':
    'Ten trening nie trafił jeszcze do Garmina, więc zostanie usunięty bez śladu.',
  'workout.confirmDeleteTemplateTitle': 'Usunąć „{title}” z biblioteki?',
  'workout.confirmDeleteTemplateBody':
    'Treningi już zaplanowane w kalendarzu zostaną — usuwasz tylko wzorzec, z którego powstały.',
  'workout.library.heading': 'Biblioteka treningów',
  'workout.library.newButton': '+ Nowy',
  'workout.library.emptyBody':
    'Biblioteka jest pusta. Zapisz tu treningi, które powtarzasz — potem przeciągniesz je na kalendarz.',
  'workout.library.emptyWriteHint': ' Włącz zapis treningów w Ustawieniach, aby dodawać.',
  'workout.library.dragHint': 'Przeciągnij trening na dzień w kalendarzu albo użyj przycisku „Zaplanuj”.',
  'workout.library.scheduleFor': 'Zaplanuj na {date}',
  'workout.calendar.prevMonth': 'Poprzedni miesiąc',
  'workout.calendar.nextMonth': 'Następny miesiąc',
  'workout.calendar.srAuthored': ', {count} zaplanowanych treningów',
  'workout.calendar.srDone': ', {count} wykonanych',
  'workout.calendar.srPlanned': ', {count} z kalendarza Garmina',
  'workout.calendar.legendMine': 'Twój plan',
  'workout.calendar.legendDone': 'Wykonane',
  'workout.calendar.mon.short': 'Pn',
  'workout.calendar.mon.long': 'Poniedziałek',
  'workout.calendar.tue.short': 'Wt',
  'workout.calendar.tue.long': 'Wtorek',
  'workout.calendar.wed.short': 'Śr',
  'workout.calendar.wed.long': 'Środa',
  'workout.calendar.thu.short': 'Cz',
  'workout.calendar.thu.long': 'Czwartek',
  'workout.calendar.fri.short': 'Pt',
  'workout.calendar.fri.long': 'Piątek',
  'workout.calendar.sat.short': 'So',
  'workout.calendar.sat.long': 'Sobota',
  'workout.calendar.sun.short': 'Nd',
  'workout.calendar.sun.long': 'Niedziela',

  /* ------------------------------------------------------------------ *
   * Season goals (spec 060)
   * ------------------------------------------------------------------ */
  'season.phase.done': 'Po starcie',
  'season.phase.raceWeek': 'Tydzień startowy',
  'season.phase.taper': 'Tapering',
  'season.phase.peak': 'Szczyt formy',
  'season.phase.build': 'Budowanie',
  'season.phase.base': 'Baza',
  'season.phase.far': 'Daleko',
  'season.verdict.past': 'Cel jest już za Tobą.',
  'season.verdict.taperGood':
    'Obciążenie spadło do {pct}% poziomu sprzed taperingu — to prawdziwy tapering. Forma z ostatnich tygodni zdąży wyjść na wierzch.',
  'season.verdict.taperBad':
    'Obciążenie trzyma się na {pct}% poziomu sprzed taperingu. To zwykły tydzień pod nazwą taperingu — na starcie zostaniesz ze zmęczeniem, nie z formą.',
  'season.verdict.atRisk':
    'Forma rośnie szybciej, niż baza jest w stanie unieść. To najczęstsza droga do kontuzji przeciążeniowej — zanim dołożysz cokolwiek do planu, wpleć lżejszy tydzień.',
  'season.verdict.behindNoRoom':
    'Obecne tempo nie dowozi celu, a na budowanie nie ma już czasu. Realniejszy jest cel skromniejszy niż plan, który się nie domknie.',
  'season.verdict.behindRamp':
    'Obecne tempo nie dowozi celu. Potrzeba około {ramp} pkt CTL tygodniowo — dokładaj stopniowo, nie jednym mocnym tygodniem.',
  'season.verdict.ahead':
    'Jesteś przed planem. Nie ma powodu dokładać — nadmiar formy przed czasem zwykle kończy się przetrenowaniem, nie lepszym startem.',
  'season.verdict.onTrack':
    'Obecne tempo dowozi cel na start taperingu. Utrzymaj kierunek i pilnuj tygodni odciążających.',
  'season.verdict.unknown':
    'Za mało ciągłej historii treningowej, aby ocenić trajektorię do tego celu. Wskaźniki liczone z niepełnej bazy tylko straszą.',
  'season.priorityLabel.a': 'Cel A',
  'season.priorityLabel.b': 'Cel B',
  'season.priorityLabel.c': 'Cel C',
  'season.priorityLabel.fallback': 'Cel',
  'season.band.onTrack': 'Zgodnie z planem',
  'season.band.ahead': 'Przed planem',
  'season.band.behind': 'Poniżej planu',
  'season.band.atRisk': 'Ryzyko przeciążenia',
  'season.band.unknown': 'Brak oceny',
  'season.daysAgo': '{count} dni temu',
  'season.today': 'dziś',
  'season.daysUntil': 'za {count} dni',
  'season.stat.formToday': 'Forma dziś',
  'season.stat.targetAtTaper': 'Cel na start taperingu',
  'season.stat.reaching': 'Dojdziesz do',
  'season.stat.reachingHint': 'W obecnym tempie, licząc do początku taperingu — nie do dnia startu.',
  'season.stat.paceNow': 'Tempo teraz',
  'season.stat.ctlPerWeekUnit': 'CTL/tyg.',
  'season.stat.needed': 'Potrzebne: {value} CTL/tyg.',
  'season.progressLabel': 'Droga do docelowej formy',
  'season.taperLabel': 'Tapering',
  'season.taperHint': 'Ostatnie 7 dni: {recent} TSS/dzień wobec {baseline} w czterech tygodniach przed nimi.',
  'season.predictionLabel': 'Prognoza czasu',
  'season.predictionFrom': 'Z Twojego wyniku na {label}',
  'season.predictionUnconfident':
    'Ekstrapolacja jest daleka — traktuj tę liczbę jako kierunek, nie prognozę.',
  'season.predictionCriticalSpeed':
    'Model prędkości krytycznej daje {time}; rozbieżność między metodami sama w sobie jest informacją.',
  'season.gapTarget': 'Cel {time} —',
  'season.gapAhead': 'prognoza jest o {time} szybsza',
  'season.gapBehind': 'brakuje {time}',
  'season.importedFromGarmin': 'Zaimportowany z kalendarza Garmin.',
  'season.deleteGoal': 'Usuń cel',
  'season.pageTitle': 'Cele sezonu',
  'season.pageSubtitle':
    'Jedyne miejsce w aplikacji, które patrzy do przodu — reszta opisuje to, co już było',
  'season.explainLabel': 'Jak to działa?',
  'season.explainTitle': 'Jak liczymy cele sezonu',
  'season.explainBody':
    'Podaj datę i dyscyplinę, a odliczanie, faza przygotowań i trajektoria formy policzą się z danych, które już tu są. Cele bez docelowej formy też mają sens — dostaniesz odliczanie i fazę, tylko bez oceny „czy zdążę”.',
  'season.suggestionsTitle': 'Starty z kalendarza Garmin',
  'season.suggestionsSubtitle': 'Już je synchronizujemy — jeden klik i stają się celem',
  'season.addAsGoal': 'Dodaj jako cel',
  'season.emptyTitle': 'Jeszcze nic tu nie ma',
  'season.emptyBody':
    'Nie masz jeszcze żadnego celu. Dodaj start albo datę, na którą chcesz mieć formę — od tego momentu wszystkie liczby w aplikacji dostają kierunek.',
  'season.noHistoryTitle': 'Brak historii treningowej',
  'season.noHistoryBody':
    'Cele są zapisane, ale bez zsynchronizowanych aktywności nie ma z czego policzyć trajektorii.',
  'season.pastHeading': 'Za Tobą',
  'season.deleteFailed': 'Nie udało się usunąć celu.',
  'season.deleted': 'Cel usunięty.',
  'season.networkError': 'Nie udało się połączyć z serwerem.',
  'season.addFailed': 'Nie udało się dodać celu.',
  'season.adopted': 'Start dodany jako cel.',
  'season.form.addGoal': 'Dodaj cel',
  'season.form.dateLabel': 'Data',
  'season.form.dateHelp': 'Dzień startu, albo dzień, na który chcesz mieć formę.',
  'season.form.sportLabel': 'Dyscyplina',
  'season.form.sportHelp': 'Trajektoria liczona jest z formy w tej właśnie dyscyplinie.',
  'season.form.kindLabel': 'Rodzaj',
  'season.form.kindRace': 'Start',
  'season.form.kindFitness': 'Forma',
  'season.form.priorityLabel': 'Priorytet',
  'season.form.priorityHelp': 'A to cel sezonu; B i C to starty po drodze.',
  'season.form.distanceLabel': 'Dystans (km)',
  'season.form.distanceHelp': 'Potrzebny, żeby policzyć prognozę czasu.',
  'season.form.distancePlaceholder': '21,1',
  'season.form.targetTimeLabel': 'Czas docelowy',
  'season.form.targetTimeHelp': 'Format g:mm:ss, np. 1:30:00.',
  'season.form.targetCtlLabel': 'Docelowa forma (CTL)',
  'season.form.targetCtlHelp': 'Opcjonalna. Bez niej dostajesz odliczanie i fazę, ale bez oceny trajektorii.',
  'season.form.namePlaceholder': 'np. Maraton Warszawski',
  'season.form.saving': 'Zapisywanie…',
  'season.form.saveGoal': 'Zapisz cel',
  'season.form.errorDistance': 'Dystans musi być liczbą kilometrów.',
  'season.form.errorTime': 'Czas docelowy podaj jako g:mm:ss.',
  'season.form.errorCtl': 'Docelowa forma musi być liczbą.',
  'season.form.saveFailed': 'Nie udało się zapisać celu.',
  'season.form.added': 'Cel dodany.',

  /* ------------------------------------------------------------------ *
   * Training section + timeline (specs 025/032)
   * ------------------------------------------------------------------ */
  'training.overview': 'Przegląd',
  'training.volume': 'Objętość',
  /* Tabs of the Plan treningowy section (spec 088). `Plan`, not `Plan treningowy`: repeating the
     section's own name as its first tab reads as a broken breadcrumb. */
  'training.tab.plan': 'Plan',
  'training.tab.goals': 'Cele',
  'training.titleWithTab': '{section} · {tab}',

  'timeline.stat.distance': 'Dystans',
  'timeline.stat.pace': 'Tempo',
  'timeline.stat.time': 'Czas',
  'timeline.stat.avgPower': 'Śr. moc',
  'timeline.stat.avgSpeed': 'Śr. prędkość',
  'timeline.stat.avgHr': 'Śr. tętno',
  'timeline.stat.elevation': 'Przewyższenie',
  'timeline.stat.deviation': 'Odchylenie',
  'timeline.stat.previousRecord': 'Poprzedni rekord',
  'timeline.stat.streak': 'Seria',
  'timeline.unit.days': 'dni',

  'timeline.signal.long_sleep': 'Wyjątkowo długi sen',
  'timeline.signal.poor_sleep': 'Krótki sen',
  'timeline.signal.elevated_rhr': 'Podwyższone tętno spoczynkowe',
  'timeline.signal.low_rhr': 'Wyjątkowo niskie tętno spoczynkowe',
  'timeline.signal.hrv_rise': 'Skok HRV',
  'timeline.signal.hrv_drop': 'Spadek HRV',
  'timeline.signal.high_stress': 'Dzień z wysokim stresem',
  'timeline.signal.low_stress': 'Dzień z niskim stresem',
  'timeline.signal.body_battery_peak': 'Body Battery na maksimum',
  'timeline.signal.body_battery_crash': 'Załamanie Body Battery',
  'timeline.signal.metric_outlier': 'Nietypowy odczyt',
  'timeline.signal.aboveBaseline': '{label} powyżej Twojej zwykłej bazy',
  'timeline.signal.belowBaseline': '{label} poniżej Twojej zwykłej bazy',

  'timeline.milestone.longestDistance': 'Najdłuższy dystans — {sport}',
  'timeline.milestone.longestDistanceDetail': 'Twój rekord w tej dyscyplinie: {value}',
  'timeline.milestone.longestDuration': 'Najdłuższy czas — {sport}',
  'timeline.milestone.longestDurationDetail': 'Twój najdłuższy trening w tej dyscyplinie: {value}',
  'timeline.milestone.newSport': 'Nowa dyscyplina: {sport}',
  'timeline.milestone.newSportDetail': 'Pierwszy taki trening w Twojej historii',
  'timeline.milestone.streak': {
    one: '{count} dzień z rzędu z treningiem',
    few: '{count} dni z rzędu z treningiem',
    many: '{count} dni z rzędu z treningiem',
    other: '{count} dnia z rzędu z treningiem'
  },
  'timeline.milestone.streakDetail': 'Seria trwa — każdy z tych dni ma co najmniej jedną aktywność',

  'training.sectionAriaLabel': 'Sekcja treningu',

  /* ------------------------------------------------------------------ *
   * Walking page (spec 025)
   * ------------------------------------------------------------------ */
  'walking.emptyTitle': 'Brak marszów i wędrówek',
  'walking.emptySubtitle': 'Ta strona czyta zsynchronizowane aktywności typu marsz.',
  'walking.emptyBody':
    'Nie znaleziono marszów, spacerów ani wędrówek w zakresie: {range}. Zmień zakres u góry strony ' +
    'lub uruchom synchronizację w zakładce',
  'walking.tile.sessions': 'Marsze',
  'walking.tile.longest': 'Najdłuższy',
  'walking.tile.avgPace': 'Śr. tempo',
  // Whole titles per bucket, never a stem plus a suffix: Polish inflects the adjective and the
  // locative, English does not, and composing them from fragments produces grammar in neither.
  'walking.kmTitle.week': 'Kilometraż tygodniowy',
  'walking.kmTitle.month': 'Kilometraż miesięczny',
  'walking.kmSubtitle.week': 'Dystans pokonany w kolejnych tygodniach',
  'walking.kmSubtitle.month': 'Dystans pokonany w kolejnych miesiącach',
  'walking.elevationTitle.week': 'Przewyższenie tygodniowe',
  'walking.elevationTitle.month': 'Przewyższenie miesięczne',
  'walking.elevationSubtitle.week': 'Suma podejść w tygodniu',
  'walking.elevationSubtitle.month': 'Suma podejść w miesiącu',
  'walking.chart.distance': 'Kilometraż',
  'walking.longestTitle': 'Najdłuższe trasy',
  'walking.longestSubtitle': 'Największy dystans w zakresie',
  'walking.stepsTitle': 'Kroki dzienne',
  'walking.stepsAvgSubtitle': 'Średnio {steps} kroków dziennie',
  'walking.stepsSubtitle': 'Dzienna liczba kroków',
  'walking.stepsUnit': 'kroki',

  /* ------------------------------------------------------------------ *
   * Running page (specs 025/038/042/043)
   * ------------------------------------------------------------------ */
  'running.empty': 'Brak aktywności biegowych. Zsynchronizuj dane w zakładce',
  'running.emptyTail': ', a bieganie pojawi się tutaj.',
  'running.rangeHeading': 'Zakres: {range}',
  'running.noRunsInRange':
    'Brak biegów w tym zakresie. Rekordy życiowe i profil biegacza poniżej liczą całą historię.',
  'running.tile.runs': 'Biegi',
  'running.tile.totalDistance': 'Łączny dystans',
  'running.tile.longest': 'Najdłuższy',
  'running.tile.avgPace': 'Śr. tempo',

  'running.bests.title': 'Rekordy życiowe',
  'running.bests.subtitle':
    'Najszybszy przewidywany czas dla każdego dystansu (równe tempo). Z całej historii.',
  'running.bests.distance': 'Dystans',
  'running.bests.time': 'Czas',
  'running.bests.pace': 'Tempo',
  'running.bests.date': 'Data',
  'running.bests.empty': 'Za mało danych do wyznaczenia rekordów.',

  'running.zones.title': 'Strefy tętna',
  'running.zones.subtitle': 'Podział na podstawie maks. tętna {maxHr} bpm',
  'running.zones.noHr': 'Brak danych o tętnie',
  'running.zones.ariaLabel': 'Udział czasu w strefach tętna',
  'running.zones.empty': 'Brak strumieni tętna w zsynchronizowanych biegach.',

  'running.mileage.title.week': 'Kilometraż tygodniowy',
  'running.mileage.title.month': 'Kilometraż miesięczny',
  'running.mileage.subtitle.week': 'Dystans w kolejnych tygodniach',
  'running.mileage.subtitle.month': 'Dystans w kolejnych miesiącach',

  'running.predictions.title': 'Przewidywane czasy',
  'running.predictions.subtitle':
    'Dwie niezależne metody. Gdy się zgadzają, liczba jest coś warta; gdy się rozjeżdżają — to też jest informacja.',
  'running.predictions.fromBests': 'Z rekordów',
  'running.predictions.fromCriticalSpeed': 'Z tempa krytycznego',
  'running.predictions.basedOn': 'Na podstawie',
  'running.predictions.farExtrapolation': 'daleka ekstrapolacja',
  'running.predictions.criticalSpeedOnly': 'tylko model tempa krytycznego',
  'running.predictions.note':
    '„Z rekordów” to prawo Riegela zastosowane do Twojego najbliższego wynikowo dystansu — im dalsza ' +
    'ekstrapolacja, tym mniej znaczy, dlatego pokazujemy jej krotność i nie liczymy jej wcale powyżej ' +
    'czterokrotności. Dystanse, o których żadna metoda nie ma nic do powiedzenia, po prostu tu nie ' +
    'występują. Żadna z metod nie wie nic o paliwie, upale ani o tym, czy przebiegłeś kiedyś ten dystans.',

  'running.curve.title': 'Krzywa tempa',
  'running.curve.subtitle':
    'Najlepsze tempo utrzymane przez dany czas — obwiednia z ostatnich biegów, nie jedna sesja',
  'running.curve.criticalPace': 'Tempo krytyczne',
  'running.curve.criticalPaceHint':
    'Tempo, do którego krzywa się wypłaszcza — najszybsze, które da się utrzymać tlenowo. Biegowy ' +
    'odpowiednik FTP.',
  'running.curve.anaerobicReserve': 'Zapas beztlenowy',
  'running.curve.anaerobicReserveHint':
    'Ile metrów da się przebiec powyżej tempa krytycznego, zanim się skończy. Duża wartość to mocny finisz.',
  'running.curve.label': 'krzywa tempa',
  'running.curve.note':
    'Niżej na wykresie = szybciej. Krzywa to obwiednia z ostatnich biegów, przy założeniu próbkowania ' +
    'sekundowego — na zegarku zapisującym rzadziej krótki koniec krzywej będzie zawyżony. To obraz ' +
    'treningu, nie wynik testu.',

  'running.efficiency.title': 'Wydolność tlenowa w czasie',
  'running.efficiency.subtitle':
    'Średnia miesięczna. Rosnąca wydolność albo malejący koszt = lepsza forma tlenowa, niezależnie od ' +
    'tego, jak mocno się starało.',
  'running.efficiency.label': 'wydolność tlenowa',
  'running.efficiency.seriesEf': 'Wydolność (m/min/bpm)',
  'running.efficiency.seriesCost': 'Koszt sercowy (÷{scale} ud./km)',
  'running.efficiency.note':
    'Wydolność to metry na minutę na jedno uderzenie serca, koszt to uderzenia na kilometr — dlatego ' +
    'jedna linia powinna rosnąć, a druga maleć. Miesiące bez biegów są przerwą w linii, a nie zerem. ' +
    'Liczone ze średnich, więc porównuj miesiące o podobnej intensywności.',
  'running.mileage.chartLabel': 'Kilometraż',
  'running.curve.explainLabel': 'Jak liczymy tempo krytyczne?',
  'running.curve.explainTitle': 'Skąd tempo krytyczne',
  'running.efficiency.explainLabel': 'Jak liczymy wydolność tlenową?',
  'running.efficiency.explainTitle': 'Skąd wydolność tlenowa',
  'running.predictions.basisMeasured': 'zmierzony odcinek',
  'running.predictions.basisProjected': 'projekcja z całego biegu',
  'running.predictions.noChangeValue': 'bez zmian',
  'running.predictions.deltaFlat': '{label}: bez zmian od {date}',
  'running.predictions.deltaChanged': '{label}: {direction} o {value} niż {date}',
  'running.predictions.faster': 'szybciej',
  'running.predictions.slower': 'wolniej',
  'running.predictions.criticalPaceInline': 'z tempa krytycznego {value}',
  'running.predictions.extrapolationFactor': 'ekstrapolacja ×{value}',
  'running.predictions.noRecordNearby':
    'Tylko model tempa krytycznego — żaden rekord nie jest dość blisko tego dystansu.',
  'running.predictions.explainLabel': 'Jak liczymy te przewidywania?',
  'running.predictions.explainTitle': 'Skąd te przewidywania',
  'running.predictions.explainBody':
    'Duża liczba to prawo Riegela zastosowane do Twojego najbliższego wynikowo dystansu — im dalsza ' +
    'ekstrapolacja, tym mniej znaczy, dlatego pokazujemy jej krotność i nie liczymy jej wcale powyżej ' +
    'czterokrotności. Znacznik obok dystansu porównuje dzisiejszą prognozę z tą samą prognozą policzoną ' +
    'wyłącznie z wyników sprzed 90 dni; gdy nie ma czego porównać, znacznika po prostu nie ma. Dystanse, o ' +
    'których żadna metoda nie ma nic do powiedzenia, tu nie występują. Żadna z metod nie wie nic o paliwie, ' +
    'upale ani o tym, czy przebiegłeś kiedyś ten dystans.',
  'running.profile.title': 'Profil biegacza',
  'running.profile.explainLabel': 'Co pokazuje ten profil?',
  'running.profile.explainTitle': 'Skąd ten profil',
  'running.profile.explainBody': 'Pięć osi policzonych z Twoich zsynchronizowanych biegów',
  'running.profile.radarAriaLabel': 'Profil biegacza — pięć osi',
  'running.profile.yourType': 'Twój typ',
  'running.profile.strengthLabel': 'Mocna strona:',
  'running.profile.weaknessLabel': 'Do poprawy:',
  'running.profile.noData': 'brak danych',
  'running.profile.windowWeeks': 'z ostatnich {weeks} tygodni',
  'running.profile.windowPending': 'dopiero wtedy, gdy uzbiera się kilka tygodni historii',
  'running.profile.scale':
    'Skala odniesienia: 0 to poziom początkujący, 100 wyczynowy — to miara kształtu profilu, nie test ' +
    'sprawności. Osie tempa liczymy z rekordów życiowych, a objętość i regularność {window}. Przerywana ' +
    'oś oznacza brak danych, nie zero.',

  /* ------------------------------------------------------------------ *
   * Volume page (spec 037)
   * ------------------------------------------------------------------ */
  'volume.title': 'Objętość',
  'volume.empty':
    'Brak zsynchronizowanych aktywności w ostatnich latach. Po pierwszej synchronizacji pojawią się tu ' +
    'miesiące i porównanie rok do roku.',
  'volume.summaryLabel': 'Podsumowanie objętości',
  'volume.measure.distance': 'Dystans',
  'volume.measure.duration': 'Czas',
  'volume.measure.elevation': 'Przewyższenie',
  'volume.measureAriaLabel': 'Miara objętości',
  'volume.tile.thisYearToDate': 'W tym roku do dziś',
  'volume.tile.yearToThisDay': '{year} do tego dnia',
  'volume.tile.wholeYear': 'Cały {year}',
  'volume.tile.avgPerFullMonth': 'Średnio na pełny miesiąc',
  'volume.tile.bestMonth': 'Najlepszy miesiąc · {month}',
  'volume.yoy.title': 'Rok do roku',
  'volume.yoy.subtitle':
    'Suma kilometrów narastająco. Każdy rok mierzony w tym samym dniu sezonu — inaczej porównanie nie ' +
    'miałoby sensu.',
  'volume.yoy.ahead': 'Przed rokiem {year}',
  'volume.yoy.behind': 'Za rokiem {year}',
  'volume.yoy.byKm': 'o {km} km na ten sam dzień roku.',
  'volume.yoy.label': 'dystans narastająco',
  'volume.monthly.title': 'Miesiąc po miesiącu',
  'volume.monthly.subtitle':
    'Ostatnie {months} miesięcy, w podziale na sporty. Bieżący miesiąc jest niepełny.',
  'volume.monthly.baselineNote':
    'Linia odniesienia to średnia z pełnych miesięcy — bieżący, niepełny miesiąc nie wchodzi do tej ' +
    'średniej ani do „najlepszego miesiąca”.',
  'volume.grid.title': 'Regularność {year}',
  'volume.grid.subtitle':
    'Każdy dzień roku jako jedno pole — streaki, przerwy i sezonowość widać tu od razu, czego nie pokaże ' +
    'żaden wykres tygodniowy',
  'volume.grid.ariaLabel': 'Regularność treningu',
  'volume.grid.note':
    'Odcień zależy od tego, jak duży był to dzień na tle Twoich pozostałych dni, a nie na tle ' +
    'największego — inaczej jeden długi bieg wyblakłby cały rok. Dzień bez aktywności jest pustym polem, ' +
    'nie najjaśniejszym odcieniem.',
  'volume.months.title': 'Miesiące',
  'volume.months.subtitle': 'Te same liczby w tabeli, z zaznaczonym miesiącem w toku',
  'volume.months.month': 'Miesiąc',
  'volume.months.activities': 'Aktywności',
  'volume.months.inProgress': 'w toku',
  'volume.sportFilter.all': 'Wszystko',
  'volume.yoy.subtitleWithSport':
    'Suma kilometrów narastająco — {sport}. Każdy rok mierzony w tym samym dniu sezonu, inaczej ' +
    'porównanie nie miałoby sensu.',
  'volume.yoy.byKmLead': 'o',
  'volume.yoy.byKmTrail': 'na ten sam dzień roku.',
  'volume.yoy.emptySport': 'Brak aktywności w tej dyscyplinie w ostatnich latach.',
  'volume.yoy.sportAriaLabel': 'Dyscyplina na wykresie rok do roku',
  'volume.period.last12': 'Ostatnie 12 miesięcy',
  'volume.period.last12Short': '12 mies.',
  'volume.period.last12Lower': 'ostatnie 12 miesięcy',
  'volume.period.sectionTitle': 'Miesiące i regularność',
  'volume.period.ariaLabel': 'Okres',
  'volume.monthly.subtitleFor': '{period}, w podziale na sporty.',
  'volume.monthly.partialCaveat': 'Bieżący miesiąc jest niepełny.',
  'volume.grid.titleWithPeriod': 'Regularność · {period}',
  'volume.grid.subtitleGeneric':
    'Każdy dzień jako jedno pole — streaki, przerwy i sezonowość widać tu od razu, czego nie pokaże ' +
    'żaden wykres tygodniowy',
  'volume.grid.noteWithPeriod':
    'Odcień zależy od tego, jak duży był to dzień na tle Twoich pozostałych dni w tym okresie, a nie na ' +
    'tle największego — inaczej jeden długi bieg wyblakłby cały rok. Dzień bez aktywności jest pustym ' +
    'polem, nie najjaśniejszym odcieniem.',

  'training.band.fresh': 'Świeży',
  'training.band.optimal': 'Optymalny',
  'training.band.neutral': 'Neutralny',
  'training.band.fatigued': 'Zmęczony',
  'training.band.very-fatigued': 'Bardzo zmęczony',

  'training.emptyTitle': 'Brak treningów do pokazania',
  'training.emptySubtitle': 'Ta sekcja czyta zsynchronizowane aktywności.',
  'training.emptyBody': 'Nie znaleziono żadnych aktywności. Uruchom synchronizację w zakładce',
  'training.emptyBodyTail': ', a rower, bieg i marsz pojawią się tutaj automatycznie.',
  'training.rangeHeading': 'Zakres: {range}',
  'training.tile.activities': 'Aktywności',
  'training.other': 'Pozostałe',
  'training.split.title': 'Podział na sporty',
  'training.split.subtitle': 'Udział czasu treningowego w wybranym zakresie',
  'training.split.ariaLabel': 'Podział czasu treningowego na sporty',
  'training.split.sessions': 'Treningi',
  'training.split.load': 'Obciążenie',
  'training.volume.title': 'Objętość treningu',
  'training.volume.subtitle.week': 'Godziny treningu w tygodniu, z podziałem na sporty',
  'training.volume.subtitle.month': 'Godziny treningu w miesiącu, z podziałem na sporty',
  'training.volume.unit': 'godz.',
  'training.form.heading': 'Forma',
  'training.tile.ctl': 'CTL (forma)',
  'training.tile.atl': 'ATL (zmęczenie)',
  'training.tile.tsb': 'TSB (świeżość)',
  'training.tile.streak': 'Seria',
  'training.streakUnit': { one: 'tydzień', few: 'tygodnie', many: 'tygodni', other: 'tygodnia' },
  'training.reco.title': 'Rekomendacja',
  'training.reco.subtitleFtp': 'Obciążenie z mocy · FTP {watts} W',
  'training.reco.subtitleHr': 'Obciążenie z danych Garmina i tętna',
  'training.reco.empty':
    'PMC potrzebuje treningów z obciążeniem, mocą lub tętnem. Uruchom synchronizację w zakładce',
  'training.pmc.title': 'PMC — zarządzanie formą',
  'training.pmc.subtitle': 'CTL (forma), ATL (zmęczenie) i TSB (świeżość) w czasie',

  /* ------------------------------------------------------------------ *
   * Weekly summary card — the "Wszystko" section (spec 089)
   * ------------------------------------------------------------------ */
  'weeklySummary.all.chip': 'Wszystko',
  'weeklySummary.all.subject': 'wszystkie sporty',
  'weeklySummary.all.sessions': 'Liczba sesji',
  'weeklySummary.all.noDistance':
    'Bez dystansu: kilometra na rowerze nie dodajemy do kilometra w biegu — taka suma nic nie znaczy. ' +
    'Czas, przewyższenie i liczba sesji sumują się uczciwie.',
  'weeklySummary.title': 'Podsumowanie tygodnia',
  'weeklySummary.subtitle': 'Stałe okno 12 tygodni — niezależne od zakresu wybranego u góry strony',
  'weeklySummary.sportAriaLabel': 'Sport',
  'weeklySummary.thisWeekHeading': 'Ten tydzień',
  'weeklySummary.thisWeekCaption': 'od poniedziałku {weekStart} · {days} z 7 dni · {label}',
  'weeklySummary.trendHeading': 'Ostatnie {weeks} tygodni',
  'weeklySummary.emphasisLabel': 'bieżący tydzień (w toku)',
  'weeklySummary.currentWeekDayWord': { one: 'dniu', few: 'dniach', many: 'dniach', other: 'dniach' },
  'weeklySummary.trendCaption': 'Ostatni punkt to bieżący, niepełny tydzień: {value} po {days} {dayWord}.',
  'weeklySummary.moreLink': 'Pełny widok objętości →',
  'weeklySummary.emptyBody': 'Brak treningów z ostatnich {weeks} tygodni. Uruchom synchronizację w zakładce',
  'weeklySummary.emptyBodyTail': ', a rower, bieg i marsz pojawią się tutaj automatycznie.',

  /* ------------------------------------------------------------------ *
   * Today's metrics dashboard (specs 006/028)
   * ------------------------------------------------------------------ */
  'dash.ariaLabel': 'Dzisiejsze metryki',
  'dash.today': 'Dziś',
  'dash.snapshotOf': 'Migawka z {date}',
  'dash.unlockTitle': 'Odblokuj trendy tygodniowe',
  'dash.unlockSubtitle': 'Włącz, aby zobaczyć, jak każda metryka zmienia się w czasie',

  /* ------------------------------------------------------------------ *
   * Pages: titles, section shells, landing/login
   * ------------------------------------------------------------------ */
  'page.dashboardTitle': 'Pulpit',
  'page.yourData': 'Twoje dane',
  'page.activity': 'Aktywność',
  'page.notConnectedTitle': 'Konto Garmin nie jest połączone',
  'page.notConnectedCta': 'Połącz w Ustawieniach →',
  'page.notConnectedBody':
    'Tryb zaawansowany jest włączony, ale nie widzimy połączenia z Garminem. Połącz konto ponownie w Ustawieniach.',
  'page.garminDownTitle': 'Usługa Garmin jest chwilowo niedostępna',
  'page.garminDownCta': 'Sprawdź połączenie →',
  'page.garminDownBody':
    'Nie udało się połączyć z usługą Garmin, więc odczyty mogą być nieaktualne. Twoje dane są bezpieczne ' +
    '— połączymy się ponownie automatycznie.',
  'page.redirectingToSettings': 'Przekierowywanie do ustawień…',
  'page.updatedLabel': 'Zaktualizowano {time}',
  'page.garminNotConnectedBody':
    'Nie widzimy połączenia z Garminem, więc nie ma czego pokazać. Połącz konto ponownie w Ustawieniach.',
  'page.homeHeadTitle': 'OpenVitals — Twoje dane z Garmina, połączone z AI',

  'settings.advancedTitle': 'Tryb zaawansowany',
  'settings.advancedSubtitle':
    'Włącz lub wyłącz przetwarzanie danych — pulpit, analitykę i wnioski. Wyłączenie wraca do trybu podstawowego.',
  'settings.featuresTitle': 'Funkcje i zgody',
  'settings.featuresSubtitle':
    'Włączaj i wyłączaj funkcje. Niektóre wymagają wcześniejszej akceptacji warunków.',

  'activities.tab.list': 'Lista',
  'activities.tab.map': 'Mapa',
  'activities.sectionAriaLabel': 'Sekcja aktywności',
  'activities.titleWithTab': 'Aktywności · {tab}',

  'login.title': 'Zaloguj się',
  'login.subtitle': 'Podłącz swoje dane z Garmina do narzędzi AI',
  'login.note': 'Konto tworzy administrator tej instalacji.',
  'login.continueWithGoogle': 'Kontynuuj z Google',
  'login.identifierLabel': 'Nazwa użytkownika lub e-mail',
  'login.passwordLabel': 'Hasło',
  'login.signInButton': 'Zaloguj się',
  'login.orDivider': 'lub',
  'activities.routeOf': 'Trasa: {name}',
  'activities.search': 'Szukaj aktywności',
  'activities.sortBy': 'Sortuj według',
  'activities.ascending': 'Rosnąco',
  'activities.descending': 'Malejąco',
  'activities.next': 'Następna',
  'activities.emptyInRange':
    'Brak aktywności w zakresie: {range} dla tego filtra. Zmień zakres u góry strony lub uruchom ' +
    'synchronizację w zakładce',
  'activities.empty': 'Brak aktywności dla tego filtra. Uruchom synchronizację w zakładce',

  'activities.searchPlaceholder': 'Szukaj po nazwie lub sporcie…',
  'activities.searchAction': 'Szukaj',
  'activities.sort.date': 'Data',
  'activities.view': 'Widok',
  'activities.view.grid': 'Siatka',
  'activities.filterBySport': 'Filtruj po sporcie',
  'activities.previous': 'Poprzednia',
  'activities.pageOf': 'Strona {page} z {total}',
  'activities.pagesAriaLabel': 'Strony',
  'activities.card.distance': 'Dystans',
  'activities.card.time': 'Czas',

  'heatmap.withGpsTrack': 'Z trasą GPS',
  'heatmap.empty': 'Brak tras GPS dla tego filtra. Uruchom synchronizację w zakładce',
  'heatmap.mapLabel': 'Mapa ciepła tras',

  'power.emptyTitle': 'Brak danych o mocy',
  'power.emptySubtitle': 'Profil mocy wymaga aktywności z pomiarem mocy.',
  'power.emptyBody': 'Nie znaleziono strumieni mocy. Uruchom synchronizację w zakładce',
  'power.ftpFromSettings': 'z ustawień',
  'power.recordsTitle': 'Rekordy mocy (all-time)',
  'power.recordsSubtitle': 'Najlepsza średnia moc dla każdego czasu trwania',
  'power.compareTitle': 'Porównanie krzywych mocy (rocznie)',
  'power.compareSubtitle':
    'Oś X: czas wysiłku · oś Y: najlepsza średnia moc. Kliknij rok w legendzie, aby go ukryć.',
  'power.tableCaption': 'Najlepsza moc (W) dla wybranych czasów, według roku',
  'power.riderTypeTitle': 'Analiza typu zawodnika',
  'power.riderTypeSubtitleWeight': 'Masa {weight} kg · W/kg',
  'power.riderTypeSubtitleUnknown': 'Masa nieznana · waty',
  'power.riderRadarAriaLabel': 'Radar typu zawodnika',
  'power.ftpZonesTitle': 'FTP i strefy mocy',
  'power.ftpEstimated': 'szacowane',
  'power.best20MinLabel': 'Szac. 20 min',
  'power.best60MinLabel': 'Najlepsze 60 min',
  'power.yearlyBestsTitle': 'Najlepsze wyniki wg roku',
  'power.yearColumnHeader': 'Rok',
  'power.curveLabel': 'Krzywa mocy',
  'power.allTimeSeriesName': 'Rekord',

  /* ------------------------------------------------------------------ *
   * Timeline card (specs 022/032)
   * ------------------------------------------------------------------ */
  'timelineView.today': 'dziś',
  'timelineView.yesterday': 'wczoraj',

  'timelineView.title': 'Oś czasu',
  'timelineView.subtitle': 'Ostatnie {past} dni i najbliższe {future}',
  'timelineView.orientation': 'Układ osi czasu',
  'timelineView.vertical': 'Pion',
  'timelineView.horizontal': 'Poziom',
  'timelineView.notConnected': 'Połącz konto Garmin, aby zobaczyć swoją oś czasu.',
  'timelineView.connectCta': 'Połącz w Ustawieniach →',
  'timelineView.notEnabled':
    'Oś czasu korzysta z Twoich zsynchronizowanych danych. Włącz tryb zaawansowany, aby ją uruchomić.',
  'timelineView.notEnoughData': 'Za mało danych — synchronizuj zegarek i wróć za chwilę.',
  'timelineView.emptyPast':
    'Brak zdarzeń w ostatnich {days} dniach. Kiedy zsynchronizujesz trening albo pojawi się nietypowy odczyt, znajdzie się tutaj.',
  'timelineView.axisAriaLabel': 'Oś czasu — ostatnie {days} dni, przewijana w poziomie',
  'timelineView.pastHeading': 'Co się wydarzyło',
  'timelineView.noPlanned': 'Brak zaplanowanych treningów',
  'timelineView.noPlannedBody': 'Na najbliższe {days} dni nie masz nic w kalendarzu Garmina.',
  'timelineView.plannedNotSynced': 'Zaplanowane treningi nie są jeszcze synchronizowane',
  'timelineView.plannedNotSyncedBody':
    'Nie pobieramy jeszcze kalendarza treningów z Garmina, więc nie pokazujemy tu nic — zamiast zgadywać, ' +
    'co masz w planie. Gdy synchronizacja planu ruszy, to miejsce wypełni się samo.',
  'timelineView.showPrimary': 'Pokaż tylko najważniejsze',
  'timelineView.showAll': 'Pokaż wszystkie zdarzenia ({count})',
  'timelineView.push.pending': 'do wysłania',
  'timelineView.push.pushed': 'w Garminie',
  'timelineView.push.failed': 'błąd wysyłki',
  'timelineView.push.unsupported': 'niewspierane',
  'timelineView.nextHeading': 'Co dalej',
  'timelineView.hiddenCount': 'ukryto {count} mniej istotnych',
  'timelineView.planFallback': 'plan',
  'timelineView.plannedNotSyncedBodyShort':
    'Nie pobieramy jeszcze kalendarza treningów z Garmina, więc nie pokazujemy tu nic — zamiast zgadywać, co masz w planie.',

  /* ------------------------------------------------------------------ *
   * Activity detail + insights (specs 026/010)
   * ------------------------------------------------------------------ */
  'detail.backToActivities': '← Aktywności',
  'detail.tile.avgPace': 'Średnie tempo',
  'detail.tile.avgSpeed': 'Średnia prędkość',
  'detail.tile.avgHr': 'Średnie tętno',
  'detail.tile.avgPower': 'Średnia moc',
  'detail.tile.load': 'Obciążenie',
  'detail.streamsSubtitle': 'Zapis z zegarka — kliknij, aby przypiąć ten sam moment na wszystkich wykresach',
  'detail.detailsTitle': 'Szczegóły',
  'detail.detailsSubtitle': 'Wszystko, co Garmin zapisał dla tej aktywności',
  'detail.noDetails':
    'Ta aktywność nie ma jeszcze szczegółowych danych. {dash} zwykle znaczy, że zegarek ich nie zapisał.',

  /* ------------------------------------------------------------------ *
   * i18n audit (this pass): the activity-detail cards and their pure builders that were still
   * rendering literal Polish instead of calling i18n.t(). Grouped by component/module below.
   * ------------------------------------------------------------------ */
  'detail.tilesAriaLabel': 'Kluczowe liczby',
  'detail.tile.distance': 'Dystans',
  'detail.tile.movingTime': 'Czas w ruchu',
  'detail.tile.calories': 'Kalorie',
  'detail.mapTitle': 'Trasa',
  'detail.streamsTitle': 'Przebieg',
  'detail.stravaLink': 'Zobacz na Strava →',

  /* ---- ActivityZones.svelte: card chrome that was still hardcoded ---- */
  'zones.title': 'Strefy intensywności',
  'zones.powerTableTitle': 'Najlepsza moc',
  'zones.powerTableSubtitle': 'Najwyższa średnia moc dla każdego czasu trwania',
  'zones.hrBlockTitle': 'Tętno',
  'zones.powerBlockTitle': 'Moc',
  'zones.donutAriaLabel': 'Rozkład czasu w strefach mocy',
  'zones.hrBarLabel': 'Strefa {zone}',

  /* ---- ActivityStreamsPanel.svelte ---- */
  'streams.axis.time': 'Czas',
  'streams.axis.distance': 'Dystans',
  'streams.axisAriaLabel': 'Oś pozioma wykresów',
  'streams.hint':
    'Najedź na dowolny wykres — ten sam moment zaznaczy się na wszystkich. Kliknięcie przypina go na stałe.',
  'streams.viewMode.stacked': 'Pojedynczo',
  'streams.viewMode.combined': 'Razem',
  'streams.viewModeAriaLabel': 'Układ wykresów',

  /* ---- activity-charts.ts: chart specs passed as props into TrendChart ---- */
  'chart.section.effort': 'Wysiłek',
  'chart.section.terrain': 'Teren i warunki',
  'chart.section.physiology': 'Fizjologia',
  'chart.section.dynamics': 'Dynamika biegu',
  'chart.heartRate.title': 'Tętno',
  'chart.pace.title': 'Tempo',
  'chart.pace.note': 'Wyżej na wykresie = wolniej.',
  'chart.speed.title': 'Prędkość',
  'chart.gradeAdjustedPace.title': 'Tempo skorygowane o nachylenie',
  'chart.gradeAdjustedPace.note':
    'Tempo, jakie ten wysiłek dałby na płasko. Na podbiegu szybsze od rzeczywistego, na zbiegu wolniejsze.',
  'chart.power.title': 'Moc',
  'chart.cadence.title': 'Kadencja',
  'chart.elevation.title': 'Wysokość',
  'chart.grade.title': 'Nachylenie',
  'chart.temperature.title': 'Temperatura',
  'chart.cardiacCost.title': 'Koszt sercowy',
  'chart.cardiacCost.note':
    'Uderzenia serca na kilometr. Niżej = taniej. Rośnie, gdy tętno dryfuje przy tym samym tempie.',
  'chart.respirationRate.title': 'Oddech',
  'chart.performanceCondition.title': 'Kondycja fizyczna',
  'chart.verticalRatio.title': 'Stosunek pionowy',
  'chart.verticalOscillation.title': 'Oscylacja pionowa',
  'chart.groundContactTime.title': 'Czas kontaktu z podłożem',
  'chart.groundContactBalance.title': 'Balans kontaktu z podłożem',
  'chart.groundContactBalance.note': '50% = równo między nogami.',
  'chart.strideLength.title': 'Długość kroku',
  'chart.stamina.title': 'Stamina',
  'chart.stamina.current': 'Dostępna',
  'chart.stamina.potential': 'Potencjalna',
  'chart.unit.stepsPerMin': 'kroki/min',
  'chart.unit.rpm': 'obr./min',
  'chart.unit.beatsPerKm': 'uderzeń/km',
  'chart.unit.breathsPerMin': 'odd./min',
  'chart.unit.points': 'pkt',
  'chart.unit.metresAsl': 'm n.p.m.',

  /* ---- StatSections.svelte / activity-stat-groups.ts ---- */
  'stat.noDataHint': 'Brak danych: {hint}',
  'stat.timing.title': 'Czas i ruch',
  'stat.timing.duration': 'Czas trwania',
  'stat.timing.moving': 'W ruchu',
  'stat.timing.elapsed': 'Czas całkowity',
  'stat.timing.idle': 'Przestój',
  'stat.timing.run': 'Bieg',
  'stat.timing.walk': 'Marsz',
  'stat.timing.stand': 'Stanie',
  'stat.pace.title': 'Tempo i prędkość',
  'stat.pace.avgPace': 'Średnie tempo',
  'stat.pace.movingPace': 'Tempo w ruchu',
  'stat.pace.bestPace': 'Najlepsze tempo',
  'stat.pace.gap': 'Tempo skorygowane',
  'stat.pace.avgSpeed': 'Średnia prędkość',
  'stat.pace.maxSpeed': 'Maks. prędkość',
  'stat.pace.avgPaceRide': 'Średnie tempo',
  'stat.elevation.title': 'Wysokość',
  'stat.elevation.gain': 'Suma podejść',
  'stat.elevation.loss': 'Suma zjazdów',
  'stat.elevation.min': 'Najniżej',
  'stat.elevation.max': 'Najwyżej',
  'stat.hr.title': 'Tętno',
  'stat.hr.avg': 'Średnie',
  'stat.hr.max': 'Maksymalne',
  'stat.power.title': 'Moc',
  'stat.power.avg': 'Średnia',
  'stat.power.max': 'Maksymalna',
  'stat.power.np': 'Znormalizowana',
  'stat.dynamics.title': 'Dynamika biegu',
  'stat.dynamics.avgCadence': 'Średnia kadencja',
  'stat.dynamics.maxCadence': 'Maks. kadencja',
  'stat.dynamics.stride': 'Długość kroku',
  'stat.dynamics.vRatio': 'Stosunek pionowy',
  'stat.dynamics.vOsc': 'Oscylacja pionowa',
  'stat.dynamics.gctBalance': 'Balans kontaktu',
  'stat.dynamics.gct': 'Czas kontaktu',
  'stat.cadence.title': 'Kadencja',
  'stat.cadence.avg': 'Średnia',
  'stat.cadence.max': 'Maksymalna',
  'stat.calories.title': 'Kalorie i nawodnienie',
  'stat.calories.total': 'Kalorie',
  'stat.calories.active': 'Aktywne',
  'stat.calories.resting': 'Spoczynkowe',
  'stat.calories.sweat': 'Utrata potu',
  'stat.trainingEffect.title': 'Efekt treningowy',
  'stat.trainingEffect.aerobic': 'Tlenowy',
  'stat.trainingEffect.anaerobic': 'Beztlenowy',
  'stat.trainingEffect.benefit': 'Główna korzyść',
  'stat.trainingEffect.load': 'Obciążenie',
  'stat.trainingEffect.rpe': 'Odczuwany wysiłek',
  'stat.trainingEffect.feel': 'Samopoczucie',
  'stat.trainingEffect.execution': 'Wynik wykonania',
  'stat.physiology.title': 'Fizjologia',
  'stat.physiology.respAvg': 'Oddech — średni',
  'stat.physiology.respMin': 'Oddech — min.',
  'stat.physiology.respMax': 'Oddech — maks.',
  'stat.physiology.staminaBegin': 'Stamina na starcie',
  'stat.physiology.staminaEnd': 'Stamina na końcu',
  'stat.physiology.staminaMin': 'Stamina minimalna',
  'stat.physiology.bodyBattery': 'Body Battery',
  'stat.physiology.stressAvg': 'Stres — średni',
  'stat.physiology.stressMax': 'Stres — maks.',
  'stat.physiology.stressDiff': 'Stres — zmiana',
  'stat.temperature.title': 'Temperatura',
  'stat.temperature.avg': 'Średnia',
  'stat.temperature.min': 'Minimalna',
  'stat.temperature.max': 'Maksymalna',
  'stat.intensity.title': 'Minuty intensywności',
  'stat.intensity.moderate': 'Umiarkowane',
  'stat.intensity.vigorous': 'Intensywne',
  'stat.intensity.total': 'Razem (z wagą 2×)',
  'stat.hint.gradeAdjusted':
    'Garmin nie udostępnia tempa skorygowanego o nachylenie — liczy je dopiero Strava, na podstawie własnego modelu.',
  'stat.hint.avgTemperature':
    'Garmin podaje tylko minimum i maksimum. Średnią liczymy ze strumienia temperatury, a to urządzenie go nie zapisało.',
  'stat.hint.runWalk':
    'Podział na bieg i marsz pochodzi z klasyfikacji Garmina (typed splits). Ta aktywność ich nie ma — zwykle znaczy to, że sport lub zegarek ich nie generuje.',
  'stat.hint.selfEvaluation':
    'Odczucia po treningu wypełnia się ręcznie w zegarku lub w Garmin Connect. Ta aktywność nie ma takiego wpisu.',
  'stat.hint.stamina': 'Stamina jest raportowana tylko przez nowsze zegarki i tylko dla części sportów.',
  'stat.hint.executionScore':
    'Wynik wykonania Garmin zwraca wyłącznie dla treningów wykonanych według zaplanowanego workoutu. Ta aktywność go nie ma.',

  /* ---- ActivityFlags.svelte / activity-highlights.ts ---- */
  'flags.title': 'Warto zauważyć',
  'flags.subtitle': 'Rekordy i wartości, które wyglądają na błąd pomiaru',
  'flags.record': 'Rekord',
  'flags.notable': 'Wyróżnienie',
  'flags.highlightsAriaLabel': 'Wyróżnione wyniki',
  'flags.suspectsAriaLabel': 'Wartości wyglądające na błąd',
  'flags.suspectSevere': 'Podejrzana wartość',
  'flags.suspectMild': 'Do sprawdzenia',
  'flags.rankOf': '{rank} z {outOf} porównywalnych sesji',
  'highlight.metric.distance': 'Dystans',
  'highlight.metric.duration': 'Czas w ruchu',
  'highlight.metric.elevation': 'Przewyższenie',
  'highlight.metric.pace': 'Średnie tempo',
  'highlight.metric.speed': 'Średnia prędkość',
  'highlight.metric.load': 'Obciążenie treningowe',
  'highlight.metric.calories': 'Kalorie',
  'highlight.metric.normPower': 'Moc znormalizowana',
  'highlight.tiedAllTime': 'Wyrównany najlepszy wynik w historii',
  'highlight.tiedWindow': 'Wyrównany najlepszy wynik w ostatnich {span}',
  'highlight.recordAllTime': 'Rekord — najlepszy wynik w historii',
  'highlight.recordWindow': 'Najlepszy wynik w ostatnich {span}',
  'highlight.bestSince': 'Najlepszy od {span}',
  'highlight.rankAllTime': '{rank}. najlepszy wynik w historii',
  'highlight.rankWindow': '{rank}. najlepszy wynik w ostatnich {span}',
  'highlight.months': {
    one: '{count} miesiąca',
    few: '{count} miesięcy',
    many: '{count} miesięcy',
    other: '{count} miesięcy'
  },
  'highlight.span.years': '{years} lat',
  'highlight.span.syncedHistory': 'zsynchronizowanej historii',
  'suspect.label.maxSpeed': 'Maks. prędkość',
  'suspect.label.elevation': 'Przewyższenie',
  'suspect.label.maxHr': 'Maks. tętno',
  'suspect.label.distanceTime': 'Dystans i czas',
  'suspect.label.movingTime': 'Czas w ruchu',
  'suspect.label.cadence': 'Kadencja',
  'suspect.zeroSamples': '{count} próbek zerowych',
  'suspect.speedCeiling':
    'Powyżej {ceiling} km/h dla tego sportu — praktycznie zawsze skok GPS, nie rzeczywista prędkość. Średnie liczone ze strumienia prędkości też będą przez to zawyżone.',
  'suspect.speedSpike':
    '{ratio}× więcej niż średnia {avg} km/h. Zwykle pojedynczy skok GPS, np. po wyjściu z tunelu albo spod drzew.',
  'suspect.elevationPerKm':
    '{perKm} m na kilometr. Powyżej {ceiling} m/km to zwykle dryf barometru albo wysokość liczona z GPS, a nie taki podbieg.',
  'suspect.maxHrCeiling':
    '{ceiling} bpm i więcej to niemal zawsze artefakt paska — najczęściej złapana kadencja albo zakłócenie na starcie, zanim pasek się zwilżył.',
  'suspect.hrSpike':
    'O {gap} bpm powyżej średniej {avg} bpm. Przy treningu ciągłym taka różnica to raczej pojedynczy skok niż wysiłek.',
  'suspect.speedMismatch':
    'Dystans podzielony przez czas daje {implied} km/h, a zegarek raportuje średnią {avg} km/h — rozjazd {drift}%. Zwykle znaczy to, że część zapisu zginęła albo dystans pochodzi z innego źródła niż prędkość.',
  'suspect.movingOverElapsed':
    'Czas w ruchu jest dłuższy od całkowitego, co nie jest możliwe. Najczęściej efekt sklejenia zapisu po pauzie albo wznowienia aktywności.',
  'suspect.cadenceGap':
    'Najdłuższy ciąg zer to {gap} próbek pod rząd. Przy zapisie sekundowym to około {minutes} min bez sygnału — zwykle czujnik odpadł, a średnia kadencja jest przez to zaniżona.',

  /* ---- ActivityEfficiency.svelte ---- */
  'efficiency.title': 'Wydolność tlenowa',
  'efficiency.subtitle': 'Ile kosztowało jedno uderzenie serca — i czy ten koszt rósł w trakcie',
  'efficiency.shape.even.label': 'Równo',
  'efficiency.shape.even.text':
    'Obie połowy w podobnym tempie, bez dużych wahań. Tak wygląda dobrze rozłożona jednostka ciągła.',
  'efficiency.shape.negativeSplit.label': 'Negative split',
  'efficiency.shape.negativeSplit.text':
    'Druga połowa szybsza od pierwszej. To rozkład, o który walczy się na zawodach — start pod kontrolą, finisz mocniej.',
  'efficiency.shape.faded.label': 'Odpadnięcie',
  'efficiency.shape.faded.text':
    'Druga połowa wyraźnie wolniejsza. Klasyczny zbyt szybki start — albo dystans jeszcze poza zasięgiem obecnej formy.',
  'efficiency.shape.variable.label': 'Zmienne tempo',
  'efficiency.shape.variable.text':
    'Duży rozrzut tempa między fragmentami. Tak wygląda trening interwałowy albo bardzo pofałdowana trasa — bilans połówek nic tu nie znaczy.',
  'efficiency.decouplingLabelPower': 'Rozejście tętna i mocy',
  'efficiency.decouplingLabelPace': 'Rozejście tętna i tempa',
  'efficiency.decoupling.coupled.label': 'Spięty',
  'efficiency.decoupling.coupled.text':
    'Tempo na uderzenie serca utrzymało się w drugiej połowie (do {limit}% uznajemy za stabilne). Tak wygląda dobrze rozłożony wysiłek tlenowy.',
  'efficiency.decoupling.drifted.label': 'Rozjechany',
  'efficiency.decoupling.drifted.text':
    'Druga połowa kosztowała więcej uderzeń na ten sam efekt. Typowe przyczyny: zbyt szybki start, upał, za mało paliwa albo dystans jeszcze poza zasięgiem formy tlenowej.',
  'efficiency.decoupling.accelerated.label': 'Przyspieszony',
  'efficiency.decoupling.accelerated.text':
    'Druga połowa była tańsza niż pierwsza — zwykle znaczy to bardzo spokojny start albo długą rozgrzewkę wliczoną w zapis.',
  'efficiency.decoupling.meta':
    'Druga połowa vs pierwsza, po {samples} próbek na połowę. Liczone z całego zapisu — dla treningu interwałowego ta liczba nie ma sensu.',
  'efficiency.paceLabel': 'Rozkład tempa',
  'efficiency.secondHalfUnit': 'druga połowa',
  'efficiency.pacing.meta':
    'Połowy dzielone po DYSTANSIE, nie po czasie — inaczej odpadnięcie byłoby zaniżone. {first} vs {second} min/km. Rozrzut tempa między {chunks} fragmentami: {variability}%.',
  'efficiency.efLabel': 'Współczynnik wydolności',
  'efficiency.efText':
    'Metrów na minutę na jedno uderzenie. Rośnie, gdy to samo tempo kosztuje mniej — to sygnał formy tlenowej, niezależny od tego, jak mocno się starało.',
  'efficiency.powerEfLabel': 'Wydolność na mocy',
  'efficiency.powerEfUnit': 'W/bpm',
  'efficiency.powerEfText': 'Watów na uderzenie serca — rowerowy odpowiednik powyższego.',
  'efficiency.cardiacCostLabel': 'Koszt sercowy',
  'efficiency.cardiacCostUnit': 'ud./km',
  'efficiency.cardiacCostText':
    'Tyle uderzeń serca kosztował jeden kilometr. Mniej na tej samej trasie = lepsza forma.',

  /* ---- ActivityBestEfforts.svelte ---- */
  'bestEfforts.title': 'Najlepsze odcinki',
  'bestEfforts.subtitle':
    'Najszybszy fragment tej aktywności na każdym dystansie — także wtedy, gdy był tylko jej częścią',
  'bestEfforts.explainLabel': 'Jak liczymy te odcinki?',
  'bestEfforts.col.distance': 'Dystans',
  'bestEfforts.col.time': 'Czas',
  'bestEfforts.col.pace': 'Tempo',
  'bestEfforts.col.start': 'Start',
  'bestEfforts.col.measured': 'Zmierzono',
  'bestEfforts.explainWindow':
    'Okno pomiarowe pokrywa co najmniej zadany dystans, dlatego kolumna „zmierzono” pokazuje, ile metrów faktycznie objęło — tempo liczymy z tej wartości, a nie z dystansu nominalnego.',
  'bestEfforts.explainOvershoot':
    'Przy tym zapisie okna wyraźnie wychodzą poza dystans, co znaczy, że zegarek próbkował rzadko.',
  'bestEfforts.explainStart': '„Start” to czas od początku aktywności.',

  /* ---- ActivityClimbs.svelte ---- */
  'climbs.title': 'Podjazdy',
  'climbs.subtitle': 'Nie „ile przewyższenia”, a „co konkretnie wjechałem” — z VAM, czyli tempem wspinania',
  'climbs.hardest': 'Najtrudniejszy: {label}',
  'climbs.summaryUnit': 'wspinania',
  'climbs.summaryShare': ' · to {pct}% całego przewyższenia tej aktywności',
  'climbs.count': {
    one: 'podjazd',
    few: 'podjazdy',
    many: 'podjazdów',
    other: 'podjazdów'
  },
  'climbs.col.gain': 'Przewyższenie',
  'climbs.col.length': 'Długość',
  'climbs.col.grade': 'Nachylenie',
  'climbs.col.time': 'Czas',
  'climbs.col.vam': 'VAM',
  'climbs.col.start': 'Start',
  'climbs.col.category': 'Kategoria',
  'climbs.explainLabel': 'Jak liczymy podjazdy?',
  'climbs.explain':
    'Podjazd to ciągły wzrost o co najmniej 30 m przy średnim nachyleniu od 2%; krótkie zjazdy w środku go nie przerywają, bo prawdziwe drogi mają fałszywe płaskie. VAM liczymy z czasu całego podjazdu — postój w połowie faktycznie obniża tempo wspinania. Wysokość z barometru dryfuje, a z GPS jeszcze bardziej, więc kategorie traktuj jako orientacyjne.',

  /* ---- ActivityLapsPanel.svelte / activity-laps.ts ---- */
  'laps.splitsTitle': 'Bieg, marsz i postoje',
  'laps.splitsSubtitle': 'Klasyfikacja Garmina — udział czasu',
  'laps.splitsAriaLabel': 'Podział czasu na bieg, marsz i postoje',
  'laps.title': 'Okrążenia',
  'laps.subtitle': '{count} odcinków zapisanych przez zegarek',
  'laps.caption': 'Statystyki poszczególnych okrążeń',
  'laps.col.index': 'Nr',
  'laps.col.distance': 'Dystans',
  'laps.col.duration': 'Czas',
  'laps.col.pace': 'Tempo',
  'laps.col.speed': 'Prędkość',
  'laps.col.avgHr': 'Śr. tętno',
  'laps.col.maxHr': 'Maks. tętno',
  'laps.col.avgPower': 'Śr. moc',
  'laps.col.cadence': 'Kadencja',
  'laps.col.elevation': 'Podejście',
  'laps.col.calories': 'Kalorie',

  /* ---- ActivityMatchedRoute.svelte ---- */
  'matchedRoute.found': {
    one: 'Znaleziono {count} wcześniejsze przejście tej trasy',
    few: 'Znaleziono {count} wcześniejsze przejścia tej trasy',
    many: 'Znaleziono {count} wcześniejszych przejść tej trasy',
    other: 'Znaleziono {count} wcześniejszych przejść tej trasy'
  },
  'matchedRoute.fastestEver.label': 'Najszybszy raz',
  'matchedRoute.fastestEver.text': 'To najszybsze przejście tej trasy z tych, które udało się dopasować.',
  'matchedRoute.rankLabel': '{rank}. najszybszy raz',
  'matchedRoute.withinRange': 'Tempo tego przejścia mieści się wśród pozostałych.',
  'matchedRoute.gapToBest': 'Do najlepszego przejścia brakuje {gap} na kilometrze.',
  'matchedRoute.col.date': 'Data',
  'matchedRoute.col.pace': 'Tempo',
  'matchedRoute.col.time': 'Czas',
  'matchedRoute.col.distance': 'Dystans',
  'matchedRoute.col.hr': 'Tętno',
  'matchedRoute.col.overlap': 'Zgodność',
  'matchedRoute.thisActivity': 'ta aktywność',
  'matchedRoute.explainLabel': 'Jak dopasowujemy trasy?',
  'matchedRoute.explain':
    'Trasy dopasowujemy po pokryciu siatką około 50-metrowych komórek, przy zbliżonej długości — to prawdopodobnie ta sama trasa, nie dowód. Kolumna „zgodność” pokazuje, jak duże jest pokrycie. Kierunek nie ma znaczenia, więc ta sama trasa przebiegnięta na odwrót też się dopasuje. Porównano {count} zapisanych tras tego samego sportu.',
  'matchedRoute.emptyNoGps':
    'Ten trening nie ma zapisanej trasy GPS, więc nie da się go dopasować do wcześniejszych przejść. Spróbuj zakładki {similarTab}.',
  'matchedRoute.emptyNoMatch':
    'Nie znaleziono wcześniejszych przejść tej trasy. Trasa jest dopasowywana po nakładaniu się zapisu GPS, więc pierwszy przejazd nową drogą nigdy nie ma z czym się równać.',

  /* ---- SimilarActivities.svelte ---- */
  'similar.title': 'Porównaj z innymi treningami',
  'similar.subtitle': 'Dwa sposoby: podobny wysiłek albo dokładnie ta sama trasa.',
  'similar.tab.effort': 'Podobny wysiłek',
  'similar.tab.route': 'Ta sama trasa',
  'similar.tabsAriaLabel': 'Sposób porównania',
  'similar.emptyNoAxis':
    'Ten trening nie ma dystansu ani czasu, więc nie da się go porównać z innymi wysiłkami. Spróbuj zakładki {routeTab}.',
  'similar.emptyNoMatch':
    'Brak podobnych treningów. Szukaliśmy sesji tego samego sportu z dystansem i czasem w zakresie ±{tolerance}% — wśród {compared} nie było żadnej. Ten trening był dla Ciebie nietypowy.',
  'similar.comparedSessions': {
    one: '{count} porównywalnej sesji',
    few: '{count} porównywalnych sesji',
    many: '{count} porównywalnych sesji',
    other: '{count} porównywalnych sesji'
  },
  'similar.scope': '{matches} w zakresie ±{tolerance}% · porównano {compared}{recent}',
  'similar.matches': {
    one: '{count} dopasowanie',
    few: '{count} dopasowania',
    many: '{count} dopasowań',
    other: '{count} dopasowań'
  },
  'similar.comparedSessionsShort': {
    one: '{count} sesję',
    few: '{count} sesje',
    many: '{count} sesji',
    other: '{count} sesji'
  },
  'similar.recentOnly': ' (najnowsze)',
  'similar.col.date': 'Data',
  'similar.col.distance': 'Dystans',
  'similar.col.time': 'Czas',
  'similar.col.pace': 'Tempo',
  'similar.col.comparison': 'Dziś vs wtedy',
  'similar.metric.pace': 'tempo',
  'similar.metric.hr': 'tętno',
  'similar.metric.power': 'moc',
  'similar.delta.sameValue': 'bez zmian',
  'similar.delta.sameLabel': '{metric} bez zmian względem tego treningu',
  'similar.delta.lower': 'dziś {metric} niżej o {value} niż w tym treningu',
  'similar.delta.higher': 'dziś {metric} wyżej o {value} niż w tym treningu',

  /* ---- TrainingVerdict.svelte / activity-comparison.ts / activity-comparison.format.ts ---- */
  'verdict.title': 'Ocena treningu',
  'verdict.subtitle': 'Wobec Twoich własnych sesji z ostatnich 6 tygodni',
  'verdict.empty': 'Brak danych do oceny tego treningu.',
  'verdict.load': 'Obciążenie',
  'verdict.recentNorm': 'Norma 6 tyg.',
  'verdict.recentComparable': '{count} porównywalnych',
  'verdict.formBefore': 'Forma przed',
  'verdict.noHistory': 'brak historii',
  'verdict.fitness': 'Kondycja (CTL)',
  'verdict.dayBefore': 'w przeddzień',
  'verdict.loadRatio': 'sesja = {ratio}× CTL',
  'verdict.vsNorm': 'wzgl. normy',
  'verdict.ftpLine': 'FTP {ftp} W{estimated}',
  'verdict.ftpEstimatedSuffix': ' (szacowane z krzywej mocy)',
  'verdict.ftpMissing': 'Ustaw FTP w ustawieniach, aby zobaczyć IF i TSS.',
  'verdict.method.garmin': 'obciążenie z Garmina',
  'verdict.method.power': 'z mocy (TSS)',
  'verdict.method.hr': 'oszacowane z tętna',
  'verdict.method.none': 'brak źródła',
  'verdict.work': 'Praca',
  'verdict.plannedLabel': 'Zaplanowany trening',
  'verdict.plannedNoneScheduled':
    'Na ten dzień nie było w kalendarzu zaplanowanego treningu w tej dyscyplinie — ta sesja była poza planem.',
  'verdict.plannedNotSynced':
    'Nie mamy zsynchronizowanego kalendarza treningowego w okolicy tej daty, więc nie wiemy, czy sesja realizowała jakiś plan.',
  'verdict.band.fresh': 'świeżość',
  'verdict.band.optimal': 'forma optymalna',
  'verdict.band.neutral': 'równowaga',
  'verdict.band.fatigued': 'zmęczenie',
  'verdict.band.veryFatigued': 'duże zmęczenie',
  'verdict.easy': 'Lżejszy niż zwykle',
  'verdict.steady': 'Typowa sesja',
  'verdict.hard': 'Mocniejszy niż zwykle',
  'verdict.peak': 'Najmocniejszy od tygodni',
  'verdict.unknown': 'Brak porównania',
  'verdict.summary.noLoad':
    'Nie da się ocenić obciążenia tej aktywności — nie ma ani obciążenia z Garmina, ani zapisu tętna.',
  'verdict.summary.firstSession':
    'To pierwsza porównywalna sesja w ostatnich 6 tygodniach, więc nie ma jeszcze do czego jej odnieść.',
  'verdict.summary.noNorm': 'Brak wiarygodnej normy z ostatnich 6 tygodni.',
  'verdict.summary.typical': 'Obciążenie na poziomie {norm}.',
  'verdict.summary.harder': 'O {pct}% mocniejszy od {norm}.',
  'verdict.summary.lighter': 'O {pct}% lżejszy od {norm}.',
  'verdict.summary.norm': 'typowej sesji z ostatnich 6 tygodni ({count} porównywalnych)',
  'verdict.summary.form': 'Wchodziłeś w niego z formą {sign}{value} ({band}).',

  /* ---- activity-format.ts: shared enum dictionaries (training-effect benefit, typed-split class) ---- */
  'benefit.recovery': 'Regeneracja',
  'benefit.base': 'Baza tlenowa',
  'benefit.tempo': 'Tempo',
  'benefit.threshold': 'Próg mleczanowy',
  'benefit.vo2max': 'VO2 max',
  'benefit.anaerobicCapacity': 'Wydolność beztlenowa',
  'benefit.anaerobic': 'Beztlenowy',
  'benefit.speed': 'Szybkość',
  'benefit.sprint': 'Sprint',
  'benefit.maintaining': 'Podtrzymanie',
  'benefit.impactNone': 'Bez wpływu',
  'benefit.unknown': 'Nieokreślony',
  'benefit.noBenefit': 'Bez wyraźnej korzyści',
  'split.run': 'Bieg',
  'split.walk': 'Marsz',
  'split.stand': 'Postój',
  'split.interval': 'Interwał',
  'split.rest': 'Przerwa',
  'split.otherRest': 'Odpoczynek',
  'split.warmup': 'Rozgrzewka',
  'split.cooldown': 'Schłodzenie',
  'split.fallback': 'Odcinek',

  /* ---- modules/best-efforts (all-time PR leaderboard, distinct from the per-activity card above) ---- */
  'records.title': 'Rekordy życiowe',
  'records.subtitle':
    'Najszybsze odcinki z całej historii biegów — również te ukryte w środku dłuższych treningów.',
  'records.pr': 'PR',
  'records.prAriaLabel': 'Rekord życiowy',
  'records.rankAriaLabel': '{rank}. najlepszy wynik',
  'records.explainLabel': 'Jak liczymy te rekordy?',
  'records.explain':
    'Odcinek to najszybsze okno pokrywające co najmniej dany dystans, wyszukane w zapisanym tempie całej sesji — dlatego 5 km z długiego wybiegania liczy się tak samo jak 5 km z zawodów. Pokazujemy do {topN} najlepszych wyników na dystans; kliknij wiersz, żeby otworzyć tę aktywność.',
  'records.empty':
    'Brak rekordów. Odcinki liczymy z zapisanego tempa biegów — pojawią się tutaj, gdy synchronizacja pobierze i przeliczy strumienie aktywności (zakładka',

  'insights.strength.moderate': 'umiarkowana',
  'insights.strength.strong': 'silna',
  'insights.stat.range': 'Zakres',
  'insights.stat.total': 'Suma',
  'insights.stat.best': 'Najlepszy',
  'insights.stat.daysWithData': 'Dni z danymi',
  'insights.periodSubtitle': '{start} – {end} · {days} dni',

  'insights.trends': 'Trendy',
  'insights.anomalies': 'Anomalie',
  'insights.correlations': 'Korelacje',
  'insights.anomalyTitleHigh': '{label}: nietypowo wysoko {date}',
  'insights.anomalyTitleLow': '{label}: nietypowo nisko {date}',
  'insights.anomalyBody': 'Odczyt {value} — {sd} SD od Twojej bazy z {days} dni (odchylenie {severity}).',
  'insights.anomalySd': '±{sd} SD',
  'insights.correlationMeta': 'r = {r} · {days} dni',
  'insights.correlationHigher': 'Więcej „{a}” zwykle wiąże się z wyższym „{b}”.',
  'insights.correlationLower': 'Więcej „{a}” zwykle wiąże się z niższym „{b}”.',

  /* ------------------------------------------------------------------ *
   * Spec 087 — the predicted race time, day by day
   * ------------------------------------------------------------------ */
  'predHistory.title': 'Historia przewidywań',
  'predHistory.subtitle':
    'Jak przewidywany czas zmieniał się dzień po dniu — przeliczany na nowo z rekordów, które obowiązywały danego dnia',
  'predHistory.filterLabel': 'Dystans',
  'predHistory.chartLabel': 'przewidywany czas',
  'predHistory.netHeading': 'Zmiana w tym zakresie',
  'predHistory.netFaster': 'Szybciej o {value} niż na początku zakresu.',
  'predHistory.netSlower': 'Wolniej o {value} niż na początku zakresu.',
  'predHistory.netFlat': 'Bez zmian — rekord, z którego liczona jest ta prognoza, nie drgnął w tym zakresie.',
  'predHistory.netUnknown': 'Za mało dni z podstawą w tym zakresie, żeby mówić o zmianie.',
  'predHistory.note':
    'Każdy punkt to ta sama prognoza co w karcie wyżej, policzona od nowa z rekordów obowiązujących tamtego dnia — nie interpolacja między nimi. Linia stoi w miejscu między rekordami, bo najlepszy wynik też stoi. To wyłącznie model Riegela z Twoich zmierzonych odcinków; tempo krytyczne tu nie wchodzi, więc liczby mogą się różnić od tych z karty wyżej. Dzień bez podstawy to przerwa, nie zero.',

  'readiness.band.low': 'Niska',
  'readiness.band.moderate': 'Umiarkowana',
  'readiness.band.high': 'Wysoka',
  'readiness.band.peak': 'Szczytowa',

  // Spec 084: the score's own limits, its forecast, and the honest refusals.
  'readiness.limit.recovery': 'Zegar regeneracji',
  'readiness.limit.hrv': 'HRV poza pasmem',
  'readiness.limit.load': 'Obciążenie treningowe',
  'readiness.limitedBy': 'Kanały same dają {composite}, ale {limit} obniża wynik do {score}.',
  'readiness.limitedByMany': 'Kanały same dają {composite}, ale {limits} obniżają wynik do {score}.',
  'readiness.limitJoin': ' i ',
  'readiness.channelsAriaLabel': 'Kanały gotowości',
  'readiness.limitsAriaLabel': 'Co ogranicza gotowość',
  'readiness.derived': 'liczone u nas',
  'readiness.derivedNote':
    'Garmin nie podał dziś swoich czynników, więc te kanały liczymy z surowych danych.',
  'readiness.fullyReadyToday': 'Nic Cię dziś nie ogranicza',
  'readiness.fullyReadyOn': 'Pełna gotowość: {day}',
  'readiness.fullyReadyUnknown': 'Kiedy wrócisz do pełnej gotowości — nie umiemy jeszcze powiedzieć',
  'readiness.recoveredAt': 'Zegar regeneracji zeruje się {when}',
  'readiness.clearsOn': 'ustąpi {day}',
  'readiness.clearsAt': 'ustąpi {when}',
  'readiness.clearsUnknown': 'bez prognozy',
  'readiness.hrvProjection': 'przy nocach na poziomie {nightly} ms',
  'readiness.garminReference': 'Garmin: {score}',
  'readiness.explainTitle': 'Skąd ta liczba',
  'readiness.explainBody':
    'Wynik odpowiada na pytanie „jak bardzo jestem dziś gotowy do treningu”. Liczymy go z bezwzględnych wejść — ocena ostatniej nocy, żywy zegar regeneracji, HRV względem Twojego pasma, obciążenie i historia stresu — a nie z odchylenia od średniej z ostatnich 30 dni.',
  'readiness.explainLimits':
    'Kanały są średnią ważoną, ale każde wejście, które samo mówi „nie trenuj dziś mocno”, nakłada sufit i przybija wynik, zamiast rozpuścić się w średniej. Dobrze przespana noc nie spłaca 61-godzinnego długu regeneracyjnego.',
  'readiness.explainBands': 'Progi: poniżej 40 niska, 40–59 umiarkowana, 60–79 wysoka, od 80 szczytowa.',
  'readiness.explainDisclaimer': 'Sygnał wellness, nie diagnoza medyczna.',
  'readiness.explainGarmin':
    'Garmin dostaje te same czynniki, ale składa je własnym, nieujawnionym wzorem, więc obie liczby nadal mogą się różnić. Nie próbujemy odtworzyć jego wyniku — chcemy taki, który da się przeczytać linia po linii.',
  'readiness.explainLabel': 'Jak liczymy ten wynik?',

  'readiness.title': 'Gotowość',
  'readiness.subtitle': 'Jak bardzo jesteś dziś gotowy do treningu i kiedy wrócisz do pełnej formy',
  'readiness.notEnabled':
    'Gotowość korzysta z Twoich wielodniowych metryk. Włącz tryb zaawansowany, aby ją uruchomić.',
  'readiness.notEnoughData': 'Za mało danych — synchronizuj zegarek i wróć za kilka dni.',
  'readiness.driversAriaLabel': 'Czynniki gotowości',

  /* ------------------------------------------------------------------ *
   * Plan kontra wykonanie (spec 085)
   * ------------------------------------------------------------------ */
  'plan.title': 'Plan kontra wykonanie',
  'plan.subtitle': 'Co miało być, co było i co poprawić następnym razem',
  'plan.origin.authored': 'Twój plan',
  'plan.origin.garmin': 'Plan z Garmina',
  'plan.kind.race': 'Start',
  'plan.kind.note': 'Notatka',
  'plan.compliance': 'zgodności z planem',
  'plan.complianceAriaLabel': 'Zgodność z planem',
  'plan.noTargets': 'Ten wpis w kalendarzu nie ma mierzalnych celów do porównania.',
  'plan.tableCaption': 'Cele planu wobec wykonania',
  'plan.col.metric': 'Cel',
  'plan.col.target': 'Plan',
  'plan.col.actual': 'Wykonanie',
  'plan.col.met': 'Ocena',
  'plan.met.yes': 'Zgodnie z planem',
  'plan.met.no': 'Poza planem',
  'plan.met.unknown': 'Brak pomiaru',
  'plan.step.duration': 'Czas',
  'plan.step.distance': 'Dystans',
  'plan.step.load': 'Obciążenie',
  'plan.step.pace': 'Tempo',
  'plan.step.power': 'Moc',
  'plan.step.hr': 'Tętno',
  'plan.rangeFrom': 'od {value}',
  'plan.rangeTo': 'do {value}',
  'plan.takeawaysTitle': 'Na następny raz',
  'plan.takeaway.over': '{metric} o {pct}% powyżej planu — następnym razem trzymaj się założeń.',
  'plan.takeaway.under': '{metric} o {pct}% poniżej planu — następnym razem dokończ sesję zgodnie z planem.',
  'plan.takeaway.harder':
    'Sesja wyszła o {pct}% mocniej, niż zakładał plan ({metric}) — następnym razem trzymaj przedział z planu.',
  'plan.takeaway.easier':
    'Sesja wyszła o {pct}% lżej, niż zakładał plan ({metric}) — następnym razem trzymaj przedział z planu.',
  'plan.strip.title': 'Struktura treningu',
  'plan.strip.plannedLabel': 'Plan',
  'plan.strip.ariaLabel': 'Zaplanowana struktura treningu na osi czasu',
  'plan.strip.note': 'Bloki planu na tej samej osi czasu co wykresy poniżej.',
  'plan.stepKind.warmup': 'Rozgrzewka',
  'plan.stepKind.work': 'Praca',
  'plan.stepKind.recovery': 'Przerwa',
  'plan.stepKind.rest': 'Odpoczynek',
  'plan.stepKind.cooldown': 'Schłodzenie',
  'plan.stepRepeat': '{kind} {index}/{total}',
  'plan.stepMarkerLap': '{kind} — do przycisku lap',
  'plan.stepMarkerCalories': '{kind} — do spalenia kalorii',

  /* ------------------------------------------------------------------ *
   * Które okrążenie to który krok planu (spec 091)
   * ------------------------------------------------------------------ */
  'plan.stepNth': '{kind} {index}',
  'plan.source.perStep':
    'Intensywność liczona z okrążeń dopasowanych do kolejnych kroków planu — każdy odcinek oceniony osobno.',
  'plan.source.average':
    'Nie udało się dopasować okrążeń do kroków planu, więc intensywność liczona ze średniej całej sesji. Na treningu z przerwami średnia wypada między przedziałem pracy a przerwą.',
  'plan.strip.executedLabel': 'Wykonanie',
  'plan.strip.executedAriaLabel': 'Rzeczywisty przebieg kroków planu na osi czasu',
  'error.activityNotFound': 'Nie znaleziono aktywności',
  'error.tooManyAttempts': 'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.',
  'auth.missingCode': 'Brak kodu autoryzacji.',

  'auth.sessionExpired': 'Sesja logowania wygasła. Spróbuj ponownie.',
  'auth.invalidState': 'Nieprawidłowy stan logowania. Spróbuj ponownie.',
  'auth.verificationFailed': 'Nie udało się zweryfikować logowania Google.',
  'auth.noAccountForGoogleEmail':
    'Nie znaleziono konta dla tego adresu Google. Poproś administratora o utworzenie konta.',
  'auth.invalidCredentials': 'Nieprawidłowa nazwa użytkownika, e-mail lub hasło.',

  'onboarding.title': 'Utwórz konto administratora',
  'onboarding.subtitle': 'To jednorazowy krok — utwórz pierwsze konto, aby zacząć korzystać z OpenVitals.',
  'onboarding.emailLabel': 'E-mail',
  'onboarding.usernameLabel': 'Nazwa użytkownika',
  'onboarding.passwordLabel': 'Hasło',
  'onboarding.confirmPasswordLabel': 'Powtórz hasło',
  'onboarding.submit': 'Utwórz konto administratora',
  'onboarding.error.invalid_email': 'Wpisz prawidłowy adres e-mail.',
  'onboarding.error.email_taken': 'Ten adres e-mail jest już używany.',
  'onboarding.error.invalid_username':
    'Nazwa użytkownika musi mieć 3–32 znaki: małe litery, cyfry, "_" lub "-".',
  'onboarding.error.username_taken': 'Ta nazwa użytkownika jest już zajęta.',
  'onboarding.error.invalid_password': 'Hasło musi mieć 10–72 bajty.',
  'onboarding.error.password_mismatch': 'Hasła nie są takie same.',

  'admin.users.navLabel': 'Administracja',
  'admin.users.pageTitle': 'Użytkownicy',
  'admin.users.newUserButton': 'Nowy użytkownik',
  'admin.users.tableCaption': 'Lista kont w tej instalacji',
  'admin.users.colUsername': 'Nazwa użytkownika',
  'admin.users.colEmail': 'E-mail',
  'admin.users.colName': 'Imię',
  'admin.users.colAdmin': 'Rola',
  'admin.users.colMethods': 'Logowanie',
  'admin.users.colCreated': 'Utworzono',
  'admin.users.colActions': 'Akcje',
  'admin.users.adminBadge': 'Administrator',
  'admin.users.memberBadge': 'Użytkownik',
  'admin.users.passwordBadge': 'Hasło',
  'admin.users.googleBadge': 'Google',
  'admin.users.createTitle': 'Nowy użytkownik',
  'admin.users.editTitle': 'Edytuj użytkownika',
  'admin.users.emailLabel': 'E-mail',
  'admin.users.usernameLabel': 'Nazwa użytkownika',
  'admin.users.initialPasswordLabel': 'Hasło początkowe (opcjonalnie)',
  'admin.users.resetPasswordLabel': 'Nowe hasło (opcjonalnie)',
  'admin.users.resetPasswordHelp': 'Wypełnij, aby ustawić nowe hasło dla tego użytkownika.',
  'admin.users.isAdminLabel': 'Administrator',
  'admin.users.deleteConfirmTitle': 'Usunąć tego użytkownika?',
  'admin.users.deleteConfirmBody':
    'Konto {username} zostanie usunięte wraz z jego sesjami. Tej operacji nie można odwrócić.',
  'admin.users.lastAdminTitle': 'Nie można usunąć jedynego administratora',
  'admin.users.lastAdminBody':
    'Ten użytkownik jest jedynym administratorem. Nadaj rolę administratora innemu kontu, zanim usuniesz to konto lub odbierzesz mu tę rolę.',
  'admin.users.error.invalid_email': 'Wpisz prawidłowy adres e-mail.',
  'admin.users.error.email_taken': 'Ten adres e-mail jest już używany.',
  'admin.users.error.invalid_username':
    'Nazwa użytkownika musi mieć 3–32 znaki: małe litery, cyfry, "_" lub "-".',
  'admin.users.error.username_taken': 'Ta nazwa użytkownika jest już zajęta.',
  'admin.users.error.invalid_password': 'Hasło musi mieć 10–72 bajty.',
  'admin.users.saveErrorBanner': 'Nie udało się zapisać zmian. Sprawdź pola poniżej.',

  'account.title': 'Moje konto',
  'account.subtitle': 'Sposób logowania i hasło do tego konta',
  'account.usernameLabel': 'Nazwa użytkownika',
  'account.emailLabel': 'E-mail',
  'account.passwordStatusLabel': 'Hasło',
  'account.passwordSet': 'Ustawione',
  'account.passwordNotSet': 'Nie ustawione',
  'account.googleStatusLabel': 'Google',
  'account.googleLinked': 'Połączone',
  'account.googleNotLinked': 'Nie połączone',
  'account.setPasswordTitle': 'Ustaw hasło',
  'account.changePasswordTitle': 'Zmień hasło',
  'account.currentPasswordLabel': 'Obecne hasło',
  'account.newPasswordLabel': 'Nowe hasło',
  'account.confirmPasswordLabel': 'Powtórz nowe hasło',
  'account.password.saved': 'Hasło zapisane.',
  'account.password.error.wrongCurrent': 'Obecne hasło jest nieprawidłowe.',
  'account.password.error.mismatch': 'Hasła nie są takie same.',
  'account.password.error.invalid': 'Hasło musi mieć 10–72 bajty.',
  'account.password.error.network': 'Błąd sieci. Spróbuj ponownie.',
  'account.sessions.title': 'Aktywne sesje',
  'account.sessions.subtitle': 'Urządzenia, na których jesteś zalogowany',
  'account.sessions.tableCaption': 'Twoje własne aktywne sesje',
  'account.sessions.colDevice': 'Urządzenie',
  'account.sessions.colIp': 'Adres IP',
  'account.sessions.colCreated': 'Zalogowano',
  'account.sessions.colExpires': 'Wygasa',
  'account.sessions.colActions': 'Akcje',
  'account.sessions.thisDevice': 'To urządzenie',
  'account.sessions.revokeButton': 'Wyloguj to urządzenie',
  'account.sessions.revokeOthersButton': 'Wyloguj inne urządzenia',
  'account.sessions.revokeOthersConfirmTitle': 'Wylogować wszystkie inne urządzenia?',
  'account.sessions.revokeOthersConfirmBody':
    'Każda inna aktywna sesja zostanie zakończona. To urządzenie zostanie zalogowane.',
  'account.sessions.revokeFailed': 'Nie udało się wylogować urządzenia.',
  'account.sessions.revokedOthers': 'Wylogowano {count} innych urządzeń.',

  'insights.subtitle': 'Gotowość, trendy, anomalie i korelacje z Twoich własnych metryk',
  'insights.connectTitle': 'Połącz Garmina, aby zobaczyć wnioski',
  'insights.connectSubtitle': 'Wnioski wymagają połączonego konta Garmin.',
  'insights.connectCta': 'Połącz na pulpicie →',
  'insights.enableTitle': 'Włącz tryb zaawansowany',
  'insights.enableSubtitle': 'Wnioski powstają z Twoich wielodniowych metryk.',
  'insights.notEnoughTrends': 'Za mało danych, aby pokazać trendy.',
  'insights.nothingUnusualTitle': 'Nic nietypowego',
  'insights.nothingUnusualBody': 'Nic nietypowego — Twoje metryki są stabilne.',
  'insights.noCorrelations': 'Brak istotnych korelacji — pojawią się, gdy zbierzemy więcej dni.',
  'insights.chartsAriaLabel': 'Wykresy długiego okresu',
  'insights.metricsHeading': 'Metryki — {range}',
  'insights.stat.average': 'Średnia',
  'insights.stat.worst': 'Najsłabszy',
  'insights.strength.weak': 'słaba',
  'insights.noChartData': 'Brak danych w tym zakresie.',

  /* ------------------------------------------------------------------ *
   * Skąd się biorą strefy intensywności (spec 086)
   * ------------------------------------------------------------------ */
  'zones.explainLabel': 'Skąd się biorą te strefy?',
  'zones.explainTitle': 'Skąd się biorą te strefy',
  'zones.subtitleDefault': 'Czas spędzony w strefach',
  'zones.subtitleEstimated': 'Strefy tętna oszacowane z tętna maksymalnego tej aktywności',
  'zones.subtitleConfigured': 'Strefy tętna liczone od tętna maksymalnego z Twojego profilu',
  'zones.hrGarmin':
    'Tętno: to Twoje własne strefy, ustawione w Garmin Connect — my ich tutaj nie definiujemy. Garmin przysyła wyłącznie czas spędzony w każdej z nich, nigdy granic w uderzeniach na minutę, dlatego słupki mogą powiedzieć tylko „Strefa 1–5”.',
  'zones.hrEstimatedIntro':
    'Tętno: Garmin nie przysłał dla tej aktywności czasu w strefach, więc podzieliliśmy zapis tętna sami — według procentu tętna maksymalnego:',
  'zones.hrBand': 'Strefa {zone} — {range} tętna maksymalnego',
  'zones.hrEstimatedMax':
    'Za maksimum bierzemy najwyższe tętno zmierzone w tej sesji, a nie wartość z profilu. Najwyższa strefa jest więc niemal pewna, a cały podział jest tyle wart, ile to założenie.',
  'zones.hrConfiguredMax':
    'Za maksimum bierzemy {maxHr} bpm zapisane w Twoim profilu, a nie najwyższe tętno tej sesji — dzięki temu strefy z różnych treningów znaczą to samo.',
  'zones.hrSetInSettings':
    'Swoje tętno maksymalne zapiszesz w Ustawieniach → Atleta → Profil; wtedy podział przestaje zależeć od tego, jak mocno poszedłeś akurat tego dnia.',
  'zones.powerIntro': 'Moc: te strefy liczymy zawsze my — model Coggana Z1–Z7 jako procent FTP:',
  'zones.powerBand': '{name} · {range} FTP — {use}',
  'zones.power.z1.name': 'Z1 aktywna regeneracja',
  'zones.power.z1.use': 'rozruch i wytrzęsienie nóg, wysiłek ledwo odczuwalny',
  'zones.power.z2.name': 'Z2 wytrzymałość',
  'zones.power.z2.use': 'baza tlenowa, długie spokojne godziny',
  'zones.power.z3.name': 'Z3 tempo',
  'zones.power.z3.use': 'mocna jazda ciągła — szybko, ale jeszcze bez bólu',
  'zones.power.z4.name': 'Z4 próg',
  'zones.power.z4.use': 'praca wokół FTP, podnosi próg mleczanowy',
  'zones.power.z5.name': 'Z5 VO2max',
  'zones.power.z5.use': 'interwały 3–8 minut, pułap tlenowy',
  'zones.power.z6.name': 'Z6 beztlenowa',
  'zones.power.z6.use': 'wysiłki od 30 sekund do 3 minut, pojemność beztlenowa',
  'zones.power.z7.name': 'Z7 nerwowo-mięśniowa',
  'zones.power.z7.use': 'sprinty do 15 sekund, moc maksymalna',
  'zones.ftpConfigured': 'Procenty liczymy od FTP {ftp} W zapisanego w ustawieniach.',
  'zones.ftpEstimated':
    'Nie masz zapisanego FTP, więc bierzemy 95% najlepszej 20-minutowej mocy tej sesji: {ftp} W. Wszystko, co z niego wynika — strefy, IF, TSS — przesuwa się razem z tym oszacowaniem.',
  'zones.ftpSetInSettings':
    'Swoje FTP zapiszesz w Ustawieniach → Atleta → Profil; od tej pory strefy, IF i TSS liczą się od jednej, stałej wartości.',

  /* ------------------------------------------------------------------ *
   * Data page: coverage, sync run detail, diagnostics (spec 019)
   * ------------------------------------------------------------------ */
  'data.phase.activities': 'Aktywności',
  'data.phase.streams': 'Trasy / strumienie',
  'data.phase.weight': 'Waga',
  'data.phase.planned': 'Plan treningowy',
  'data.phase.workoutPush': 'Wysyłka treningów',
  'data.phase.metrics': 'Metryki dzienne',
  'data.summary.activities': '{count} aktywności ({pages} stron)',
  'data.summary.streams': '{count} pobranych',
  'data.summary.streamsEfforts': '{count} odcinków przeliczonych',
  'data.summary.streamsEffortsPending': '{count} odcinków w kolejce',
  'data.summary.weight': '{count} pomiarów',
  'data.summary.planned': '{count} zaplanowanych',
  'data.summary.plannedUnavailable': 'kalendarz niedostępny w Garminie',
  'data.summary.pushed': '{count} wysłanych',
  'data.summary.pending': '{count} w kolejce',
  'data.summary.unsupported': '{count} niewspieranych',
  'data.summary.metrics': '{count} dni z danymi (od {from})',

  'data.filter.problems': 'Problemy',
  'data.filter.errorsOnly': 'Tylko błędy',
  'data.phaseName.start': 'start',
  'data.phaseName.activities': 'aktywności',
  'data.phaseName.streams': 'trasy',
  'data.phaseName.weight': 'waga',
  'data.phaseName.planned': 'plan',
  'data.phaseName.workoutPush': 'wysyłka treningów',
  'data.phaseName.metrics': 'metryki',
  'data.phaseName.done': 'koniec',
  'data.code.rate_limited': 'limit zapytań',
  'data.code.token_rejected': 'token wygasł',
  'data.code.not_connected': 'brak połączenia',
  'data.code.sidecar_unreachable': 'usługa nie działa',
  'data.code.timeout': 'przekroczony czas',
  'data.code.blocked': 'zablokowane',
  'data.code.not_found': 'brak endpointu',
  'data.code.bad_response': 'zła odpowiedź',
  'data.code.upstream_error': 'błąd Garmina',
  'data.code.unsupported': 'niedostępne w tym trybie',

  'data.notConnected': 'Konto Garmin nie jest połączone. Połącz je w',
  'data.notConnectedTail': ', aby synchronizować dane.',
  'data.settingsLink': 'Ustawieniach',
  'data.refreshPrompt': 'Zalogowano. Chcesz teraz odświeżyć swoje dane z Garmina?',
  'data.runFailed': 'błąd',
  'data.fullSync': 'Pełna synchronizacja',
  'data.backfillTo': 'Uzupełnianie historii: pobrano wstecz do',
  'data.backfillRemaining': '· zostało ~{days} dni (do {target})',
  'data.backfillContinues': '· dociąganie trwa dalej przy kolejnych synchronizacjach.',
  'data.needsAction': ' · wymaga działania',
  'data.logEmptyForFilter': 'Brak wpisów dla wybranego filtru.',
  'data.sidecarLogTitle': 'Log usługi Garmin (Python)',
  'data.sidecarLogNote':
    'Szczegóły po stronie usługi łączącej się z Garminem — dokładny powód odrzucenia zapytania.',
  'data.sidecarRefresh': 'Odśwież log',
  'data.sidecarFetch': 'Pobierz log',
  'data.sidecarUnavailable': 'Log niedostępny: {reason}.',
  'data.sidecarEmpty': 'Brak wpisów — usługa nie odnotowała nic dla tego konta.',
  'data.tile.totalDistance': 'Łączny dystans',
  'data.storageLine':
    'W bazie: {metricDays} dni metryk · {activities} aktywności ({withGps} z GPS) · {streams} strumieni tras · {weight} pomiarów wagi',
  'data.coverageNote': 'Zakres dni zsynchronizowanych lokalnie dla każdej metryki.',
  'data.coverageEmpty': 'Brak danych. Uruchom pełną synchronizację, aby pobrać historię.',
  'data.syncTitle': 'Synchronizacja',
  'data.stop': 'Zatrzymaj',
  'data.downloadingStep': 'Pobieranie: {step}',
  'data.syncingEllipsis': 'Synchronizacja…',
  'data.runOk': 'ok',
  'data.watchBehindLead': 'Garmin ma dane najwyżej z',
  'data.staleYesterday': 'wczoraj',
  'data.staleDaysAgo': '{days} dni temu',
  'data.watchBehindRest':
    '. Synchronizacja pobrała wszystko, co Garmin ma — brakujących dni nie ma po jego stronie. Otwórz aplikację Garmin Connect na telefonie i zsynchronizuj zegarek, potem uruchom synchronizację tutaj.',
  'data.backfillComplete': 'Historia metryk dziennych jest kompletna.',
  'data.logTitle': 'Dziennik synchronizacji ({count})',
  'data.logFilterAriaLabel': 'Filtr dziennika',
  'data.tile.earliest': 'Dane od',
  'data.tile.weightCount': 'Pomiary wagi',
  'data.tile.storageSize': 'Rozmiar w bazie',
  'data.storageLineWithPlan':
    'W bazie: {metricDays} dni metryk · {activities} aktywności ({withGps} z GPS, {withWorkoutId} z planu) · {streams} strumieni tras · {weight} pomiarów wagi',
  'data.planInfoLabel': 'Co znaczy „z planu”?',
  'data.planInfoBody':
    '„z planu” = aktywności rozpoczęte z zaplanowanego treningu na zegarku. Tylko te wiążą się z planem po numerze; reszta jest dopasowywana orientacyjnie.',
  'data.coverageTitle': 'Pokrycie danych dziennych',
  'data.metricHeader': 'Metryka',
  'data.fromHeader': 'Od',
  'data.toHeader': 'Do',
  'data.phaseOk': 'OK',

  /* ------------------------------------------------------------------ *
   * Settings: version/update card (spec 068), integrations panel (spec 017)
   * ------------------------------------------------------------------ */
  'version.subtitle': 'Czy ta instalacja działa na najnowszym kodzie',
  'version.checking': 'Sprawdzanie…',
  'version.checkNow': 'Sprawdź aktualizacje',
  'version.runningLabel': 'Uruchomiona wersja',
  'version.status': 'Status',
  'version.asking': 'Pytam GitHuba…',
  'version.checkFailed': 'Nie udało się sprawdzić',
  'version.notConfigured': 'Sprawdzanie nieskonfigurowane',
  'version.notConfiguredHintLead': 'Ustaw',
  'version.notConfiguredHintMid': 'w',
  'version.notConfiguredHintTail': '— repozytorium jest prywatne.',
  'version.unreachable': 'GitHub nieosiągalny',
  'version.retryLater': 'Spróbuj ponownie za chwilę.',
  'version.behindBadge': 'Dostępna nowsza wersja',
  'version.upToDate': 'Aktualna',
  'version.latestCommit': 'Najnowszy commit',
  'version.whatNext': 'Co dalej',
  'version.manualDeployHint':
    'Wdrożenie jest ręczne: zaktualizuj kod na NAS-ie i uruchom stack ponownie. Ta karta tylko informuje — aplikacja celowo nie aktualizuje sama siebie.',

  'integrations.stravaTitle': 'Strava',
  'integrations.stravaSubtitle': 'Powiąż swoje aktywności Garmin z ich odpowiednikami w Strava.',
  'integrations.withingsTitle': 'Withings',
  'integrations.withingsSubtitle': 'Importuj pomiary wagi z konta Withings do lokalnego magazynu.',
  'integrations.connected': 'Połączono',
  'integrations.notConnected': 'Nie połączono',
  'integrations.linkedActivities': 'Powiązane aktywności: {count}',
  'integrations.weightReadings': 'Pomiary wagi: {count}',
  'integrations.linkActivities': 'Powiąż aktywności',
  'integrations.importWeight': 'Importuj wagę',
  'integrations.disconnect': 'Rozłącz',
  'integrations.connectStrava': 'Połącz ze Strava',
  'integrations.connectWithings': 'Połącz z Withings',
  'integrations.weightImported': 'Zaimportowano {count} pomiarów wagi.',
  'integrations.activitiesScanned': 'Przeskanowano {scanned}, powiązano {matched} aktywności.',
  'integrations.syncFailed': 'Synchronizacja nie powiodła się.',
  'integrations.demoLabel': 'Co znaczy „dane demonstracyjne”?',
  'integrations.demoNote':
    'Integracje działają teraz na danych demonstracyjnych. Po dodaniu kluczy API (Strava, Withings) do konfiguracji serwera połączą się z prawdziwymi kontami — bez zmian w kodzie.',

  'features.saveFailed': 'Nie udało się zapisać ustawienia.',
  'features.networkError': 'Nie udało się połączyć z serwerem. Spróbuj ponownie.',
  'features.autoSync.title': 'Automatyczne pobieranie danych',
  'features.autoSync.summary':
    'Pobieraj nowe dane z Garmina w tle, bez otwierania aplikacji. Po wyłączeniu dane odświeżysz ' +
    'ręcznie na stronie „Twoje dane”.',
  'features.workoutWrite.title': 'Zapis treningów do Garmina',
  'features.workoutWrite.summary':
    'Pozwól tej aplikacji zapisywać treningi na Twoim koncie Garmin. To jedyna funkcja, która ' +
    'cokolwiek tam zmienia. Po wyłączeniu nie ułożysz tu treningu i nic nie trafi na zegarek.',
  'features.workoutAutoPush.title': 'Wysyłaj treningi automatycznie',
  'features.workoutAutoPush.summary':
    'Przy każdej synchronizacji wysyłaj zaplanowane sesje do kalendarza Garmina. Po wyłączeniu ' +
    'trening trafia na zegarek dopiero po kliknięciu „Wyślij na Garmina” w planie.',
  'features.mcp.title': 'Serwer MCP',
  'features.mcp.summary':
    'Udostępniaj swoje dane klientom AI pod osobistym adresem MCP. Po wyłączeniu adres przestaje ' +
    'odpowiadać, ale token pozostaje ten sam.',
  'features.error.badRequest': 'Oczekiwano pól { featureId, enabled }.',
  'features.error.unknown': 'Nieznana funkcja.',

  /* ------------------------------------------------------------------ *
   * Training block: current week card (spec 073)
   * ------------------------------------------------------------------ */
  'block.title': 'Bieżący tydzień',
  'block.emptyState':
    'Żaden blok treningowy nie obejmuje dzisiejszego dnia. Blok to nazwany ciąg tygodni z celami objętości, tempami i stałymi zasadami — dzięki niemu asystent nie musi co rozmowę wyprowadzać od nowa, na jakim jesteś etapie.',
  'block.weekOf': 'tydzień {weekNumber} z {weeks}',
  'block.sorenessBannerTitle': 'Zgłoszony ból w ostatnim tygodniu',
  'block.sorenessBody':
    '{soreness}/10{location}, {day}. Przy takim sygnale ostrożniejszym wyborem jest ściąć objętość, nie dokładać.',
  'block.tile.actual': 'Objętość w tygodniu',
  'block.tile.target': 'Cel tygodnia',
  'block.tile.remaining': 'Zostało',
  'block.progressLabel': 'Realizacja celu objętości',
  'block.sessionsTitle': 'Sesje w tym tygodniu',
  'block.noSessions': 'Nie zaplanowano jeszcze żadnej sesji na ten tydzień.',
  'block.push.pushed': 'na zegarku',
  'block.push.pending': 'czeka na wysyłkę',
  'block.push.failed': 'wysyłka nieudana',
  'block.push.unsupported': 'Garmin nie przyjmie',
  'block.pacesTitle': 'Tempa bloku',
  'block.pace.easy': 'Spokojne',
  'block.pace.long': 'Długie',
  'block.pace.threshold': 'Próg',
  'block.pace.interval': 'Interwały',
  'block.pace.goal': 'Docelowe',
  'block.constraintsTitle': 'Stałe zasady',
  'block.goalLabel': 'Cel:',
  'block.goalDaysOut': 'za {days} dni',
  'block.goalPast': 'już za nami',

  /* ------------------------------------------------------------------ *
   * Landing page (logged out)
   * ------------------------------------------------------------------ */
  'baseHome.eyebrowBase': 'Tryb podstawowy',
  'baseHome.eyebrowActive': 'Tryb podstawowy jest aktywny',
  'baseHome.advanceTitle': 'Odblokuj tryb zaawansowany',

  'baseHome.perk.dashboard': 'Pulpit — dzisiejsza gotowość i najważniejsze metryki na jeden rzut oka.',
  'baseHome.perk.analytics': 'Analityka — wielodniowe trendy i statystyki dla każdej metryki.',
  'baseHome.perk.insights': 'Wnioski — gotowość, anomalie i korelacje liczone lokalnie, bez AI.',
  'baseHome.perk.range': 'Jeden przełącznik zakresu — 7, 14, 30 dni, rok albo cały czas, na każdej stronie.',
  'baseHome.onboardTitle': 'Podłącz Garmina i gotowe',
  'baseHome.onboardLede':
    'W trybie podstawowym łączysz swoje konto Garmin i dostajesz osobisty adres MCP dla asystenta AI. ' +
    '{emphasis} — pośredniczymy tylko w odczytach na Twoje żądanie.',
  'baseHome.onboardEmphasis': 'Nic nie przetwarzamy ani nie przechowujemy',
  'baseHome.step.signIn': 'Zaloguj się danymi Garmina — użyjemy ich jednorazowo, by pobrać tokeny dostępu.',
  'baseHome.step.tokens': 'Zapisujemy wyłącznie zaszyfrowane tokeny. Twoje hasło nie jest przechowywane.',
  'baseHome.step.mcp': 'Twój osobisty adres MCP staje się aktywny — skopiuj go z',
  'baseHome.step.mcpTail': 'do klienta AI.',
  'baseHome.settingsLink': 'Ustawień',
  'baseHome.connectTitle': 'Połącz konto Garmin',
  'baseHome.garminDownTitle': 'Usługa Garmin jest chwilowo niedostępna',
  'baseHome.garminDownBody':
    'Nie udało się połączyć z usługą Garmin. Twoje dane są bezpieczne — spróbujemy ponownie automatycznie.',
  'baseHome.advanceLede':
    'Na razie nic nie przetwarzamy — masz połączenie z Garminem i swój adres MCP. Włącz tryb ' +
    'zaawansowany, aby zobaczyć swoje dane w aplikacji:',
  'baseHome.advanceNote':
    'Przetwarzanie odbywa się w Twojej sesji, dane nie są sprzedawane ani wysyłane dalej. Zgodę możesz ' +
    'wycofać w każdej chwili i wrócić do trybu podstawowego.',
  'baseHome.consentUnavailable': 'Panel zgody jest chwilowo niedostępny.',
  'baseHome.mcpCardTitle': 'Adres MCP i połączenie',
  'baseHome.mcpCardSubtitle': 'Stan konta Garmin oraz Twój osobisty adres MCP znajdziesz w Ustawieniach.',
  'baseHome.openSettings': 'Otwórz ustawienia →',

  /* ------------------------------------------------------------------ *
   * Garmin Training Readiness (spec 059)
   * ------------------------------------------------------------------ */
  'garminReadiness.factor.sleep': 'Sen',
  'garminReadiness.factor.sleep_history': 'Historia snu',
  'garminReadiness.factor.hrv': 'HRV',
  'garminReadiness.factor.recovery': 'Regeneracja',
  'garminReadiness.factor.load': 'Obciążenie',
  'garminReadiness.factor.stress': 'Historia stresu',
  'garminReadiness.change.decreased': 'krótszy niż wczoraj',
  'garminReadiness.change.increased': 'dłuższy niż wczoraj',
  'garminReadiness.change.none': 'bez zmian',
  'garminReadiness.change.noChangeSleep': 'bez zmian po śnie',
  'garminReadiness.change.noChangeActivity': 'bez zmian po treningu',
  'garminReadiness.change.decreasedSleep': 'skrócony po śnie',
  'garminReadiness.change.decreasedActivity': 'skrócony po treningu',
  'garminReadiness.change.increasedActivity': 'wydłużony po treningu',

  'garminReadiness.head.prime': 'Garmin: gotowość szczytowa',
  'garminReadiness.head.high': 'Garmin: gotowość wysoka',
  'garminReadiness.head.moderate': 'Garmin: gotowość umiarkowana',
  'garminReadiness.head.low': 'Garmin: gotowość niska',
  'garminReadiness.head.poor': 'Garmin: gotowość bardzo niska',
  'garminReadiness.head.unknown': 'Garmin: gotowość bez oceny',
  'garminReadiness.level.prime': 'Szczytowa',
  'garminReadiness.level.high': 'Wysoka',
  'garminReadiness.level.moderate': 'Umiarkowana',
  'garminReadiness.level.low': 'Niska',
  'garminReadiness.level.poor': 'Bardzo niska',
  'garminReadiness.level.unknown': 'Bez oceny',

  'garminReadiness.stale': 'nieaktualne',
  'garminReadiness.dataFrom': 'dane z {day}',
  'garminReadiness.recovered': 'regeneracja zakończona',
  'garminReadiness.recoveryIn': 'do pełnej regeneracji {time}',
  'garminReadiness.recoveryInStale': 'do pełnej regeneracji {time} (stan na ten dzień)',
  'garminReadiness.basis': 'wynik Garmina, 0–100',
  'garminReadiness.factorsAriaLabel': 'Czynniki gotowości według Garmina',
  'garminReadiness.asOf': 'stan na {day}',

  /* ------------------------------------------------------------------ *
   * Condition / regeneration sentence (spec 022)
   * ------------------------------------------------------------------ */
  'condition.head.rested': 'Jesteś wypoczęty',
  'condition.head.steady': 'Regeneracja idzie swoim torem',
  'condition.head.strained': 'Organizm jest obciążony',
  'condition.head.unknown': 'Za mało danych, żeby ocenić regenerację',
  'condition.unknownTail': 'synchronizuj zegarek przez kilka dni, a policzymy resztę.',
  'condition.sleepClause': 'sen {duration}',

  'condition.recoveryEndToday': 'dziś {time}',
  'condition.recoveryEndTomorrow': 'jutro {time}',
  'condition.recoveryEndOn': '{day}, {time}',

  'condition.aboveBaseline': 'powyżej bazy',
  'condition.belowBaseline': 'poniżej bazy',
  'condition.dataFrom': 'dane z {day}',
  'condition.state.rested': 'Wypoczęty',
  'condition.state.steady': 'Stabilnie',
  'condition.state.strained': 'Obciążony',
  'condition.state.unknown': 'Brak oceny',
  'condition.title': 'Regeneracja',
  'condition.subtitle': 'Twoja gotowość, ostatnia noc i kanały odnowy względem Twojej własnej bazy',
  'condition.notConnected': 'Połącz konto Garmin, aby zobaczyć swoją regenerację.',
  'condition.connectCta': 'Połącz w Ustawieniach →',
  'condition.noScore': 'Za mało danych, żeby policzyć wynik.',
  'condition.recoveredLabel': 'wg Garmina jesteś zregenerowany',
  'condition.recoveryLabel': 'do pełnej regeneracji wg Garmina',
  'condition.recoveryLabelStale': 'do pełnej regeneracji wg Garmina — stan na {day}',
  'condition.recoveryEndLabel': 'pełna regeneracja: {when}',
  'condition.noGarminScore': 'Garmin nie przysłał dla tego konta swojego wyniku gotowości.',
  'condition.lastNightTitle': 'Ostatnia noc',
  'condition.sleepLabel': 'snu',
  'condition.readout.sleepScore': 'Wynik snu',
  'condition.readout.efficiency': 'Efektywność',
  'condition.readout.bedTime': 'Zaśnięcie',
  'condition.readout.wakeTime': 'Pobudka',
  'condition.stage.deep': 'Głęboki',
  'condition.stage.rem': 'REM',
  'condition.stage.light': 'Lekki',
  'condition.stage.awake': 'Czuwanie',
  'condition.sleepStagesAriaLabel': 'Fazy snu',
  'condition.channelsTitle': 'Kanały odnowy',
  'condition.channelsSubtitle': 'vs ostatnie {days} dni',
  'condition.channelDelta': '{delta} vs {baseline}',
  'condition.batteryPeriod': 'ostatnia doba',
  'condition.staleBanner':
    'Garmin nie ma danych nowszych niż {day} — wszystko poniżej opisuje tamten dzień, nie dzisiaj. Nasza synchronizacja pobrała już wszystko, co Garmin ma: zsynchronizuj zegarek z aplikacją Garmin Connect na telefonie.',
  'condition.readyLabel': 'gotowy',

  /* ------------------------------------------------------------------ *
   * Sport families
   * ------------------------------------------------------------------ */
  'sportGroup.ride': 'Rower',
  'sportGroup.run': 'Bieg',
  'sportGroup.walk': 'Marsz',
  'sportGroup.swim': 'Pływanie',
  'sportGroup.strength': 'Siła',
  'sportGroup.other': 'Inne',

  /* ------------------------------------------------------------------ *
   * Sports — keys are Garmin `activityType.typeKey` values (spec 020)
   * ------------------------------------------------------------------ */
  'sport.cycling': 'Rower',
  'sport.road_biking': 'Rower szosowy',
  'sport.mountain_biking': 'Rower górski',
  'sport.gravel_cycling': 'Gravel',
  'sport.cyclocross': 'Przełaje',
  'sport.downhill_biking': 'Rower zjazdowy',
  'sport.virtual_ride': 'Rower wirtualny',
  'sport.indoor_cycling': 'Rower stacjonarny',
  'sport.track_cycling': 'Kolarstwo torowe',
  'sport.bmx': 'BMX',
  'sport.recumbent_cycling': 'Rower poziomy',
  'sport.handcycling': 'Handbike',
  'sport.indoor_handcycling': 'Handbike stacjonarny',
  'sport.e_bike_fitness': 'Rower elektryczny',
  'sport.e_bike_mountain': 'Rower elektryczny górski',
  'sport.ebikeride': 'Rower elektryczny',

  'sport.running': 'Bieg',
  'sport.trail_running': 'Bieg terenowy',
  'sport.street_running': 'Bieg uliczny',
  'sport.track_running': 'Bieg na stadionie',
  'sport.treadmill_running': 'Bieżnia',
  'sport.indoor_running': 'Bieg w hali',
  'sport.virtual_run': 'Bieg wirtualny',
  'sport.obstacle_run': 'Bieg z przeszkodami',
  'sport.ultra_run': 'Bieg ultra',

  'sport.swimming': 'Pływanie',
  'sport.lap_swimming': 'Pływanie (basen)',
  'sport.open_water_swimming': 'Pływanie (wody otwarte)',

  'sport.walking': 'Marsz',
  'sport.casual_walking': 'Spacer',
  'sport.speed_walking': 'Marsz szybki',
  'sport.indoor_walking': 'Marsz w pomieszczeniu',
  'sport.hiking': 'Wędrówka',
  'sport.rucking': 'Marsz z obciążeniem',
  'sport.mountaineering': 'Turystyka wysokogórska',

  'sport.strength_training': 'Siłownia',
  'sport.functional_strength': 'Trening funkcjonalny',
  'sport.indoor_cardio': 'Trening cardio',
  'sport.cardio_training': 'Trening cardio',
  'sport.hiit': 'Trening interwałowy (HIIT)',
  'sport.pilates': 'Pilates',
  'sport.elliptical': 'Orbitrek',
  'sport.stair_climbing': 'Stepper',
  'sport.indoor_rowing': 'Wioślarstwo (ergometr)',

  'sport.yoga': 'Joga',
  'sport.breathwork': 'Oddech',
  'sport.meditation': 'Medytacja',
  'sport.stretching': 'Rozciąganie',
  'sport.rowing': 'Wioślarstwo',
  'sport.kayaking': 'Kajak',
  'sport.canoeing': 'Kanadyjka',
  'sport.stand_up_paddleboarding': 'Deska SUP',
  'sport.whitewater_rafting': 'Rafting',
  'sport.sailing': 'Żeglarstwo',
  'sport.surfing': 'Surfing',
  'sport.windsurfing': 'Windsurfing',
  'sport.kitesurfing': 'Kitesurfing',
  'sport.inline_skating': 'Rolki',
  'sport.skateboarding': 'Deskorolka',
  'sport.ice_skating': 'Łyżwy',
  'sport.skate_skiing': 'Narty biegowe (łyżwa)',
  'sport.cross_country_skiing': 'Narty biegowe',
  'sport.cross_country_skiing_ws': 'Narty biegowe',
  'sport.backcountry_skiing': 'Skitury',
  'sport.resort_skiing': 'Narty zjazdowe',
  'sport.resort_skiing_snowboarding_ws': 'Narty / snowboard',
  'sport.snowboarding': 'Snowboard',
  'sport.snowshoeing': 'Rakiety śnieżne',
  'sport.snowmobiling': 'Skuter śnieżny',
  'sport.rock_climbing': 'Wspinaczka skałkowa',
  'sport.indoor_climbing': 'Wspinaczka (ścianka)',
  'sport.bouldering': 'Bouldering',
  'sport.tennis': 'Tenis',
  'sport.table_tennis': 'Tenis stołowy',
  'sport.padel': 'Padel',
  'sport.squash': 'Squash',
  'sport.badminton': 'Badminton',
  'sport.soccer': 'Piłka nożna',
  'sport.basketball': 'Koszykówka',
  'sport.volleyball': 'Siatkówka',
  'sport.golf': 'Golf',
  'sport.boxing': 'Boks',
  'sport.horseback_riding': 'Jazda konna',
  'sport.fishing': 'Wędkarstwo',
  'sport.hunting': 'Łowiectwo',
  'sport.triathlon': 'Triatlon',
  'sport.multi_sport': 'Multisport',
  'sport.transition': 'Strefa zmian',
  'sport.winter_sports': 'Sporty zimowe',
  'sport.other': 'Inne',

  /* ------------------------------------------------------------------ *
   * lib/server/analytics — pure compute modules (spec 076 backfill).
   * These are display strings threaded through an optional `Translator`
   * so a pure `lib/server/analytics/*.ts` module still renders the
   * reader's locale, not just the Polish default.
   * ------------------------------------------------------------------ */
  'runnerProfile.axis.speed.label': 'Szybkość',
  'runnerProfile.axis.speed.hint': 'Najlepsze 1 km — co masz na krótkim odcinku.',
  'runnerProfile.axis.tempo.label': 'Tempo',
  'runnerProfile.axis.tempo.hint': 'Najlepsze 5 km — tempo w okolicach progu.',
  'runnerProfile.axis.endurance.label': 'Wytrzymałość',
  'runnerProfile.axis.endurance.hint': 'Najlepszy długi dystans: 10 km, półmaraton, maraton.',
  'runnerProfile.axis.volume.label': 'Objętość',
  'runnerProfile.axis.volume.hint': 'Średni kilometraż tygodniowy.',
  'runnerProfile.axis.consistency.label': 'Regularność',
  'runnerProfile.axis.consistency.hint': 'Jak często i jak równo biegasz.',

  'runnerProfile.archetype.speedster.label': 'Szybkościowiec',
  'runnerProfile.archetype.speedster.summary':
    'Krótkie odcinki wychodzą Ci lepiej niż długie. Najwięcej zyskasz, dorzucając spokojne kilometry — ' +
    'baza podniesie też tempo na 5 i 10 km.',
  'runnerProfile.archetype.diesel.label': 'Dystansowiec',
  'runnerProfile.archetype.diesel.summary':
    'Trzymasz tempo na długim, krótkie odcinki są słabszą stroną. Jedna sesja szybkich wstawek w ' +
    'tygodniu doda Ci prędkości bez ruszania objętości.',
  'runnerProfile.archetype.grinder.label': 'Maszyna do kilometrów',
  'runnerProfile.archetype.grinder.summary':
    'Regularność i objętość to Twój fundament — biegasz stale i dużo. To najlepszy możliwy punkt startu ' +
    'do pracy nad tempem.',
  'runnerProfile.archetype.allrounder.label': 'Wszechstronny',
  'runnerProfile.archetype.allrounder.summary':
    'Żadna oś nie odstaje: masz i szybkość, i dystans, i regularność. Rozwój przyjdzie z wyboru celu, ' +
    'nie z łatania dziur.',
  'runnerProfile.archetype.beginner.label': 'Na starcie',
  'runnerProfile.archetype.beginner.summary':
    'Baza dopiero rośnie, więc za wcześnie na wyroki. Regularność zrobi teraz więcej niż jakikolwiek ' +
    'trening szybkościowy.',
  'runnerProfile.archetype.unknown.label': 'Za mało danych',
  'runnerProfile.archetype.unknown.summary':
    'Mamy za mało zsynchronizowanych biegów, żeby nazwać Twój typ. Radar wypełni się sam, kiedy dojdą ' +
    'kolejne treningi i dłuższe dystanse.',

  'runnerProfile.distanceName.1k': '1 km',
  'runnerProfile.distanceName.5k': '5 km',
  'runnerProfile.distanceName.10k': '10 km',
  'runnerProfile.distanceName.half': 'półmaraton',
  'runnerProfile.distanceName.marathon': 'maraton',

  'runnerProfile.basis.noRunAt': 'brak biegu na {distance}',
  'runnerProfile.basis.bestAt': 'najlepsze {distance}',
  'runnerProfile.basis.noLongRun': 'brak biegu od 10 km w górę',
  'runnerProfile.basis.tooShortHistory': 'za krótka historia biegania (min. {weeks} tyg.)',
  'runnerProfile.basis.recentWeeks': 'ostatnie {weeks} tyg.',
  'runnerProfile.basis.activeWeeksOfTotal': '{active} z {total} tyg. z biegiem',
  'runnerProfile.readout.kmPerWeek': '{value} km/tyg.',
  'runnerProfile.readout.runsPerWeek': '{value} biegu/tyg.',

  'powerProfile.rider.sprint': 'Sprint (5 s)',
  'powerProfile.rider.punch': 'Punch (1 min)',
  'powerProfile.rider.climb': 'VO2/Podjazd (5 min)',
  'powerProfile.rider.tt': 'Próg/TT (20 min)',
  'powerProfile.rider.endurance': 'Wytrzymałość (60 min)',

  'powerProfile.zone.recovery': 'Regeneracja',
  'powerProfile.zone.endurance': 'Wytrzymałość',
  'powerProfile.zone.tempo': 'Tempo',
  'powerProfile.zone.threshold': 'Próg',
  'powerProfile.zone.vo2max': 'VO2max',
  'powerProfile.zone.anaerobic': 'Anaerobowa',
  'powerProfile.zone.neuromuscular': 'Neuromięśniowa',

  'runningProfile.distance.half': 'Półmaraton',
  'runningProfile.distance.marathon': 'Maraton',

  'loadRisk.advice.detraining':
    'Obciążenie spadło wyraźnie poniżej tego, do czego jesteś przygotowany. Jeśli to nie zaplanowane ' +
    'roztrenowanie ani choroba, wróć do regularnych jednostek — forma tlenowa cofa się szybciej, niż ' +
    'narasta.',
  'loadRisk.advice.steady':
    'Obciążenie ostatniego tygodnia mieści się w tym, do czego jesteś przygotowany. To zakres, w którym ' +
    'można bezpiecznie budować.',
  'loadRisk.advice.building':
    'Budujesz formę w rozsądnym tempie — obciążenie rośnie, ale nie ucieka bazie. Utrzymaj ten kierunek ' +
    'i pilnuj tygodni odciążających.',
  'loadRisk.advice.overreaching':
    'Ostatni tydzień jest wyraźnie mocniejszy od Twojej bazy. Jeden taki tydzień to normalny bodziec; ' +
    'dwa lub trzy pod rząd to najczęstsza droga do kontuzji przeciążeniowej.',
  'loadRisk.advice.spike':
    'Skok obciążenia: ostatni tydzień znacznie przewyższa to, do czego jesteś przygotowany. ' +
    'Najbezpieczniejszy ruch to lżejszy tydzień, zanim wróci normalny plan.',
  'loadRisk.advice.notEnoughHistory':
    'Za mało historii, aby ocenić tempo narastania obciążenia. Potrzebne są około cztery tygodnie ' +
    'ciągłych danych — wcześniej wskaźniki liczone z niepełnej bazy tylko straszą.',

  'trainingLoad.recommendation.fresh':
    'Jesteś wypoczęty — dobry moment na mocny trening lub start w zawodach.',
  'trainingLoad.recommendation.optimal': 'Forma optymalna — utrzymuj obecne obciążenie treningowe.',
  'trainingLoad.recommendation.neutral': 'Równowaga między zmęczeniem a formą — kontynuuj bieżący plan.',
  'trainingLoad.recommendation.fatigued': 'Wyraźne zmęczenie — rozważ dzień regeneracji lub lżejszy trening.',
  'trainingLoad.recommendation.veryFatigued':
    'Bardzo duże zmęczenie — zaplanuj odpoczynek, aby uniknąć przetrenowania.',
  'trainingLoad.recommendation.noData':
    'Za mało danych, aby ocenić formę. Zsynchronizuj więcej treningów z pomiarem mocy lub tętna.',

  'intensityMix.advice.onModel':
    'Rozkład intensywności jest zgodny z modelem spolaryzowanym — większość czasu spokojnie, reszta ' +
    'naprawdę mocno. To najlepiej udokumentowany sposób budowania wytrzymałości.',
  'intensityMix.advice.tooHard':
    'Zbyt mała część treningu jest spokojna. Najczęstszy błąd samodzielnie trenujących: łatwe biegi ' +
    'robią się średnio szybkie, a mocne przestają być mocne. Zwolnij na spokojnych jednostkach, a nie ' +
    'skracaj ich.',
  'intensityMix.advice.tooEasy':
    'Prawie cały trening jest spokojny. Baza tlenowa rośnie, ale bez regularnych mocnych bodźców tempo ' +
    'na zawodach zwykle stoi w miejscu. Wystarczy jedna–dwie intensywne jednostki w tygodniu.',
  'intensityMix.advice.unknown':
    'Bez maksymalnego tętna nie da się zaklasyfikować intensywności. Ustaw je w ustawieniach lub ' +
    'zsynchronizuj trening z pomiarem tętna.',

  /* ------------------------------------------------------------------ *
   * Journal — the daily check-in and session RPE (spec 062 / 080)
   * ------------------------------------------------------------------ */
  'journal.checkIn.title': 'Jak się dziś czujesz?',
  'journal.checkIn.infoLabel': 'Do czego służy ten check-in?',
  'journal.checkIn.why':
    'Zegarek tego nie zmierzy, a to najwcześniejszy sygnał, jaki masz. Nic nie jest wymagane — wypełnij tyle, ile chcesz.',
  'journal.checkIn.painLabel': 'Ból / zakwasy',
  'journal.checkIn.painAriaLabel': 'Ból lub zakwasy w skali 1–10',
  'journal.checkIn.soreness.1': 'bez śladu',
  'journal.checkIn.soreness.2': 'ledwo czuć',
  'journal.checkIn.soreness.3': 'lekkie zakwasy',
  'journal.checkIn.soreness.4': 'wyraźne zakwasy',
  'journal.checkIn.soreness.5': 'czuć przy każdym kroku',
  'journal.checkIn.soreness.6': 'boli',
  'journal.checkIn.soreness.7': 'boli mocno',
  'journal.checkIn.soreness.8': 'trening pod górkę',
  'journal.checkIn.soreness.9': 'ledwo się ruszam',
  'journal.checkIn.soreness.10': 'nie do ruszenia',
  'journal.checkIn.whereLabel': 'Gdzie boli?',
  'journal.checkIn.whereHelp': 'Jedno miejsce wystarczy — to ono wraca w korelacjach.',
  'journal.checkIn.wherePlaceholder': 'np. lewe kolano',
  'journal.checkIn.moodLabel': 'Nastrój',
  'journal.checkIn.moodAriaLabel': 'Nastrój w skali 1–10',
  'journal.checkIn.mood.1': 'fatalnie',
  'journal.checkIn.mood.2': 'bardzo słabo',
  'journal.checkIn.mood.3': 'słabo',
  'journal.checkIn.mood.4': 'nietęgo',
  'journal.checkIn.mood.5': 'średnio',
  'journal.checkIn.mood.6': 'w porządku',
  'journal.checkIn.mood.7': 'dobrze',
  'journal.checkIn.mood.8': 'bardzo dobrze',
  'journal.checkIn.mood.9': 'świetnie',
  'journal.checkIn.mood.10': 'jak nigdy',
  'journal.checkIn.illnessLabel': 'Choroba',
  'journal.checkIn.injuryLabel': 'Kontuzja',
  'journal.checkIn.noteLabel': 'Notatka',
  'journal.checkIn.noteHelp': 'Sen, stres, pogoda, buty — cokolwiek, co wyjaśni ten dzień później.',
  'journal.checkIn.notePlaceholder': 'cokolwiek, co warto zapamiętać',
  'journal.checkIn.savedBadge': 'Zapisano',
  'journal.checkIn.statusDirty': 'Niezapisane zmiany',
  'journal.checkIn.statusSaved': 'Wpis na dziś jest zapisany — możesz go zmienić.',
  'journal.checkIn.statusEmpty': 'Nic jeszcze nie zapisano na dziś.',
  'journal.checkIn.saving': 'Zapisuję…',
  'journal.checkIn.toastSaved': 'Zapisano',
  'journal.checkIn.toastError': 'Nie udało się zapisać wpisu',

  'journal.rpe.title': 'Jak ciężko było?',
  'journal.rpe.subtitle': 'RPE — odczuwany wysiłek, 1–10',
  'journal.rpe.label': 'RPE',
  'journal.rpe.ariaLabel': 'RPE w skali 1–10',
  'journal.rpe.hint.1': 'bardzo lekko',
  'journal.rpe.hint.3': 'lekko',
  'journal.rpe.hint.5': 'umiarkowanie',
  'journal.rpe.hint.7': 'ciężko',
  'journal.rpe.hint.9': 'bardzo ciężko',
  'journal.rpe.hint.10': 'maksymalnie',
  'journal.rpe.why':
    'Twoja ocena, nie zegarka. Próg, który czuł się jak dziewiątka, mówi więcej niż średnie tętno.',
  'journal.rpe.toastRemoved': 'Usunięto RPE',
  'journal.rpe.toastSaved': 'Zapisano RPE {value}',
  'journal.rpe.toastError': 'Nie udało się zapisać RPE',

  'journal.error.expectedJson': 'oczekiwano obiektu JSON',
  'journal.error.dayFormat': 'data musi być w formacie RRRR-MM-DD',
  'journal.error.futureDay': 'nie można zapisać wpisu z przyszłości',
  'journal.error.activityIdText': 'identyfikator aktywności musi być tekstem',
  'journal.error.numberField': '{label} musi być liczbą',
  'journal.error.integerField': '{label} musi być liczbą całkowitą',
  'journal.error.scoreRange': '{label} musi być w skali {min}–{max}',
  'journal.error.textField': '{label} musi być tekstem',
  'journal.error.tooLong': '{label} jest za długie',
  'journal.error.boolField': '{label} musi być prawdą albo fałszem',
  'journal.error.emptyEntry': 'wpis musi zawierać co najmniej jedno pole',
  'journal.error.noSuchActivity': 'nie ma takiej aktywności',
  'journal.error.activityDayMismatch': 'ta aktywność jest z {activityDay}, a wpis dotyczy {entryDay}',
  'journal.error.noSuchEntry': 'nie ma wpisu o tym identyfikatorze',
  'journal.field.rpe': 'RPE',
  'journal.field.soreness': 'ból/zakwasy',
  'journal.field.mood': 'nastrój',
  'journal.field.location': 'lokalizacja',
  'journal.field.note': 'notatka',
  'journal.field.illness': 'choroba',
  'journal.field.injury': 'kontuzja'
} as const;
