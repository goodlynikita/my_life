/* ============================================================
   SLIDES — редактор слайдов главного экрана
   Хранение: Store → home.slides[] — массив конфигов слайдов
   Каждый слайд: { id, type, label, blocks[], color, enabled }
   ============================================================ */

/* Что сегодня по тренировкам — ОДНА функция и для слайда «Фокус дня», и для плитки */
function todayWorkoutInfo(store) {
  const plans = ((store.training && store.training.plans) || []).filter(Boolean);
  const plan = plans.find(p => p.status === 'active') || plans.slice(-1)[0];
  const now = new Date();
  let parts = [], hasRest = false, hasAny = false;
  if (plan && plan.weeks) plan.weeks.forEach(w => ((w && w.days) || []).forEach(d => {
    if (!d || !d.date) return;
    const [dd, mm] = d.date.split('.').map(Number);
    if (dd !== now.getDate() || mm !== now.getMonth() + 1) return;
    (d.sessions || []).filter(Boolean).forEach(s => {
      hasAny = true;
      if (s.type === 'Отдых') { hasRest = true; return; }
      if (s.groups && s.groups.length) parts = parts.concat(s.groups);
      else if (s.type) parts.push(s.type);
    });
    if (!(d.sessions || []).length && (d.exercises || []).length) { hasAny = true; parts.push('Тренировка'); }
  }));
  parts = parts.filter((x, i) => parts.indexOf(x) === i);
  if (parts.length) return { text: parts.join(' + '), empty: false };
  if (hasRest) return { text: 'Отдых', empty: false };
  return { text: 'Не задано', empty: true };
}
window.todayWorkoutInfo = todayWorkoutInfo;

var Slides = (() => {

  /* ── Библиотека блоков ──
     Каждый блок знает как рендерить себя из данных Store      */
  const BLOCK_LIBRARY = [
    /* Тренировки */
    {
      id: 'workout_today', section: 'Тренировки',
      name: 'Тренировка сегодня',
      desc: 'Группы мышц / тип тренировки на сегодня',
      render: (store) => {
        const t = todayWorkoutInfo(store);
        return `<div class="hero-big-text${t.empty ? ' hero-dim' : ''}">${t.text}</div>`;
      },
    },
    {
      id: 'habits_today', section: 'Привычки',
      name: 'Привычки сегодня',
      desc: 'X/Y выполнено сегодня',
      render: (store) => {
        const now = new Date();
        const mm  = String(now.getMonth()+1).padStart(2,'0');
        const list  = (store.habits?.list||[]).filter(Boolean);
        const marks = (store.habits?.months||{})[`${now.getFullYear()}-${mm}`]||{};
        const done  = list.filter(h=>marks[h.id]?.[now.getDate()]==='done').length;
        return `<div class="hero-stat-num">${done}<span class="hero-stat-of">/${list.length}</span></div><div class="hero-stat-lbl">привычек</div>`;
      },
    },
    {
      id: 'habit_streak_best', section: 'Привычки',
      name: 'Лучший стрик',
      desc: 'Максимальная серия дней среди всех привычек',
      render: (store) => {
        const list   = (store.habits?.list||[]).filter(Boolean);
        const months = store.habits?.months||{};
        let best = 0, bestName = '—';
        list.forEach(h => {
          let streak = 0, max = 0;
          const now = new Date();
          for (let i=0;i<365;i++) {
            const d = new Date(now); d.setDate(d.getDate()-i);
            const dow = d.getDay(); // 0=вс,1=пн...6=сб
            const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            const mark = months[mk]?.[h.id]?.[d.getDate()];
            /* Проверяем активен ли день для привычки */
            let active = true;
            if (h.schedule === 'weekday' && (dow === 0 || dow === 6)) active = false;
            if (h.schedule === '3perweek') active = true; // любой день потенциально активен
            if (!active) continue; /* не рабочий день — пропускаем не ломая стрик */
            if (mark === 'done') {
              streak++;
              max = Math.max(max, streak);
            } else if (i === 0 && (!mark || mark === '')) {
              /* Сегодня ещё не отмечено — не ломаем */
            } else {
              break;
            }
          }
          if (max > best) { best = max; bestName = h.name; }
        });
        const c = best>=14?'#FF4500':best>=7?'#F59E0B':best>=3?'#FB923C':'#9D9A92';
        return `<div class="hero-stat-num" style="color:${c}"><i class="ti ti-flame-filled hero-flame"></i>${best}</div><div class="hero-stat-lbl">${bestName}</div>`;
      },
    },
    {
      id: 'finance_income', section: 'Финансы',
      name: 'Доход за месяц',
      desc: 'Сумма доходов текущего месяца',
      render: (store) => {
        const now = new Date();
        const yr = now.getFullYear(), mm = String(now.getMonth()+1).padStart(2,'0');
        const entries = store.finance?.years?.[yr]?.[mm]?.entries || [];
        const income  = entries.reduce((s,e)=>s+((e?.amount)||0),0);
        const fmt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ')+'₽';
        return `<div class="hero-big-text">${income>0?fmt(income):'Нет данных'}</div>`;
      },
    },
    {
      id: 'finance_cushion', section: 'Финансы',
      name: 'Финансовая подушка',
      desc: 'Доход минус фактические расходы месяца',
      render: (store) => {
        const now = new Date();
        const yr = now.getFullYear(), mm = String(now.getMonth()+1).padStart(2,'0');
        const entries = store.finance?.years?.[yr]?.[mm]?.entries || [];
        const income  = entries.reduce((s,e)=>s+((e?.amount)||0),0);
        const cats = store.finance?.balance?.categories || [];
        const spent = cats.reduce((s,c)=>s+(c?.spent||0), 0);
        /* Если нет фактических трат — берём плановые */
        const expenses = spent > 0 ? spent : cats.reduce((s,c)=>s+(c?.amt||0), 0);
        const cushion = income - expenses;
        const fmt = n => Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ')+'₽';
        const color = cushion>=0?'#4ADE80':'#F87171';
        return `<div class="hero-stat-num" style="color:${color}">${cushion<0?'−':''}${fmt(cushion)}</div><div class="hero-stat-lbl">${cushion>=0?'свободно':'не хватает'}</div>`;
      },
    },
    {
      id: 'goals_pct', section: 'Цели',
      name: 'Прогресс целей %',
      desc: 'Процент закрытых целей',
      render: (store, cfg, slideColor) => {
        const goals = ((store.goals?.directions)||[]).filter(Boolean);
        const done  = goals.filter(g=>g.done).length;
        const pct   = goals.length ? Math.round(done/goals.length*100) : 0;
        const color = slideColor || '#A78BFA';
        return `<div class="hero-big-text">${pct}%</div><div class="hero-goals-bar"><div class="hero-goals-fill" style="width:${pct}%;background:${color};"></div></div>`;
      },
    },
    {
      id: 'goals_season_left', section: 'Цели',
      name: 'Осталось по сезону ₽',
      desc: 'Сумма незакрытых целей текущего сезона',
      render: (store) => {
        const now = new Date(); const m = now.getMonth();
        const season = m<=1||m===11 ? 'winter' : m<=4?'spring':m<=7?'summer':'autumn';
        const goals  = ((store.goals?.directions)||[]).filter(Boolean);
        const left   = goals.filter(g=>g.season===season&&!g.done&&!g.maybe).reduce((s,g)=>s+(g.amount||0),0);
        const fmt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ')+'₽';
        const names  = {spring:'Весна',summer:'Лето',autumn:'Осень',winter:'Зима'};
        return `<div class="hero-stat-num">${fmt(left)}</div><div class="hero-stat-lbl">цели ${names[season]}</div>`;
      },
    },
    {
      id: 'date_today', section: 'Общее',
      name: 'Дата',
      desc: 'Текущая дата',
      render: () => {
        const now = new Date();
        const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
        const DOWS = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
        return `<div class="hero-stat-num">${now.getDate()}</div><div class="hero-stat-lbl">${MONTHS[now.getMonth()]}</div>`;
      },
    },
    {
      id: 'custom_text', section: 'Кастом',
      name: 'Свой текст',
      desc: 'Любой заголовок и подпись, вводишь сам',
      render: (store, cfg) => `<div class="hero-big-text">${cfg?.text||'Твой текст'}</div>${cfg?.sub?`<div class="hero-sub-text">${cfg.sub}</div>`:''}`,
    },
    {
      id: 'custom_goal', section: 'Кастом',
      name: 'Конкретная цель',
      desc: 'Одна выбранная цель: статус и сумма',
      render: (store, cfg) => {
        const goals = ((store.goals?.directions)||[]).filter(Boolean);
        const g = goals.find(x=>x.id===cfg?.goalId) || goals[0];
        if (!g) return `<div class="hero-big-text">—</div>`;
        const fmt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ')+'₽';
        const num = g.done ? '✓ ' + (g.amount ? fmt(g.amount) : 'готово') : (g.amount ? fmt(g.amount) : '—');
        return `<div class="hero-stat-num"${g.done?' style="opacity:.55"':''}>${num}</div><div class="hero-stat-lbl">${g.name}</div>`;
      },
    },
    /* ── Тренировки: доп блоки ── */
    {
      id: 'workout_week_count', section: 'Тренировки',
      name: 'Тренировок на этой неделе',
      desc: 'Количество завершённых тренировок за текущую неделю',
      render: (store) => {
        const plans = (store.training?.plans||[]).filter(Boolean);
        const plan = plans.find(p=>p.status==='active') || plans.slice(-1)[0];
        const now = new Date(); const dow = now.getDay();
        const weekStart = new Date(now); weekStart.setDate(now.getDate() - (dow===0?6:dow-1));
        let count = 0;
        if (plan?.weeks) plan.weeks.forEach(w=>(w?.days||[]).forEach(d=>{
          if (!d?.date) return;
          const [dd,mm] = d.date.split('.');
          const date = new Date(now.getFullYear(), +mm-1, +dd);
          if (date >= weekStart && date <= now && (d.sessions||[]).some(s=>s&&s.type!=='Отдых')) count++;
        }));
        return `<div class="hero-stat-num">${count}</div><div class="hero-stat-lbl">тренировок</div>`;
      },
    },
    {
      id: 'workout_volume', section: 'Тренировки',
      name: 'Объём за неделю (кг)',
      desc: 'Суммарный тоннаж всех упражнений за текущую неделю',
      render: (store) => {
        const plans = (store.training?.plans||[]).filter(Boolean);
        const plan = plans.find(p=>p.status==='active') || plans.slice(-1)[0];
        const now = new Date(); const dow = now.getDay();
        const weekStart = new Date(now); weekStart.setDate(now.getDate() - (dow===0?6:dow-1));
        let vol = 0;
        if (plan?.weeks) plan.weeks.forEach(w=>(w?.days||[]).forEach(d=>{
          if (!d?.date) return;
          const [dd,mm] = d.date.split('.');
          const date = new Date(now.getFullYear(), +mm-1, +dd);
          if (date >= weekStart && date <= now)
            (d.sessions||[]).forEach(s=>(s?.exercises||[]).forEach(e=>{ vol += (e.sets||0)*(e.reps||0)*(e.weight||0); }));
        }));
        const fmt = n => n>=1000 ? (n/1000).toFixed(1)+'т' : Math.round(n)+'кг';
        return `<div class="hero-big-text">${vol>0?fmt(vol):'—'}</div>`;
      },
    },
    /* ── Привычки: доп блоки ── */
    {
      id: 'habits_month_pct', section: 'Привычки',
      name: 'Прогресс месяца %',
      desc: 'Средний процент выполнения привычек за текущий месяц',
      render: (store) => {
        const now = new Date();
        const mm  = String(now.getMonth()+1).padStart(2,'0');
        const list  = (store.habits?.list||[]).filter(Boolean);
        const marks = (store.habits?.months||{})[`${now.getFullYear()}-${mm}`]||{};
        let total = 0, done = 0;
        list.forEach(h=>{
          for(let d=1;d<=now.getDate();d++){
            const m = marks[h.id]?.[d];
            if (m==='done') { done++; total++; }
            else if (m==='missed') total++;
          }
        });
        const pct = total ? Math.round(done/total*100) : 0;
        const c = pct>=80?'#4ADE80':pct>=50?'#F59E0B':'#F87171';
        return `<div class="hero-stat-num" style="color:${c}">${pct}%</div><div class="hero-stat-lbl">привычек в месяц</div>`;
      },
    },
    {
      id: 'discipline_streak', section: 'Привычки',
      name: 'Стрик дисциплины',
      desc: 'Число дней подряд с хотя бы одной выполненной привычкой',
      render: (store) => {
        const list = (store.habits?.list||[]).filter(Boolean);
        const months = store.habits?.months||{};
        const now = new Date(); let streak = 0;
        for(let i=0;i<365;i++){
          const d = new Date(now); d.setDate(d.getDate()-i);
          const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          const hasDone = list.some(h=>months[mk]?.[h.id]?.[d.getDate()]==='done');
          if (hasDone) streak++; else if (i>0) break;
        }
        const c = streak>=14?'#FF4500':streak>=7?'#F59E0B':streak>=3?'#4ADE80':'#9D9A92';
        return `<div class="hero-stat-num" style="color:${c}"><i class="ti ti-flame-filled hero-flame"></i>${streak}</div><div class="hero-stat-lbl">дней подряд</div>`;
      },
    },
    /* ── Финансы: доп блоки ── */
    {
      id: 'finance_expenses', section: 'Финансы',
      name: 'Расходы за месяц',
      desc: 'Сумма фактических расходов текущего месяца',
      render: (store) => {
        const now = new Date();
        const yr = now.getFullYear(), mm = String(now.getMonth()+1).padStart(2,'0');
        const data = store.finance?.years?.[yr]?.[mm];
        const expenses = (data?.cats||[]).reduce((s,c)=>s+(c?.spent||0),0);
        const fmt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ')+'₽';
        return `<div class="hero-big-text">${expenses>0?fmt(expenses):'—'}</div>`;
      },
    },
    {
      id: 'finance_balance', section: 'Финансы',
      name: 'Баланс: доход − расходы',
      desc: 'Итоговый баланс месяца (доход минус расходы)',
      render: (store) => {
        const now = new Date();
        const yr = now.getFullYear(), mm = String(now.getMonth()+1).padStart(2,'0');
        const entries = store.finance?.years?.[yr]?.[mm]?.entries || [];
        const income = entries.reduce((s,e)=>s+((e?.amount)||0),0);
        const cats = store.finance?.years?.[yr]?.[mm]?.cats || [];
        const expenses = cats.reduce((s,c)=>s+(c?.spent||0),0);
        const bal = income - expenses;
        const fmt = n => Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ')+'₽';
        const c = bal>=0?'#4ADE80':'#F87171';
        return `<div class="hero-stat-num" style="color:${c}">${bal<0?'−':''}${fmt(bal)}</div><div class="hero-stat-lbl">баланс</div>`;
      },
    },
    {
      id: 'finance_savings_pct', section: 'Финансы',
      name: 'Процент накоплений',
      desc: 'Доля сохранённых денег от дохода (доход − расходы)',
      render: (store) => {
        const now = new Date();
        const yr = now.getFullYear(), mm = String(now.getMonth()+1).padStart(2,'0');
        const entries = store.finance?.years?.[yr]?.[mm]?.entries || [];
        const income = entries.reduce((s,e)=>s+((e?.amount)||0),0);
        const cats = store.finance?.balance?.categories || [];
        const spent = cats.reduce((s,c)=>s+(c?.spent||0), 0);
        const expenses = spent > 0 ? spent : cats.reduce((s,c)=>s+(c?.amt||0), 0);
        const saved = Math.max(0, income - expenses);
        const pct = income > 0 ? Math.round(saved / income * 100) : 0;
        const c = pct>=30?'#4ADE80':pct>=15?'#F59E0B':'#F87171';
        return `<div class="hero-stat-num" style="color:${c}">${pct}%</div><div class="hero-stat-lbl">накоплений</div>`;
      },
    },
    /* ── Цели: доп блоки ── */
    {
      id: 'goals_done_count', section: 'Цели',
      name: 'Закрытых целей',
      desc: 'Число выполненных целей всего',
      render: (store) => {
        const goals = ((store.goals?.directions)||[]).filter(Boolean);
        const done = goals.filter(g=>g.done).length;
        return `<div class="hero-stat-num">${done}<span class="hero-stat-of">/${goals.length}</span></div><div class="hero-stat-lbl">целей</div>`;
      },
    },
    {
      id: 'goals_season_pct', section: 'Цели',
      name: 'Прогресс сезона %',
      desc: 'Процент закрытых целей текущего сезона',
      render: (store) => {
        const now = new Date(); const m = now.getMonth();
        const season = m<=4?'spring':m<=7?'summer':m<=10?'autumn':'december';
        const goals = ((store.goals?.directions)||[]).filter(g=>g&&g.season===season);
        const done = goals.filter(g=>g.done).length;
        const pct = goals.length ? Math.round(done/goals.length*100) : 0;
        const names = {spring:'Весна',summer:'Лето',autumn:'Осень',december:'Декабрь'};
        return `<div class="hero-stat-num">${pct}%</div><div class="hero-stat-lbl">${names[season]}</div>`;
      },
    },
    /* ── Общее: доп блоки ── */
    {
      id: 'day_of_week', section: 'Общее',
      name: 'День недели',
      desc: 'Текущий день недели',
      render: () => {
        const DOWS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
        const MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
        const now = new Date();
        return `<div class="hero-sub-text" style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;opacity:.6;">${DOWS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}</div>`;
      },
    },
    {
      id: 'motivational_quote', section: 'Кастом',
      name: 'Мотивационная фраза',
      desc: 'Рандомная фраза из набора каждый день',
      render: (store, cfg) => {
        const quotes = cfg?.quotes ? cfg.quotes.split('\n').filter(Boolean) : [
          'Сегодня важнее вчера','Один шаг уже движение','Дисциплина сильнее мотивации',
          'Делай сейчас, отдохнёшь позже','Маленький прогресс всё равно прогресс',
        ];
        const idx = new Date().getDate() % quotes.length;
        return `<div class="hero-big-text" style="font-size:15px;line-height:1.4;">${quotes[idx]}</div>`;
      },
    },
  ];

  /* ── Дефолтные слайды (если юзер ещё ничего не настроил) ── */
  const DEFAULT_SLIDES = [
    {
      id: 's_focus', label: 'ФОКУС ДНЯ', cssClass: 'slide-focus', glowClass: 'slide-glow-blue',
      enabled: true, route: '/training',
      blocks: ['workout_today','habits_today'],
    },
    {
      id: 's_finance', label: 'ФИНАНСОВЫЙ ПУЛЬС', cssClass: 'slide-finance', glowClass: 'slide-glow-green',
      enabled: true, route: '/finance',
      blocks: ['finance_income','finance_cushion','finance_savings_pct'],
    },
    {
      id: 's_goals', label: 'ПРОГРЕСС ЦЕЛЕЙ', cssClass: 'slide-goals', glowClass: 'slide-glow-purple',
      enabled: true, route: '/goals',
      blocks: ['goals_pct','goals_season_left'],
    },
  ];

  /* ── Числа блоков для видов «полоска», «кольцо», «мини-график» ──
     v: значение, max: предел для полоски/кольца, text: как показать число, lbl: подпись, series: 7 значений за неделю */
  const _ym = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const _habDone = (store, d) => {
    const list = (store.habits?.list||[]).filter(Boolean);
    const marks = (store.habits?.months||{})[_ym(d)]||{};
    return { done: list.filter(h=>marks[h.id]?.[d.getDate()]==='done').length, total: list.length };
  };
  const _last7 = () => Array.from({length:7}, (_,i) => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-6+i); return d; });
  const _weekDays = () => { const now = new Date(); now.setHours(0,0,0,0); const dow = now.getDay(); const mon = new Date(now); mon.setDate(now.getDate()-(dow===0?6:dow-1)); return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d; }); };
  const _plan = (store) => { const plans=(store.training?.plans||[]).filter(Boolean); return plans.find(p=>p.status==='active') || plans.slice(-1)[0]; };
  const _planDay = (plan, d) => { let out = null; if (plan?.weeks) plan.weeks.forEach(w=>(w?.days||[]).forEach(x=>{ if (!x?.date) return; const [dd,mm]=x.date.split('.').map(Number); if (dd===d.getDate() && mm===d.getMonth()+1) out = x; })); return out; };
  const _ton = (day) => { let v = 0; (day?.sessions||[]).forEach(s=>(s?.exercises||[]).forEach(e=>{ v += (e?.sets||0)*(e?.reps||0)*(e?.weight||0); })); return v; };
  const _fmtT = (n) => n>=1000 ? (n/1000).toFixed(1).replace('.', ',')+' т' : Math.round(n)+' кг';
  const _rub = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' ₽';
  const _fin = (store) => { const now=new Date(); const yr=now.getFullYear(), mm=String(now.getMonth()+1).padStart(2,'0'); const m=store.finance?.years?.[yr]?.[mm]||{};
    const income=(m.entries||[]).reduce((s,e)=>s+((e?.amount)||0),0); const cats=store.finance?.balance?.categories||[]; const spent=cats.reduce((s,c)=>s+(c?.spent||0),0);
    const expenses = spent>0 ? spent : cats.reduce((s,c)=>s+(c?.amt||0),0); return { income, expenses }; };
  const BLOCK_DATA = {
    habits_today: (st) => { const t = _habDone(st, new Date()); return { v: t.done, max: t.total || 1, text: `${t.done}/${t.total}`, lbl: 'привычек сегодня', series: _last7().map(d=>_habDone(st,d).done) }; },
    habits_month_pct: (st) => { const now=new Date(); const list=(st.habits?.list||[]).filter(Boolean); const marks=(st.habits?.months||{})[_ym(now)]||{}; let tot=0,dn=0;
      list.forEach(h=>{ for(let d=1;d<=now.getDate();d++){ const m=marks[h.id]?.[d]; if(m==='done'){dn++;tot++;} else if(m==='missed') tot++; } });
      const pct = tot?Math.round(dn/tot*100):0; return { v: pct, max: 100, text: pct+'%', lbl: 'привычек за месяц', series: _last7().map(d=>{ const t=_habDone(st,d); return t.total?Math.round(t.done/t.total*100):0; }) }; },
    discipline_streak: (st) => { let s=0; for(let i=0;i<365;i++){ const d=new Date(); d.setDate(d.getDate()-i); if(_habDone(st,d).done>0) s++; else if(i>0) break; }
      return { v: s, max: 30, text: String(s), lbl: 'дней подряд', series: _last7().map(d=>_habDone(st,d).done) }; },
    workout_week_count: (st) => { const p=_plan(st); const today=new Date(); today.setHours(23,59,59,0); const days=_weekDays();
      const has=(d)=>{ const x=_planDay(p,d); return !!(x && (x.sessions||[]).some(s=>s&&s.type!=='Отдых')); };
      const done=days.filter(d=>d<=today&&has(d)).length, planned=days.filter(has).length;
      return { v: done, max: Math.max(planned, done, 1), text: planned ? `${done}/${planned}` : String(done), lbl: 'тренировок за неделю', series: days.map(d=>d<=today&&has(d)?1:0) }; },
    workout_volume: (st) => { const p=_plan(st); const today=new Date(); today.setHours(23,59,59,0); const ser=_weekDays().map(d=>d<=today?_ton(_planDay(p,d)):0); const v=ser.reduce((a,b)=>a+b,0);
      return { v, text: v>0?_fmtT(v):'—', lbl: 'тоннаж за неделю', series: ser }; },
    goals_pct: (st) => { const g=((st.goals?.directions)||[]).filter(Boolean); const pct=g.length?Math.round(g.filter(x=>x.done).length/g.length*100):0; return { v: pct, max: 100, text: pct+'%', lbl: 'целей закрыто' }; },
    goals_done_count: (st) => { const g=((st.goals?.directions)||[]).filter(Boolean); const d=g.filter(x=>x.done).length; return { v: d, max: g.length||1, text: `${d}/${g.length}`, lbl: 'целей' }; },
    goals_season_pct: (st) => { const m=new Date().getMonth(); const season=m<=4?'spring':m<=7?'summer':m<=10?'autumn':'december'; const g=((st.goals?.directions)||[]).filter(x=>x&&x.season===season); const pct=g.length?Math.round(g.filter(x=>x.done).length/g.length*100):0; return { v: pct, max: 100, text: pct+'%', lbl: 'целей сезона' }; },
    finance_savings_pct: (st) => { const f=_fin(st); const pct=f.income>0?Math.round(Math.max(0,f.income-f.expenses)/f.income*100):0; return { v: pct, max: 100, text: pct+'%', lbl: 'накоплений' }; },
    finance_expenses: (st) => { const f=_fin(st); return { v: f.expenses, max: f.income || null, text: f.expenses>0?_rub(f.expenses):'—', lbl: f.income ? 'потрачено от дохода' : 'расходы' }; },
  };
  const blockData = (bid, store) => { const f = BLOCK_DATA[bid]; if (!f) return null; try { return f(store); } catch (e) { return null; } };
  const viewsOf = (bid) => SlideKit.viewsFor(blockData(bid, Store.get()));
  const renderBlockView = (bid, view, store, cfg) => SlideKit.viewHtml(blockData(bid, store), view, SlideKit.accentOf(cfg));
  /* ── Готовые шаблоны слайдов ── */
  const TEMPLATES = [
    { id: 'day', name: 'Мой день', desc: 'тренировка, привычки, серия', slide: { label: 'МОЙ ДЕНЬ', icon: 'ti-sun', cssClass: 'slide-focus', glowClass: 'slide-glow-blue', route: '/habits', layout: 'auto', blocks: ['workout_today', 'habits_today', 'discipline_streak'], views: { habits_today: 'ring' } } },
    { id: 'gym', name: 'Неделя в зале', desc: 'тренировки и тоннаж по дням', slide: { label: 'НЕДЕЛЯ В ЗАЛЕ', icon: 'ti-barbell', cssClass: 'slide-indigo', glowColor: '#818CF8', route: '/training', layout: 'cols', blocks: ['workout_week_count', 'workout_volume'], views: { workout_week_count: 'ring', workout_volume: 'spark' } } },
    { id: 'money', name: 'Деньги месяца', desc: 'доход, расходы, накопления', slide: { label: 'ДЕНЬГИ МЕСЯЦА', icon: 'ti-wallet', cssClass: 'slide-finance', glowClass: 'slide-glow-green', route: '/finance', layout: 'list', blocks: ['finance_income', 'finance_expenses', 'finance_balance', 'finance_savings_pct'], views: {} } },
    { id: 'goals', name: 'Цели сезона', desc: 'прогресс и сколько осталось', slide: { label: 'ЦЕЛИ СЕЗОНА', icon: 'ti-target-arrow', cssClass: 'slide-goals', glowClass: 'slide-glow-purple', route: '/goals', layout: 'center', blocks: ['goals_season_pct', 'goals_season_left', 'goals_done_count'], views: { goals_season_pct: 'ring' } } },
    { id: 'mind', name: 'Настрой', desc: 'дата и фраза дня', slide: { label: 'НАСТРОЙ', icon: 'ti-bolt', cssClass: 'slide-amber', glowColor: '#F59E0B', layout: 'center', blocks: ['motivational_quote', 'day_of_week'], views: {} } },
    { id: 'empty', name: 'Пустой', desc: 'соберу сам', slide: { label: 'НОВЫЙ СЛАЙД', cssClass: 'slide-slate', glowColor: '#64748B', layout: 'auto', blocks: [], views: {} } },
  ];
  const escT = SlideKit.esc;

  function getSlides() {
    let saved = Store.get().home?.slides;
    if (saved && !Array.isArray(saved) && typeof saved === 'object') saved = Object.keys(saved).sort((a,b)=>a-b).map(k => saved[k]);
    if (saved && Array.isArray(saved) && saved.filter(Boolean).length) return saved.filter(Boolean).map(x => ({...x}));
    /* Ещё не настраивали — берём дефолт и учитываем старые флаги s0..s2 */
    const cfg = Store.get().home?.sliderCfg || {};
    return DEFAULT_SLIDES.map((x, i) => ({ ...x, enabled: cfg['s' + i] !== false }));
  }

  function saveSlides(slides) { Store.set('home.slides', slides); }

  /* ── Рендер одного слайда — структура как в оригинале ── */
  function renderSlide(cfg, store) {
    const _glowColorMap = {
      'slide-focus':'#60A5FA','slide-finance':'#4ADE80','slide-goals':'#C084FC',
      'slide-amber':'#F59E0B','slide-crimson':'#F87171','slide-pink':'#F472B6',
      'slide-teal':'#2DD4BF','slide-indigo':'#818CF8','slide-orange':'#FB923C',
      'slide-lime':'#A3E635','slide-slate':'#94A3B8','slide-red':'#EF4444',
      'slide-midnight':'#60A5FA','slide-jade':'#34D399'
    };
    const slideColor = cfg.glowColor || _glowColorMap[cfg.cssClass] || '#4A7CFF';

    const rendered = (cfg.blocks||[]).map(bid => {
      const def = BLOCK_LIBRARY.find(b=>b.id===bid);
      if (!def) return null;
      const blockCfg = cfg.blockCfgs?.[bid];
      const view = (cfg.views || {})[bid];
      try { return { bid, name: def.name, html: renderBlockView(bid, view, store, cfg) || def.render(store, blockCfg, slideColor) }; }
      catch(e) { return null; }
    }).filter(Boolean);

    const layout = cfg.layout || 'auto';
    const route = cfg.route ? ` data-route="${cfg.route}"` : '';
    /* Используем cssClass для оригинальных слайдов, иначе inline color */
    const slideClass = cfg.cssClass ? `hero-slide ${cfg.cssClass}` : 'hero-slide';
    const stylePart  = cfg.cssClass ? '' : ` style="background:${cfg.color||'#1A1C22'}"`;
    const glowClass  = cfg.glowClass || '';
    /* Для новых cssClass без glowClass — glow через inline color */
    const _gc = cfg.glowColor || _glowColorMap[cfg.cssClass] || '#4A7CFF';
    const glowStyle  = cfg.glowClass ? '' : ` style="background:radial-gradient(ellipse at 80% 50%,${_gc}44 0%,transparent 70%);"`;
    return `<div class="${slideClass} hsl-${layout}"${stylePart}${route}>
      <div class="slide-ray-1"></div>
      <div class="slide-ray-2"></div>
      ${SlideKit.headHtml(cfg)}
      ${SlideKit.bodyHtml(cfg, rendered)}
      <div class="hero-slide-glow ${glowClass}"${glowStyle}></div>
    </div>`;
  }

  /* ── Открыть редактор слайдов ── */
  function openEditor() {
    const slides  = getSlides();
    const store   = Store.get();
    const goals   = ((store.goals?.directions)||[]).filter(Boolean);

    const SLIDE_COLORS = [
      {name:'Синий',      cssClass:'slide-focus',   glowClass:'slide-glow-blue',
       bg:'linear-gradient(135deg,#080e1e 0%,#0c2654 40%,#1a3f8a 70%,#0d1f4a 100%)'},
      {name:'Зелёный',    cssClass:'slide-finance', glowClass:'slide-glow-green',
       bg:'linear-gradient(135deg,#010c05 0%,#092e14 40%,#14522c 70%,#071a0c 100%)'},
      {name:'Фиолетовый', cssClass:'slide-goals',   glowClass:'slide-glow-purple',
       bg:'linear-gradient(135deg,#09051a 0%,#1e0a4a 40%,#3d1580 70%,#1a0840 100%)'},
      {name:'Янтарный',   cssClass:'slide-amber',   val:'#1a0f00', glow:'#F59E0B',
       bg:'linear-gradient(135deg,#1a0f00 0%,#3d2200 40%,#5a3300 70%,#2a1500 100%)'},
      {name:'Красный',    cssClass:'slide-crimson',  val:'#1f0808', glow:'#F87171',
       bg:'linear-gradient(135deg,#1f0808 0%,#450a0a 40%,#6b1010 70%,#2d0606 100%)'},
      {name:'Розовый',    cssClass:'slide-pink',    val:'#1a0612', glow:'#F472B6',
       bg:'linear-gradient(135deg,#1a0612 0%,#3d0a2a 40%,#5c1040 70%,#2a0620 100%)'},
      {name:'Бирюза',     cssClass:'slide-teal',    val:'#001a1a', glow:'#2DD4BF',
       bg:'linear-gradient(135deg,#001a1a 0%,#003d3d 40%,#005c5c 70%,#002626 100%)'},
      {name:'Индиго',     cssClass:'slide-indigo',  val:'#080d24', glow:'#818CF8',
       bg:'linear-gradient(135deg,#080d24 0%,#151e50 40%,#1e2d6e 70%,#0d1540 100%)'},
      {name:'Оранжевый',  cssClass:'slide-orange',  val:'#1a0a00', glow:'#FB923C',
       bg:'linear-gradient(135deg,#1a0a00 0%,#3d1a00 40%,#5c2800 70%,#2a1000 100%)'},
      {name:'Лайм',       cssClass:'slide-lime',    val:'#0a1a00', glow:'#A3E635',
       bg:'linear-gradient(135deg,#0a1a00 0%,#1a3d00 40%,#285c00 70%,#102a00 100%)'},
      {name:'Сланец',     cssClass:'slide-slate',   val:'#0d1117', glow:'#64748B',
       bg:'linear-gradient(135deg,#0d1117 0%,#1c2230 40%,#243044 70%,#141d2a 100%)'},
      {name:'Алый',       cssClass:'slide-red',     val:'#1f0a0a', glow:'#EF4444',
       bg:'linear-gradient(135deg,#1f0a0a 0%,#4a0e0e 40%,#6b1414 70%,#2d0808 100%)'},
      {name:'Полночь',    cssClass:'slide-midnight', val:'#050810', glow:'#60A5FA',
       bg:'linear-gradient(135deg,#050810 0%,#0d1225 40%,#141c38 70%,#0a1020 100%)'},
      {name:'Нефрит',     cssClass:'slide-jade',    val:'#001a0d', glow:'#34D399',
       bg:'linear-gradient(135deg,#001a0d 0%,#00401f 40%,#005c2b 70%,#002a14 100%)'},
    ];

    const SECTION_ORDER = ['Тренировки','Привычки','Финансы','Цели','Общее','Кастом'];

    function slideBg(s) {
      const c = SLIDE_COLORS.find(x => (s.cssClass && x.cssClass === s.cssClass) || (!s.cssClass && s.color && x.val === s.color));
      return c ? c.bg : (s.color || '#1A1C22');
    }

    function slideCard(s, idx, total) {
      const blocks = (s.blocks||[]).map(bid => {
        const def = BLOCK_LIBRARY.find(b=>b.id===bid);
        return def ? `<span class="se-chip">${def.name}</span>` : '';
      }).join('');
      return `<div class="se-slide-card${s.enabled===false?' is-off':''}" data-idx="${idx}" style="background:${slideBg(s)};">
        <div class="se-card-top">
          <div class="se-move">
            <button class="se-up" data-idx="${idx}" ${idx===0?'disabled':''} aria-label="Выше"><i class="ti ti-chevron-up"></i></button>
            <button class="se-down" data-idx="${idx}" ${idx===total-1?'disabled':''} aria-label="Ниже"><i class="ti ti-chevron-down"></i></button>
          </div>
          <span class="se-card-title">${s.label||'Без названия'}</span>
          <button class="se-toggle-slide${s.enabled!==false?' on':''}" data-idx="${idx}">${s.enabled!==false?'Вкл':'Выкл'}</button>
          <button class="se-edit-slide" data-idx="${idx}" aria-label="Изменить"><i class="ti ti-edit"></i></button>
          ${total>1?`<button class="se-del-slide" data-idx="${idx}" aria-label="Удалить"><i class="ti ti-trash"></i></button>`:''}
        </div>
        <div class="se-chips">${blocks||'<span class="se-empty">Нет блоков, нажми «Изменить»</span>'}</div>
      </div>`;
    }

    /* ── Редактор одного слайда: живое превью сверху, всё меняется сразу ── */
    function openSlideForm(idx) {
      const sl = getSlides();
      const panel = ov.querySelector('#se-panel');
      panel.querySelector('.se-head-title').textContent = 'Слайд';
      panel.querySelector('#se-add').style.display = 'none';
      SlideKit.form(panel.querySelector('#se-body'), {
        draft: sl[idx] || {}, blocks: BLOCK_LIBRARY.map(b => ({ id: b.id, name: b.name, desc: b.desc, sec: b.section })), sections: SECTION_ORDER,
        colors: SLIDE_COLORS, routes: [['', 'Никуда'], ['/training', 'Тренировки'], ['/habits', 'Привычки'], ['/finance', 'Финансы'], ['/goals', 'Цели']],
        preview: (d) => renderSlide(d, Store.get()), views: viewsOf,
        cfgHtml: (bid, c) => {
          if (bid === 'custom_text') return `<div class="sf-cfg"><input type="text" class="sf-in" data-cfg="text" data-bid="${bid}" placeholder="Заголовок" value="${escT(c.text)}"><input type="text" class="sf-in" data-cfg="sub" data-bid="${bid}" placeholder="Подпись" value="${escT(c.sub)}"></div>`;
          if (bid === 'custom_goal') return `<div class="sf-cfg"><select class="sf-in" data-cfg="goalId" data-bid="${bid}">${goals.map(g => `<option value="${g.id}" ${g.id === c.goalId ? 'selected' : ''}>${escT(g.name)}</option>`).join('')}</select></div>`;
          if (bid === 'motivational_quote') return `<div class="sf-cfg"><textarea class="sf-in" data-cfg="quotes" data-bid="${bid}" rows="3" placeholder="Свои фразы, каждая с новой строки. Пусто: стандартные">${escT(c.quotes)}</textarea></div>`;
          return '';
        },
        onCancel: () => renderOv(),
        onSave: (d) => { const s2 = getSlides(); s2[idx] = d; saveSlides(s2); renderOv(); Router.render(); },
      });
    }
    /* ── Новый слайд: сначала шаблон, потом правка ── */
    function openTemplates() {
      const panel = ov.querySelector('#se-panel');
      panel.querySelector('.se-head-title').textContent = 'Новый слайд';
      panel.querySelector('#se-add').style.display = 'none';
      const st = Store.get();
      SlideKit.templates(panel.querySelector('#se-body'), { templates: TEMPLATES, preview: (sl) => renderSlide({ ...sl, id: 'tpl' }, st), onBack: () => renderOv(),
        onPick: (sl) => { const s2 = getSlides(); s2.push({ ...sl, id: 's_' + Date.now(), enabled: true }); saveSlides(s2); Router.render(); openSlideForm(s2.length - 1); } });
    }

    /* ── DOM ── центрированное окно, как остальные модалки */
    const ov = document.createElement('div');
    ov.className = 'tr-modal-overlay se-overlay';

    function renderOv() {
      const curSlides = getSlides();
      ov.innerHTML = `<div id="se-panel" class="se-panel">
        <div class="se-head">
          <span class="se-head-title">Слайды</span>
          <div style="display:flex;gap:8px;align-items:center;">
            <button id="se-add" class="se-add-btn">+ Новый</button>
            <button id="se-close" class="se-close-btn">×</button>
          </div>
        </div>
        <div id="se-body" class="se-body">
          <div class="se-hint">Стрелками меняй порядок на главном, «Вкл/Выкл» показывает или прячет слайд. Нажми на карандаш, чтобы настроить вид.</div>
          ${curSlides.map((s,i) => slideCard(s,i,curSlides.length)).join('')}
        </div>
      </div>`;

      /* Порядок */
      const move = (i, d) => {
        const sl = getSlides(); const j = i + d;
        if (j < 0 || j >= sl.length) return;
        const [x] = sl.splice(i, 1); sl.splice(j, 0, x);
        saveSlides(sl); renderOv(); Router.render();
      };
      ov.querySelectorAll('.se-up').forEach(b => b.addEventListener('click', () => move(parseInt(b.dataset.idx), -1)));
      ov.querySelectorAll('.se-down').forEach(b => b.addEventListener('click', () => move(parseInt(b.dataset.idx), 1)));

      ov.querySelector('#se-close').addEventListener('click', () => ov.remove());
      ov.addEventListener('click', e => { if(e.target===ov) ov.remove(); });

      /* Toggle enabled */
      ov.querySelectorAll('.se-toggle-slide').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = parseInt(btn.dataset.idx);
          const sl = getSlides();
          sl[i] = {...sl[i], enabled: sl[i].enabled === false};
          saveSlides(sl); renderOv(); Router.render();
        });
      });

      /* Delete */
      ov.querySelectorAll('.se-del-slide').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!confirm('Удалить слайд?')) return;
          const sl = getSlides(); sl.splice(parseInt(btn.dataset.idx),1);
          saveSlides(sl); renderOv(); Router.render();
        });
      });

      /* Edit */
      ov.querySelectorAll('.se-edit-slide').forEach(btn => btn.addEventListener('click', () => openSlideForm(parseInt(btn.dataset.idx))));

      /* Add new slide: шаблоны */
      ov.querySelector('#se-add')?.addEventListener('click', openTemplates);
    }

    document.body.appendChild(ov);
    renderOv();
  }

  return { getSlides, saveSlides, renderSlide, openEditor, BLOCK_LIBRARY, DEFAULT_SLIDES };
})();

window.Slides = Slides;
