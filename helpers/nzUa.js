const {
  clickFirstAvailable,
  waitForAnySelector,
  waitForLoadToSettle,
} = require('./actions');

async function openHomePage(page, config) {
  console.log(`[2/7] Открываю сайт ${config.baseUrl}`);

  await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded' });
  console.log(`Текущий URL после перехода: ${page.url()}`);
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
    const journalsLinkVisible = await hasJournalsLink(page, config, 3000);

    if (!journalsLinkVisible) {
      throw error;
    }

    console.log('Кнопка входа не найдена, потому что активная сессия уже открыта');
  }

  await waitForCabinetAccess(page, config);
}

async function openTrainingJournals(page, config) {
  console.log('[7/7] Перехожу в "Навчальні журнали"');

  await clickFirstAvailable(page, config.selectors.journalsLink, {
    description: 'раздел "Навчальні журнали"',
    timeout: config.defaultTimeout,
  });
  await waitForLoadToSettle(page);

  console.log('Ожидаю загрузку страницы "Навчальні журнали"');
  try {
    await waitForAnySelector(page, config.selectors.journalsPageMarker, {
      timeout: config.defaultTimeout,
    });
  } catch (error) {
    if (page.url().includes('/journal/')) {
      console.log(`Страница журналов открыта: ${page.url()}`);
      return;
    }

    throw error;
  }
}

async function hasJournalsLink(page, config, timeout = 3000) {
  try {
    await waitForAnySelector(page, config.selectors.journalsLink, {
      timeout,
    });

    return true;
  } catch (error) {
    return false;
  }
}

async function waitForCabinetAccess(page, config) {
  const journalsLinkVisible = await hasJournalsLink(page, config, 5000);

  if (journalsLinkVisible) {
    console.log('Вход выполнен, ссылка "Навчальні журнали" доступна');
    return;
  }

  const loginFormVisible = await hasLoginPageMarker(page, config);

  if (!loginFormVisible) {
    console.log(
      'Ссылка "Навчальні журнали" пока не найдена. Жду ручной вход перед продолжением.'
    );
  } else {
    console.log(
      'Автоматический вход не выполнен: открыта форма логина. Войдите вручную в открытом браузере.'
    );
  }

  console.log(
    `Следующие шаги остановлены до появления "Навчальні журнали" (${config.manualLoginTimeout} ms)`
  );

  await waitForAnySelector(page, config.selectors.journalsLink, {
    timeout: config.manualLoginTimeout,
  });

  console.log('Ручной вход выполнен, продолжаю алгоритм');
}

async function hasLoginPageMarker(page, config) {
  try {
    await waitForAnySelector(page, config.selectors.loginPageMarker, {
      timeout: 2000,
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
