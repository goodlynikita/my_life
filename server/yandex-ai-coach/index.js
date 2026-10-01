/* ============================================================
   YOU · AI-тренер — облачная функция Yandex Cloud (Node.js 18+)
   Приложение → эта функция → YandexGPT.
   • Проверяет, что запрос от залогиненного пользователя (Firebase)
   • Считает лимит: LIMIT сообщений в месяц на человека
   • Отвечает только про тренировки, питание и восстановление

   Переменные окружения функции:
     FIREBASE_API_KEY    — apiKey из js/config.js
     FIREBASE_DB_URL     — https://nik-track-default-rtdb.firebaseio.com
     FIREBASE_DB_SECRET  — секрет базы (Firebase → Настройки проекта → Сервисные аккаунты → Секреты базы данных)
     YANDEX_FOLDER_ID    — ID каталога Yandex Cloud
     LIMIT               — лимит сообщений в месяц (по умолчанию 20)
     MODEL               — yandexgpt-lite (дёшево) или yandexgpt (умнее)
   Функции нужен сервисный аккаунт с ролью ai.languageModels.user.
   ============================================================ */

/* отвечаем только своим сайтам: чужой клон не сможет звать функцию из браузера */
const ORIGINS = ['https://you-app.ru', 'https://www.you-app.ru', 'https://goodlynikita.github.io', 'http://you-app.ru.website.yandexcloud.net'];
let CORS = {};
const setCors = (origin) => { CORS = {
  'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
  'Vary': 'Origin',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
}; };
const reply = (code, obj) => ({ statusCode: code, headers: CORS, body: JSON.stringify(obj) });

const SYSTEM = `Ты персональный тренер в приложении YOU. Отвечай по-русски, дружелюбно и по делу, на «ты».
Опирайся на данные пользователя ниже: его тренировки, веса, частоту, связки мышц.
Давай конкретику: упражнения, подходы, повторы, веса в кг, сколько отдыхать.
Отвечай коротко: до 8 строк, списком если уместно. Без длинных вступлений.
Темы: тренировки, техника, прогрессия, восстановление, сон, питание для тренировок.
На другие темы вежливо откажись и верни разговор к тренировкам.
При острой боли, травме или проблемах со здоровьем советуй обратиться к врачу, не ставь диагнозы.
Не используй длинное тире «—».`;

async function j(url, opts) {
  const r = await fetch(url, opts);
  const t = await r.text();
  let d = null; try { d = JSON.parse(t); } catch (e) {}
  return { ok: r.ok, status: r.status, data: d, text: t };
}

module.exports.handler = async function (event, context) {
  const hd = event.headers || {};
  setCors(hd.Origin || hd.origin || '');
  const method = (event.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (method !== 'POST') return reply(405, { error: 'method' });

  const env = process.env;
  const LIMIT = parseInt(env.LIMIT || '20', 10);
  let body = {};
  try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : (event.body || '{}')); }
  catch (e) { return reply(400, { error: 'json' }); }

  /* 1. Кто пишет */
  if (!body.idToken) return reply(401, { error: 'auth' });
  const who = await j(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: body.idToken }),
  });
  const user = who.ok && who.data && who.data.users && who.data.users[0];
  if (!user) return reply(401, { error: 'auth' });
  const uid = user.localId;

  /* 2. Лимит на месяц */
  const month = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 7); /* по Москве */
  const db = env.FIREBASE_DB_URL.replace(/\/$/, '');
  const usageUrl = `${db}/aiUsage/${uid}/${month}.json?auth=${env.FIREBASE_DB_SECRET}`;
  const cur = await j(usageUrl);
  const used = (cur.data && cur.data.count) || 0;
  if (body.check) return reply(200, { used, limit: LIMIT });
  if (used >= LIMIT) return reply(429, { error: 'limit', used, limit: LIMIT });

  /* 3. Вопрос к YandexGPT */
  const ctx = String(body.context || '').slice(0, 6000);
  const hist = (Array.isArray(body.messages) ? body.messages : []).slice(-8)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.text)
    .map(m => ({ role: m.role, text: String(m.text).slice(0, 1500) }));
  if (!hist.length || hist[hist.length - 1].role !== 'user') return reply(400, { error: 'empty' });

  const iam = context && context.token && context.token.access_token;
  if (!iam) return reply(500, { error: 'no-service-account' });
  const model = env.MODEL || 'yandexgpt-lite';
  const gpt = await j('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iam}`, 'x-folder-id': env.YANDEX_FOLDER_ID },
    body: JSON.stringify({
      modelUri: `gpt://${env.YANDEX_FOLDER_ID}/${model}/latest`,
      completionOptions: { stream: false, temperature: 0.4, maxTokens: '700' },
      messages: [{ role: 'system', text: SYSTEM + '\n\nДАННЫЕ ПОЛЬЗОВАТЕЛЯ:\n' + ctx }, ...hist],
    }),
  });
  const text = gpt.ok && gpt.data && gpt.data.result && gpt.data.result.alternatives && gpt.data.result.alternatives[0]
    && gpt.data.result.alternatives[0].message && gpt.data.result.alternatives[0].message.text;
  if (!text) {
    const busy = gpt.status === 402 || /balance|billing|payment/i.test(gpt.text || '');
    return reply(busy ? 503 : 502, { error: busy ? 'billing' : 'gpt', detail: (gpt.text || '').slice(0, 300) });
  }

  /* 4. Засчитываем сообщение (только успешное) */
  await j(usageUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count: used + 1, last: Date.now(), email: user.email || '' }) });
  const statUrl = `${db}/aiStats/${month}.json?auth=${env.FIREBASE_DB_SECRET}`;
  const st = await j(statUrl);
  await j(statUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: ((st.data && st.data.messages) || 0) + 1, tokens: ((st.data && st.data.tokens) || 0) + (+(gpt.data.result.usage && gpt.data.result.usage.totalTokens) || 0) }) });

  return reply(200, { text: text.replace(/\s+—\s+/g, ', '), used: used + 1, limit: LIMIT });
};
