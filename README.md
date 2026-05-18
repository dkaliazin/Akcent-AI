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

## Локальная панель с кнопками

Можно запустить локальную веб-панель:

```bash
npm run app
```

Откройте в браузере:

```text
http://127.0.0.1:3000
```

На странице будет кнопка `Навчальні журнали`. Она запускает тот же сценарий, что и `npm start`, а логи отображаются прямо на странице.
Кнопка `Остановить / закрыть браузер` останавливает текущий запуск и в CDP-режиме закрывает открытый Chrome.

Настройки берутся из локального `.env`, например:

```dotenv
BROWSER=chrome-cdp
KEEP_BROWSER_OPEN=true
MANUAL_LOGIN_TIMEOUT_MS=600000
```

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

## Запуск через Google Chrome

Если Adblock Browser нужен для обычной работы, можно выделить Google Chrome под automation.

Рекомендуемый вариант - `BROWSER=chrome-cdp`. В нем бот сам запускает Chrome с debug-портом и отдельным профилем, поэтому вручную открывать `127.0.0.1:9222` не нужно.

Локальный `.env`:

```dotenv
BROWSER=chrome-cdp
KEEP_BROWSER_OPEN=true
MANUAL_LOGIN_TIMEOUT_MS=600000
```

В первый раз в этом отдельном Chrome-профиле нужно будет войти вручную. Потом cookies сохранятся.

Старый вариант `BROWSER=chrome` использует `launchPersistentContext` напрямую. Для Chrome 136+ он менее надежен, потому что основной профиль Chrome может открываться на `about:blank`.

`.env` для прямого Chrome-режима:

```dotenv
BROWSER=chrome
KEEP_BROWSER_OPEN=true
MANUAL_LOGIN_TIMEOUT_MS=600000
```

В этом режиме бот попробует использовать системный Google Chrome, папку профилей `%LOCALAPPDATA%\Google\Chrome\User Data` и профиль `Default`.

Не пишите путь к `chrome.exe` в `USER_DATA_DIR` или `CHROME_USER_DATA_DIR`. Эти переменные должны указывать на папку профиля с cookies, например `C:\Users\dmitr\AppData\Local\Google\Chrome\User Data`.

Если нужно указать профиль явно:

```dotenv
BROWSER=chrome
CHROME_USER_DATA_DIR=C:\Users\dmitr\AppData\Local\Google\Chrome\User Data
CHROME_PROFILE_DIRECTORY=Default
KEEP_BROWSER_OPEN=true
MANUAL_LOGIN_TIMEOUT_MS=600000
```

Для другого профиля замените `CHROME_PROFILE_DIRECTORY`, например:

```dotenv
CHROME_PROFILE_DIRECTORY=Profile 1
```

Чтобы узнать точное имя профиля, откройте в Chrome `chrome://version` и посмотрите `Profile Path`. Последняя часть пути - это имя профиля (`Default`, `Profile 1`, `Profile 2` и т.д.).

Перед запуском закройте все обычные окна Google Chrome, если используете реальный профиль Chrome. Если Chrome не закрыт, Playwright может не получить доступ к профилю.

Chrome 136+ может не давать Playwright нормально автоматизировать обычный основной профиль Chrome: окно открывается на `about:blank`, страницы не грузятся или профиль не подхватывается. Для Chrome-режима бот автоматически добавляет флаг:

```text
--disable-features=DevToolsDebuggingRestrictions
```

Если это не помогает, используйте CDP-режим ниже или отдельный automation-профиль.

### CDP-режим: детали

Самый простой вариант - дать боту самому запустить Chrome с remote debugging.

Локальный `.env`:

```dotenv
BROWSER=chrome-cdp
KEEP_BROWSER_OPEN=true
MANUAL_LOGIN_TIMEOUT_MS=600000
```

В этом режиме бот сам:

1. находит Google Chrome;
2. запускает его с `--remote-debugging-port=9222`;
3. использует отдельный профиль `.browser-profile\chrome-cdp`;
4. подключается к Chrome и продолжает алгоритм.

В первый раз в этом отдельном Chrome-профиле нужно будет войти вручную. Потом cookies сохранятся.

Если хотите использовать конкретную папку профиля Chrome, можно указать:

```dotenv
BROWSER=chrome-cdp
CHROME_USER_DATA_DIR=C:\Users\dmitr\AppData\Local\Google\Chrome\User Data
CHROME_PROFILE_DIRECTORY=Default
KEEP_BROWSER_OPEN=true
MANUAL_LOGIN_TIMEOUT_MS=600000
```

Перед таким запуском закройте обычные окна Chrome, потому что один и тот же профиль нельзя безопасно использовать в двух процессах одновременно.

Альтернативный ручной вариант - запустить Chrome вручную с remote debugging и подключиться к нему.

1. Полностью закройте Chrome.
2. Запустите Chrome из PowerShell:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:LOCALAPPDATA\Google\Chrome\User Data" --profile-directory="Default"
```

Если Chrome установлен в другом месте, замените путь к `chrome.exe`.

3. Проверьте, что debug-порт работает: откройте в Chrome:

```text
http://127.0.0.1:9222/json/version
```

Если видите JSON - все готово.

4. В локальном `.env` для бота укажите:

```dotenv
CHROME_CDP_ENDPOINT=http://127.0.0.1:9222
KEEP_BROWSER_OPEN=true
MANUAL_LOGIN_TIMEOUT_MS=600000
```

В CDP-режиме бот подключается к уже открытому Chrome и использует его текущие cookies. При завершении скрипт не закрывает этот Chrome.

Если получаете `connect ECONNREFUSED ::1:9222`, значит `localhost` резолвится в IPv6 `::1`, а Chrome слушает не там или вообще не запущен с debug-портом. Используйте `127.0.0.1` и обязательно проверьте `http://127.0.0.1:9222/json/version`.

Если видите ошибку `EEXIST: file already exists, mkdir '...\chrome.exe'`, значит в `.env` путь к `chrome.exe` указан как профиль. Исправьте `.env` так:

```dotenv
BROWSER=chrome
CHROME_USER_DATA_DIR=C:\Users\dmitr\AppData\Local\Google\Chrome\User Data
CHROME_PROFILE_DIRECTORY=Default
KEEP_BROWSER_OPEN=true
MANUAL_LOGIN_TIMEOUT_MS=600000
```

Если окно открылось на `about:blank`, проверьте терминал:

- должна быть строка `[2/7] Открываю сайт https://nz.ua`;
- должна быть строка `Текущий URL после перехода: ...`;
- в начале запуска бот печатает `BROWSER`, `Путь к браузеру`, `Источник профиля`, `Папка профиля` и `Имя профиля`.

Если этих строк нет, значит запущен старый код или процесс завершился до перехода на сайт.

## Настройки через env

- `BROWSER=chrome` - использовать системный Google Chrome.
- `BROWSER=chrome-cdp` - бот сам запускает Google Chrome с debug-портом и подключается к нему.
- `CHROME_CDP_AUTO_LAUNCH=true` - авто-запуск Chrome CDP без `BROWSER=chrome-cdp`.
- `CHROME_CDP_PORT=9222` - порт для авто-запуска Chrome CDP.
- `CHROME_CDP_ENDPOINT=http://127.0.0.1:9222` - подключиться к уже запущенному Chrome через CDP.
- `CHROME_DISABLE_DEVTOOLS_RESTRICTIONS=false` - отключить автоматический флаг обхода Chrome DevTools restrictions.
- `BROWSER_EXECUTABLE_PATH=/path/to/browser` - путь к установленному Chromium-based браузеру.
- `BROWSER_PROFILE_DIRECTORY=Default` - имя профиля внутри `USER_DATA_DIR`.
- `CHROME_USER_DATA_DIR=C:\Users\...\Google\Chrome\User Data` - папка профилей Google Chrome.
- `CHROME_PROFILE_DIRECTORY=Default` - имя профиля Google Chrome.
- `USER_DATA_DIR=.browser-profile/chromium` - папка persistent profile с cookies и сессией.
- `HEADLESS=true` - запускать Chromium без UI.
- `KEEP_BROWSER_OPEN=true` - оставить браузер открытым после выполнения.
- `SLOW_MO_MS=250` - замедлить действия Playwright.
- `DEFAULT_TIMEOUT_MS=15000` - общий timeout ожиданий.
- `NAVIGATION_TIMEOUT_MS=30000` - timeout навигации.
- `OPTIONAL_POPUP_TIMEOUT_MS=5000` - timeout ожидания необязательных popup.
- `MANUAL_VERIFICATION_TIMEOUT_MS=120000` - сколько ждать ручное прохождение security check.
- `MANUAL_LOGIN_TIMEOUT_MS=600000` - сколько ждать ручной вход, если cookies не сработали.
