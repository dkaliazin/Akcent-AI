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

## Запуск через свой браузер

Если сайт показывает Cloudflare/anti-bot проверку, лучше запускать бота локально на своем компьютере в headed-режиме и вручную пройти проверку один раз. Скрипт подождет, пока после проверки появится кнопка "Увійти до кабінету".

Можно передавать настройки через переменные окружения или создать локальный файл `.env` в корне проекта. Файл `.env` уже добавлен в `.gitignore`, не коммитьте его.

Пример локального `.env`:

```dotenv
BROWSER_EXECUTABLE_PATH=C:\Program Files\Adblock Browser\Application\AdblockBrowser.exe
USER_DATA_DIR=.browser-profile\adblock-browser
KEEP_BROWSER_OPEN=true
MANUAL_VERIFICATION_TIMEOUT_MS=300000
MANUAL_LOGIN_TIMEOUT_MS=600000
```

После этого запуск:

```bash
npm start
```

Если не хотите создавать `.env`, можно задать переменные прямо в PowerShell. Для Adblock Browser на Windows путь обычно похож на один из этих вариантов:

```powershell
$env:BROWSER_EXECUTABLE_PATH="C:\Program Files\Adblock Browser\Application\AdblockBrowser.exe"
npm start
```

или:

```powershell
$env:BROWSER_EXECUTABLE_PATH="$env:LOCALAPPDATA\Adblock Browser\Application\AdblockBrowser.exe"
npm start
```

Рекомендуется использовать отдельный профиль для automation, а не основной профиль браузера:

```powershell
$env:BROWSER_EXECUTABLE_PATH="C:\Program Files\Adblock Browser\Application\AdblockBrowser.exe"
$env:USER_DATA_DIR="$PWD\.browser-profile\adblock-browser"
$env:KEEP_BROWSER_OPEN="true"
npm start
```

Не запускайте automation на профиле, который уже открыт в обычном окне браузера: Chromium блокирует профиль, а одновременное использование может повредить данные профиля.

Важно: `BROWSER_EXECUTABLE_PATH` выбирает только программу браузера. Cookies и логин берутся из `USER_DATA_DIR`. Если `USER_DATA_DIR` указывает на `.browser-profile\...`, это отдельный чистый профиль, и в нем нужно один раз войти вручную.

Если нужно попробовать использовать уже существующие cookies Adblock Browser, закройте все обычные окна Adblock Browser и укажите его папку `User Data`:

```dotenv
BROWSER_EXECUTABLE_PATH=C:\Users\dmitr\AppData\Local\AdblockBrowser\Application\adblockbrowser.exe
USER_DATA_DIR=C:\Users\dmitr\AppData\Local\AdblockBrowser\User Data
BROWSER_PROFILE_DIRECTORY=Default
KEEP_BROWSER_OPEN=true
MANUAL_LOGIN_TIMEOUT_MS=600000
```

Если ваш активный профиль называется не `Default`, откройте `chrome://version` в Adblock Browser и посмотрите значение `Profile Path`. Последняя часть пути обычно и есть `BROWSER_PROFILE_DIRECTORY`, например `Default` или `Profile 1`.

Playwright всегда открывает управляемое окно браузера. Это может выглядеть как новое окно, даже если используется тот же браузер и тот же профиль.

## Настройки через env

- `BROWSER_EXECUTABLE_PATH=/path/to/browser` - путь к установленному Chromium-based браузеру.
- `BROWSER_PROFILE_DIRECTORY=Default` - имя профиля внутри `USER_DATA_DIR`.
- `USER_DATA_DIR=.browser-profile/chromium` - папка persistent profile с cookies и сессией.
- `HEADLESS=true` - запускать Chromium без UI.
- `KEEP_BROWSER_OPEN=true` - оставить браузер открытым после выполнения.
- `SLOW_MO_MS=250` - замедлить действия Playwright.
- `DEFAULT_TIMEOUT_MS=15000` - общий timeout ожиданий.
- `NAVIGATION_TIMEOUT_MS=30000` - timeout навигации.
- `OPTIONAL_POPUP_TIMEOUT_MS=5000` - timeout ожидания необязательных popup.
- `MANUAL_VERIFICATION_TIMEOUT_MS=120000` - сколько ждать ручное прохождение security check.
- `MANUAL_LOGIN_TIMEOUT_MS=600000` - сколько ждать ручной вход, если cookies не сработали.
