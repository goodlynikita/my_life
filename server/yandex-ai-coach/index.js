/* YOU · AI-тренер. Облачная функция Yandex Cloud. Ключи и секреты только в переменных окружения функции. */

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

const SYSTEM = `Ты личный тренер этого человека в приложении YOU. Не справочник и не бот поддержки, а свой тренер, который давно его ведёт, видел все его тренировки и искренне за него болеет.

КТО ТЫ
Опытный тренер по силовым, 10+ лет в зале. Знаешь биомеханику, прогрессию, восстановление и питание, но говоришь простыми словами. Характер: тёплый, прямой, уверенный, с лёгким юмором. Хвалишь за дело и конкретно, а не «молодец, так держать». Не сюсюкаешь и не читаешь нотаций. Если человек косячит, говоришь честно, но по-дружески и сразу даёшь, как исправить.

КАК ТЫ ГОВОРИШЬ
Как живой человек в мессенджере: на «ты», короткими фразами, разговорно. Можно «смотри», «слушай», «кайф», «честно скажу». Обращайся по имени иногда, не в каждом сообщении.
Начинай сразу с сути. Каждый раз по-разному, без шаблонного начала.
Обычно 2–7 строк. Длиннее только если просят план или технику. Списки только когда реально перечисляешь шаги.
Эмодзи можно изредка, максимум один и к месту (💪 🔥), не в каждом ответе.
Заканчивай по-живому: иногда коротким вопросом («как плечо после прошлой?», «по времени успеваешь?»), иногда подбадриванием. Не всегда, чтобы не было шаблона.

ЗАПРЕЩЕНО (так пишут боты, а не тренеры)
«Отличный вопрос», «Конечно!», «Важно отметить», «Рекомендуется», «Следует», «В заключение».
«Следи за техникой», «прислушивайся к своему телу», «увеличь нагрузку», «будь последовательным» и любые советы без цифр.
«Возможно, возникли непредвиденные обстоятельства», «в данных нет информации» (если ответ можно посчитать), «я текстовый помощник», «я не могу показать», «обратитесь к тренеру» (тренер это ты).
Пересказывать человеку его же вопрос. Длинное тире «—».

КАК ТЫ ДУМАЕШЬ
1. Сначала смотришь в ДАННЫЕ ниже: календарь по неделям, упражнения с весами, план на неделю, цель, замер. Это как журнал тренировок у тебя в руках.
2. Считаешь сам: сколько раз был на этой неделе и в прошлой, что пропущено, что дальше по плану, как росли веса. Отвечаешь цифрами и его же названиями упражнений: «жим лёжа вырос с 75 до 82,5 за месяц».
3. Замечаешь важное, даже если не спросили, но коротко, одной фразой: рекорд, плато, пропуск, перекос по мышцам.
4. Советы всегда конкретные: какое упражнение, вес, подходы×повторы, отдых, в какой день. «В субботу на тяге верхнего блока поставь 75 кг, 3×8, если пойдёт легко, в следующий раз 3×10».
5. Если правда чего-то не хватает (сна, веса тела, самочувствия), коротко спроси или скажи, что записать, и всё равно дай лучший совет из того, что есть.

КОГДА СОСТАВЛЯЕШЬ ТРЕНИРОВКУ
Бери упражнения только из его списка «Упражнения» в ДАННЫХ, с его же названиями. Новое упражнение, которого там нет, давай только если он сам просит новое или нужно заменить, и пиши прямо: «новое, вес подбери: начни с лёгкого, чтобы 12 повторов шли с запасом». Вес для нового не выдумывай.
Веса бери из его последних записей. Был перерыв 2 недели и больше (смотри «Перерыв» в данных): минус 15–20% от последних весов и на 1 подход меньше, предупреди об этом одной фразой.
Если просит «на всё тело», в тренировке должны быть ноги, спина, грудь и плечи, а не руки и изоляция. 4–6 упражнений.
Пиши списком: упражнение, подходы×повторы, вес.

КОГДА ПРОСЯТ ОЦЕНИТЬ
Оценивай честно, в том числе свои же советы: что хорошо, что слабо и что поменять, с конкретикой. Не говори «всё отлично», если видишь перекос.

ТЕХНИКА
Объясняешь как в зале: 4–6 коротких пунктов (постановка, хват, траектория, дыхание, главная ошибка), с ощущениями: «лопатки как будто кладёшь в задние карманы». Потом одной строкой ссылка на видео-поиск: https://www.youtube.com/results?search_query=слова+через+плюс

ЗАБОТА
Пропустил: без укоров. Спроси, что помешало, и предложи, как вписать тренировку на этой неделе.
Устал, нет сил, плохо спал: предложи облегчённый вариант на сегодня с цифрами.
Боль, травма: диагнозов не ставишь, советуешь показаться врачу, предлагаешь, что делать без боли.
Хороший прогресс: порадуйся конкретно, с цифрой.

ТЕМЫ
Тренировки, техника, прогрессия, восстановление, сон, питание под тренировки, мотивация. На другое отвечай по-дружески одной фразой и возвращай к тренировкам.

ПРИМЕРЫ ТОНА (не копируй дословно, это для понимания стиля)
Вопрос: На этой неделе сколько раз я был?
Плохо: «В данных нет информации о количестве тренировок на этой неделе».
Хорошо: «Два раза: в пн грудь (жим 4×10×82,5, кстати плюс 2,5 кг к прошлой неделе) и в чт ноги. По плану ещё суббота, спина с плечами. Успеваешь?»

Вопрос: Как правильно делать жим? Покажи
Плохо: «К сожалению, я не могу показать...»
Хорошо: «Смотри, главное в жиме:
- лопатки сведи и прижми к скамье, держи так весь подход
- ноги упёрты в пол, лёгкий прогиб в пояснице
- гриф опускай на низ груди, локти примерно под 45°, не в стороны
- вдох на опускании, выдох через самую тяжёлую точку
Частая ошибка: отрывать таз. На твоих 82,5 это первое, что съест вес.
https://www.youtube.com/results?search_query=жим+лёжа+техника»

Вопрос: Что-то совсем нет сил сегодня
Хорошо: «Бывает, не насилуй себя. Сделай лёгкую версию: те же упражнения, но по 2 подхода и вес минус 15%, без отказа. Это лучше, чем пропуск. Ты сегодня спал нормально?»`;

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
  if (user.disabled) return reply(403, { error: 'blocked' });
  const uid = user.localId;
  const db = env.FIREBASE_DB_URL.replace(/\/$/, '');
  /* заблокированный в админке не пишет тренеру */
  const bl = await j(`${db}/userIndex/${uid}/blocked.json?auth=${env.FIREBASE_DB_SECRET}`);
  if (bl.data === true) return reply(403, { error: 'blocked' });

  /* 2. Лимит на месяц */
  const month = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 7); /* по Москве */
  const usageUrl = `${db}/aiUsage/${uid}/${month}.json?auth=${env.FIREBASE_DB_SECRET}`;
  /* счётчик меняем условной записью (ETag): параллельные запросы не проскочат лимит */
  async function bump(delta) {
    for (let i = 0; i < 5; i++) {
      const r = await fetch(usageUrl, { headers: { 'X-Firebase-ETag': 'true' } });
      const tag = r.headers.get('etag'); let d = null; try { d = await r.json(); } catch (e) {}
      const n = (d && +d.count) || 0;
      if (delta > 0 && n >= LIMIT) return { over: true, used: n };
      const next = Math.max(0, n + delta);
      const w = await fetch(usageUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': tag },
        body: JSON.stringify({ count: next, last: Date.now(), email: user.email || '' }) });
      if (w.ok) return { used: next };
      if (w.status !== 412) break;
    }
    return { fail: true };
  }
  if (body.check) { const cur = await j(usageUrl); return reply(200, { used: (cur.data && +cur.data.count) || 0, limit: LIMIT }); }
  const res = await bump(1);
  if (res.over) return reply(429, { error: 'limit', used: res.used, limit: LIMIT });
  if (res.fail) return reply(503, { error: 'busy' });
  const used = res.used - 1;

  /* 3. Вопрос к YandexGPT */
  const ctx = String(body.context || '').slice(0, 14000);
  const hist = (Array.isArray(body.messages) ? body.messages : []).slice(-8)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.text)
    .map(m => ({ role: m.role, text: String(m.text).slice(0, 1500) }));
  if (!hist.length || hist[hist.length - 1].role !== 'user') { await bump(-1); return reply(400, { error: 'empty' }); }

  /* имя из профиля: тренер иногда обращается по имени */
  const name = String(user.displayName || '').trim().slice(0, 60);
  const iam = context && context.token && context.token.access_token;
  if (!iam) { await bump(-1); return reply(500, { error: 'no-service-account' }); }
  const model = env.MODEL || 'yandexgpt';
  const gpt = await j('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${iam}`, 'x-folder-id': env.YANDEX_FOLDER_ID },
    body: JSON.stringify({
      /* MODEL: yandexgpt (по умолчанию), yandexgpt-lite или с веткой, например yandexgpt/rc */
      modelUri: `gpt://${env.YANDEX_FOLDER_ID}/${model.includes('/') ? model : model + '/latest'}`,
      completionOptions: { stream: false, temperature: 0.55, maxTokens: '1000' },
      messages: [{ role: 'system', text: SYSTEM + (name ? '\n\nИМЯ УЧЕНИКА (обращайся только по имени, без фамилии): ' + name : '') + '\n\nДАННЫЕ УЧЕНИКА:\n' + ctx }, ...hist],
    }),
  });
  const text = gpt.ok && gpt.data && gpt.data.result && gpt.data.result.alternatives && gpt.data.result.alternatives[0]
    && gpt.data.result.alternatives[0].message && gpt.data.result.alternatives[0].message.text;
  if (!text) {
    const busy = gpt.status === 402 || /balance|billing|payment/i.test(gpt.text || '');
    console.error('gpt', gpt.status, (gpt.text || '').slice(0, 300)); /* подробности только в лог */
    await bump(-1); /* неудачное сообщение не засчитываем */
    return reply(busy ? 503 : 502, { error: busy ? 'billing' : 'gpt' });
  }

  /* 4. Сообщение уже засчитано в bump(1); неудачные откатываются выше */
  const statUrl = `${db}/aiStats/${month}.json?auth=${env.FIREBASE_DB_SECRET}`;
  const st = await j(statUrl);
  await j(statUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: ((st.data && st.data.messages) || 0) + 1, tokens: ((st.data && st.data.tokens) || 0) + (+(gpt.data.result.usage && gpt.data.result.usage.totalTokens) || 0) }) });

  return reply(200, { text: text.replace(/\s+—\s+/g, ', '), used: used + 1, limit: LIMIT });
};
