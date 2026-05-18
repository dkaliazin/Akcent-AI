async function waitForAnySelector(page, selectors, options = {}) {
  const timeout = options.timeout ?? 15000;
  const state = options.state ?? 'visible';

  const waits = selectors.map((selector) =>
    page.waitForSelector(selector, { timeout, state }).then(() => selector)
  );

  try {
    return await Promise.any(waits);
  } catch (error) {
    throw new Error(`Не найден ни один селектор: ${selectors.join(', ')}`);
  }
}

async function clickFirstAvailable(page, selectors, options = {}) {
  const description = options.description ?? 'элемент';
  console.log(`Ожидаю ${description}`);

  const selector = await waitForAnySelector(page, selectors, options);
  console.log(`Кликаю ${description}: ${selector}`);

  await page.click(selector);

  return selector;
}

async function clickIfVisible(page, selectors, options = {}) {
  const description = options.description ?? 'необязательный элемент';

  try {
    const selector = await waitForAnySelector(page, selectors, {
      ...options,
      timeout: options.timeout ?? 3000,
    });

    console.log(`Найден ${description}, кликаю: ${selector}`);
    await page.click(selector);

    return true;
  } catch (error) {
    console.log(`${description} не появился`);

    return false;
  }
}

async function waitForLoadToSettle(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
}

module.exports = {
  clickFirstAvailable,
  clickIfVisible,
  waitForAnySelector,
  waitForLoadToSettle,
};
