const http = require('node:http');
const { spawn } = require('node:child_process');
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

function runJournalsBot() {
  if (state.isRunning) {
    return false;
  }

  state.exitCode = null;
  state.isRunning = true;
  state.logs = [];
  state.startedAt = new Date().toISOString();

  addLog('Запускаю действие: Навчальні журнали');

  const child = spawn(process.execPath, ['main.js'], {
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

function stopBot() {
  if (!state.child) {
    return false;
  }

  addLog('Останавливаю текущий запуск');
  state.child.kill();

  return true;
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

function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === 'GET' && url.pathname === '/') {
    sendHtml(response);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/status') {
    sendJson(response, 200, {
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

  if (request.method === 'POST' && url.pathname === '/api/stop') {
    const stopped = stopBot();
    sendJson(response, stopped ? 202 : 409, {
      isRunning: state.isRunning,
      message: stopped ? 'Остановка запрошена' : 'Нет активного запуска',
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
    <button id="stopButton" type="button">Остановить</button>
    <div id="status" class="status">Статус: загрузка...</div>
    <pre id="logs"></pre>
  </main>
  <script>
    const runButton = document.getElementById('runButton');
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
      stopButton.disabled = !status.isRunning;
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

const server = http.createServer(handleRequest);

server.listen(PORT, HOST, () => {
  console.log(`NZ bot panel: http://${HOST}:${PORT}`);
});
