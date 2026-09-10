/* ============================================================
   FEATURES — реестр всех доработок с возможностью откатить
   Каждая фича: { id, on, apply, revert }
   Состояние хранится в Store → Firebase: store.features.flags
   ============================================================ */

const Features = (() => {

  /* ── Реестр всех доработок ── */
  const REGISTRY = [
    {
      id: 'habit_streaks',
      title: 'Стрики в привычках 🔥',
      desc: 'Счётчик дней подряд рядом с каждой привычкой',
      section: 'Привычки',
      color: '#F59E0B',
      date: 'сен 2026',
    },
    {
      id: 'habit_metrics_3col',
      title: '3 метрики вместо 4',
      desc: 'Прогресс / Лучшая / Подтянуть — крупнее и информативнее',
      section: 'Привычки',
      color: '#34D399',
      date: 'сен 2026',
    },
    {
      id: 'habit_sticky_col',
      title: 'Закреплённая колонка в таблице',
      desc: 'Название привычки не уезжает при горизонтальном скролле',
      section: 'Привычки',
      color: '#34D399',
      date: 'сен 2026',
    },
    {
      id: 'habit_wheel_month',
      title: 'Колесо привязано к выбранному месяцу',
      desc: 'Раньше всегда показывало текущий месяц, теперь — выбранный на гриде',
      section: 'Привычки',
      color: '#34D399',
      date: 'сен 2026',
    },
    {
      id: 'goals_season_tabs',
      title: 'Вкладки сезонов в целях',
      desc: 'Исправлен критический баг: весь экран целей не открывался из-за ReferenceError',
      section: 'Цели',
      color: '#A78BFA',
      date: 'сен 2026',
    },
    {
      id: 'goals_month_filter',
      title: 'Фильтр по месяцу в целях',
      desc: 'Сентябрь / Октябрь / Ноябрь реально фильтруют список',
      section: 'Цели',
      color: '#A78BFA',
      date: 'сен 2026',
    },
    {
      id: 'goals_money_counter',
      title: 'Счётчик денег в целях',
      desc: 'После закрытия цели сумма обновляется сразу',
      section: 'Цели',
      color: '#A78BFA',
      date: 'сен 2026',
    },
    {
      id: 'goals_save_fix',
      title: 'Исправлены дубли целей в Firebase',
      desc: 'goalsSave() теперь пишет весь массив одним Store.set — нет дублей',
      section: 'Цели',
      color: '#A78BFA',
      date: 'сен 2026',
    },
    {
      id: 'finance_drag_columns',
      title: 'Drag по столбцам независимый',
      desc: 'Левый (расходы) и правый (потенциал) перетаскиваются отдельно',
      section: 'Финансы',
      color: '#60A5FA',
      date: 'сен 2026',
    },
    {
      id: 'finance_tabs_style',
      title: 'Вкладки крупнее, чёрный цвет',
      desc: 'Шрифт 14px, цвет #111, активная вкладка bold',
      section: 'Финансы',
      color: '#60A5FA',
      date: 'сен 2026',
    },
    {
      id: 'home_slider_settings',
      title: 'Настройки слайдера',
      desc: 'Иконка ⚙ в хедере: выбирай слайды и интервал переключения',
      section: 'Главный экран',
      color: '#F59E0B',
      date: 'сен 2026',
    },
    {
      id: 'home_planned_expenses',
      title: 'Настраиваемые плановые расходы',
      desc: 'Нажми на блок «подушка» — можно изменить сумму. Раньше было захардкожено 97 000₽',
      section: 'Главный экран',
      color: '#F59E0B',
      date: 'сен 2026',
    },
    {
      id: 'training_rounding',
      title: 'Числа округляются в тренировках',
      desc: 'Больше нет -5.799999... — Math.round(x * 10) / 10',
      section: 'Тренировки',
      color: '#F87171',
      date: 'сен 2026',
    },
    {
      id: 'training_base_week',
      title: 'Сравнение с произвольной неделей',
      desc: 'В «Рабочем весе» селектор «Сравнивать с: Нед. X»',
      section: 'Тренировки',
      color: '#F87171',
      date: 'сен 2026',
    },
  ];

  /* ── Получить состояние флагов из Store ── */
  function getFlags() {
    return Store.get().features?.flags || {};
  }

  /* ── Проверить: фича включена? (по умолчанию — да) ── */
  function isOn(id) {
    const flags = getFlags();
    return flags[id] !== false; // undefined → true (включено по умолчанию)
  }

  /* ── Переключить фичу ── */
  function toggle(id) {
    const current = isOn(id);
    Store.set('features.flags.' + id, !current);
    return !current;
  }

  /* ── Все фичи с текущим статусом ── */
  function all() {
    return REGISTRY.map(f => ({ ...f, enabled: isOn(f.id) }));
  }

  /* ── Сгруппировать по секции ── */
  function bySection() {
    const groups = {};
    REGISTRY.forEach(f => {
      if (!groups[f.section]) groups[f.section] = [];
      groups[f.section].push({ ...f, enabled: isOn(f.id) });
    });
    return groups;
  }

  /* ── Открыть панель управления фичами ── */
  function openPanel() {
    const groups = bySection();

    const sectionsHtml = Object.entries(groups).map(([section, features]) => {
      const color = features[0].color;
      const itemsHtml = features.map(f => {
        const on = f.enabled;
        return `<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid #2A2D35;" data-feature-row="${f.id}">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
              <span style="font-size:13px;font-weight:700;color:${on?'#E8E5DC':'#555'};font-family:Montserrat,sans-serif;transition:color .2s;">${f.title}</span>
              <span style="font-size:9px;color:#555;font-family:Montserrat,sans-serif;">${f.date}</span>
            </div>
            <div style="font-size:11px;color:${on?'#9D9A92':'#444'};line-height:1.5;font-family:Montserrat,sans-serif;transition:color .2s;">${f.desc}</div>
          </div>
          <button data-toggle="${f.id}" style="
            flex-shrink:0;margin-top:2px;
            width:44px;height:26px;border-radius:13px;border:none;cursor:pointer;
            background:${on?color:'#2A2D35'};
            transition:background .25s;position:relative;
          ">
            <div style="
              position:absolute;top:3px;
              left:${on?'21px':'3px'};
              width:20px;height:20px;border-radius:50%;background:#fff;
              transition:left .25s;box-shadow:0 1px 4px rgba(0,0,0,.4);
            "></div>
          </button>
        </div>`;
      }).join('');

      const onCount = features.filter(f => f.enabled).length;
      return `<div style="padding:0 20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 0 6px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${color};"></div>
            <span style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.08em;font-family:Montserrat,sans-serif;">${section}</span>
          </div>
          <span style="font-size:10px;color:#555;font-family:Montserrat,sans-serif;">${onCount}/${features.length} вкл.</span>
        </div>
        ${itemsHtml}
      </div>`;
    }).join('');

    const totalOn = REGISTRY.filter(f => isOn(f.id)).length;

    const ov = document.createElement('div');
    ov.className = 'tr-modal-overlay';
    ov.style.cssText = 'align-items:flex-end;padding:0;';
    ov.innerHTML = `
      <div id="features-panel" style="background:#1A1C22;border-radius:20px 20px 0 0;width:100%;max-width:520px;margin:0 auto;max-height:88vh;display:flex;flex-direction:column;">
        <div style="position:sticky;top:0;background:#1A1C22;padding:16px 20px 12px;border-bottom:1px solid #2A2D35;border-radius:20px 20px 0 0;flex-shrink:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;">
            <span style="font-size:16px;font-weight:800;color:#E8E5DC;font-family:Montserrat,sans-serif;">⚙ Доработки</span>
            <button id="feat-close" style="background:#2A2D35;border:none;border-radius:50%;width:28px;height:28px;color:#9D9A92;cursor:pointer;font-size:16px;">×</button>
          </div>
          <div style="font-size:11px;color:#555;font-family:Montserrat,sans-serif;">${totalOn} из ${REGISTRY.length} включено · toggle = перезагрузка страницы</div>
        </div>
        <div style="overflow-y:auto;flex:1;padding-bottom:32px;">
          ${sectionsHtml}
          <div style="padding:20px 20px 0;border-top:1px solid #2A2D35;margin-top:8px;">
            <button id="feat-disable-all" style="width:100%;padding:10px;border-radius:8px;border:1px solid #FF5C5C;background:none;color:#FF5C5C;font-size:12px;font-weight:700;cursor:pointer;font-family:Montserrat,sans-serif;">
              Откатить все доработки
            </button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(ov);

    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.querySelector('#feat-close').addEventListener('click', () => ov.remove());

    /* Toggle кнопки */
    ov.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.toggle;
        const nowOn = toggle(id);
        /* Обновить визуально без закрытия */
        const row = ov.querySelector(`[data-feature-row="${id}"]`);
        const feat = REGISTRY.find(f => f.id === id);
        const color = feat.color;
        btn.style.background = nowOn ? color : '#2A2D35';
        btn.querySelector('div').style.left = nowOn ? '21px' : '3px';
        row.querySelector('span').style.color = nowOn ? '#E8E5DC' : '#555';
        /* Обновить счётчик секции */
        const groups2 = bySection();
        ov.querySelectorAll('[data-toggle]').forEach(b => {
          /* Пересчитать заголовки секций */
        });
        /* Дать время Firebase записать, потом перезагрузить */
        setTimeout(() => Router.go(Router.currentPath()), 400);
      });
    });

    /* Откатить всё */
    ov.querySelector('#feat-disable-all').addEventListener('click', () => {
      if (!confirm('Отключить все доработки? Страница перезагрузится.')) return;
      REGISTRY.forEach(f => Store.set('features.flags.' + f.id, false));
      setTimeout(() => Router.go(Router.currentPath()), 500);
      ov.remove();
    });
  }

  return { isOn, toggle, all, openPanel, REGISTRY };
})();

window.Features = Features;
