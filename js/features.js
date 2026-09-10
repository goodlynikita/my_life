/* ============================================================
   FEATURES — реестр доработок с toggle, категориями и типами
   type: 'bug' (серый, техническое) | 'feature' (цветное, UX)
   Состояние: Store → Firebase: store.features.flags
   ============================================================ */

const Features = (() => {

  const REGISTRY = [
    /* ──────────── БАГИ ──────────── */
    {
      id: 'goals_season_tabs',    type: 'bug',
      title: 'Вкладки сезонов в целях',
      desc: 'render() падал с ReferenceError — весь экран целей не открывался',
      section: 'Цели', date: 'сен 2026',
    },
    {
      id: 'goals_save_fix',       type: 'bug',
      title: 'Дубли целей в Firebase',
      desc: 'goalsSave() теперь пишет весь массив одним Store.set',
      section: 'Цели', date: 'сен 2026',
    },
    {
      id: 'training_rounding',    type: 'bug',
      title: 'Числа в тренировках -5.799...',
      desc: 'Math.round(x * 10) / 10 в diff расчёте',
      section: 'Тренировки', date: 'сен 2026',
    },

    /* ──────────── ФИЧИ ──────────── */
    {
      id: 'habit_streaks',        type: 'feature',
      title: '🔥 Стрики в привычках',
      desc: 'Счётчик дней подряд рядом с каждой привычкой. Горит оранжевым от 2+',
      section: 'Привычки', color: '#F59E0B', date: 'сен 2026',
    },
    {
      id: 'habit_metrics_3col',   type: 'feature',
      title: '📊 3 метрики вместо 4',
      desc: 'Прогресс / Лучшая / Подтянуть — крупнее и информативнее',
      section: 'Привычки', color: '#34D399', date: 'сен 2026',
    },
    {
      id: 'habit_sticky_col',     type: 'feature',
      title: '📌 Закреплённая колонка',
      desc: 'Название привычки не уезжает при горизонтальном скролле',
      section: 'Привычки', color: '#34D399', date: 'сен 2026',
    },
    {
      id: 'goals_month_filter',   type: 'feature',
      title: '📅 Фильтр по месяцу в целях',
      desc: 'Сентябрь/Октябрь/Ноябрь — показывает только цели за выбранный месяц',
      section: 'Цели', color: '#A78BFA', date: 'сен 2026',
    },
    {
      id: 'goals_money_counter',  type: 'feature',
      title: '💰 Счётчик денег обновляется',
      desc: 'После закрытия цели сумма пересчитывается сразу',
      section: 'Цели', color: '#A78BFA', date: 'сен 2026',
    },
    {
      id: 'finance_drag_columns', type: 'feature',
      title: '↕️ Drag столбцов независимый',
      desc: 'Левый (расходы) и правый (потенциал) перетаскиваются отдельно',
      section: 'Финансы', color: '#60A5FA', date: 'сен 2026',
    },
    {
      id: 'finance_tabs_style',   type: 'feature',
      title: '🔡 Вкладки финансов крупнее',
      desc: 'Шрифт 14px, чёрный цвет, активная bold',
      section: 'Финансы', color: '#60A5FA', date: 'сен 2026',
    },
    {
      id: 'home_slider_settings', type: 'feature',
      title: '🎛️ Настройки слайдера',
      desc: 'Кнопка ⚙ в хедере — выбор слайдов, интервал, автолистание',
      section: 'Главный экран', color: '#F59E0B', date: 'сен 2026',
    },
    {
      id: 'home_planned_expenses',type: 'feature',
      title: '💡 Настраиваемые расходы',
      desc: 'Нажми на "подушка" — меняй плановые расходы. Раньше: захардкожено 97 000₽',
      section: 'Главный экран', color: '#F59E0B', date: 'сен 2026',
    },
    {
      id: 'training_base_week',   type: 'feature',
      title: '📐 Сравнение с любой неделей',
      desc: 'В "Рабочем весе" — селектор базовой недели для сравнения прогресса',
      section: 'Тренировки', color: '#F87171', date: 'сен 2026',
    },
    {
      id: 'training_1rm',         type: 'feature',
      title: '💪 Калькулятор 1RM',
      desc: 'Вкладка "1RM" — расчёт максимума по формуле Эпли + зоны нагрузки',
      section: 'Тренировки', color: '#F87171', date: 'сен 2026',
    },
    {
      id: 'fluid_typography',     type: 'feature',
      title: '📱 Адаптивные шрифты',
      desc: 'На телефоне крупнее, на ноуте компактнее — через CSS clamp()',
      section: 'Дизайн', color: '#818CF8', date: 'сен 2026',
    },
    {
      id: 'visual_animations',    type: 'feature',
      title: '✨ Анимации и hover-эффекты',
      desc: 'Карточки появляются с анимацией, упражнения подсвечиваются, прогресс светится',
      section: 'Дизайн', color: '#818CF8', date: 'сен 2026',
    },
  ];

  function getFlags() { return Store.get().features?.flags || {}; }
  function isOn(id) { return getFlags()[id] !== false; }
  function toggle(id) { const v = !isOn(id); Store.set('features.flags.' + id, v); return v; }
  function all() { return REGISTRY.map(f => ({ ...f, enabled: isOn(f.id) })); }

  function bySection() {
    const groups = {};
    REGISTRY.forEach(f => {
      if (!groups[f.section]) groups[f.section] = [];
      groups[f.section].push({ ...f, enabled: isOn(f.id) });
    });
    return groups;
  }

  /* ══════════════════════════════════════════
     ПАНЕЛЬ ДОРАБОТОК
     ══════════════════════════════════════════ */
  function openPanel() {
    const bugs    = REGISTRY.filter(f => f.type === 'bug');
    const features = REGISTRY.filter(f => f.type === 'feature');
    const groups   = {};
    features.forEach(f => {
      if (!groups[f.section]) groups[f.section] = [];
      groups[f.section].push(f);
    });

    const SECTION_COLORS = {
      'Привычки':      '#34D399',
      'Цели':          '#A78BFA',
      'Финансы':       '#60A5FA',
      'Главный экран': '#F59E0B',
      'Тренировки':    '#F87171',
      'Дизайн':        '#818CF8',
    };

    /* ── Баги (свёрнутый блок) ── */
    const bugsHtml = `
      <details style="margin:0 20px 4px;">
        <summary style="cursor:pointer;padding:12px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#555;font-family:Montserrat,sans-serif;list-style:none;display:flex;align-items:center;gap:8px;">
          <span style="flex:1;">🔧 Исправленные баги (${bugs.length})</span>
          <span style="font-size:10px;color:#3A3D45;">▸ раскрыть</span>
        </summary>
        <div style="padding-bottom:8px;">
          ${bugs.map(f => {
            const on = isOn(f.id);
            return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #1E2028;" data-feature-row="${f.id}">
              <div style="flex:1;">
                <div style="font-size:12px;font-weight:600;color:${on?'#9D9A92':'#444'};font-family:Montserrat,sans-serif;">${f.title}</div>
                <div style="font-size:11px;color:#444;margin-top:2px;line-height:1.4;">${f.desc}</div>
              </div>
              <button data-toggle="${f.id}" style="flex-shrink:0;width:40px;height:24px;border-radius:12px;border:none;cursor:pointer;background:${on?'#2A5A3A':'#2A2D35'};position:relative;transition:background .2s;">
                <div style="position:absolute;top:3px;left:${on?'19px':'3px'};width:18px;height:18px;border-radius:50%;background:${on?'#34D399':'#555'};transition:left .2s;"></div>
              </button>
            </div>`;
          }).join('')}
        </div>
      </details>`;

    /* ── Фичи по секциям ── */
    const featuresHtml = Object.entries(groups).map(([section, items]) => {
      const color = SECTION_COLORS[section] || '#9D9A92';
      const onCount = items.filter(f => isOn(f.id)).length;
      return `<div style="padding:0 20px;margin-bottom:4px;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0 8px;border-top:1px solid #1E2028;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color}88;"></div>
            <span style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.08em;font-family:Montserrat,sans-serif;">${section}</span>
          </div>
          <span style="font-size:10px;color:#3A3D45;font-family:Montserrat,sans-serif;">${onCount}/${items.length}</span>
        </div>
        ${items.map(f => {
          const on = isOn(f.id);
          return `<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid #1A1C22;" data-feature-row="${f.id}">
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:700;color:${on?'#E8E5DC':'#555'};font-family:Montserrat,sans-serif;transition:color .2s;">${f.title}</div>
              <div style="font-size:11px;color:${on?'#6B7280':'#3A3D45'};line-height:1.5;margin-top:3px;font-family:Montserrat,sans-serif;transition:color .2s;">${f.desc}</div>
            </div>
            <button data-toggle="${f.id}" style="flex-shrink:0;margin-top:2px;width:44px;height:26px;border-radius:13px;border:none;cursor:pointer;background:${on?color:'#2A2D35'};position:relative;transition:background .25s;box-shadow:${on?'0 0 10px '+color+'55':'none'};">
              <div style="position:absolute;top:3px;left:${on?'21px':'3px'};width:20px;height:20px;border-radius:50%;background:#fff;transition:left .25s;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>
            </button>
          </div>`;
        }).join('')}
      </div>`;
    }).join('');

    const totalOn  = REGISTRY.filter(f => isOn(f.id)).length;
    const featOn   = features.filter(f => isOn(f.id)).length;

    const ov = document.createElement('div');
    ov.className = 'tr-modal-overlay';
    ov.style.cssText = 'align-items:flex-end;padding:0;';
    ov.innerHTML = `
      <div id="features-panel" style="background:#13151A;border-radius:20px 20px 0 0;width:100%;max-width:520px;margin:0 auto;max-height:88vh;display:flex;flex-direction:column;">

        <!-- Хедер -->
        <div style="position:sticky;top:0;background:#13151A;padding:18px 20px 12px;border-bottom:1px solid #1E2028;border-radius:20px 20px 0 0;flex-shrink:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:17px;font-weight:800;color:#E8E5DC;font-family:Montserrat,sans-serif;">Доработки</span>
            <button id="feat-close" style="background:#1E2028;border:none;border-radius:50%;width:30px;height:30px;color:#9D9A92;cursor:pointer;font-size:18px;line-height:1;">×</button>
          </div>
          <!-- Сводка -->
          <div style="display:flex;gap:8px;">
            <div style="flex:1;background:#1A1C22;border-radius:10px;padding:8px 12px;text-align:center;">
              <div style="font-size:20px;font-weight:900;color:#E8E5DC;font-family:Montserrat,sans-serif;">${featOn}</div>
              <div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:.06em;">фич вкл.</div>
            </div>
            <div style="flex:1;background:#1A1C22;border-radius:10px;padding:8px 12px;text-align:center;">
              <div style="font-size:20px;font-weight:900;color:#34D399;font-family:Montserrat,sans-serif;">${bugs.length}</div>
              <div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:.06em;">багов закрыто</div>
            </div>
            <div style="flex:1;background:#1A1C22;border-radius:10px;padding:8px 12px;text-align:center;">
              <div style="font-size:20px;font-weight:900;color:#A78BFA;font-family:Montserrat,sans-serif;">${REGISTRY.length}</div>
              <div style="font-size:9px;color:#555;text-transform:uppercase;letter-spacing:.06em;">всего</div>
            </div>
          </div>
        </div>

        <!-- Список -->
        <div style="overflow-y:auto;flex:1;padding:8px 0 0;">
          ${bugsHtml}
          ${featuresHtml}

          <!-- Кнопка сброса -->
          <div style="padding:16px 20px 32px;margin-top:8px;">
            <button id="feat-disable-all" style="width:100%;padding:12px;border-radius:10px;border:1px solid #3A1A1A;background:none;color:#FF5C5C;font-size:12px;font-weight:700;cursor:pointer;font-family:Montserrat,sans-serif;">
              Отключить все фичи
            </button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.querySelector('#feat-close').addEventListener('click', () => ov.remove());

    /* Toggle */
    ov.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id    = btn.dataset.toggle;
        const feat  = REGISTRY.find(f => f.id === id);
        const nowOn = toggle(id);
        const color = feat?.color || '#34D399';

        btn.style.background   = nowOn ? color : '#2A2D35';
        btn.style.boxShadow    = nowOn ? '0 0 10px ' + color + '55' : 'none';
        btn.querySelector('div').style.left = nowOn ? '21px' : '3px';

        const row = ov.querySelector(`[data-feature-row="${id}"]`);
        if (row) {
          const title = row.querySelector('[style*="font-size:13px"]') || row.querySelector('[style*="font-size:12px"]');
          const desc  = row.querySelector('[style*="font-size:11px"]');
          if (title) title.style.color = nowOn ? '#E8E5DC' : '#555';
          if (desc)  desc.style.color  = nowOn ? '#6B7280' : '#3A3D45';
        }

        /* Обновить счётчики в шапке */
        const newFeatOn = REGISTRY.filter(f => f.type==='feature' && isOn(f.id)).length;
        const numEls = ov.querySelectorAll('[style*="font-size:20px"]');
        if (numEls[0]) numEls[0].textContent = newFeatOn;

        setTimeout(() => Router.go(Router.currentPath()), 350);
      });
    });

    /* Отключить всё */
    ov.querySelector('#feat-disable-all').addEventListener('click', () => {
      if (!confirm('Отключить все фичи? Баги останутся исправленными.')) return;
      REGISTRY.filter(f => f.type === 'feature').forEach(f => Store.set('features.flags.' + f.id, false));
      setTimeout(() => Router.go(Router.currentPath()), 400);
      ov.remove();
    });
  }

  return { isOn, toggle, all, openPanel, REGISTRY };
})();

window.Features = Features;
