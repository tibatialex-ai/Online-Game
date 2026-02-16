# Unreal Engine часть проекта

Подготовлена структура UE5-проекта в папке `ue/CityDistrict`.

## Что включено
- Карта `CityMap` (назначена как стартовая в конфиге).
- Основа под персонажа от 3-го лица (через `BP_CityCharacter`/`BP_CityGameMode` в структуре ассетов).
- Один район с улицами и 10 зданиями-блоками.
- Для каждого здания — табличка с названием.
- Для каждого здания — входная зона с подсказкой **"Нажмите кнопку Войти"**.
- При входе предусмотрено открытие простого UI-окна здания (`WBP_BuildingPanel`).

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
