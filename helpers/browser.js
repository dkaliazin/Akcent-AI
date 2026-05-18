const fs = require('node:fs');
const path = require('node:path');
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
  console.log(`[1/7] Подключаюсь к уже запущенному Chrome: ${config.cdpEndpoint}`);
  logBrowserConfig(config);

  const browser = await chromium.connectOverCDP(config.cdpEndpoint, {
    noDefaults: true,
    slowMo: config.slowMo,
    timeout: config.navigationTimeout,
  });

  const context = browser.contexts()[0];

  if (!context) {
    throw new Error('Не найден default context в Chrome CDP-сессии.');
  }

  context.setDefaultTimeout(config.defaultTimeout);
  context.setDefaultNavigationTimeout(config.navigationTimeout);

  const page = context.pages()[0] || await context.newPage();

  return {
    context,
    page,
    close: async () => {
      console.log('CDP режим: оставляю уже запущенный Chrome открытым');
    },
  };
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
