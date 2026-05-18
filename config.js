const fs = require('node:fs');
const path = require('node:path');
const { loadLocalEnv } = require('./helpers/env');

loadLocalEnv();

const booleanFromEnv = (name, fallback) => {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  return !['0', 'false', 'no', 'off'].includes(rawValue.trim().toLowerCase());
};

const numberFromEnv = (name, fallback) => {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);

  return Number.isFinite(value) ? value : fallback;
};

const portFromEndpoint = (endpoint, fallback) => {
  if (!endpoint) {
    return fallback;
  }

  try {
    const url = new URL(endpoint);
    const port = Number(url.port);

    return Number.isFinite(port) && port > 0 ? port : fallback;
  } catch (error) {
    return fallback;
  }
};

const browserName = (process.env.BROWSER || '').trim().toLowerCase();
const autoLaunchChromeCdp = ['chrome-cdp', 'chrome-cdp-auto'].includes(browserName) ||
  booleanFromEnv('CHROME_CDP_AUTO_LAUNCH', false);
const isChrome = browserName === 'chrome' || autoLaunchChromeCdp;
const configuredCdpEndpoint = process.env.CHROME_CDP_ENDPOINT || process.env.CDP_ENDPOINT;
const cdpPort = numberFromEnv('CHROME_CDP_PORT', portFromEndpoint(configuredCdpEndpoint, 9222));
const cdpEndpoint = configuredCdpEndpoint ||
  (autoLaunchChromeCdp ? `http://127.0.0.1:${cdpPort}` : undefined);

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

const getUserDataDirSource = () => {
  if (process.env.CHROME_USER_DATA_DIR) {
    return 'CHROME_USER_DATA_DIR';
  }

  if (process.env.USER_DATA_DIR) {
    return 'USER_DATA_DIR';
  }

  return 'default';
};

module.exports = {
  baseUrl: 'https://nz.ua',
  browserName: autoLaunchChromeCdp ? 'chrome-cdp-auto' : (cdpEndpoint ? 'chrome-cdp' : browserName),
  browserChannel: !cdpEndpoint && isChrome && !process.env.BROWSER_EXECUTABLE_PATH ? 'chrome' : undefined,
  cdpEndpoint,
  cdpPort,
  autoLaunchChromeCdp,
  browserExecutablePath: process.env.BROWSER_EXECUTABLE_PATH ||
    (isChrome ? getDefaultChromeExecutablePath() : undefined),
  browserProfileDirectory: process.env.CHROME_PROFILE_DIRECTORY ||
    process.env.BROWSER_PROFILE_DIRECTORY ||
    (isChrome ? 'Default' : undefined),
  userDataDir: pathFromEnv(
    'CHROME_USER_DATA_DIR',
    pathFromEnv(
      'USER_DATA_DIR',
      autoLaunchChromeCdp
        ? path.resolve(__dirname, '.browser-profile', 'chrome-cdp')
        : isChrome
        ? getDefaultChromeUserDataDir() || path.resolve(__dirname, '.browser-profile', 'chrome')
        : path.resolve(__dirname, '.browser-profile', 'chromium')
    )
  ),
  userDataDirSource: getUserDataDirSource(),
  disableDevToolsDebuggingRestrictions: booleanFromEnv(
    'CHROME_DISABLE_DEVTOOLS_RESTRICTIONS',
    isChrome
  ),
  headless: process.env.HEADLESS === 'true',
  slowMo: numberFromEnv('SLOW_MO_MS', 0),
  defaultTimeout: numberFromEnv('DEFAULT_TIMEOUT_MS', 15000),
  navigationTimeout: numberFromEnv('NAVIGATION_TIMEOUT_MS', 30000),
  optionalPopupTimeout: numberFromEnv('OPTIONAL_POPUP_TIMEOUT_MS', 5000),
  manualVerificationTimeout: numberFromEnv('MANUAL_VERIFICATION_TIMEOUT_MS', 120000),
  manualLoginTimeout: numberFromEnv('MANUAL_LOGIN_TIMEOUT_MS', 600000),
  geography7Transfer: {
    subject: process.env.TRANSFER_SUBJECT || 'Географія',
    grade: process.env.TRANSFER_GRADE || '7',
    sourceSemester: process.env.TRANSFER_SOURCE_SEMESTER || '2024-2025 [2]',
    targetSemester: process.env.TRANSFER_TARGET_SEMESTER || '2025-2026 [2]',
  },
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
    loggedInCabinetMarker: [
      'text=Журнали',
      'text=Навчальні журнали',
      'text=Розклад',
      'text=Вийти',
      'a:has-text("Журнали")',
      'a:has-text("Вийти")',
      '.sidebar',
      '.side-menu',
      'nav:has-text("Журнали")',
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
      '.modal.show .modal-close',
      '.modal.show [data-dismiss="modal"]',
      '.modal.show [data-bs-dismiss="modal"]',
      '.modal button.close',
      '.popup button.close',
      '.modal-close',
      '.close',
    ],
    blockingModal: [
      '.modal.show',
      '.modal[style*="display: block"]',
      '#modal-1',
      '.modal-content',
    ],
    blockingModalBackdrop: [
      '.modal-backdrop',
      '.modal-backdrop.show',
    ],
    blockingModalClose: [
      '.modal.show .modal-close',
      '.modal.show [data-dismiss="modal"]',
      '.modal.show [data-bs-dismiss="modal"]',
      '.modal.show [aria-label="Close"]',
      '.modal.show [aria-label="Закрити"]',
      '.modal.show button.close',
      '.modal.show .close',
      '.modal.show button:has-text("×")',
      '#modal-1 .modal-close',
      '#modal-1 [data-dismiss="modal"]',
      '#modal-1 [data-bs-dismiss="modal"]',
      '#modal-1 [aria-label="Close"]',
      '#modal-1 button.close',
      '#modal-1 .close',
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
      'text=Журнал не знайден',
      'text=Журнал не найден',
    ],
  },
};
