# Akcent-AI

Стартовый Playwright-бот для первого этапа automation на https://nz.ua.

## Что делает бот

1. Открывает https://nz.ua.
2. Нажимает "Увійти до кабінету".
3. Запускает Chromium с persistent browser profile и использует сохраненные cookies.
4. Нажимает кнопку входа.
5. Нажимает OK в popup, если он появился.
6. Закрывает popup крестиком, если он появился.
7. Переходит в раздел "Навчальні журнали".

## Структура

```text
main.js
config.js
helpers/
  actions.js
  browser.js
  nzUa.js
  popups.js
```

## Установка

```bash
npm install
npm run install:browsers
```

## Запуск

```bash
npm start
```

По умолчанию используется persistent profile в `.browser-profile/chromium`.
Если cookies еще не сохранены, запустите бота в headed-режиме, войдите вручную один раз и закройте браузер:

```bash
KEEP_BROWSER_OPEN=true npm start
```

После ручного входа следующий запуск будет использовать сохраненные cookies.

## Настройки через env

- `HEADLESS=true` - запускать Chromium без UI.
- `KEEP_BROWSER_OPEN=true` - оставить браузер открытым после выполнения.
- `SLOW_MO_MS=250` - замедлить действия Playwright.
- `DEFAULT_TIMEOUT_MS=15000` - общий timeout ожиданий.
- `NAVIGATION_TIMEOUT_MS=30000` - timeout навигации.
- `OPTIONAL_POPUP_TIMEOUT_MS=5000` - timeout ожидания необязательных popup.
