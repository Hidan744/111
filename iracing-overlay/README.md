# iRacing Overlay (MVP)

Прозрачный click-through оверлей для iRacing: показывает скорость, обороты,
топливо, времена кругов, дельту, температуру шин, позицию, упрощённую карту
трассы и таблицу позиций поверх игры, без переключения окон. Стиль — тёмные
полупрозрачные панели, как у `track-impulse.com/overlays` (вариант 1 из
референсов).

## Стек

- C# / .NET 8, WPF (`net8.0-windows`)
- Чтение телеметрии — **собственный минимальный клиент shared-memory** к
  iRacing SDK (`Services/Irsdk/`), без стороннего NuGet-обёртки: открывает
  `Local\IRSDKMemMapFileName`, разбирает заголовок и таблицу переменных SDK
  напрямую через `System.IO.MemoryMappedFiles`. Это сознательный выбор вместо
  `irsdkSharp`/аналогов из дизайн-документа — так весь путь чтения телеметрии
  лежит в репозитории и не зависит от версии внешнего пакета.
- `YamlDotNet` — разбор блока `SessionInfo` (имя трассы, список пилотов) для
  виджетов Standings/TrackMap.
- Клик-сквозь окно: `WS_EX_TRANSPARENT` + `WS_EX_LAYERED` через P/Invoke
  (`Interop/ClickThrough.cs`), переключается кнопкой "Lock/Unlock layout".

## Структура

```
src/IRacingOverlay/
  Services/Irsdk/       низкоуровневый клиент shared-memory (header, var table, tear-free read)
  Services/             ITelemetryService, реальный и mock источники, SettingsService, парсер SessionInfo
  Models/                TelemetrySnapshot, AppSettings/WidgetSettings, FuelCalculator
  ViewModel/             TelemetryViewModel — единая модель, к которой биндятся все виджеты
  Overlay/               OverlayWindow (прозрачный канвас) + WidgetHost (перетаскиваемая обёртка)
  Widgets/               9 виджетов MVP (см. ниже)
  Settings/              обычное окно настроек (чекбоксы, юниты, lock layout, mock-режим)
  Interop/               click-through P/Invoke
  Converters/            форматирование времени круга, дельты, проекция карты трассы
tests/IRacingOverlay.Tests/   xUnit-тесты на чистую логику (fuel calc, settings, mock-телеметрия, YAML)
```

## Виджеты MVP

Speed, RPM/Gear, Fuel (+ оценка кругов на баке), LapTimes (current/last/best),
DeltaBest, TireTemps (4 угла), Position (overall/class), TrackMap (упрощённая
проекция по `LapDistPct`, без привязки к реальному контуру трассы — см.
"Известные ограничения"), Standings.

## Обработка ошибок (как в дизайн-документе)

- iRacing не запущена → баннер "Waiting for iRacing..." вместо пустого экрана.
- SDK отвалился посреди сессии → виджеты держат последние значения, баннер
  "Telemetry stale" через 2 секунды без обновлений.
- Битый `settings.json` → откат на дефолтный набор виджетов (`SettingsService`
  ловит исключение и возвращает `AppSettings.CreateDefault()`).

## Сборка и запуск (Windows)

Нужен Windows и [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
(или Visual Studio 2022 17.8+ с workload ".NET desktop development"). Эта
сессия работала в Linux-контейнере без WPF/Windows, поэтому код не был
скомпилирован здесь — соберите и проверьте на Windows перед первым запуском:

```powershell
cd iracing-overlay
dotnet build
dotnet test                      # проверка чистой логики без iRacing
dotnet run --project src/IRacingOverlay
```

При первом запуске без iRacing оверлей покажет "Waiting for iRacing...".
Чтобы проверить виджеты без симулятора, включите в окне Settings опцию
"Use mock telemetry" — она включает синтетический источник кадров
(`MockTelemetryService`) и требует перезапуска приложения.

Приложение живёт в трее (иконка рядом с часами): оттуда доступны Settings,
Lock/Unlock layout и Exit.

## Известные ограничения / что дальше (Roadmap v2)

- **TrackMap** сейчас рисует машины на условной окружности по `LapDistPct`,
  а не по реальному контуру трассы — интеграция community SVG-набора
  трасс (как в референсах) осталась пунктом v2, чтобы не тащить в MVP
  большой набор ассетов.
- `Standings.GapSec` пока не считается (нет накопления интервалов между
  машинами по `CarIdxLapDistPct`/скорости) — оставлен как `0.0`.
- Многоклассовые предупреждения об обгоне, радар, цифровые флаги, топливный
  калькулятор с несколькими стратегиями, умные макеты — see `racelab.app` в
  исходном дизайн-документе, сознательно не в MVP.
