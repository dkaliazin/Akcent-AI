const http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const config = require('./config');
const { loadLocalEnv } = require('./helpers/env');

loadLocalEnv();

const HOST = process.env.APP_HOST || '127.0.0.1';
const PORT = Number(process.env.APP_PORT || 3000);
const MAX_LOG_LINES = 1000;

const state = {
  child: null,
  exitCode: null,
  isRunning: false,
  logs: [],
  startedAt: null,
};

function addLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  const lines = String(message)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => `[${timestamp}] ${line}`);

  state.logs.push(...lines);

  if (state.logs.length > MAX_LOG_LINES) {
    state.logs.splice(0, state.logs.length - MAX_LOG_LINES);
  }
}

function runBot(scriptName, label) {
  if (state.isRunning) {
    return false;
  }

  state.exitCode = null;
  state.isRunning = true;
  state.logs = [];
  state.startedAt = new Date().toISOString();

  addLog(`Запускаю действие: ${label}`);

  const child = spawn(process.execPath, [scriptName], {
    cwd: __dirname,
    env: process.env,
    shell: false,
  });

  state.child = child;

  child.stdout.on('data', (chunk) => addLog(chunk));
  child.stderr.on('data', (chunk) => addLog(chunk));

  child.on('error', (error) => {
    addLog(`Ошибка запуска: ${error.message}`);
  });

  child.on('close', (code) => {
    state.exitCode = code;
    state.isRunning = false;
    state.child = null;
    addLog(code === 0 ? 'Действие завершено успешно' : `Действие завершилось с кодом ${code}`);
  });

  return true;
}

function runJournalsBot() {
  return runBot('main.js', 'Навчальні журнали');
}

function runGeography7Transfer() {
  return runBot('fill-geography7.js', 'Заповнити Географія 7');
}

function runGeography7Cleanup() {
  return runBot('clear-geography7.js', 'Почистити Теми уроків Географія 7');
}

async function stopBot() {
  let didSomething = false;

  if (state.child) {
    addLog('Останавливаю текущий запуск');
    state.child.kill();
    didSomething = true;
  }

  const browserClosed = await closeBrowser();

  return didSomething || browserClosed;
}

async function closeBrowser() {
  if (!config.cdpEndpoint) {
    addLog('CDP endpoint не настроен, закрыть браузер из панели нельзя');
    return false;
  }

  addLog(`Пробую закрыть Chrome через CDP: ${config.cdpEndpoint}`);

  try {
    const browser = await connectOverCdpForStop(config.cdpEndpoint);
    await browser.close();
    addLog('Chrome закрыт');
    return true;
  } catch (error) {
    addLog(`Не удалось закрыть Chrome через CDP: ${error.message}`);
    return false;
  }
}

async function connectOverCdpForStop(endpoint) {
  const endpoints = getCdpEndpointCandidates(endpoint);
  let lastError;

  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    for (const candidate of endpoints) {
      try {
        return await chromium.connectOverCDP(candidate, {
          timeout: 1000,
        });
      } catch (error) {
        lastError = error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw lastError || new Error(`CDP endpoint не доступен: ${endpoint}`);
}

function getCdpEndpointCandidates(endpoint) {
  const endpoints = [endpoint];

  try {
    const url = new URL(endpoint);

    if (url.hostname === 'localhost') {
      url.hostname = '127.0.0.1';
      endpoints.push(url.toString().replace(/\/$/, ''));
    }

    if (url.hostname === '127.0.0.1') {
      url.hostname = 'localhost';
      endpoints.push(url.toString().replace(/\/$/, ''));
    }
  } catch (error) {
    return endpoints;
  }

  return [...new Set(endpoints)];
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function sendHtml(response) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(getHtml());
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === 'GET' && url.pathname === '/') {
    sendHtml(response);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/status') {
    sendJson(response, 200, {
      canCloseBrowser: Boolean(config.cdpEndpoint),
      exitCode: state.exitCode,
      isRunning: state.isRunning,
      logs: state.logs,
      startedAt: state.startedAt,
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/run-journals') {
    const started = runJournalsBot();
    sendJson(response, started ? 202 : 409, {
      isRunning: state.isRunning,
      message: started ? 'Запуск начат' : 'Бот уже выполняется',
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/fill-geography7') {
    const started = runGeography7Transfer();
    sendJson(response, started ? 202 : 409, {
      isRunning: state.isRunning,
      message: started ? 'Запуск начат' : 'Бот уже выполняется',
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/clear-geography7') {
    const started = runGeography7Cleanup();
    sendJson(response, started ? 202 : 409, {
      isRunning: state.isRunning,
      message: started ? 'Запуск начат' : 'Бот уже выполняется',
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/stop') {
    const stopped = await stopBot();
    sendJson(response, stopped ? 202 : 409, {
      isRunning: state.isRunning,
      message: stopped ? 'Остановка/закрытие запрошены' : 'Нет активного запуска или доступного Chrome',
    });
    return;
  }

  sendJson(response, 404, { message: 'Not found' });
}

function getHtml() {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NZ bot</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Arial, sans-serif;
    }

    body {
      background: #111827;
      color: #f9fafb;
      margin: 0;
      padding: 32px;
    }

    .card {
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 12px;
      margin: 0 auto;
      max-width: 960px;
      padding: 24px;
    }

    h1 {
      margin-top: 0;
    }

    button {
      border: 0;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 700;
      margin-right: 12px;
      padding: 12px 18px;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    #runButton {
      background: #22c55e;
      color: #052e16;
    }

    #fillGeoButton {
      background: #f59e0b;
      color: #451a03;
    }

    #clearGeoButton {
      background: #8b5cf6;
      color: #f5f3ff;
    }

    #stopButton {
      background: #ef4444;
      color: #450a0a;
    }

    .status {
      color: #d1d5db;
      margin: 18px 0;
    }

    pre {
      background: #030712;
      border: 1px solid #374151;
      border-radius: 8px;
      color: #d1d5db;
      min-height: 360px;
      overflow: auto;
      padding: 16px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>NZ bot</h1>
    <p>Нажмите кнопку, чтобы открыть раздел "Навчальні журнали".</p>
    <button id="runButton" type="button">Навчальні журнали</button>
    <button id="fillGeoButton" type="button">Заповнити Географія 7</button>
    <button id="clearGeoButton" type="button">Почистити Теми уроків Географія 7</button>
    <button id="stopButton" type="button">Остановить / закрыть браузер</button>
    <div id="status" class="status">Статус: загрузка...</div>
    <pre id="logs"></pre>
  </main>
  <script>
    const runButton = document.getElementById('runButton');
    const fillGeoButton = document.getElementById('fillGeoButton');
    const clearGeoButton = document.getElementById('clearGeoButton');
    const stopButton = document.getElementById('stopButton');
    const statusElement = document.getElementById('status');
    const logsElement = document.getElementById('logs');

    async function postJson(url) {
      const response = await fetch(url, { method: 'POST' });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || 'Request failed');
      }

      return payload;
    }

    async function refreshStatus() {
      const response = await fetch('/api/status');
      const status = await response.json();

      runButton.disabled = status.isRunning;
      fillGeoButton.disabled = status.isRunning;
      clearGeoButton.disabled = status.isRunning;
      stopButton.disabled = !status.isRunning && !status.canCloseBrowser;
      statusElement.textContent = status.isRunning
        ? 'Статус: выполняется'
        : 'Статус: остановлен' + (status.exitCode === null ? '' : ' (код ' + status.exitCode + ')');
      logsElement.textContent = status.logs.join('\\n');
      logsElement.scrollTop = logsElement.scrollHeight;
    }

    runButton.addEventListener('click', async () => {
      try {
        await postJson('/api/run-journals');
        await refreshStatus();
      } catch (error) {
        alert(error.message);
      }
    });

    fillGeoButton.addEventListener('click', async () => {
      if (!confirm('Запустить тестовое заполнение Географія 7?')) {
        return;
      }

      try {
        await postJson('/api/fill-geography7');
        await refreshStatus();
      } catch (error) {
        alert(error.message);
      }
    });

    clearGeoButton.addEventListener('click', async () => {
      if (!confirm('Очистить темы уроков и домашние задания для Географія 7 текущего 2 семестра?')) {
        return;
      }

      try {
        await postJson('/api/clear-geography7');
        await refreshStatus();
      } catch (error) {
        alert(error.message);
      }
    });

    stopButton.addEventListener('click', async () => {
      try {
        await postJson('/api/stop');
        await refreshStatus();
      } catch (error) {
        alert(error.message);
      }
    });

    refreshStatus();
    setInterval(refreshStatus, 1000);
  </script>
</body>
</html>`;
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    addLog(`Ошибка панели: ${error.message}`);
    sendJson(response, 500, { message: error.message });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`NZ bot panel: http://${HOST}:${PORT}`);
});
