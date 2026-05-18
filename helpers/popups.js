const { clickIfVisible } = require('./actions');

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
}

module.exports = {
  handleOptionalPopups,
};
