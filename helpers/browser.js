const fs = require('node:fs');
const { chromium } = require('playwright');

async function launchPersistentBrowser(config) {
  console.log(`[1/7] Запускаю браузер с persistent profile: ${config.userDataDir}`);

  fs.mkdirSync(config.userDataDir, { recursive: true });

  const launchOptions = {
    headless: config.headless,
    slowMo: config.slowMo,
    viewport: config.viewport,
  };

  if (config.browserExecutablePath) {
    console.log(`Использую установленный браузер: ${config.browserExecutablePath}`);
    launchOptions.executablePath = config.browserExecutablePath;
  } else {
    console.log('Использую Chromium из Playwright');
  }

  const context = await chromium.launchPersistentContext(config.userDataDir, launchOptions);

  context.setDefaultTimeout(config.defaultTimeout);
  context.setDefaultNavigationTimeout(config.navigationTimeout);

  const page = context.pages()[0] || await context.newPage();

  return { context, page };
}

module.exports = {
  launchPersistentBrowser,
};
