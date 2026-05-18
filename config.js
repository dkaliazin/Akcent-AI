const path = require('node:path');
const { loadLocalEnv } = require('./helpers/env');

loadLocalEnv();

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

module.exports = {
  baseUrl: 'https://nz.ua',
  browserExecutablePath: process.env.BROWSER_EXECUTABLE_PATH,
  userDataDir: pathFromEnv(
    'USER_DATA_DIR',
    path.resolve(__dirname, '.browser-profile', 'chromium')
  ),
  headless: process.env.HEADLESS === 'true',
  slowMo: numberFromEnv('SLOW_MO_MS', 0),
  defaultTimeout: numberFromEnv('DEFAULT_TIMEOUT_MS', 15000),
  navigationTimeout: numberFromEnv('NAVIGATION_TIMEOUT_MS', 30000),
  optionalPopupTimeout: numberFromEnv('OPTIONAL_POPUP_TIMEOUT_MS', 5000),
  manualVerificationTimeout: numberFromEnv('MANUAL_VERIFICATION_TIMEOUT_MS', 120000),
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
