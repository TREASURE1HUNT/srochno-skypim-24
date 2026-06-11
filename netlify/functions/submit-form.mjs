// Netlify function: отправка заявок в Telegram

const FIELD_LABELS = {
  mod: "Марка и модель",
  vip: "Год выпуска",
  kor: "Коробка передач",
  pro: "Пробег",
  sost: "Состояние",
  vl: "Количество владельцев",
  obr: "Обременения",
  mest: "Местоположение",
  tel: "Телефон",
  field_33e91bb: "Марка",
  field_4bc3582: "Модель",
  field_c744db9: "Год выпуска",
  email12133: "Телефон",
  field_f84371f: "Телефон",
  name: "Имя",
  form_type: "Тип формы",
};

async function sendTelegramMessage(token, chatId, message) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const data = await response.json();
  if (!data.ok) {
    console.error("Telegram API error:", data);
    throw new Error(data.description || "Telegram API error");
  }
  return data;
}

function parseBody(body, contentType) {
  if (!body) return {};

  if (contentType.includes("application/json")) {
    return JSON.parse(body);
  }

  const params = new URLSearchParams(body);
  const data = {};
  for (const [key, value] of params.entries()) {
    const match = key.match(/^form_fields\[(.+?)\]$/);
    data[match ? match[1] : key] = value;
  }
  return data;
}

function buildMessage(data) {
  const skip = new Set(["action", "nonce", "post_id", "form_id", "referer_title", "queried_id", "redirect", "remote_ip"]);
  let message = "<b>📩 Новая заявка — срочноскупим24</b>\n";
  message += "━━━━━━━━━━━━━━━━\n";

  for (const [key, value] of Object.entries(data)) {
    if (skip.has(key) || !value || !String(value).trim()) continue;
    const label = FIELD_LABELS[key] || key;
    message += `<b>${label}:</b> ${String(value).trim()}\n`;
  }

  message += "━━━━━━━━━━━━━━━━\n";
  message += `⏱ ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`;

  return message;
}

export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // Приоритет: переменные окружения Netlify > значения по умолчанию
  // ⚠ ВАЖНО: для продакшена установите TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID
  // в настройках деплоя (Netlify Dashboard → Environment variables)
  const token = process.env.TELEGRAM_BOT_TOKEN || "8928279752:AAH3QZCm5dYLfi9GfH5h-L34GXa1wo2r6MA";
  const chatId = process.env.TELEGRAM_CHAT_ID || "1042967208";

  if (!token || !chatId) {
    console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env vars");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, message: "Сервер не настроен" }),
    };
  }

  try {
    const contentType = event.headers["content-type"] || event.headers["Content-Type"] || "";
    const formData = parseBody(event.body, contentType);
    const message = buildMessage(formData);

    await sendTelegramMessage(token, chatId, message);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "Спасибо! Ваша заявка принята. Ожидайте, с вами свяжется оператор.",
      }),
    };
  } catch (error) {
    console.error("Error processing form:", error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        message: "Не удалось отправить заявку. Позвоните нам: +7 913 514 11 22",
      }),
    };
  }
}
