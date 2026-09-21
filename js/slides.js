/* ============================================================
   SLIDES — редактор слайдов главного экрана
   Хранение: Store → home.slides[] — массив конфигов слайдов
   Каждый слайд: { id, type, label, blocks[], color, enabled }
   ============================================================ */

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
        const plans = (store.training?.plans||[]).filter(Boolean);
        const plan  = plans.find(p=>p.status==='active') || plans.slice(-1)[0];
        const now   = new Date();
        let groups  = [];
        if (plan?.weeks) plan.weeks.forEach(w=>(w?.days||[]).forEach(d=>{
          if (!d?.date) return;
          const [dd,mm] = d.date.split('.');
          if (+dd===now.getDate()&&+mm===(now.getMonth()+1))
            (d.sessions||[]).filter(s=>s&&s.type!=='Отдых').forEach(s=>{
              if (s.groups?.length) groups=groups.concat(s.groups); else if(s.type) groups.push(s.type);
            });
        }));
        const text = groups.join(' + ') || 'Отдых';
        return `<div class="hero-big-text">${text}</div>`;
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
        return `<div class="hero-stat-num" style="color:${c}">🔥${best}</div><div class="hero-stat-lbl">${bestName}</div>`;
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
        return `<div class="hero-stat-num" style="font-size:13px;">${fmt(left)}</div><div class="hero-stat-lbl">цели ${names[season]}</div>`;
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
      desc: 'Любой заголовок и подпись — ты вводишь сам',
      render: (store, cfg) => `<div class="hero-big-text">${cfg?.text||'Твой текст'}</div>${cfg?.sub?`<div class="hero-sub-text">${cfg.sub}</div>`:''}`,
    },
    {
      id: 'custom_goal', section: 'Кастом',
      name: 'Конкретная цель',
      desc: 'Показывает одну выбранную цель — статус и сумму',
      render: (store, cfg) => {
        const goals = ((store.goals?.directions)||[]).filter(Boolean);
        const g = goals.find(x=>x.id===cfg?.goalId) || goals[0];
        if (!g) return `<div class="hero-big-text">—</div>`;
        const fmt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ')+'₽';
        const nameColor = g.done ? 'rgba(255,255,255,0.45)' : '#F2F4F8';
        const nameStyle = g.done ? 'text-decoration:line-through;' : '';
        return `<div class="hero-stat-num" style="font-size:14px;line-height:1.3;color:${nameColor};${nameStyle}">${g.name}</div><div class="hero-stat-lbl">${g.amount?fmt(g.amount):''}</div>`;
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
        return `<div class="hero-stat-num" style="color:${c}">🔥${streak}</div><div class="hero-stat-lbl">дней подряд</div>`;
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
          'Сегодня важнее вчера','Один шаг — уже движение','Дисциплина сильнее мотивации',
          'Делай сейчас — отдохнёшь позже','Маленький прогресс — всё равно прогресс',
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

  function getSlides() {
    const saved = Store.get().home?.slides;
    if (saved && Array.isArray(saved) && saved.length) return saved;
    return DEFAULT_SLIDES;
  }

  function saveSlides(slides) { Store.set('home.slides', slides); }

  /* ── Рендер одного слайда — структура как в оригинале ── */
  function renderSlide(cfg, store) {
    const _glowColorMap = {
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
      try { return { html: def.render(store, blockCfg, slideColor) }; }
      catch(e) { return null; }
    }).filter(Boolean);

    /* Первый блок — главный (big text в центре), остальные — статы внизу */
    const mainHtml  = rendered[0] ? `<div class="hero-slide-main">${rendered[0].html}</div>` : '';
    const statsHtml = rendered.slice(1).map(b =>
      `<div class="sb-block">${b.html}</div>`
    ).join('<div class="hero-stat-sep"></div>');
    const subHtml = statsHtml
      ? `<div class="hero-slide-sub"><div class="hero-stat-row">${statsHtml}</div></div>`
      : '';

    const route = cfg.route ? ` data-route="${cfg.route}"` : '';
    /* Используем cssClass для оригинальных слайдов, иначе inline color */
    const slideClass = cfg.cssClass ? `hero-slide ${cfg.cssClass}` : 'hero-slide';
    const stylePart  = cfg.cssClass ? '' : ` style="background:${cfg.color||'#1A1C22'}"`;
    const glowClass  = cfg.glowClass || '';
    /* Для новых cssClass без glowClass — glow через inline color */
    const _gc = cfg.glowColor || _glowColorMap[cfg.cssClass] || '#4A7CFF';
    const glowStyle  = cfg.glowClass ? '' : ` style="background:radial-gradient(ellipse at 80% 50%,${_gc}44 0%,transparent 70%);"`;
    return `<div class="${slideClass}"${stylePart}${route}>
      <div class="slide-ray-1"></div>
      <div class="slide-ray-2"></div>
      <div class="hero-slide-label">${cfg.label||''}</div>
      ${mainHtml}
      ${subHtml}
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

    function slideCard(s, idx) {
      const blocks = (s.blocks||[]).map(bid => {
        const def = BLOCK_LIBRARY.find(b=>b.id===bid);
        return def ? `<span style="display:inline-block;background:#2A2D35;border-radius:6px;padding:3px 8px;font-size:10px;color:#9D9A92;margin:2px;">${def.name}</span>` : '';
      }).join('');
      return `<div class="se-slide-card" data-idx="${idx}" style="background:${s.color||'#1A1C22'};border:1px solid ${s.enabled?'#3A4060':'#2A2D35'};border-radius:14px;padding:14px;margin-bottom:10px;opacity:${s.enabled?1:0.45};transition:all .2s;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span style="flex:1;font-size:12px;font-weight:700;color:#E8E5DC;font-family:Montserrat,sans-serif;letter-spacing:.06em;">${s.label||'Без названия'}</span>
          <button class="se-toggle-slide" data-idx="${idx}" style="padding:4px 10px;border-radius:8px;border:1px solid ${s.enabled?'#4A7CFF':'#2A2D35'};background:${s.enabled?'rgba(74,124,255,.15)':'none'};color:${s.enabled?'#4A7CFF':'#555'};font-size:10px;font-weight:700;cursor:pointer;font-family:Montserrat,sans-serif;">${s.enabled?'Вкл':'Выкл'}</button>
          <button class="se-edit-slide" data-idx="${idx}" style="padding:4px 10px;border-radius:8px;border:1px solid #2A2D35;background:none;color:#9D9A92;font-size:10px;font-weight:600;cursor:pointer;font-family:Montserrat,sans-serif;">Изменить</button>
          ${idx>0?`<button class="se-del-slide" data-idx="${idx}" style="padding:4px 8px;border-radius:8px;border:1px solid #3A1A1A;background:none;color:#FF5C5C;font-size:10px;cursor:pointer;">✕</button>`:''}
        </div>
        <div>${blocks||'<span style="font-size:11px;color:#555;">Нет блоков — нажми Изменить</span>'}</div>
      </div>`;
    }

    function slideEditForm(s, idx) {
      const blocksBySection = {};
      BLOCK_LIBRARY.forEach(b => {
        if (!blocksBySection[b.section]) blocksBySection[b.section] = [];
        blocksBySection[b.section].push(b);
      });

      const blockCheckboxes = SECTION_ORDER.filter(sec => blocksBySection[sec]).map(sec =>
        `<div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#555;letter-spacing:.06em;margin:10px 0 4px;">${sec}</div>`
        + blocksBySection[sec].map(b => {
          const checked = (s.blocks||[]).includes(b.id);
          let extraHtml = '';
          if (b.id === 'custom_text') {
            const cfg = s.blockCfgs?.[b.id]||{};
            extraHtml = `<div style="margin:4px 0 0 22px;display:${checked?'block':'none'};" id="cfg-${b.id}">
              <input type="text" placeholder="Заголовок" value="${cfg.text||''}" id="cfg-${b.id}-text" style="width:100%;background:#1C1E24;border:1px solid #2A2D35;border-radius:6px;color:#E8E5DC;padding:6px 8px;font-size:12px;margin-bottom:4px;">
              <input type="text" placeholder="Подпись" value="${cfg.sub||''}" id="cfg-${b.id}-sub" style="width:100%;background:#1C1E24;border:1px solid #2A2D35;border-radius:6px;color:#E8E5DC;padding:6px 8px;font-size:12px;">
            </div>`;
          }
          if (b.id === 'custom_goal') {
            const cfg = s.blockCfgs?.[b.id]||{};
            const opts = goals.map(g=>`<option value="${g.id}" ${g.id===cfg.goalId?'selected':''}>${g.name}</option>`).join('');
            extraHtml = `<div style="margin:4px 0 0 22px;display:${checked?'block':'none'};" id="cfg-${b.id}">
              <select id="cfg-${b.id}-goalId" style="width:100%;background:#1C1E24;border:1px solid #2A2D35;border-radius:6px;color:#E8E5DC;padding:6px 8px;font-size:12px;">${opts}</select>
            </div>`;
          }
          return `<label style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;cursor:pointer;">
            <input type="checkbox" class="se-block-cb" data-bid="${b.id}" ${checked?'checked':''} style="width:auto;margin-top:2px;accent-color:#4A7CFF;">
            <div>
              <div style="font-size:13px;font-weight:600;color:#E8E5DC;">${b.name}</div>
              <div style="font-size:11px;color:#555;">${b.desc}</div>
            </div>
          </label>${extraHtml}`;
        }).join('')
      ).join('');

      const colorOpts = SLIDE_COLORS.map((c,i) => {
        const isActive = c.cssClass ? s.cssClass===c.cssClass : s.color===c.val;
        const swatchBg = c.bg || c.val || '#1A2040';
        return `<button class="se-color-btn" data-css-class="${c.cssClass||''}" data-glow-class="${c.glowClass||''}" data-color="${c.val||''}" data-glow="${c.glow||''}" data-bg="${encodeURIComponent(c.bg||c.val||'')}" style="width:36px;height:36px;border-radius:8px;background:${swatchBg};border:2px solid ${isActive?'rgba(255,255,255,0.9)':'transparent'};cursor:pointer;box-shadow:${isActive?'0 0 0 1px rgba(255,255,255,0.3)':''}" title="${c.name}"></button>`;
      }).join('');

      return `<div style="padding:0 20px 20px;box-sizing:border-box;width:100%;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#555;letter-spacing:.06em;margin-bottom:8px;">Название слайда</div>
        <input type="text" id="se-label" value="${s.label||''}" placeholder="ФОКУС ДНЯ" style="width:100%;box-sizing:border-box;background:#1C1E24;border:1px solid #2A2D35;border-radius:8px;color:#E8E5DC;padding:10px 12px;font-size:13px;font-weight:700;letter-spacing:.06em;margin-bottom:14px;">

        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#555;letter-spacing:.06em;margin-bottom:8px;">Цвет фона</div>
        <div style="display:grid;grid-template-columns:repeat(6,36px);gap:8px;margin-bottom:16px;">${colorOpts}</div>

        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#555;letter-spacing:.06em;margin-bottom:4px;">Ссылка при нажатии</div>
        <select id="se-route" style="width:100%;box-sizing:border-box;background:#1C1E24;border:1px solid #2A2D35;border-radius:8px;color:#E8E5DC;padding:10px 12px;font-size:13px;margin-bottom:16px;">
          <option value="">Никуда</option>
          <option value="/training" ${s.route==='/training'?'selected':''}>Тренировки</option>
          <option value="/habits"   ${s.route==='/habits'?'selected':''}>Привычки</option>
          <option value="/finance"  ${s.route==='/finance'?'selected':''}>Финансы</option>
          <option value="/goals"    ${s.route==='/goals'?'selected':''}>Цели</option>
        </select>

        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#555;letter-spacing:.06em;margin-bottom:4px;">Блоки данных</div>
        ${blockCheckboxes}

        <button id="se-save-slide" style="width:100%;box-sizing:border-box;margin-top:16px;margin-bottom:8px;padding:14px;background:#4A7CFF;border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:Montserrat,sans-serif;">Сохранить слайд</button>
      </div>`;
    }

    /* ── DOM ── */
    const ov = document.createElement('div');
    ov.className = 'tr-modal-overlay';
    ov.style.cssText = 'align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';

    function renderOv() {
      const curSlides = getSlides();
      ov.innerHTML = `<div id="se-panel" style="background:#13151A;border-radius:16px;width:100%;max-width:520px;margin:0 auto;max-height:85vh;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;">
        <div style="position:sticky;top:0;background:#13151A;padding:18px 20px 14px;border-bottom:1px solid #1E2028;border-radius:16px 16px 0 0;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:17px;font-weight:800;color:#E8E5DC;font-family:Montserrat,sans-serif;">Слайды</span>
          <div style="display:flex;gap:8px;">
            <button id="se-add" style="padding:6px 14px;border-radius:10px;border:1px solid #4A7CFF;background:rgba(74,124,255,.15);color:#4A7CFF;font-size:12px;font-weight:700;cursor:pointer;font-family:Montserrat,sans-serif;">+ Новый</button>
            <button id="se-close" style="background:#1E2028;border:none;border-radius:50%;width:30px;height:30px;color:#9D9A92;cursor:pointer;font-size:18px;">×</button>
          </div>
        </div>
        <div id="se-body" style="overflow-y:auto;flex:1;min-height:0;padding:16px 20px 40px;-webkit-overflow-scrolling:touch;box-sizing:border-box;width:100%;">
          <div style="font-size:11px;color:#555;margin-bottom:12px;font-family:Montserrat,sans-serif;">Нажми Изменить чтобы редактировать блоки слайда.</div>
          ${curSlides.map((s,i) => slideCard(s,i)).join('')}
        </div>
      </div>`;

      ov.querySelector('#se-close').addEventListener('click', () => ov.remove());
      ov.addEventListener('click', e => { if(e.target===ov) ov.remove(); });

      /* Toggle enabled */
      ov.querySelectorAll('.se-toggle-slide').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = parseInt(btn.dataset.idx);
          const sl = getSlides();
          sl[i] = {...sl[i], enabled: !sl[i].enabled};
          saveSlides(sl); renderOv(); Router.go('/home');
        });
      });

      /* Delete */
      ov.querySelectorAll('.se-del-slide').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!confirm('Удалить слайд?')) return;
          const sl = getSlides(); sl.splice(parseInt(btn.dataset.idx),1);
          saveSlides(sl); renderOv(); Router.go('/home');
        });
      });

      /* Edit */
      ov.querySelectorAll('.se-edit-slide').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          const sl  = getSlides();
          const panel = ov.querySelector('#se-panel');
          const head  = panel.querySelector('[style*="sticky"]');
          head.querySelector('span').textContent = 'Редактировать слайд';
          head.querySelector('#se-add').style.display='none';
          const body = panel.querySelector('#se-body');
          body.style.cssText = 'overflow-y:auto;flex:1;min-height:0;padding:16px 20px 80px;-webkit-overflow-scrolling:touch;box-sizing:border-box;width:100%;';
          body.innerHTML = slideEditForm(sl[idx], idx);

          /* Color picker */
          let selCssClass = sl[idx].cssClass||'', selGlowClass = sl[idx].glowClass||'';
          let selColor = sl[idx].color||'', selGlow = sl[idx].glowColor||'';
          body.querySelectorAll('.se-color-btn').forEach(cb => {
            cb.addEventListener('click', () => {
              body.querySelectorAll('.se-color-btn').forEach(x=>x.style.border='2px solid transparent');
              cb.style.border='2px solid #fff';
              selCssClass=cb.dataset.cssClass; selGlowClass=cb.dataset.glowClass;
              selColor=cb.dataset.color; selGlow=cb.dataset.glow;
            });
          });

          /* Block cfg toggles */
          body.querySelectorAll('.se-block-cb').forEach(cb => {
            cb.addEventListener('change', () => {
              const cfgDiv = body.querySelector(`#cfg-${cb.dataset.bid}`);
              if (cfgDiv) cfgDiv.style.display = cb.checked?'block':'none';
            });
          });

          /* Save */
          body.querySelector('#se-save-slide').addEventListener('click', () => {
            const newBlocks = [...body.querySelectorAll('.se-block-cb:checked')].map(c=>c.dataset.bid);
            const blockCfgs = {};
            if (newBlocks.includes('custom_text')) {
              blockCfgs.custom_text = {
                text: body.querySelector('#cfg-custom_text-text')?.value||'',
                sub:  body.querySelector('#cfg-custom_text-sub')?.value||'',
              };
            }
            if (newBlocks.includes('custom_goal')) {
              blockCfgs.custom_goal = { goalId: body.querySelector('#cfg-custom_goal-goalId')?.value||'' };
            }
            sl[idx] = {
              ...sl[idx],
              label:      body.querySelector('#se-label').value.toUpperCase(),
              cssClass:   selCssClass,
              glowClass:  selGlowClass,
              color:      selColor,
              glowColor:  selGlow,
              route:      body.querySelector('#se-route').value,
              blocks:     newBlocks,
              blockCfgs,
            };
            saveSlides(sl); renderOv(); Router.go('/home');
          });
        });
      });

      /* Add new slide */
      ov.querySelector('#se-add')?.addEventListener('click', () => {
        const sl = getSlides();
        sl.push({ id: 's_'+Date.now(), label:'НОВЫЙ СЛАЙД', color:'#13151A', enabled:true, blocks:[] });
        saveSlides(sl); renderOv();
      });
    }

    document.body.appendChild(ov);
    renderOv();
  }

  return { getSlides, saveSlides, renderSlide, openEditor, BLOCK_LIBRARY, DEFAULT_SLIDES };
})();

window.Slides = Slides;
