// Netlify function to handle form submissions and send to Telegram
// Supports both PAFE form builder and Elementor Pro forms

const TELEGRAM_BOT_TOKEN = "8928279752:AAH3QZCm5dYLfi9GfH5h-L34GXa1wo2r6MA";
const TELEGRAM_CHAT_ID = "@skupkaauto24_bot";

// Helper to send a message to Telegram
async function sendTelegramMessage(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const data = await response.json();
  if (!data.ok) {
    console.error("Telegram API error:", data);
    throw new Error(`Telegram API error: ${data.description}`);
  }
  return data;
}

// Extract form data from the request body
function extractFormData(body, headers) {
  const contentType = headers["content-type"] || "";
  
  if (contentType.includes("application/json")) {
    return JSON.parse(body);
  }
  
  // Handle URL-encoded form data (PAFE format)
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(body);
    const data = {};
    for (const [key, value] of params.entries()) {
      // Handle form_fields[key] format used by PAFE
      const match = key.match(/^form_fields\[(.+?)\]$/);
      if (match) {
        data[match[1]] = value;
      } else {
        data[key] = value;
      }
    }
    return data;
  }
  
  // Handle multipart form data
  if (contentType.includes("multipart/form-data")) {
    // For simplicity, parse what we can
    const data = {};
    const pairs = body.split("&");
    for (const pair of pairs) {
      const [key, val] = pair.split("=").map(decodeURIComponent);
      const match = key.match(/^form_fields\[(.+?)\]$/);
      if (match) {
        data[match[1]] = val;
      } else {
        data[key] = val;
      }
    }
    return data;
  }
  
  // Fallback: parse as URL params
  try {
    const params = new URLSearchParams(body);
    const data = {};
    for (const [key, value] of params.entries()) {
      const match = key.match(/^form_fields\[(.+?)\]$/);
      if (match) {
        data[match[1]] = value;
      } else {
        data[key] = value;
      }
    }
    return data;
  } catch {
    return { raw: body };
  }
}

// Build a formatted message from form data
function buildFormattedMessage(data) {
  // Determine form type and extract relevant fields
  const fields = {
    "Марка и модель": data.mod || data["form_fields[mod]"] || data.field_33e91bb || "",
    "Год выпуска": data.vip || data["form_fields[vip]"] || data.field_c744db9 || "",
    "Коробка передач": data.kor || data["form_fields[kor]"] || "",
    "Пробег": data.pro || data["form_fields[pro]"] || "",
    "Состояние": data.sost || data["form_fields[sost]"] || "",
    "Владельцев": data.vl || data["form_fields[vl]"] || "",
    "Обременения": data.obr || data["form_fields[obr]"] || "",
    "Местоположение": data.mest || data["form_fields[mest]"] || "",
    "Телефон": data.tel || data["form_fields[tel]"] || data.field_f84371f || data.email12133 || "",
    "Модель": data.field_4bc3582 || "",
    "Имя": data.field_33e91bb || data.name || "",
  };

  // Filter out empty fields
  const nonEmpty = Object.entries(fields).filter(([_, v]) => v && v.trim());

  // Build message
  let message = "<b>📩 Новая заявка с сайта срочноскупим24</b>\n";
  message += "━━━━━━━━━━━━━━━━\n";

  for (const [label, value] of nonEmpty) {
    message += `<b>${label}:</b> ${value}\n`;
  }

  message += "━━━━━━━━━━━━━━━━\n";
  message += `⏱ ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`;

  return message;
}

// Main handler
export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  // Only accept POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Parse form data
    const formData = extractFormData(event.body, event.headers);
    
    // Build formatted message
    const message = buildFormattedMessage(formData);
    
    // Send to Telegram
    await sendTelegramMessage(message);

    // Return success response (PAFE expects JSON)
    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        message: "Спасибо! Ваша заявка принята. Ожидайте, с вами свяжется оператор.",
      }),
    };
  } catch (error) {
    console.error("Error processing form:", error);

    return {
      statusCode: 200, // Return 200 so the form doesn't show an error to the user
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        message: "Спасибо! Ваша заявка принята.",
      }),
    };
  }
}
