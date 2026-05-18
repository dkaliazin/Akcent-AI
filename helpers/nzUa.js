const {
  clickFirstAvailable,
  waitForAnySelector,
  waitForLoadToSettle,
} = require('./actions');

async function openHomePage(page, config) {
  console.log(`[2/7] Открываю сайт ${config.baseUrl}`);

  await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded' });
  await waitForLoadToSettle(page);
  await waitForManualSecurityCheck(page, config);
}

async function openCabinetLogin(page, config) {
  console.log('[3/7] Нажимаю "Увійти до кабінету"');

  await clickFirstAvailable(page, config.selectors.cabinetEntry, {
    description: 'кнопку "Увійти до кабінету"',
    timeout: config.defaultTimeout,
  });
  await waitForLoadToSettle(page);
}

async function clickLoginButton(page, config) {
  console.log('[4/7] Использую сохраненные cookies и нажимаю кнопку входа');

  try {
    await clickFirstAvailable(page, config.selectors.loginButton, {
      description: 'кнопку входа',
      timeout: config.defaultTimeout,
    });
    await waitForLoadToSettle(page);
  } catch (error) {
    const journalsLinkVisible = await hasJournalsLink(page, config);

    if (!journalsLinkVisible) {
      throw error;
    }

    console.log('Кнопка входа не найдена, потому что активная сессия уже открыта');
  }
}

async function openTrainingJournals(page, config) {
  console.log('[7/7] Перехожу в "Навчальні журнали"');

  await clickFirstAvailable(page, config.selectors.journalsLink, {
    description: 'раздел "Навчальні журнали"',
    timeout: config.defaultTimeout,
  });
  await waitForLoadToSettle(page);

  console.log('Ожидаю загрузку страницы "Навчальні журнали"');
  await waitForAnySelector(page, config.selectors.journalsPageMarker, {
    timeout: config.defaultTimeout,
  });
}

async function hasJournalsLink(page, config) {
  try {
    await waitForAnySelector(page, config.selectors.journalsLink, {
      timeout: 3000,
    });

    return true;
  } catch (error) {
    return false;
  }
}

async function waitForManualSecurityCheck(page, config) {
  try {
    await waitForAnySelector(page, config.selectors.securityCheckPage, {
      timeout: 2000,
    });
  } catch (error) {
    return;
  }

  console.log(
    'Обнаружена проверка безопасности. Пройдите ее вручную в открытом браузере.'
  );
  console.log(
    `Жду появления кнопки "Увійти до кабінету" до ${config.manualVerificationTimeout} ms`
  );

  await waitForAnySelector(page, config.selectors.cabinetEntry, {
    timeout: config.manualVerificationTimeout,
  });
}

module.exports = {
  clickLoginButton,
  openCabinetLogin,
  openHomePage,
  openTrainingJournals,
};
