const fs = require('node:fs');
const path = require('node:path');
const { loadLocalEnv } = require('./helpers/env');

loadLocalEnv();

const browserName = (process.env.BROWSER || '').trim().toLowerCase();
const isChrome = browserName === 'chrome';

const numberFromEnv = (name, fallback) => {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);

  return Number.isFinite(value) ? value : fallback;
};

const pathFromEnv = (name, fallback) => {
  const value = process.env[name];

  return value ? path.resolve(value) : fallback;
};

const firstExistingPath = (paths) => paths.find((candidatePath) => {
  if (!candidatePath) {
    return false;
  }

  try {
    return fs.existsSync(candidatePath);
  } catch (error) {
    return false;
  }
});

const getDefaultChromeExecutablePath = () => firstExistingPath([
  process.env.LOCALAPPDATA && path.join(
    process.env.LOCALAPPDATA,
    'Google',
    'Chrome',
    'Application',
    'chrome.exe'
  ),
  process.env.PROGRAMFILES && path.join(
    process.env.PROGRAMFILES,
    'Google',
    'Chrome',
    'Application',
    'chrome.exe'
  ),
  process.env['PROGRAMFILES(X86)'] && path.join(
    process.env['PROGRAMFILES(X86)'],
    'Google',
    'Chrome',
    'Application',
    'chrome.exe'
  ),
]);

const getDefaultChromeUserDataDir = () => {
  if (!process.env.LOCALAPPDATA) {
    return undefined;
  }

  return path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data');
};

module.exports = {
  baseUrl: 'https://nz.ua',
  browserName,
  browserChannel: isChrome && !process.env.BROWSER_EXECUTABLE_PATH ? 'chrome' : undefined,
  browserExecutablePath: process.env.BROWSER_EXECUTABLE_PATH ||
    (isChrome ? getDefaultChromeExecutablePath() : undefined),
  browserProfileDirectory: process.env.CHROME_PROFILE_DIRECTORY ||
    process.env.BROWSER_PROFILE_DIRECTORY ||
    (isChrome ? 'Default' : undefined),
  userDataDir: pathFromEnv(
    'CHROME_USER_DATA_DIR',
    pathFromEnv(
      'USER_DATA_DIR',
      isChrome
        ? getDefaultChromeUserDataDir() || path.resolve(__dirname, '.browser-profile', 'chrome')
        : path.resolve(__dirname, '.browser-profile', 'chromium')
    )
  ),
  headless: process.env.HEADLESS === 'true',
  slowMo: numberFromEnv('SLOW_MO_MS', 0),
  defaultTimeout: numberFromEnv('DEFAULT_TIMEOUT_MS', 15000),
  navigationTimeout: numberFromEnv('NAVIGATION_TIMEOUT_MS', 30000),
  optionalPopupTimeout: numberFromEnv('OPTIONAL_POPUP_TIMEOUT_MS', 5000),
  manualVerificationTimeout: numberFromEnv('MANUAL_VERIFICATION_TIMEOUT_MS', 120000),
  manualLoginTimeout: numberFromEnv('MANUAL_LOGIN_TIMEOUT_MS', 600000),
  viewport: {
    width: 1366,
    height: 768,
  },
  selectors: {
    securityCheckPage: [
      'text=Выполнение проверки безопасности',
      'text=Виконання перевірки безпеки',
      'text=Подтвердите, что вы человек',
      'text=Підтвердіть, що ви людина',
      'iframe[src*="challenges.cloudflare.com"]',
    ],
    cabinetEntry: [
      'a:has-text("Увійти до кабінету")',
      'button:has-text("Увійти до кабінету")',
      'text=Увійти до кабінету',
    ],
    loginButton: [
      'button[type="submit"]:has-text("Увійти")',
      'input[type="submit"][value*="Увійти"]',
      'button:has-text("Увійти")',
      'text=Увійти',
    ],
    loginPageMarker: [
      'text=Вхід на сайт',
      'text=Ім\'я користувача або e-mail',
      'text=Пароль',
      'input[name="login"]',
      'input[name="email"]',
      'input[type="password"]',
    ],
    okPopupButton: [
      'button:has-text("OK")',
      'button:has-text("Ok")',
      'button:has-text("ОК")',
      'text=OK',
      'text=ОК',
    ],
    closePopupButton: [
      '[aria-label="Close"]',
      '[aria-label="Закрити"]',
      'button:has-text("×")',
      '.modal button.close',
      '.popup button.close',
      '.close',
    ],
    journalsLink: [
      'a:has-text("Навчальні журнали")',
      'button:has-text("Навчальні журнали")',
      'text=Навчальні журнали',
    ],
    journalsPageMarker: [
      'h1:has-text("Навчальні журнали")',
      'h2:has-text("Навчальні журнали")',
      'text=Навчальні журнали',
    ],
  },
};
