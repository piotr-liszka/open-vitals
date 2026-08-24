const FEATURES = [
  {
    id: "mcp",
    title: "Konektor MCP",
    summary: "Pozwól klientowi AI czytać Twoje dane z Garmina przez osobisty adres MCP.",
    // 1.1 (spec 050): the connector is no longer read-only in every configuration — workout authoring
    // can write, behind its own consent. Bumping is free here (`requiresConsent: false`), and leaving
    // the old "tylko do odczytu" wording in place would have been a false claim.
    termsVersion: "1.1",
    requiresConsent: false,
    defaultEnabled: true,
    termsText: "Konektor MCP udostępnia Twoje dane z Garmina pod adresem chronionym tokenem. Domyślnie tylko do odczytu — jedyny zapis to treningi, które sam tworzysz, i wymaga osobnej zgody („Zapis treningów w Garminie”). Działa bezstanowo: usługa nie zapisuje niczego o żądaniach MCP — żadnej historii, analityki ani logów zwracanych danych. Każdy, kto ma ten adres (zawierający sekretny token przypisany tylko do Ciebie), może czytać Twoje dane, więc traktuj go jak hasło i wymień w Ustawieniach, jeśli wycieknie. Ponieważ nic nie jest przechowywane, ta funkcja nie wymaga osobnej zgody i jest włączona domyślnie."
  },
  {
    // The single Base → Advanced gate. Accepting it unlocks the whole processed experience
    // (pulpit, analityka, wnioski i wykresy). Kept under the id `detailed_analytics` for
    // continuity; renaming the key to `data_processing` is a tracked follow-up (spec 014).
    id: "detailed_analytics",
    title: "Tryb zaawansowany — przetwarzanie danych",
    summary: "Włącz pulpit, analitykę, wnioski i wykresy. Twoje dane są przetwarzane, aby je pokazać.",
    termsVersion: "1.0",
    requiresConsent: true,
    defaultEnabled: false,
    termsText: "Tryb zaawansowany przetwarza Twoje dane z Garmina, aby pokazać pulpit, wielodniowe trendy, wnioski (gotowość, anomalie, korelacje) oraz wykresy długiego okresu. Aby narysować wykresy, aplikacja pyta Twoje połączone konto Garmin o zakres dziennych wartości i renderuje je w Twojej przeglądarce. Dane są przetwarzane w pamięci na potrzeby wykresów; nie są sprzedawane, udostępniane ani wysyłane poza tę usługę i nie są przechowywane dłużej niż Twoja sesja. Zgodę możesz wycofać w każdej chwili — wycofanie wraca do trybu podstawowego (samo połączenie Garmin + Twój adres MCP) i zatrzymuje pobieranie zakresów. Jeśli warunki się zmienią, poprosimy Cię o ich ponowną akceptację, zanim przetwarzanie wznowi działanie."
  },
  {
    // Spec 050. The FIRST capability that writes to the user's Garmin account, so it requires
    // explicit consent even though everything it writes is the user's own authored content. The
    // read-only tools stay available without it.
    id: "workout_write",
    title: "Zapis treningów w Garminie",
    summary: "Pozwól tworzyć treningi tutaj i wysyłać je do kalendarza Garmina (i na zegarek).",
    termsVersion: "1.0",
    requiresConsent: true,
    defaultEnabled: false,
    termsText: "Ta funkcja jako jedyna ZAPISUJE dane na Twoim koncie Garmin. Treningi tworzysz tutaj (w aplikacji lub przez klienta AI); są zapisywane lokalnie, a synchronizacja wysyła je do Twojej biblioteki treningów i kalendarza w Garminie, skąd trafiają na zegarek. Wysyłane są tylko treningi, które sam utworzysz: ich nazwa, dyscyplina, dzień i kroki. Nic innego na Twoim koncie Garmin nie jest zmieniane ani usuwane. Usunięcie treningu tutaj usuwa go także w Garminie. Zgodę możesz wycofać w każdej chwili — wycofanie zatrzymuje wysyłkę; treningi już wysłane zostają w Garminie, dopóki ich nie usuniesz."
  }
];
const WORKOUT_WRITE_FEATURE = "workout_write";
export {
  FEATURES as F,
  WORKOUT_WRITE_FEATURE as W
};
