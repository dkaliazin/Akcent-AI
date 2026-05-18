const config = require('./config');
const { launchPersistentBrowser } = require('./helpers/browser');
const { handleOptionalPopups } = require('./helpers/popups');
const { transferGeography7Homework } = require('./helpers/journalTransfer');
const {
  clickLoginButton,
  openCabinetLogin,
  openHomePage,
} = require('./helpers/nzUa');

async function run() {
  let context;
  let closeBrowser;

  try {
    console.log('Старт тестового заполнения Географія 7');

    const browser = await launchPersistentBrowser(config);
    context = browser.context;
    closeBrowser = browser.close;

    await openHomePage(browser.page, config);
    await openCabinetLogin(browser.page, config);
    await clickLoginButton(browser.page, config);
    await handleOptionalPopups(browser.page, config);
    await transferGeography7Homework(browser.page, config);

    console.log('Тестовое заполнение Географія 7 завершено');
  } catch (error) {
    console.error('Тестовое заполнение завершилось с ошибкой');
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (!context) {
      return;
    }

    if (process.env.KEEP_BROWSER_OPEN === 'true') {
      console.log('KEEP_BROWSER_OPEN=true, браузер оставлен открытым');
      return;
    }

    console.log('Закрываю браузер и сохраняю persistent profile');

    if (closeBrowser) {
      await closeBrowser();
      return;
    }

    await context.close();
  }
}

run();
