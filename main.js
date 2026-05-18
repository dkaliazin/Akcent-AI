const config = require('./config');
const { launchPersistentBrowser } = require('./helpers/browser');
const { handleOptionalPopups } = require('./helpers/popups');
const {
  clickLoginButton,
  openCabinetLogin,
  openHomePage,
  openTrainingJournals,
} = require('./helpers/nzUa');

async function run() {
  let context;

  try {
    console.log('Старт automation-бота для nz.ua');

    const browser = await launchPersistentBrowser(config);
    context = browser.context;

    await openHomePage(browser.page, config);
    await openCabinetLogin(browser.page, config);
    await clickLoginButton(browser.page, config);
    await handleOptionalPopups(browser.page, config);
    await openTrainingJournals(browser.page, config);

    console.log('Первый этап завершен: раздел "Навчальні журнали" открыт');
  } catch (error) {
    console.error('Automation завершился с ошибкой');
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
    await context.close();
  }
}

run();
