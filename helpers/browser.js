const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

async function launchPersistentBrowser(config) {
  if (config.cdpEndpoint) {
    return connectToExistingBrowser(config);
  }

  console.log(`[1/7] Запускаю браузер с persistent profile: ${config.userDataDir}`);
  logBrowserConfig(config);

  validateUserDataDir(config);
  fs.mkdirSync(config.userDataDir, { recursive: true });

  const launchOptions = {
    headless: config.headless,
    slowMo: config.slowMo,
    viewport: config.viewport,
  };

  if (process.platform === 'win32') {
    launchOptions.ignoreDefaultArgs = ['--no-sandbox'];
  }

  if (config.browserExecutablePath) {
    console.log(`Использую установленный браузер: ${config.browserExecutablePath}`);
    launchOptions.executablePath = config.browserExecutablePath;
  } else if (config.browserChannel) {
    console.log(`Использую системный браузер Playwright channel: ${config.browserChannel}`);
    launchOptions.channel = config.browserChannel;
  } else {
    console.log('Использую Chromium из Playwright');
  }

  const browserArgs = [];

  if (config.browserProfileDirectory) {
    console.log(`Использую профиль браузера: ${config.browserProfileDirectory}`);
    browserArgs.push(`--profile-directory=${config.browserProfileDirectory}`);
  }

  if (config.disableDevToolsDebuggingRestrictions) {
    console.log('Отключаю Chrome DevTools debugging restrictions для persistent profile');
    browserArgs.push('--disable-features=DevToolsDebuggingRestrictions');
  }

  if (browserArgs.length > 0) {
    launchOptions.args = browserArgs;
  }

  const context = await chromium.launchPersistentContext(config.userDataDir, launchOptions);

  context.setDefaultTimeout(config.defaultTimeout);
  context.setDefaultNavigationTimeout(config.navigationTimeout);

  const page = await context.newPage();
  await closeStartupBlankPages(context, page);

  return { context, page };
}

async function connectToExistingBrowser(config) {
  if (config.autoLaunchChromeCdp) {
    await launchChromeForCdp(config);
  }

  const launchMode = config.autoLaunchChromeCdp ? 'автоматически запущенному Chrome' : 'уже запущенному Chrome';
  console.log(`[1/7] Подключаюсь к ${launchMode}: ${config.cdpEndpoint}`);
  logBrowserConfig(config);

  const browser = await connectOverCdpWithFallbacks(config);

  const context = browser.contexts()[0];

  if (!context) {
    throw new Error('Не найден default context в Chrome CDP-сессии.');
  }

  context.setDefaultTimeout(config.defaultTimeout);
  context.setDefaultNavigationTimeout(config.navigationTimeout);

  const page = await getCdpAutomationPage(context);

  return {
    context,
    page,
    close: async () => {
      console.log('CDP режим: оставляю уже запущенный Chrome открытым');
    },
  };
}

async function launchChromeForCdp(config) {
  if (!config.browserExecutablePath) {
    throw new Error(
      'Не найден Google Chrome. Укажите BROWSER_EXECUTABLE_PATH или установите Chrome.'
    );
  }

  if (!fs.existsSync(config.browserExecutablePath)) {
    throw new Error(`Chrome executable не найден: ${config.browserExecutablePath}`);
  }

  validateUserDataDir(config);
  fs.mkdirSync(config.userDataDir, { recursive: true });

  if (await isCdpEndpointReady(config.cdpEndpoint)) {
    console.log(`Chrome CDP endpoint уже доступен, переиспользую: ${config.cdpEndpoint}`);
    return;
  }

  const args = [
    `--remote-debugging-port=${config.cdpPort}`,
    `--user-data-dir=${config.userDataDir}`,
    'about:blank',
  ];

  if (config.browserProfileDirectory) {
    args.push(`--profile-directory=${config.browserProfileDirectory}`);
  }

  if (config.disableDevToolsDebuggingRestrictions) {
    args.push('--disable-features=DevToolsDebuggingRestrictions');
  }

  console.log('Запускаю Chrome с remote debugging автоматически');
  console.log(`Chrome executable: ${config.browserExecutablePath}`);
  console.log(`Chrome args: ${args.join(' ')}`);

  const chromeProcess = spawn(config.browserExecutablePath, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });

  chromeProcess.unref();

  await waitForCdpEndpoint(config.cdpEndpoint, config.navigationTimeout);
}

async function waitForCdpEndpoint(endpoint, timeout) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    if (await isCdpEndpointReady(endpoint)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Chrome запущен, но CDP endpoint не ответил: ${getCdpEndpointCandidates(endpoint).join(', ')}`
  );
}

async function isCdpEndpointReady(endpoint) {
  for (const candidate of getCdpEndpointCandidates(endpoint)) {
    const versionUrl = `${candidate.replace(/\/$/, '')}/json/version`;

    if (await canReadUrl(versionUrl)) {
      return true;
    }
  }

  return false;
}

async function getCdpAutomationPage(context) {
  const blankPage = context.pages().find((page) => page.url() === 'about:blank');

  return blankPage || await context.newPage();
}

function canReadUrl(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function connectOverCdpWithFallbacks(config) {
  const endpoints = getCdpEndpointCandidates(config.cdpEndpoint);
  let lastError;

  for (const endpoint of endpoints) {
    try {
      console.log(`Пробую CDP endpoint: ${endpoint}`);

      return await chromium.connectOverCDP(endpoint, {
        noDefaults: true,
        slowMo: config.slowMo,
        timeout: config.navigationTimeout,
      });
    } catch (error) {
      lastError = error;
      console.log(`Не удалось подключиться к ${endpoint}: ${error.message}`);
    }
  }

  throw new Error(buildCdpConnectionError(config.cdpEndpoint, endpoints, lastError));
}

function getCdpEndpointCandidates(endpoint) {
  const endpoints = [endpoint];

  try {
    const url = new URL(endpoint);

    if (url.hostname === 'localhost') {
      url.hostname = '127.0.0.1';
      endpoints.push(url.toString().replace(/\/$/, ''));
    }

    if (url.hostname === '127.0.0.1') {
      url.hostname = 'localhost';
      endpoints.push(url.toString().replace(/\/$/, ''));
    }
  } catch (error) {
    return endpoints;
  }

  return [...new Set(endpoints)];
}

function buildCdpConnectionError(originalEndpoint, attemptedEndpoints, lastError) {
  return [
    `Не удалось подключиться к Chrome CDP endpoint: ${originalEndpoint}`,
    `Пробовал: ${attemptedEndpoints.join(', ')}`,
    lastError ? `Последняя ошибка: ${lastError.message}` : undefined,
    '',
    'Проверьте, что Chrome запущен с remote debugging:',
    '& "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:LOCALAPPDATA\\Google\\Chrome\\User Data" --profile-directory="Default"',
    '',
    'Потом откройте в Chrome: http://127.0.0.1:9222/json/version',
    'Если JSON не открывается, бот тоже не сможет подключиться.',
    '',
    'В .env лучше использовать:',
    'CHROME_CDP_ENDPOINT=http://127.0.0.1:9222',
  ].filter(Boolean).join('\n');
}

function logBrowserConfig(config) {
  console.log(`BROWSER: ${config.browserName || 'playwright-chromium'}`);
  if (config.cdpEndpoint) {
    console.log(`CDP endpoint: ${config.cdpEndpoint}`);
    console.log('Профиль и cookies управляются уже запущенным Chrome');
    return;
  }

  console.log(`Путь к браузеру: ${config.browserExecutablePath || config.browserChannel || 'Playwright Chromium'}`);
  console.log(`Источник профиля: ${config.userDataDirSource || 'default'}`);
  console.log(`Папка профиля: ${config.userDataDir}`);

  if (config.browserProfileDirectory) {
    console.log(`Имя профиля: ${config.browserProfileDirectory}`);
  }
}

async function closeStartupBlankPages(context, activePage) {
  const pages = context.pages();

  for (const page of pages) {
    if (page === activePage || page.url() !== 'about:blank') {
      continue;
    }

    await page.close().catch(() => {});
  }
}

function validateUserDataDir(config) {
  if (!config.userDataDir) {
    throw new Error('USER_DATA_DIR не задан: укажите папку профиля браузера.');
  }

  const extension = path.win32.extname(config.userDataDir).toLowerCase();

  if (extension === '.exe') {
    throw new Error(buildUserDataDirError(config));
  }

  if (!fs.existsSync(config.userDataDir)) {
    return;
  }

  const stats = fs.statSync(config.userDataDir);

  if (stats.isFile()) {
    throw new Error(buildUserDataDirError(config));
  }
}

function buildUserDataDirError(config) {
  const source = config.userDataDirSource || 'USER_DATA_DIR';

  return [
    `${source} должен указывать на папку профиля с cookies, а не на exe-файл браузера.`,
    `Сейчас указано: ${config.userDataDir}`,
    'Для Chrome используйте так:',
    'BROWSER=chrome',
    'CHROME_USER_DATA_DIR=C:\\Users\\dmitr\\AppData\\Local\\Google\\Chrome\\User Data',
    'CHROME_PROFILE_DIRECTORY=Default',
    'Если хотите указать chrome.exe вручную, используйте BROWSER_EXECUTABLE_PATH, а не USER_DATA_DIR.',
  ].join('\n');
}

module.exports = {
  launchPersistentBrowser,
};
