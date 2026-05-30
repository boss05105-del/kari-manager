const bcrypt = require('bcryptjs');
const { getDb, initDatabase } = require('./database');

const STORES = [
  '11392','10667','11460','10835','10527','11687','11833','10692','10790','11834',
  '10746','11403','11461','10832','11121','13005','13178','11709','10211','13121',
  '10611','10718','10781','10953','10867','10912','10980','11737','10708','13149',
  '11145','11707','11543','11370','11486','11092','11631','13074','10804'
];

const DIRECTOR_NAMES = [
  'Иванова Анна Сергеевна','Петров Дмитрий Александрович','Сидорова Елена Викторовна',
  'Козлов Михаил Николаевич','Новикова Ольга Петровна','Морозов Андрей Игоревич',
  'Волкова Татьяна Дмитриевна','Алексеев Сергей Юрьевич','Лебедева Марина Анатольевна',
  'Семенов Алексей Владимирович','Егорова Светлана Борисовна','Федоров Игорь Михайлович',
  'Орлова Наталья Андреевна','Соколов Павел Евгеньевич','Виноградова Юлия Игоревна',
  'Зайцев Константин Александрович','Белова Ирина Сергеевна','Тихомиров Роман Олегович',
  'Комарова Людмила Владимировна','Сорокин Денис Петрович','Никитина Валерия Андреевна',
  'Громов Вадим Николаевич','Фролова Екатерина Михайловна','Васильев Артем Игоревич',
  'Попова Кристина Дмитриевна','Ковалев Максим Сергеевич','Лазарева Оксана Петровна',
  'Миронов Евгений Александрович','Захарова Анастасия Юрьевна','Тарасов Владимир Олегович',
  'Кузнецова Алина Борисовна','Борисов Геннадий Иванович','Антонова Жанна Евгеньевна',
  'Романов Станислав Андреевич','Щербакова Вера Николаевна','Голубев Тимур Сергеевич',
  'Власова Диана Михайловна','Соловьев Артур Константинович','Гусева Полина Дмитриевна'
];

async function seed() {
  initDatabase();
  const db = getDb();

  const adminPassword = await bcrypt.hash('admin123', 10);

  const insertAdmin = db.prepare(`
    INSERT OR IGNORE INTO users (username, password, role, full_name)
    VALUES (?, ?, 'admin', ?)
  `);
  insertAdmin.run('admin', adminPassword, 'Руководитель сети');

  const insertStore = db.prepare(`
    INSERT OR IGNORE INTO stores (store_number, name) VALUES (?, ?)
  `);
  const insertDirector = db.prepare(`
    INSERT OR IGNORE INTO users (username, password, role, full_name, store_id)
    VALUES (?, ?, 'director', ?, ?)
  `);
  const updateStoreDirector = db.prepare(`
    UPDATE stores SET director_id = ? WHERE id = ?
  `);

  for (let i = 0; i < STORES.length; i++) {
    const storeNum = STORES[i];
    const dirPassword = await bcrypt.hash(`store${storeNum}`, 10);

    insertStore.run(storeNum, `Магазин ${storeNum}`);
    const store = db.prepare('SELECT id FROM stores WHERE store_number = ?').get(storeNum);

    insertDirector.run(
      `dir${storeNum}`,
      dirPassword,
      DIRECTOR_NAMES[i] || `Директор ${storeNum}`,
      store.id
    );

    const director = db.prepare('SELECT id FROM users WHERE username = ?').get(`dir${storeNum}`);
    updateStoreDirector.run(director.id, store.id);
  }

  // Generate sample historical data for the past 30 days
  const stores = db.prepare('SELECT id FROM stores').all();
  const today = new Date();

  for (const store of stores) {
    const director = db.prepare("SELECT id FROM users WHERE store_id = ? AND role = 'director'").get(store.id);
    if (!director) continue;

    for (let d = 29; d >= 1; d--) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];

      const skipPlan = Math.random() < 0.08;
      const skipFact = Math.random() < 0.1;
      const latePlan = !skipPlan && Math.random() < 0.15;
      const lateFact = !skipFact && Math.random() < 0.12;

      if (!skipPlan) {
        try {
          db.prepare(`
            INSERT OR IGNORE INTO daily_plans
            (store_id, director_id, plan_date, ui_percent, gold_qty, silver_qty,
             finmoll_qty, kari_qty, yandex_qty, items_per_receipt,
             conversion_shoes, conversion_insoles, sbp_share, comment, submitted_at, is_late)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            store.id, director.id, dateStr,
            (15 + Math.random() * 20).toFixed(1),
            Math.floor(2 + Math.random() * 8),
            Math.floor(5 + Math.random() * 15),
            Math.floor(1 + Math.random() * 5),
            Math.floor(1 + Math.random() * 4),
            Math.floor(1 + Math.random() * 3),
            (1.5 + Math.random() * 0.8).toFixed(2),
            (25 + Math.random() * 20).toFixed(1),
            (15 + Math.random() * 15).toFixed(1),
            (20 + Math.random() * 30).toFixed(1),
            'Проведем утреннее совещание, распределим задачи, активируем акционные предложения для клиентов, контроль работы кассиров.',
            `${dateStr}T${latePlan ? '10' : '09'}:${Math.floor(Math.random()*59).toString().padStart(2,'0')}:00`,
            latePlan ? 1 : 0
          );
        } catch {}
      }

      if (!skipFact) {
        const planData = db.prepare('SELECT * FROM daily_plans WHERE store_id = ? AND plan_date = ?').get(store.id, dateStr);
        if (planData) {
          const factor = 0.6 + Math.random() * 0.8;
          try {
            db.prepare(`
              INSERT OR IGNORE INTO daily_facts
              (store_id, director_id, fact_date, ui_percent, gold_qty, silver_qty,
               finmoll_qty, kari_qty, yandex_qty, items_per_receipt,
               conversion_shoes, conversion_insoles, sbp_share,
               what_helped, obstacles, tomorrow_actions, submitted_at, is_late)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              store.id, director.id, dateStr,
              (planData.ui_percent * factor).toFixed(1),
              Math.round(planData.gold_qty * factor),
              Math.round(planData.silver_qty * factor),
              Math.round(planData.finmoll_qty * factor),
              Math.round(planData.kari_qty * factor),
              Math.round(planData.yandex_qty * factor),
              (planData.items_per_receipt * factor).toFixed(2),
              (planData.conversion_shoes * factor).toFixed(1),
              (planData.conversion_insoles * factor).toFixed(1),
              (planData.sbp_share * factor).toFixed(1),
              'Активная работа с клиентами, утреннее совещание дало результат.',
              factor < 0.85 ? 'Низкий трафик в первой половине дня, несколько отказов по рассрочке.' : 'Препятствий практически не было.',
              'Усилить работу в утреннее время, дополнительно проработать предложения по рассрочке.',
              `${dateStr}T${lateFact ? '22' : '20'}:${Math.floor(Math.random()*59).toString().padStart(2,'0')}:00`,
              lateFact ? 1 : 0
            );
          } catch {}
        }
      }
    }
  }

  console.log('Database seeded successfully');
  console.log('Admin login: admin / admin123');
  console.log(`Director login example: dir11392 / store11392`);
  process.exit(0);
}

seed().catch(console.error);
