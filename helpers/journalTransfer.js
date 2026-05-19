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
  await goToFirstHomeworkPage(page);
  const sourceRows = await collectHomeworkRows(page, config);

  if (sourceRows.length === 0) {
    throw new Error('Не удалось прочитать строки тем и домашних заданий из прошлого года.');
  }

  console.log(`Прочитано строк из источника: ${sourceRows.length}`);

  await openJournalForSemester(page, config, transferConfig.targetSemester, transferConfig);
  await goToFirstHomeworkPage(page);
  await fillHomeworkRows(page, config, sourceRows);

  console.log('Перенос тем и домашних заданий завершен');
}

async function clearGeography7Homework(page, config) {
  const transferConfig = config.geography7Transfer;

  console.log(
    `Старт очистки тем и домашних заданий: ${transferConfig.subject} ${transferConfig.grade} класс`
  );
  console.log(`Семестр: ${transferConfig.targetSemester}`);

  await openJournalForSemester(page, config, transferConfig.targetSemester, transferConfig);
  await goToFirstHomeworkPage(page);
  await clearHomeworkRows(page, config);

  console.log('Очистка тем и домашних заданий завершена');
}

async function openJournalForSemester(page, config, semesterText, transferConfig) {
  console.log(`Открываю журнал ${transferConfig.subject} ${transferConfig.grade}, семестр: ${semesterText}`);

  console.log('Открываю раздел "Журнали" перед выбором семестра');
  await page.goto(`${config.baseUrl}/journal/list`, { waitUntil: 'domcontentloaded' });
  await waitForLoadToSettle(page);
  await closeBlockingModals(page, config);

  await selectSemester(page, semesterText);
  await waitForLoadToSettle(page);
  await closeBlockingModals(page, config);

  await selectJournalFromList(page, config, transferConfig.subject, transferConfig.grade);
  await waitForLoadToSettle(page);
  await closeBlockingModals(page, config);
}

async function selectSemester(page, semesterText) {
  console.log(`Выбираю семестр: ${semesterText}`);

  const selectedSemester = await page.evaluate((needle) => {
    const normalize = (value) => value.replace(/\s+/g, ' ').trim();
    const normalizedNeedle = normalize(needle);
    const selects = [
      ...document.querySelectorAll('#personalselectform-semester_id'),
      ...document.querySelectorAll('select[name*="semester"], select[id*="semester"], select'),
    ];

    for (const select of [...new Set(selects)]) {
      const option = Array.from(select.options).find((item) =>
        normalize(item.textContent || '').includes(normalizedNeedle)
      );

      if (!option) {
        continue;
      }

      select.value = option.value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));

      return normalize(option.textContent || '');
    }

    return null;
  }, semesterText);

  if (selectedSemester) {
    console.log(`Выбран семестр: ${selectedSemester}`);
    await waitForLoadToSettle(page);
    await page.waitForTimeout(1000);
    return;
  }

  await page.locator('text=Семестр').first().click();
  await page.locator(`text=${semesterText}`).first().click();
  await waitForLoadToSettle(page);
  await page.waitForTimeout(1000);
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

    const nextPage = await getNextPaginationNumber(page, pageIndex);

    if (!nextPage) {
      break;
    }

    const previousSignature = await getHomeworkPageSignature(page);
    await clickPaginationNumber(page, nextPage, previousSignature);
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

    const nextPage = await getNextPaginationNumber(page, pageIndex);

    if (!nextPage) {
      console.log('Следующая страница не найдена, оставшиеся строки не заполнены');
      break;
    }

    const previousSignature = await getHomeworkPageSignature(page);
    await clickPaginationNumber(page, nextPage, previousSignature);
    await waitForLoadToSettle(page);
  }

  console.log(`Заполнено строк: ${sourceIndex}/${sourceRows.length}`);
}

async function clearHomeworkRows(page, config) {
  let clearedCount = 0;

  for (let pageIndex = 1; pageIndex <= 20; pageIndex += 1) {
    await waitForHomeworkTable(page, config);

    const pageRows = await extractHomeworkRowsFromCurrentPage(page);
    const rowCount = await getEditableRowsCount(page);
    console.log(`Страница очистки ${pageIndex}: доступно строк ${rowCount}`);

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const currentRow = pageRows[rowIndex] || {};

      if (!currentRow.topic && !currentRow.homework) {
        console.log(`Строка ${rowIndex + 1}: тема и домашнее уже пустые, пропускаю`);
        continue;
      }

      console.log(
        `Очищаю строку ${clearedCount + 1}: урок ${currentRow.lessonNumber || '-'}`
      );

      await openHomeworkEditor(page, rowIndex);
      await clearHomeworkEditor(page, currentRow);
      clearedCount += 1;
    }

    const nextPage = await getNextPaginationNumber(page, pageIndex);

    if (!nextPage) {
      break;
    }

    const previousSignature = await getHomeworkPageSignature(page);
    await clickPaginationNumber(page, nextPage, previousSignature);
    await waitForLoadToSettle(page);
  }

  console.log(`Очищено строк: ${clearedCount}`);
}

async function waitForHomeworkTable(page, config) {
  await page.waitForSelector('text=Теми уроків та домашні завдання', {
    timeout: config.defaultTimeout,
  });
  await page.waitForSelector('.homework-table, table', {
    timeout: config.defaultTimeout,
  });
}

async function extractHomeworkRowsFromCurrentPage(page) {
  return page.evaluate(() => {
    const homeworkGrid = findHomeworkGrid();

    if (!homeworkGrid) {
      return [];
    }

    if (homeworkGrid.kind === 'div') {
      return extractRowsFromDivGrid(homeworkGrid.element);
    }

    return extractRowsFromTable(homeworkGrid.element);

    function extractRowsFromDivGrid(grid) {
      const rows = Array.from(grid.querySelectorAll('.homework-row'))
        .filter((row) =>
          !row.classList.contains('homework-row--header') &&
          row.querySelectorAll('.homework__item, [class*="homework__item"]').length > 0
        );

      return rows.map((row) => {
        const cells = Array.from(row.querySelectorAll('.homework__item, [class*="homework__item"]'));

        return {
          homework: getCellText(cells[6]),
          lessonNumber: getCellText(cells[2]),
          topic: getCellText(cells[4]),
        };
      }).filter((row) => row.homework || row.lessonNumber || row.topic);
    }

    function extractRowsFromTable(table) {
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
    }

    function findHomeworkGrid() {
      const divGrid = Array.from(document.querySelectorAll('.homework-table, [class*="homework-table"]'))
        .find((candidate) => {
          const text = normalize(candidate.textContent || '').toLowerCase();
          return text.includes('тема уроку') && text.includes('домашнє завдання');
        });

      if (divGrid) {
        return { element: divGrid, kind: 'div' };
      }

      const table = Array.from(document.querySelectorAll('table')).find((candidate) => {
        const text = normalize(candidate.textContent || '').toLowerCase();
        return text.includes('тема уроку') && text.includes('домашнє завдання');
      });

      return table ? { element: table, kind: 'table' } : null;
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

async function getHomeworkPageSignature(page) {
  return page.evaluate(() => {
    const root = findHomeworkRoot();

    if (!root) {
      return '';
    }

    return normalize(root.textContent || '').slice(0, 500);

    function findHomeworkRoot() {
      return Array.from(document.querySelectorAll('.homework-table, [class*="homework-table"], table'))
        .find((candidate) => {
          const text = normalize(candidate.textContent || '').toLowerCase();
          return text.includes('тема уроку') && text.includes('домашнє завдання');
        });
    }

    function normalize(value) {
      return value.replace(/\s+/g, ' ').trim();
    }
  });
}

async function goToFirstHomeworkPage(page) {
  await waitForHomeworkTable(page, { defaultTimeout: 15000 });

  const currentPage = await getCurrentHomeworkPageNumber(page);

  if (currentPage === 1) {
    console.log('Homework-пагинация уже на первой странице');
    return;
  }

  if (!(await hasHomeworkPaginationNumber(page, 1))) {
    console.log('Кнопка первой страницы homework-пагинации не найдена, считаю страницу первой');
    return;
  }

  console.log(`Перехожу на первую страницу homework-пагинации (текущая: ${currentPage || 'неизвестно'})`);
  const previousSignature = await getHomeworkPageSignature(page);
  await clickPaginationNumber(page, 1, previousSignature);
  await waitForLoadToSettle(page);
}

async function hasHomeworkPaginationNumber(page, pageNumber) {
  return page.evaluate((targetPageNumber) => {
    const scope = findHomeworkPaginationScope();

    return Array.from(scope.querySelectorAll('a, button'))
      .some((element) => (element.textContent || '').trim() === String(targetPageNumber));

    function findHomeworkPaginationScope() {
      const homeworkRoot = Array.from(document.querySelectorAll('.homework-table, [class*="homework-table"], table'))
        .find((candidate) => {
          const text = (candidate.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          return text.includes('тема уроку') && text.includes('домашнє завдання');
        });
      const containers = Array.from(document.querySelectorAll('.pagination, nav, [class*="pagination"], [class*="pager"]'))
        .filter((element) => /\b\d+\b/.test(element.textContent || ''));

      if (!homeworkRoot || containers.length === 0) {
        return containers[0] || document;
      }

      const tableBox = homeworkRoot.getBoundingClientRect();
      const afterTable = containers
        .map((element) => ({
          distance: Math.abs(element.getBoundingClientRect().top - tableBox.bottom),
          element,
          top: element.getBoundingClientRect().top,
        }))
        .filter((item) => item.top >= tableBox.top - 20)
        .sort((a, b) => a.distance - b.distance);

      return (afterTable[0] && afterTable[0].element) || containers[containers.length - 1] || document;
    }
  }, pageNumber);
}

async function getCurrentHomeworkPageNumber(page) {
  return page.evaluate(() => {
    const scope = findHomeworkPaginationScope();
    const activeText = Array.from(scope.querySelectorAll('.active, [aria-current="page"]'))
      .map((element) => Number((element.textContent || '').trim()))
      .find((number) => Number.isInteger(number) && number > 0);

    if (activeText) {
      return activeText;
    }

    const selectedLink = Array.from(scope.querySelectorAll('a, button'))
      .find((element) => element.classList.contains('active') || element.getAttribute('aria-current') === 'page');

    if (selectedLink) {
      const number = Number((selectedLink.textContent || '').trim());
      return Number.isInteger(number) ? number : null;
    }

    return null;

    function findHomeworkPaginationScope() {
      const homeworkRoot = findHomeworkRoot();
      const containers = Array.from(document.querySelectorAll('.pagination, nav, [class*="pagination"], [class*="pager"]'))
        .filter((element) => /\b\d+\b/.test(element.textContent || '') && isVisible(element));

      if (!homeworkRoot || containers.length === 0) {
        return containers[0] || document;
      }

      const tableBox = homeworkRoot.getBoundingClientRect();
      const afterTable = containers
        .map((element) => ({
          distance: Math.abs(element.getBoundingClientRect().top - tableBox.bottom),
          element,
          top: element.getBoundingClientRect().top,
        }))
        .filter((item) => item.top >= tableBox.top - 20)
        .sort((a, b) => a.distance - b.distance);

      return (afterTable[0] && afterTable[0].element) || containers[containers.length - 1] || document;
    }

    function findHomeworkRoot() {
      return Array.from(document.querySelectorAll('.homework-table, [class*="homework-table"], table'))
        .find((candidate) => {
          const text = (candidate.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          return text.includes('тема уроку') && text.includes('домашнє завдання');
        });
    }

    function isVisible(element) {
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();

      return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        box.width > 0 &&
        box.height > 0;
    }
  });
}

async function getEditableRowsCount(page) {
  return page.evaluate(() => {
    return getHomeworkRows().length;

    function getHomeworkRows() {
      const divGrid = Array.from(document.querySelectorAll('.homework-table, [class*="homework-table"]'))
        .find((candidate) => {
          const text = normalize(candidate.textContent || '').toLowerCase();
          return text.includes('тема уроку') && text.includes('домашнє завдання');
        });

      if (divGrid) {
        return Array.from(divGrid.querySelectorAll('.homework-row'))
          .filter((row) =>
            !row.classList.contains('homework-row--header') &&
            row.querySelectorAll('.homework__item, [class*="homework__item"]').length > 0
          );
      }

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

    const firstCell = row.querySelector('.homework__item, [class*="homework__item"], td');
    const editElement = firstCell && (
      (firstCell.matches('.homework__item, [class*="homework__item"], .homework_item, [class*="homework"]') ? firstCell : null) ||
      firstCell.querySelector('.homework__item') ||
      firstCell.querySelector('[class*="homework__item"]') ||
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
      const divGrid = Array.from(document.querySelectorAll('.homework-table, [class*="homework-table"]'))
        .find((candidate) => {
          const text = normalize(candidate.textContent || '').toLowerCase();
          return text.includes('тема уроку') && text.includes('домашнє завдання');
        });

      if (divGrid) {
        return Array.from(divGrid.querySelectorAll('.homework-row'))
          .filter((tableRow) =>
            !tableRow.classList.contains('homework-row--header') &&
            tableRow.querySelectorAll('.homework__item, [class*="homework__item"]').length > 0
          );
      }

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
  await waitForHomeworkEditor(page);

  await setEditorField(page, 'Тема уроку', sourceRow.topic);
  await setEditorField(page, '№ уроку', sourceRow.lessonNumber);
  await setEditorField(page, 'Домашнє завдання', sourceRow.homework);

  await page.locator('button:has-text("Зберегти")').last().click();
  await waitForSaveResult(page, sourceRow);
  await waitForLoadToSettle(page);
}

async function clearHomeworkEditor(page, currentRow) {
  await waitForHomeworkEditor(page);

  await setEditorField(page, 'Тема уроку', '');
  await setEditorField(page, 'Домашнє завдання', '');

  await page.locator('button:has-text("Зберегти")').last().click();
  await waitForSaveResult(page, {
    homework: '',
    lessonNumber: currentRow.lessonNumber,
    topic: '',
  });
  await waitForLoadToSettle(page);
}

async function waitForHomeworkEditor(page) {
  await page.waitForSelector('.modal.show, [role="dialog"]', {
    timeout: 10000,
  }).catch(async () => {
    await page.waitForSelector('text=Домашнє завдання', {
      timeout: 10000,
    });
  });
}

async function waitForSaveResult(page, sourceRow) {
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    const state = await getEditorSaveState(page);

    if (!state.modalVisible) {
      console.log('Запись сохранена, модалка закрылась');
      return;
    }

    if (state.errors.length > 0 || state.invalidFields.length > 0) {
      throw buildSaveValidationError(state, sourceRow);
    }

    await page.waitForTimeout(500);
  }

  const state = await getEditorSaveState(page);

  if (state.errors.length > 0 || state.invalidFields.length > 0) {
    throw buildSaveValidationError(state, sourceRow);
  }

  throw new Error([
    'После нажатия "Зберегти" модалка не закрылась, но явных validation errors не найдено.',
    `Урок: ${sourceRow.lessonNumber || '-'}`,
    `Тема: ${sourceRow.topic || '-'}`,
    `Домашнее задание: ${sourceRow.homework || '-'}`,
    state.modalText ? `Текст модалки: ${state.modalText}` : undefined,
  ].filter(Boolean).join('\n'));
}

async function getEditorSaveState(page) {
  return page.evaluate(() => {
    const modal = findVisibleModal();

    if (!modal) {
      return {
        errors: [],
        invalidFields: [],
        modalText: '',
        modalVisible: false,
      };
    }

    return {
      errors: collectValidationErrors(modal),
      invalidFields: collectInvalidFields(modal),
      modalText: normalize(modal.textContent || '').slice(0, 700),
      modalVisible: true,
    };

    function collectValidationErrors(root) {
      const selectors = [
        '.help-block',
        '.help-block-error',
        '.invalid-feedback',
        '.invalid-tooltip',
        '.form-error',
        '.field-error',
        '.error-message',
        '.text-danger',
        '.alert-danger',
        '.has-error .help-block',
        '[data-error]',
        '[role="alert"]',
      ];
      const messages = [];

      for (const element of root.querySelectorAll(selectors.join(','))) {
        if (!isVisible(element)) {
          continue;
        }

        const text = normalize(element.textContent || element.getAttribute('data-error') || '');

        if (text && text.length <= 300) {
          messages.push(text);
        }
      }

      return unique(messages);
    }

    function collectInvalidFields(root) {
      const fields = Array.from(root.querySelectorAll(
        'input:not([type="hidden"]), textarea, select, [contenteditable="true"]'
      ));
      const invalidFields = [];

      for (const field of fields) {
        const hasInvalidState =
          field.matches('.is-invalid, .error, [aria-invalid="true"]') ||
          Boolean(field.closest('.has-error, .field-error, .form-group.has-error')) ||
          (typeof field.checkValidity === 'function' && !field.checkValidity());

        if (!hasInvalidState || !isVisible(field)) {
          continue;
        }

        invalidFields.push(getFieldName(field));
      }

      return unique(invalidFields);
    }

    function getFieldName(field) {
      const id = field.id;

      if (id) {
        const label = getLabelByFor(id);

        if (label) {
          return normalize(label.textContent || '');
        }
      }

      const row = field.closest('.form-group, .row, div');
      const labelText = row && Array.from(row.querySelectorAll('label, p, span'))
        .map((element) => normalize(element.textContent || ''))
        .find((text) => text && text.length <= 80);

      return labelText || field.getAttribute('name') || field.getAttribute('placeholder') || 'unknown field';
    }

    function getLabelByFor(id) {
      if (window.CSS && typeof window.CSS.escape === 'function') {
        return document.querySelector(`label[for="${window.CSS.escape(id)}"]`);
      }

      return Array.from(document.querySelectorAll('label[for]'))
        .find((label) => label.getAttribute('for') === id);
    }

    function findVisibleModal() {
      return Array.from(document.querySelectorAll('.modal.show, [role="dialog"], .modal-content'))
        .find((element) => isVisible(element));
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

    function unique(values) {
      return [...new Set(values.filter(Boolean))];
    }
  });
}

function buildSaveValidationError(state, sourceRow) {
  return new Error([
    'Сайт показал validation error после "Зберегти".',
    `Урок: ${sourceRow.lessonNumber || '-'}`,
    `Тема: ${sourceRow.topic || '-'}`,
    `Домашнее задание: ${sourceRow.homework || '-'}`,
    state.errors.length > 0 ? `Ошибки: ${state.errors.join(' | ')}` : undefined,
    state.invalidFields.length > 0 ? `Проблемные поля: ${state.invalidFields.join(' | ')}` : undefined,
    state.modalText ? `Текст модалки: ${state.modalText}` : undefined,
  ].filter(Boolean).join('\n'));
}

async function setEditorField(page, label, value) {
  if (value === undefined || value === null) {
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
        const prototype = element.tagName === 'TEXTAREA'
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

        if (descriptor && descriptor.set) {
          descriptor.set.call(element, fieldValue);
        } else {
          element.value = fieldValue;
        }
      }

      element.focus();
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

async function getNextPaginationNumber(page, currentPageFallback = 1) {
  return page.evaluate((fallbackCurrentPage) => {
    const scope = findHomeworkPaginationScope();
    const numbers = Array.from(scope.querySelectorAll('a, button, li'))
      .map((element) => Number((element.textContent || '').trim()))
      .filter((number) => Number.isInteger(number) && number > 0);

    if (numbers.length === 0) {
      return null;
    }

    const activeText = Array.from(scope.querySelectorAll('.active, [aria-current="page"]'))
      .map((element) => Number((element.textContent || '').trim()))
      .find((number) => Number.isInteger(number) && number > 0);
    const current = activeText || fallbackCurrentPage || Math.min(...numbers);
    const next = [...new Set(numbers)].sort((a, b) => a - b).find((number) => number > current);

    return next || null;

    function findHomeworkPaginationScope() {
      const homeworkRoot = findHomeworkRoot();
      const containers = Array.from(document.querySelectorAll('.pagination, nav, [class*="pagination"], [class*="pager"]'))
        .filter((element) => /\b\d+\b/.test(element.textContent || '') && isVisible(element));

      if (!homeworkRoot || containers.length === 0) {
        return containers[0] || document;
      }

      const tableBox = homeworkRoot.getBoundingClientRect();
      const afterTable = containers
        .map((element) => ({
          distance: Math.abs(element.getBoundingClientRect().top - tableBox.bottom),
          element,
          top: element.getBoundingClientRect().top,
        }))
        .filter((item) => item.top >= tableBox.top - 20)
        .sort((a, b) => a.distance - b.distance);

      return (afterTable[0] && afterTable[0].element) || containers[containers.length - 1] || document;
    }

    function findHomeworkRoot() {
      return findHomeworkDivGrid() || findHomeworkTable();
    }

    function findHomeworkDivGrid() {
      return Array.from(document.querySelectorAll('.homework-table, [class*="homework-table"]'))
        .find((candidate) => {
          const text = normalize(candidate.textContent || '').toLowerCase();
          return text.includes('тема уроку') && text.includes('домашнє завдання');
        });
    }

    function findHomeworkTable() {
      return Array.from(document.querySelectorAll('table'))
        .find((candidate) => {
          const text = normalize(candidate.textContent || '').toLowerCase();
          return text.includes('тема уроку') && text.includes('домашнє завдання');
        });
    }

    function isVisible(element) {
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();

      return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        box.width > 0 &&
        box.height > 0;
    }

    function normalize(value) {
      return value.replace(/\s+/g, ' ').trim();
    }
  }, currentPageFallback);
}

async function clickPaginationNumber(page, pageNumber, previousSignature = '') {
  const clicked = await page.evaluate((targetNumber) => {
    const scope = findHomeworkPaginationScope();
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

    function findHomeworkPaginationScope() {
      const homeworkRoot = findHomeworkRoot();
      const containers = Array.from(document.querySelectorAll('.pagination, nav, [class*="pagination"], [class*="pager"]'))
        .filter((elementCandidate) => /\b\d+\b/.test(elementCandidate.textContent || '') && isVisible(elementCandidate));

      if (!homeworkRoot || containers.length === 0) {
        return containers[0] || document;
      }

      const tableBox = homeworkRoot.getBoundingClientRect();
      const afterTable = containers
        .map((elementCandidate) => ({
          distance: Math.abs(elementCandidate.getBoundingClientRect().top - tableBox.bottom),
          element: elementCandidate,
          top: elementCandidate.getBoundingClientRect().top,
        }))
        .filter((item) => item.top >= tableBox.top - 20)
        .sort((a, b) => a.distance - b.distance);

      return (afterTable[0] && afterTable[0].element) || containers[containers.length - 1] || document;
    }

    function findHomeworkRoot() {
      return findHomeworkDivGrid() || findHomeworkTable();
    }

    function findHomeworkDivGrid() {
      return Array.from(document.querySelectorAll('.homework-table, [class*="homework-table"]'))
        .find((candidate) => {
          const text = normalize(candidate.textContent || '').toLowerCase();
          return text.includes('тема уроку') && text.includes('домашнє завдання');
        });
    }

    function findHomeworkTable() {
      return Array.from(document.querySelectorAll('table'))
        .find((candidate) => {
          const text = normalize(candidate.textContent || '').toLowerCase();
          return text.includes('тема уроку') && text.includes('домашнє завдання');
        });
    }

    function isVisible(elementCandidate) {
      const style = window.getComputedStyle(elementCandidate);
      const box = elementCandidate.getBoundingClientRect();

      return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        box.width > 0 &&
        box.height > 0;
    }

    function normalize(value) {
      return value.replace(/\s+/g, ' ').trim();
    }
  }, pageNumber);

  if (!clicked) {
    throw new Error(`Не удалось перейти на страницу ${pageNumber}`);
  }

  await page.waitForFunction(({ pageNumber: targetNumber, previousSignature: previousPageSignature }) => {
    const scope = findHomeworkPaginationScope();
    const activeText = Array.from(scope.querySelectorAll('.active, [aria-current="page"]'))
      .map((element) => (element.textContent || '').trim())
      .find((text) => text === String(targetNumber));

    const root = findHomeworkRoot();
    const signature = root ? (root.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500) : '';

    return Boolean(activeText) ||
      window.location.href.includes(`page=${targetNumber}`) ||
      (previousPageSignature && signature && signature !== previousPageSignature);

    function findHomeworkPaginationScope() {
      const homeworkRoot = findHomeworkRoot();
      const containers = Array.from(document.querySelectorAll('.pagination, nav, [class*="pagination"], [class*="pager"]'))
        .filter((element) => /\b\d+\b/.test(element.textContent || ''));

      if (!homeworkRoot || containers.length === 0) {
        return containers[0] || document;
      }

      const tableBox = homeworkRoot.getBoundingClientRect();
      const afterTable = containers
        .map((element) => ({
          distance: Math.abs(element.getBoundingClientRect().top - tableBox.bottom),
          element,
          top: element.getBoundingClientRect().top,
        }))
        .filter((item) => item.top >= tableBox.top - 20)
        .sort((a, b) => a.distance - b.distance);

      return (afterTable[0] && afterTable[0].element) || containers[containers.length - 1] || document;
    }

    function findHomeworkRoot() {
      return findHomeworkDivGrid() || findHomeworkTable();
    }

    function findHomeworkDivGrid() {
      return Array.from(document.querySelectorAll('.homework-table, [class*="homework-table"]'))
        .find((candidate) => {
          const text = (candidate.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          return text.includes('тема уроку') && text.includes('домашнє завдання');
        });
    }

    function findHomeworkTable() {
      return Array.from(document.querySelectorAll('table'))
        .find((candidate) => {
          const text = (candidate.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          return text.includes('тема уроку') && text.includes('домашнє завдання');
        });
    }
  }, {
    pageNumber,
    previousSignature,
  }, {
    timeout: 10000,
  }).catch(() => {});
}

module.exports = {
  clearGeography7Homework,
  transferGeography7Homework,
};
