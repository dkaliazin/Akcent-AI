const { clickIfVisible, waitForAnySelector } = require('./actions');

async function handleOptionalPopups(page, config) {
  console.log('[5/7] Проверяю popup с кнопкой OK');
  await clickIfVisible(page, config.selectors.okPopupButton, {
    description: 'popup с кнопкой OK',
    timeout: config.optionalPopupTimeout,
  });

  console.log('[6/7] Проверяю popup с крестиком закрытия');
  await clickIfVisible(page, config.selectors.closePopupButton, {
    description: 'popup с крестиком закрытия',
    timeout: config.optionalPopupTimeout,
  });

  await closeBlockingModals(page, config);
}

async function closeBlockingModals(page, config) {
  console.log('Проверяю блокирующие модальные окна сайта');

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const hasModal = await isBlockingModalVisible(page, config);

    if (!hasModal) {
      console.log('Блокирующие модальные окна не найдены');
      return;
    }

    console.log(`Найдена блокирующая модалка, закрываю (попытка ${attempt})`);

    const closedByButton = await clickIfVisible(page, config.selectors.blockingModalClose, {
      description: 'крестик блокирующей модалки',
      timeout: 1000,
    });

    if (!closedByButton) {
      console.log('Крестик модалки не найден, пробую закрыть через Escape');
      await page.keyboard.press('Escape');
    }

    await waitForModalsToClose(page, config);
  }

  if (await isBlockingModalVisible(page, config)) {
    throw new Error('Не удалось закрыть блокирующую модалку сайта.');
  }
}

async function isBlockingModalVisible(page, config) {
  try {
    await waitForAnySelector(page, config.selectors.blockingModal, {
      timeout: 1000,
    });

    return true;
  } catch (error) {
    return false;
  }
}

async function waitForModalsToClose(page, config) {
  await Promise.all([
    ...config.selectors.blockingModal.map((selector) =>
      page.waitForSelector(selector, {
        state: 'hidden',
        timeout: config.optionalPopupTimeout,
      }).catch(() => {})
    ),
    ...config.selectors.blockingModalBackdrop.map((selector) =>
      page.waitForSelector(selector, {
        state: 'hidden',
        timeout: config.optionalPopupTimeout,
      }).catch(() => {})
    ),
  ]);
}

module.exports = {
  closeBlockingModals,
  handleOptionalPopups,
};
