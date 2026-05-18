const fs = require('node:fs');
const { chromium } = require('playwright');

async function launchPersistentBrowser(config) {
  console.log(`[1/7] Запускаю Chromium с persistent profile: ${config.userDataDir}`);

  fs.mkdirSync(config.userDataDir, { recursive: true });

  const context = await chromium.launchPersistentContext(config.userDataDir, {
    headless: config.headless,
    slowMo: config.slowMo,
    viewport: config.viewport,
  });

  context.setDefaultTimeout(config.defaultTimeout);
  context.setDefaultNavigationTimeout(config.navigationTimeout);

  const page = context.pages()[0] || await context.newPage();

  return { context, page };
}

module.exports = {
  launchPersistentBrowser,
};
