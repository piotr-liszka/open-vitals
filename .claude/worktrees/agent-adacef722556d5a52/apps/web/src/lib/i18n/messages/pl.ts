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

  /* ------------------------------------------------------------------ *
   * Profil atlety: FTP, tętno maksymalne, masa ciała (spec 090)
   * ------------------------------------------------------------------ */
  'profile.section': 'Atleta',
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

  'widget.streak.label': 'Seria',
  'widget.streak.description': 'Tygodnie z aktywnością pod rząd',
  'widget.coverage.label': 'Zebrane dane',
  'widget.coverage.description': 'Ile danych masz lokalnie',
  'widget.weeklyVolume.label': 'Objętość treningu',
  'widget.weeklyVolume.description': 'Godziny treningu na tydzień (miesiąc w długich zakresach)',
  'widget.activityTypes.label': 'Typy aktywności',
  'widget.activityTypes.description': 'Podział wg sportu w wybranym zakresie',
  'widget.recentActivities.label': 'Ostatnie aktywności',
  'widget.recentActivities.description': 'Najnowsze treningi z wybranego zakresu',
  'widget.metricTrend.label': 'Trend metryki',
  'widget.metricTrend.description': 'Wykres metryki w wybranym zakresie',
  'widget.seeAlso': 'Pełny obraz w {page}',

  'dashboard.defaultName': 'Przegląd',
  'dashboard.rename': 'Zmień nazwę',
  'dashboard.delete': 'Usuń panel',
  'dashboard.moveLeft': 'Przesuń w lewo',
  'dashboard.moveRight': 'Przesuń w prawo',
  'dashboard.resize': 'Zmień rozmiar',
  'dashboard.removeWidget': 'Usuń widget',

  'dashboard.panelN': 'Panel {n}',

  'dashboard.addPanel': 'Dodaj panel',
  'dashboard.namePrompt': 'Nazwa panelu',
  'dashboard.done': 'Gotowe',
  'dashboard.edit': 'Edytuj',
  'dashboard.addWidget': '+ Dodaj widget',
  'dashboard.left': 'W lewo',
  'dashboard.right': 'W prawo',
  'dashboard.emptyPanel': 'Ten panel jest pusty. Kliknij {edit} → {addWidget}.',

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

  /* ------------------------------------------------------------------ *
   * Dashboard widgets (spec 019)
   * ------------------------------------------------------------------ */
  'widget.noActivitiesInRange': 'Brak aktywności w zakresie: {range}.',
  'widget.noActivitiesInRangeHint':
    'Brak aktywności w zakresie: {range}. Zmień zakres u góry lub zsynchronizuj dane w zakładce',
  'widget.notEnoughData': 'Za mało danych w zakresie: {range}.',
  'widget.showingLastOf': 'Pokazano {shown} ostatnich z {total} w zakresie.',

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
  'login.note':
    'Nie potrzebujesz konta — logowanie przez Google rejestruje Cię i tworzy Twoją prywatną przestrzeń.',
  'landing.headTitle': 'Vagus — Twoje dane z Garmina, połączone z AI',

  /* ------------------------------------------------------------------ *
   * Activities list, heat map, power (specs 020/041/023)
   * ------------------------------------------------------------------ */
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
  'insights.correlationMeta': 'r = {r} · {days} dni',

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

  'widget.streakUnit': {
    one: 'tydzień serii',
    few: 'tygodnie serii',
    many: 'tygodni serii',
    other: 'tygodnia serii'
  },
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

  'readiness.title': 'Gotowość',
  'readiness.subtitle': 'Jak bardzo jesteś dziś gotowy do treningu i kiedy wrócisz do pełnej formy',
  'readiness.notConnected': 'Połącz konto Garmin, aby zobaczyć swoją gotowość.',
  'readiness.connectCta': 'Połącz na pulpicie →',
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
  'plan.strip.title': 'Struktura planu',
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
  'error.activityNotFound': 'Nie znaleziono aktywności',
  'error.tooManyAttempts': 'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.',
  'auth.missingCode': 'Brak kodu autoryzacji.',

  'auth.sessionExpired': 'Sesja logowania wygasła. Spróbuj ponownie.',
  'auth.invalidState': 'Nieprawidłowy stan logowania. Spróbuj ponownie.',
  'auth.verificationFailed': 'Nie udało się zweryfikować logowania Google.',

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

  /* ------------------------------------------------------------------ *
   * Landing page (logged out)
   * ------------------------------------------------------------------ */
  'landing.selfHostNav': 'Hostuj u siebie',
  'landing.continueWithGoogle': 'Kontynuuj z Google',
  'landing.orSelfHost': 'albo hostuj u siebie →',
  'landing.tier.baseTitle': 'Tryb podstawowy',
  'landing.tier.advancedTitle': 'Tryb zaawansowany',
  'landing.howTitle': 'Trzy kroki do Twoich danych',
  'landing.step.useTitle': 'Czytaj gdziekolwiek',
  'landing.dockerLabel': 'Uruchom w Dockerze',
  'landing.dockerComment': '# ustaw swoje sekrety',
  'landing.dockerComment2': '# web + sidecar + postgres',
  'landing.finalHeading': 'Gotowe, kiedy tylko zechcesz.',
  'landing.footNote': 'Twoje dane z Garmina — dla Ciebie i Twojego AI.',
  'landing.preview.steps': 'kroki',
  'landing.preview.hrv': 'hrv',

  'landing.howItWorks': 'Jak to działa',
  'landing.signIn': 'Zaloguj się',
  'landing.eyebrow': 'Telemetria Twojego ciała',
  'landing.headlineLead': 'Dane z Twojego Garmina,',
  'landing.headlineAccent': 'podłączone do AI.',
  'landing.lede':
    'Vagus łączy Twoje konto Garmin Connect z asystentem AI przez osobisty adres MCP. Zacznij w trybie ' +
    'podstawowym — nic nie przetwarzamy — a gdy zechcesz, włącz tryb zaawansowany z pulpitem i analityką.',
  'landing.noPassword':
    'Bez hasła. Twoje dane zostają Twoje — osobno dla każdego konta, za zgodą, nigdy nie sprzedawane.',
  'landing.previewToday': 'Dziś',
  'landing.previewLive': 'na żywo',
  'landing.tier.baseBody':
    'Połącz konto Garmin i dostań osobisty adres MCP. Nic nie przetwarzamy ani nie pokazujemy — ' +
    'pośredniczymy tylko w odczytach na Twoje żądanie. Sen, kroki, HRV, Body Battery, stres, SpO₂ i ' +
    'więcej — zawsze Twoje. Zapis w Garminie jest tylko jeden i włączasz go osobno: treningi, które sam ' +
    'ułożysz.',
  'landing.tier.advancedBody':
    'Po akceptacji zgody włączasz pulpit, analitykę, wnioski i wykresy. Twoje dane widać w aplikacji, a ' +
    'gotowość, anomalie i korelacje liczymy lokalnie — bez AI.',
  'landing.privacyTitle': 'Prywatność w standardzie',
  'landing.privacyBody':
    'Każde konto jest odizolowane. Tokeny są zaszyfrowane, a tryb zaawansowany jest opcjonalny i za ' +
    'wersjonowaną zgodą. Nic nie jest sprzedawane ani udostępniane.',
  'landing.step.googleTitle': 'Zaloguj się przez Google',
  'landing.step.googleBody': 'Bez hasła. Tworzymy prywatną przestrzeń tylko dla Ciebie.',
  'landing.step.garminTitle': 'Połącz Garmina',
  'landing.step.garminBody':
    'Jednorazowe logowanie (obsługa MFA). Nie przechowujemy danych logowania — tylko zaszyfrowane tokeny.',
  'landing.step.useBody':
    'Włącz tryb zaawansowany, aby zobaczyć pulpit, albo podaj adres MCP asystentowi AI, by czytał Twoje dane.',
  'landing.selfHostTitle': 'Wolisz uruchomić to samodzielnie?',
  'landing.selfHostBody':
    'Vagus można hostować samodzielnie. Podłącz własny Postgres i klienta Google OAuth — całość działa ' +
    'jako dwa małe kontenery na Twoim sprzęcie, a dane nigdy nie opuszczają Twojej infrastruktury.',
  'landing.selfHostNote':
    'Do wdrożenia samodzielnego wymagany jest klient Google OAuth oraz instancja Postgres.',

  /* ------------------------------------------------------------------ *
   * Base-tier start screen
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
  'sport.other': 'Inne'
} as const;
