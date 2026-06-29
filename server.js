/**
 * Telegram Bot Proxy Server
 * Принимает POST-запросы с данными формы и отправляет их в Telegram Bot API
 *
 * Запуск: node server.js
 * Сервер будет слушать на порту 3000 (или PORT из окружения)
 *
 * Для продакшена установите переменные окружения:
 *   TELEGRAM_BOT_TOKEN=8928279752:AAH3QZCm5dYLfi9GfH5h-L34GXa1wo2r6MA
 *   TELEGRAM_CHAT_ID=1042967208
 */

const http = require('http');
const https = require('https');

// --- Конфигурация ---
const PORT = process.env.PORT || 3000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8928279752:AAH3QZCm5dYLfi9GfH5h-L34GXa1wo2r6MA';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1042967208';
const TELEGRAM_API = 'api.telegram.org';

// --- CORS заголовки ---
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// --- Метки полей формы (как в Netlify функции) ---
const FIELD_LABELS = {
  mod: 'Марка и модель',
  vip: 'Год выпуска',
  kor: 'Коробка передач',
  pro: 'Пробег',
  sost: 'Состояние',
  vl: 'Количество владельцев',
  obr: 'Обременения',
  mest: 'Местоположение',
  tel: 'Телефон',
  field_33e91bb: 'Марка',
  field_4bc3582: 'Модель',
  field_c744db9: 'Год выпуска',
  email12133: 'Телефон',
  field_f84371f: 'Телефон',
  name: 'Имя',
  form_type: 'Тип формы',
};

/** Поля, которые нужно пропустить */
const SKIP_FIELDS = new Set([
  'action', 'nonce', 'post_id', 'form_id', 'referer_title',
  'queried_id', 'redirect', 'remote_ip',
]);

/** Форматирует сообщение для Telegram */
function buildMessage(data) {
  let message = '<b>📩 Новая заявка — срочноскупим24</b>\n';
  message += '━━━━━━━━━━━━━━━━\n';

  for (const [key, value] of Object.entries(data)) {
    if (SKIP_FIELDS.has(key) || !value || !String(value).trim()) continue;
    const label = FIELD_LABELS[key] || key;
    message += `<b>${label}:</b> ${String(value).trim()}\n`;
  }

  message += '━━━━━━━━━━━━━━━━\n';
  const now = new Date();
  message += `⏱ ${now.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

  return message;
}

/** Отправляет сообщение в Telegram Bot API */
function sendTelegramMessage(token, chatId, message) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

    const options = {
      hostname: TELEGRAM_API,
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.description || 'Telegram API error'));
          }
        } catch (err) {
          reject(new Error(`Invalid response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** Парсит тело запроса */
function parseBody(raw, contentType) {
  if (!raw) return {};

  if (contentType && contentType.includes('application/json')) {
    try { return JSON.parse(raw); } catch { return {}; }
  }

  // URL-encoded форма
  const params = new URLSearchParams(raw);
  const data = {};
  for (const [key, value] of params.entries()) {
    const match = key.match(/^form_fields\[(.+?)\]$/);
    data[match ? match[1] : key] = value;
  }
  return data;
}

/** Сериализует тело ответа */
function jsonResponse(code, data) {
  return {
    statusCode: code,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

// --- HTTP сервер ---
const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Разрешаем только POST на /
  if (req.method !== 'POST' || req.url !== '/') {
    const response = jsonResponse(405, { success: false, message: 'Method not allowed' });
    res.writeHead(response.statusCode, response.headers);
    res.end(response.body);
    return;
  }

  // Собираем тело запроса
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', async () => {
    try {
      const contentType = req.headers['content-type'] || '';
      const formData = parseBody(body, contentType);
      const message = buildMessage(formData);

      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, message);

      const response = jsonResponse(200, {
        success: true,
        message: 'Спасибо! Ваша заявка принята. Ожидайте, с вами свяжется оператор.',
        ok: true,
      });
      res.writeHead(response.statusCode, response.headers);
      res.end(response.body);

      console.log(`[OK] Form submitted at ${new Date().toISOString()}`);
    } catch (error) {
      console.error(`[ERROR] ${error.message}`);

      // Возвращаем 200, чтобы клиент не показывал сетевую ошибку
      const response = jsonResponse(200, {
        success: false,
        message: 'Не удалось отправить заявку. Позвоните нам: +7 913 514 11 22',
        ok: false,
      });
      res.writeHead(response.statusCode, response.headers);
      res.end(response.body);
    }
  });

  req.on('error', (err) => {
    console.error(`[ERROR] Request error: ${err.message}`);
    const response = jsonResponse(500, { success: false, message: 'Internal server error' });
    res.writeHead(response.statusCode, response.headers);
    res.end(response.body);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Telegram Bot Proxy Server running on http://localhost:${PORT}`);
  console.log(`📋 POST / - отправка заявки в Telegram`);
  console.log(`🤖 Bot: @skupkaauto24_bot`);
});
