# CityMap (UE5)

## Что должно быть на карте
- Игровой режим: персонаж от третьего лица (ходьба через CharacterMovement).
- Район: 1 блок с улицами (крестовая сетка дорог).
- 10 простых зданий-блоков (Static Mesh: куб + масштаб по высоте).
- На каждом здании табличка с названием (Widget Component или Text Render).
- Возле входа каждого здания `Box Collision` зона.
- В зоне показывается подсказка: **"Нажмите кнопку Войти"**.
- По кнопке `E` открывается простое UI-окно здания.

## Состав ассетов
- `/Game/Maps/CityMap/CityMap` — основная карта.
- `/Game/Blueprints/Characters/BP_CityCharacter` — third-person pawn.
- `/Game/Blueprints/Characters/BP_CityGameMode` — game mode.
- `/Game/Blueprints/Buildings/BP_CityBuilding` — универсальный building actor:
  - Mesh (корпус)
  - TextRender/Widget для названия
  - Box Collision `EnterZone`
  - Параметры `BuildingName`, `PromptText`, `WidgetClass`
- `/Game/Blueprints/UI/WBP_BuildingPanel` — простое окно с заголовком здания и кнопкой закрытия.
- `/Game/Blueprints/Interaction/BPI_EnterableBuilding` — интерфейс интеракции для зданий.
- `Source/CityDistrict/...` — C++ модуль с API клиентом и базовыми классами UI.
- `/Game/Blueprints/UI/WBP_AuthScreen` (`Parent Class = UCityAuthWidgetBase`) — экран логина/регистрации.
- `/Game/Blueprints/UI/WBP_ProfileScreen` (`Parent Class = UCityProfileWidgetBase`) — экран профиля.

## Список зданий
1. Social Game
2. Casino
3. Pinball Shooter
4. City Simulator
5. Racing
6. Exchange
7. Cinema
8. Museum
9. Arena
10. Night Watch

## API интеграция (сервер)
`UCityApiSubsystem` подключается к backend endpoint'ам:
- `POST /auth/register`
- `POST /auth/login`
- `GET /me`
- `GET /wallet`

JWT (`accessToken`) сохраняется локально в `SaveGame` слоте `CityAuthSlot` и используется в `Authorization: Bearer <token>` для `/me` и `/wallet`.

## Поля экрана профиля
На `WBP_ProfileScreen` отобразить:
- `nickname` (`/me`)
- `balanceToken` (`/wallet`)
- `subscription.tier` (`/me`)
- `gameRating`, `mlmRating` (`/me`)

## UI flow
1. При старте открыть `WBP_AuthScreen`, если JWT отсутствует.
2. После успешного логина перейти на `WBP_ProfileScreen`.
3. `WBP_ProfileScreen` вызывает `LoadCurrentUserProfile()`, который загружает `/me` и затем `/wallet`.
4. Кнопка Refresh повторяет запросы, кнопка Logout (если добавите в BP) вызывает `Logout()` и возвращает на экран авторизации.
