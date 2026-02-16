# Unreal Engine часть проекта

Подготовлена структура UE5-проекта в папке `ue/CityDistrict`.

## Что включено
- Карта `CityMap` (назначена как стартовая в конфиге).
- Основа под персонажа от 3-го лица (через `BP_CityCharacter`/`BP_CityGameMode` в структуре ассетов).
- Один район с улицами и 10 зданиями-блоками.
- Для каждого здания — табличка с названием.
- Для каждого здания — входная зона с подсказкой **"Нажмите кнопку Войти"**.
- При входе предусмотрено открытие простого UI-окна здания (`WBP_BuildingPanel`).
- C++ runtime-модуль `CityDistrict` с HTTP-клиентом (`UCityApiSubsystem`) и хранением JWT в `SaveGame`.
- Базовые C++ виджеты для экрана логина/регистрации (`UCityAuthWidgetBase`) и профиля (`UCityProfileWidgetBase`).

## Список зданий
1) Social Game
2) Casino
3) Pinball Shooter
4) City Simulator
5) Racing
6) Exchange
7) Cinema
8) Museum
9) Arena
10) Night Watch

## Файлы
- `CityDistrict/CityDistrict.uproject` — проект UE5.
- `CityDistrict/Config/DefaultEngine.ini` — стартовая карта и game mode.
- `CityDistrict/Config/DefaultGame.ini` — метаданные проекта.
- `CityDistrict/Content/Data/Buildings.json` — данные по зданиям.
- `CityDistrict/Content/Maps/CityMap/CityMap.spec.md` — спецификация карты и blueprint-ассетов.
- `CityDistrict/Scripts/setup_city_map.py` — Python-скрипт для генерации сцены в UE Editor.

## Как применить в Unreal Editor
1. Открыть `CityDistrict.uproject` в Unreal Engine 5.
2. Включить плагины Python и Editor Scripting Utilities (уже отмечены в `.uproject`).
3. Запустить Python-скрипт `Scripts/setup_city_map.py` из консоли UE.
4. Создать/донастроить blueprint-ассеты, указанные в `CityMap.spec.md`, и привязать UI-взаимодействие на клавишу `E`.

## HTTP + JWT в игре
Реализована подсистема `UCityApiSubsystem` (GameInstance Subsystem), которая подключается к API сервера:
- `POST /auth/register`
- `POST /auth/login`
- `GET /me`
- `GET /wallet`

JWT (`accessToken`) сохраняется в `SaveGame` (`CityAuthSlot`) и автоматически поднимается при запуске игры. Базовый URL API задаётся в `Config/DefaultGame.ini`:

```ini
[/Script/CityDistrict.CityApiSubsystem]
ApiBaseUrl=http://127.0.0.1:3000
```

## UI-экраны
В проект добавлены базовые C++ классы для UMG:
- `UCityAuthWidgetBase` — логин/регистрация (nickname, password, ref code), кнопки Login/Register, отображение ошибок.
- `UCityProfileWidgetBase` — профиль игрока (nickname, balance, subscription, game/mlm rating) + кнопка Refresh.

Чтобы использовать их в редакторе:
1. Создай `WBP_AuthScreen` на основе `UCityAuthWidgetBase`.
2. Привяжи поля/кнопки через `BindWidget` имена: `NicknameField`, `PasswordField`, `RefCodeField`, `LoginButton`, `RegisterButton`, `StatusText`.
3. Создай `WBP_ProfileScreen` на основе `UCityProfileWidgetBase`.
4. Привяжи `NicknameText`, `BalanceText`, `SubscriptionText`, `GameRatingText`, `MlmRatingText`, `ErrorText`, `RefreshButton`.
