const { waitForLoadToSettle } = require('./actions');
const { closeBlockingModals } = require('./popups');

async function transferGeography7Homework(page, config) {
  const transferConfig = config.geography7Transfer;

  console.log(
    `Старт переноса: ${transferConfig.subject} ${transferConfig.grade} класс`
  );
  console.log(`Источник: ${transferConfig.sourceSemester}`);
  console.log(`Цель: ${transferConfig.targetSemester}`);

  await openJournalForSemester(page, config, transferConfig.sourceSemester, transferConfig);
  const sourceRows = await collectHomeworkRows(page, config);

  if (sourceRows.length === 0) {
    throw new Error('Не удалось прочитать строки тем и домашних заданий из прошлого года.');
  }

  console.log(`Прочитано строк из источника: ${sourceRows.length}`);

  await openJournalForSemester(page, config, transferConfig.targetSemester, transferConfig);
  await fillHomeworkRows(page, config, sourceRows);

  console.log('Перенос тем и домашних заданий завершен');
}

async function openJournalForSemester(page, config, semesterText, transferConfig) {
  console.log(`Открываю журнал ${transferConfig.subject} ${transferConfig.grade}, семестр: ${semesterText}`);

  await page.goto(`${config.baseUrl}/journal/index`, { waitUntil: 'domcontentloaded' });
  await waitForLoadToSettle(page);
  await closeBlockingModals(page, config);
  await selectSemester(page, semesterText);
  await waitForLoadToSettle(page);

  console.log('Открываю список журналов');
  await page.goto(`${config.baseUrl}/journal/list`, { waitUntil: 'domcontentloaded' });
  await waitForLoadToSettle(page);
  await closeBlockingModals(page, config);
  await selectJournalFromList(page, config, transferConfig.subject, transferConfig.grade);
  await waitForLoadToSettle(page);
  await closeBlockingModals(page, config);
}

async function selectSemester(page, semesterText) {
  console.log(`Выбираю семестр: ${semesterText}`);

  const selected = await page.evaluate((needle) => {
    const normalize = (value) => value.replace(/\s+/g, ' ').trim();
    const normalizedNeedle = normalize(needle);

    for (const select of document.querySelectorAll('select')) {
      const option = Array.from(select.options).find((item) =>
        normalize(item.textContent || '').includes(normalizedNeedle)
      );

      if (!option) {
        continue;
      }

      select.value = option.value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));

      return true;
    }

    return false;
  }, semesterText);

  if (selected) {
    return;
  }

  await page.locator('text=Семестр').first().click();
  await page.locator(`text=${semesterText}`).first().click();
}

async function selectJournalFromList(page, config, subject, grade) {
  console.log(`Ищу журнал в списке: ${subject} ${grade}`);

  const href = await page.evaluate(({ subjectName, gradeName }) => {
    const normalize = (value) => value.replace(/\s+/g, ' ').trim();
    const rows = Array.from(document.querySelectorAll('tr'));

    for (const row of rows) {
      const rowText = normalize(row.textContent || '');

      if (!rowText.toLowerCase().includes(subjectName.toLowerCase())) {
        continue;
      }

      const links = Array.from(row.querySelectorAll('a[href]'));
      const gradeLink = links.find((link) => normalize(link.textContent || '') === gradeName);

      if (gradeLink) {
        return gradeLink.href;
      }
    }

    return null;
  }, { subjectName: subject, gradeName: grade });

  if (!href) {
    throw new Error(`Не найден журнал ${subject} ${grade} в списке журналов.`);
  }

  await page.goto(href, { waitUntil: 'domcontentloaded' });
  await waitForLoadToSettle(page);
  console.log(`Журнал открыт: ${page.url()}`);
}

async function collectHomeworkRows(page, config) {
  const rows = [];

  for (let pageIndex = 1; pageIndex <= 20; pageIndex += 1) {
    await waitForHomeworkTable(page, config);

    const pageRows = await extractHomeworkRowsFromCurrentPage(page);
    console.log(`Страница ${pageIndex}: найдено строк ${pageRows.length}`);
    rows.push(...pageRows);

    const nextPage = await getNextPaginationNumber(page);

    if (!nextPage) {
      break;
    }

    await clickPaginationNumber(page, nextPage);
    await waitForLoadToSettle(page);
  }

  return rows.filter((row) => row.lessonNumber || row.topic || row.homework);
}

async function fillHomeworkRows(page, config, sourceRows) {
  let sourceIndex = 0;

  for (let pageIndex = 1; pageIndex <= 20 && sourceIndex < sourceRows.length; pageIndex += 1) {
    await waitForHomeworkTable(page, config);

    const rowCount = await getEditableRowsCount(page);
    console.log(`Целевая страница ${pageIndex}: доступно строк ${rowCount}`);

    for (let rowIndex = 0; rowIndex < rowCount && sourceIndex < sourceRows.length; rowIndex += 1) {
      const sourceRow = sourceRows[sourceIndex];
      console.log(
        `Заполняю строку ${sourceIndex + 1}/${sourceRows.length}: урок ${sourceRow.lessonNumber || '-'}`
      );

      await openHomeworkEditor(page, rowIndex);
      await fillHomeworkEditor(page, sourceRow);
      sourceIndex += 1;
    }

    if (sourceIndex >= sourceRows.length) {
      break;
    }

    const nextPage = await getNextPaginationNumber(page);

    if (!nextPage) {
      console.log('Следующая страница не найдена, оставшиеся строки не заполнены');
      break;
    }

    await clickPaginationNumber(page, nextPage);
    await waitForLoadToSettle(page);
  }

  console.log(`Заполнено строк: ${sourceIndex}/${sourceRows.length}`);
}

async function waitForHomeworkTable(page, config) {
  await page.waitForSelector('text=Теми уроків та домашні завдання', {
    timeout: config.defaultTimeout,
  });
  await page.waitForSelector('table', {
    timeout: config.defaultTimeout,
  });
}

async function extractHomeworkRowsFromCurrentPage(page) {
  return page.evaluate(() => {
    const table = findHomeworkTable();

    if (!table) {
      return [];
    }

    const headers = getHeaderTexts(table);
    const indexes = getHomeworkColumnIndexes(headers);
    const rows = Array.from(table.querySelectorAll('tbody tr, tr')).filter((row) =>
      row.querySelectorAll('td').length > 0
    );

    return rows.map((row) => {
      const cells = Array.from(row.querySelectorAll('td'));

      return {
        homework: getCellText(cells[indexes.homework]),
        lessonNumber: getCellText(cells[indexes.lessonNumber]),
        topic: getCellText(cells[indexes.topic]),
      };
    }).filter((row) => row.homework || row.lessonNumber || row.topic);

    function findHomeworkTable() {
      return Array.from(document.querySelectorAll('table')).find((candidate) => {
        const text = normalize(candidate.textContent || '').toLowerCase();
        return text.includes('тема уроку') && text.includes('домашнє завдання');
      });
    }

    function getHeaderTexts(tableElement) {
      return Array.from(tableElement.querySelectorAll('th')).map((header) =>
        normalize(header.textContent || '').toLowerCase()
      );
    }

    function getHomeworkColumnIndexes(headerTexts) {
      const lessonNumber = headerTexts.findIndex((header) => header.includes('уроку'));
      const topic = headerTexts.findIndex((header) => header.includes('тема уроку'));
      const homework = headerTexts.findIndex((header) =>
        header.includes('домашнє завдання') && !header.endsWith('на')
      );

      return {
        homework: homework === -1 ? 6 : homework,
        lessonNumber: lessonNumber === -1 ? 2 : lessonNumber,
        topic: topic === -1 ? 4 : topic,
      };
    }

    function getCellText(cell) {
      return normalize(cell ? cell.textContent || '' : '');
    }

    function normalize(value) {
      return value.replace(/\s+/g, ' ').trim();
    }
  });
}

async function getEditableRowsCount(page) {
  return page.evaluate(() => {
    return getHomeworkRows().length;

    function getHomeworkRows() {
      const table = Array.from(document.querySelectorAll('table')).find((candidate) => {
        const text = normalize(candidate.textContent || '').toLowerCase();
        return text.includes('тема уроку') && text.includes('домашнє завдання');
      });

      if (!table) {
        return [];
      }

      return Array.from(table.querySelectorAll('tbody tr, tr')).filter((row) =>
        row.querySelectorAll('td').length > 0
      );
    }

    function normalize(value) {
      return value.replace(/\s+/g, ' ').trim();
    }
  });
}

async function openHomeworkEditor(page, rowIndex) {
  const opened = await page.evaluate((index) => {
    const rows = getHomeworkRows();
    const row = rows[index];

    if (!row) {
      return false;
    }

    const firstCell = row.querySelector('td');
    const editElement = firstCell && (
      (firstCell.matches('.homework_item, [class*="homework"]') ? firstCell : null) ||
      firstCell.querySelector('.homework_item') ||
      firstCell.querySelector('[class*="homework"]') ||
      firstCell.querySelector('a') ||
      firstCell.querySelector('button') ||
      firstCell.querySelector('svg')
    );

    if (!editElement) {
      return false;
    }

    editElement.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    }));

    return true;

    function getHomeworkRows() {
      const table = Array.from(document.querySelectorAll('table')).find((candidate) => {
        const text = normalize(candidate.textContent || '').toLowerCase();
        return text.includes('тема уроку') && text.includes('домашнє завдання');
      });

      if (!table) {
        return [];
      }

      return Array.from(table.querySelectorAll('tbody tr, tr')).filter((tableRow) =>
        tableRow.querySelectorAll('td').length > 0
      );
    }

    function normalize(value) {
      return value.replace(/\s+/g, ' ').trim();
    }
  }, rowIndex);

  if (!opened) {
    throw new Error(`Не удалось открыть редактор строки ${rowIndex + 1}`);
  }

  await page.waitForSelector('text=Домашнє завдання', {
    timeout: 10000,
  });
}

async function fillHomeworkEditor(page, sourceRow) {
  await setEditorField(page, 'Тема уроку', sourceRow.topic);
  await setEditorField(page, '№ уроку', sourceRow.lessonNumber);
  await setEditorField(page, 'Домашнє завдання', sourceRow.homework);

  await page.locator('button:has-text("Зберегти")').last().click();
  await page.waitForSelector('text=Домашнє завдання', {
    state: 'hidden',
    timeout: 10000,
  }).catch(() => {});
  await waitForLoadToSettle(page);
}

async function setEditorField(page, label, value) {
  if (!value) {
    return;
  }

  const updated = await page.evaluate(({ labelText, fieldValue }) => {
    const modal = findVisibleModal();
    const input = findInputByLabel(modal, labelText) || findInputByIndex(modal, labelText);

    if (!input) {
      return false;
    }

    setValue(input, fieldValue);
    return true;

    function findVisibleModal() {
      return Array.from(document.querySelectorAll('.modal.show, [role="dialog"], .modal-content'))
        .find((element) => isVisible(element)) || document;
    }

    function findInputByLabel(root, labelValue) {
      const normalizedLabel = normalize(labelValue).toLowerCase();
      const labelElement = Array.from(root.querySelectorAll('label, p, span, div'))
        .filter((element) => {
          const text = normalize(element.textContent || '');
          return text.length <= 80 && text.toLowerCase().includes(normalizedLabel);
        })
        .sort((a, b) => normalize(a.textContent || '').length - normalize(b.textContent || '').length)[0];

      if (!labelElement) {
        return null;
      }

      for (const container of getContainers(labelElement)) {
        const input = findEditable(container);

        if (input) {
          return input;
        }
      }

      return null;
    }

    function findInputByIndex(root, labelValue) {
      const fields = Array.from(root.querySelectorAll('input:not([type="hidden"]), textarea, [contenteditable="true"]'))
        .filter((element) => !element.disabled && isVisible(element));
      const normalizedLabel = normalize(labelValue).toLowerCase();

      if (normalizedLabel.includes('тема')) {
        return fields[0] || null;
      }

      if (normalizedLabel.includes('уроку')) {
        return fields[1] || null;
      }

      if (normalizedLabel.includes('домашн')) {
        return fields[2] || null;
      }

      return null;
    }

    function getContainers(element) {
      const containers = [];
      let current = element;

      for (let depth = 0; current && depth < 5; depth += 1) {
        containers.push(current);
        current = current.parentElement;
      }

      if (element.nextElementSibling) {
        containers.push(element.nextElementSibling);
      }

      return containers;
    }

    function findEditable(root) {
      return Array.from(root.querySelectorAll('input:not([type="hidden"]), textarea, [contenteditable="true"]'))
        .find((element) => !element.disabled && isVisible(element));
    }

    function setValue(element, fieldValue) {
      if (element.isContentEditable) {
        element.textContent = fieldValue;
      } else {
        element.value = fieldValue;
      }

      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    function isVisible(element) {
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();

      return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        box.width > 0 &&
        box.height > 0;
    }

    function normalize(text) {
      return text.replace(/\s+/g, ' ').trim();
    }
  }, { labelText: label, fieldValue: value });

  if (!updated) {
    throw new Error(`Не удалось заполнить поле "${label}"`);
  }
}

async function getNextPaginationNumber(page) {
  return page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('.pagination, nav, [class*="pagination"], [class*="pager"]'))
      .filter((element) => /\b\d+\b/.test(element.textContent || ''));
    const scope = containers[0] || document;
    const numbers = Array.from(scope.querySelectorAll('a, button, li'))
      .map((element) => Number((element.textContent || '').trim()))
      .filter((number) => Number.isInteger(number) && number > 0);

    if (numbers.length === 0) {
      return null;
    }

    const activeText = Array.from(scope.querySelectorAll('.active, [aria-current="page"]'))
      .map((element) => Number((element.textContent || '').trim()))
      .find((number) => Number.isInteger(number) && number > 0);
    const current = activeText || Math.min(...numbers);
    const next = [...new Set(numbers)].sort((a, b) => a - b).find((number) => number > current);

    return next || null;
  });
}

async function clickPaginationNumber(page, pageNumber) {
  const clicked = await page.evaluate((targetNumber) => {
    const containers = Array.from(document.querySelectorAll('.pagination, nav, [class*="pagination"], [class*="pager"]'))
      .filter((candidate) => /\b\d+\b/.test(candidate.textContent || ''));
    const scope = containers[0] || document;
    const element = Array.from(scope.querySelectorAll('a, button'))
      .find((candidate) => (candidate.textContent || '').trim() === String(targetNumber));

    if (!element) {
      return false;
    }

    element.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    }));

    return true;
  }, pageNumber);

  if (!clicked) {
    throw new Error(`Не удалось перейти на страницу ${pageNumber}`);
  }
}

module.exports = {
  transferGeography7Homework,
};
