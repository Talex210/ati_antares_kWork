// src/database.ts

import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

// Обеспечиваем, чтобы путь к БД был корректным вне зависимости от того, откуда запускается скрипт
const dbPath = path.resolve(process.cwd(), 'database.db');

export let db: Database | undefined; // Экспортируем экземпляр базы данных

/**
 * Инициализирует базу данных и создает необходимые таблицы, если они не существуют.
 */
export async function initializeDatabase() {
  // Упрощаем инициализацию драйвера, чтобы избежать потенциальных проблем с .verbose()
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  console.log('✅ Подключение к базе данных SQLite установлено.');

  // Создаем таблицу для "белого списка" логистов
  await db.exec(`
    CREATE TABLE IF NOT EXISTS whitelisted_logisticians (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ati_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      phone TEXT,
      telegram TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Таблица "whitelisted_logisticians" готова.');

  // Создаем таблицу для истории опубликованных грузов
  await db.exec(`
    CREATE TABLE IF NOT EXISTS published_loads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ati_load_id TEXT NOT NULL UNIQUE,
      published_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Таблица "published_loads" готова.');

  // Создаем таблицу для грузов, ожидающих публикации
  await db.exec(`
    CREATE TABLE IF NOT EXISTS pending_loads (
      ati_load_id TEXT PRIMARY KEY,
      load_data TEXT NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Таблица "pending_loads" готова.');

  // Создаем таблицу для отклоненных грузов
  await db.exec(`
    CREATE TABLE IF NOT EXISTS rejected_loads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ati_load_id TEXT NOT NULL UNIQUE,
      load_data TEXT NOT NULL,
      rejected_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Таблица "rejected_loads" готова.');

  // Создаем таблицу для топиков
  await db.exec(`
    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      topic_id INTEGER NOT NULL UNIQUE
    );
  `);
  console.log('Таблица "topics" готова.');

  return db;
}

/**
 * Получает список ATI ID логистов, находящихся в белом списке.
 * @returns {Promise<number[]>} Массив ATI ID логистов.
 */
export async function getWhitelistedLogisticiansIds(): Promise<number[]> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return [];
  }
  try {
    const logisticians = await db.all<{ ati_id: number }[]>(
      'SELECT ati_id FROM whitelisted_logisticians'
    );
    return logisticians.map((l: { ati_id: number }) => l.ati_id);
  } catch (error) {
    console.error('Ошибка при получении ID логистов из белого списка:', error);
    return [];
  }
}

/**
 * Определяет тип для логиста из белого списка.
 */
export interface WhitelistedLogistician {
  id: number;
  ati_id: number;
  name: string;
  phone: string | null;
  telegram: string | null;
  added_at: string;
}

/**
 * Определяет тип для топика.
 */
export interface Topic {
  id: number;
  name: string;
  topic_id: number;
}

/**
 * Добавляет новый топик.
 * @param name Название топика.
 * @param topicId ID топика в Telegram.
 */
export async function addTopic(name: string, topicId: number): Promise<void> {
  if (!db) {
    throw new Error('База данных не инициализирована.');
  }
  try {
    await db.run(
      'INSERT INTO topics (name, topic_id) VALUES (?, ?)',
      name,
      topicId
    );
    console.log(`Топик "${name}" (ID: ${topicId}) добавлен.`);
  } catch (error) {
    console.error(`Ошибка при добавлении топика ${name}:`, error);
    throw error;
  }
}

/**
 * Получает все топики.
 * @returns {Promise<Topic[]>} Массив объектов топиков.
 */
export async function getTopics(): Promise<Topic[]> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return [];
  }
  try {
    const topics = await db.all<Topic[]>(
      'SELECT id, name, topic_id FROM topics ORDER BY name ASC'
    );
    return topics;
  } catch (error) {
    console.error('Ошибка при получении топиков:', error);
    return [];
  }
}

/**
 * Обновляет существующий топик.
 * @param id ID топика в базе данных.
 * @param name Новое название топика.
 * @param topicId Новый ID топика в Telegram.
 */
export async function updateTopic(id: number, name: string, topicId: number): Promise<void> {
  if (!db) {
    throw new Error('База данных не инициализирована.');
  }
  try {
    const result = await db.run(
      'UPDATE topics SET name = ?, topic_id = ? WHERE id = ?',
      name,
      topicId,
      id
    );
    if (result.changes === 0) {
      throw new Error(`Топик с ID ${id} не найден.`);
    }
    console.log(`Топик с ID ${id} обновлен: "${name}" (ID: ${topicId}).`);
  } catch (error) {
    console.error(`Ошибка при обновлении топика с ID ${id}:`, error);
    throw error;
  }
}

/**
 * Удаляет топик из базы данных.
 * @param id ID топика в базе данных.
 */
export async function deleteTopic(id: number): Promise<void> {
  if (!db) {
    throw new Error('База данных не инициализирована.');
  }
  try {
    const result = await db.run('DELETE FROM topics WHERE id = ?', id);
    if (result.changes === 0) {
      throw new Error(`Топик с ID ${id} не найден.`);
    }
    console.log(`Топик с ID ${id} удален.`);
  } catch (error) {
    console.error(`Ошибка при удалении топика с ID ${id}:`, error);
    throw error;
  }
}

/**
 * Получает полный список логистов из белого списка с информацией о контактах.
 * @returns {Promise<WhitelistedLogistician[]>} Массив объектов логистов.
 */
export async function getWhitelistedLogisticians(): Promise<WhitelistedLogistician[]> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return [];
  }
  try {
    const logisticians = await db.all<WhitelistedLogistician[]>(
      'SELECT id, ati_id, name, phone, telegram, added_at FROM whitelisted_logisticians ORDER BY added_at DESC'
    );
    return logisticians;
  } catch (error) {
    console.error('Ошибка при получении логистов из белого списка:', error);
    return [];
  }
}

/**
 * Добавляет нового логиста в белый список.
 * @param atiId ATI ID логиста.
 * @param name Имя логиста.
 * @param phone Телефон логиста (опционально).
 * @param telegram Telegram логиста (опционально).
 */
export async function addWhitelistedLogistician(
  atiId: number, 
  name: string, 
  phone?: string, 
  telegram?: string
): Promise<void> {
  if (!db) {
    throw new Error('База данных не инициализирована.');
  }
  try {
    await db.run(
      'INSERT INTO whitelisted_logisticians (ati_id, name, phone, telegram) VALUES (?, ?, ?, ?)',
      atiId,
      name,
      phone || null,
      telegram || null
    );
    console.log(`Логист "${name}" (ATI ID: ${atiId}) добавлен в белый список.`);
  } catch (error) {
    console.error(`Ошибка при добавлении логиста ${name}:`, error);
    throw error; // Пробрасываем ошибку выше для обработки в API
  }
}

/**
 * Обновляет информацию о логисте (только телефон) из ATI API.
 * Telegram НЕ обновляется, так как его нет в API.
 */
export async function updateLogisticianContactInfo(): Promise<void> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return;
  }
  
  try {
    const { getContacts } = await import('./ati_api.js');
    const contacts = await getContacts();
    const logisticians = await getWhitelistedLogisticians();
    
    let updatedCount = 0;
    
    for (const logist of logisticians) {
      const contact = contacts.find(c => c.id === logist.ati_id);
      if (contact) {
        const phone = contact.mobile || contact.phone || null;
        
        // Обновляем только телефон, если он изменился
        if (phone !== logist.phone) {
          await db.run(
            'UPDATE whitelisted_logisticians SET phone = ? WHERE id = ?',
            phone,
            logist.id
          );
          console.log(`📝 Обновлен телефон для ${logist.name}: ${phone}`);
          updatedCount++;
        }
      }
    }
    
    if (updatedCount === 0) {
      console.log('✅ Все телефоны актуальны, обновлений не требуется.');
    } else {
      console.log(`✅ Обновлено телефонов: ${updatedCount}`);
    }
  } catch (error) {
    console.error('❌ Ошибка при обновлении информации о логистах:', error);
  }
}

/**
 * Удаляет логиста из белого списка по его ID в базе данных.
 * @param id ID логиста в таблице.
 */
export async function deleteWhitelistedLogistician(id: number): Promise<void> {
  if (!db) {
    throw new Error('База данных не инициализирована.');
  }
  try {
    const result = await db.run('DELETE FROM whitelisted_logisticians WHERE id = ?', id);
    if (result.changes === 0) {
      throw new Error(`Логист с ID ${id} не найден.`);
    }
    console.log(`Логист с ID ${id} удален из белого списка.`);
  } catch (error) {
    console.error(`Ошибка при удалении логиста с ID ${id}:`, error);
    throw error; // Пробрасываем ошибку выше
  }
}

/**
 * Проверяет, был ли груз уже обработан (опубликован или находится в очереди).
 * @param atiLoadId ID груза ATI (GUID).
 * @returns {Promise<boolean>} true, если груз был обработан, иначе false.
 */
export async function isLoadProcessed(atiLoadId: string): Promise<boolean> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return false;
  }
  try {
    // Проверяем в таблице опубликованных
    const published = await db.get(
      'SELECT ati_load_id FROM published_loads WHERE ati_load_id = ?',
      atiLoadId
    );
    if (published) {
      return true;
    }
    // Проверяем в таблице ожидающих
    const pending = await db.get(
      'SELECT ati_load_id FROM pending_loads WHERE ati_load_id = ?',
      atiLoadId
    );
    return !!pending;
  } catch (error) {
    console.error(`Ошибка при проверке статуса груза ${atiLoadId}:`, error);
    return false; // В случае ошибки считаем, что не обработан
  }
}


/**
 * Отмечает груз как опубликованный.
 * @param atiLoadId ID груза ATI (GUID).
 */
export async function markLoadAsPublished(atiLoadId: string): Promise<void> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return;
  }
  try {
    await db.run(
      'INSERT INTO published_loads (ati_load_id) VALUES (?)',
      atiLoadId
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      // Это ожидаемое поведение, если груз уже в базе. Просто игнорируем.
    } else {
      console.error(`Ошибка при отметке груза ${atiLoadId} как опубликованного:`, error);
    }
  }
}

/**
 * Добавляет груз в список ожидания для публикации.
 * @param load Объект груза.
 */
export async function addPendingLoad(load: any): Promise<void> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return;
  }
  try {
    await db.run(
      'INSERT INTO pending_loads (ati_load_id, load_data) VALUES (?, ?)',
      load.Id,
      JSON.stringify(load)
    );
    console.log(`📥 Груз с ID ${load.Id} добавлен в очередь на публикацию.`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      // Груз уже в очереди, это не ошибка.
    } else {
      console.error(`Ошибка при добавлении груза ${load.Id} в очередь:`, error);
    }
  }
}

/**
 * Получает все грузы, ожидающие публикации.
 * @returns {Promise<any[]>} Массив объектов грузов.
 */
export async function getPendingLoads(): Promise<any[]> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return [];
  }
  try {
    const rows = await db.all<{ ati_load_id: string, load_data: string }[]>(
      'SELECT ati_load_id, load_data FROM pending_loads ORDER BY added_at ASC'
    );

    // Используем reduce для безопасного парсинга каждой строки
    const loads = rows.reduce((acc, row) => {
      try {
        // Пытаемся распарсить данные
        acc.push(JSON.parse(row.load_data));
      } catch (e) {
        // Если парсинг не удался, логируем ошибку и пропускаем эту запись
        console.error(`[DB_ERROR] Не удалось распарсить JSON для груза с ID: ${row.ati_load_id}. Ошибка:`, e);
        console.error('[DB_ERROR] Проблемные данные:', row.load_data);
      }
      return acc;
    }, [] as any[]);

    return loads;
  } catch (error) {
    console.error('Ошибка при получении грузов из очереди на уровне БД:', error);
    // Пробрасываем ошибку, чтобы API вернул статус 500
    throw error;
  }
}

/**
 * Получает один груз, ожидающий публикации, по его ID.
 * @param atiLoadId ID груза ATI (GUID).
 * @returns {Promise<any | null>} Объект груза или null, если не найден.
 */
export async function getPendingLoadById(atiLoadId: string): Promise<any | null> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return null;
  }
  try {
    const row = await db.get<{ load_data: string }>(
      'SELECT load_data FROM pending_loads WHERE ati_load_id = ?',
      atiLoadId
    );
    return row ? JSON.parse(row.load_data) : null;
  } catch (error) {
    console.error(`Ошибка при получении груза ${atiLoadId} из очереди:`, error);
    return null;
  }
}

/**
 * Удаляет груз из списка ожидания.
 * @param atiLoadId ID груза ATI (GUID).
 */
export async function removePendingLoad(atiLoadId: string): Promise<void> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return;
  }
  try {
    await db.run('DELETE FROM pending_loads WHERE ati_load_id = ?', atiLoadId);
    console.log(`🗑️ Груз с ID ${atiLoadId} удален из очереди.`);
  } catch (error) {
    console.error(`Ошибка при удалении груза ${atiLoadId} из очереди:`, error);
  }
}

/**
 * Удаляет из очереди грузы, которые не соответствуют текущему белому списку логистов.
 * Используется после удаления логиста из белого списка.
 */
export async function cleanupPendingLoads(): Promise<void> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return;
  }
  
  try {
    const whitelistedIds = await getWhitelistedLogisticiansIds();
    
    if (whitelistedIds.length === 0) {
      // Если белый список пуст, удаляем все грузы из очереди
      const result = await db.run('DELETE FROM pending_loads');
      console.log(`🧹 Белый список пуст. Удалено ${result.changes || 0} грузов из очереди.`);
      return;
    }
    
    // Получаем все грузы из очереди
    const pendingLoads = await getPendingLoads();
    let removedCount = 0;
    
    for (const load of pendingLoads) {
      const isWhitelisted = 
        whitelistedIds.includes(load.ContactId1) ||
        (load.ContactId2 && whitelistedIds.includes(load.ContactId2));
      
      if (!isWhitelisted) {
        await removePendingLoad(load.Id);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`🧹 Удалено ${removedCount} грузов из очереди (логисты не в белом списке).`);
    } else {
      console.log('✅ Все грузы в очереди соответствуют белому списку.');
    }
  } catch (error) {
    console.error('❌ Ошибка при очистке очереди грузов:', error);
  }
}

/**
 * Добавляет груз в список отклоненных.
 * @param load Объект груза.
 */
export async function addRejectedLoad(load: any): Promise<void> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return;
  }
  try {
    await db.run(
      'INSERT INTO rejected_loads (ati_load_id, load_data) VALUES (?, ?)',
      load.Id,
      JSON.stringify(load)
    );
    console.log(`🚫 Груз с ID ${load.Id} добавлен в список отклоненных.`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      // Груз уже в списке отклоненных
      console.log(`⚠️ Груз с ID ${load.Id} уже в списке отклоненных.`);
    } else {
      console.error(`Ошибка при добавлении груза ${load.Id} в список отклоненных:`, error);
    }
  }
}

/**
 * Получает все отклоненные грузы.
 * @returns {Promise<any[]>} Массив объектов грузов.
 */
export async function getRejectedLoads(): Promise<any[]> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return [];
  }
  try {
    const rows = await db.all<{ ati_load_id: string, load_data: string }[]>(
      'SELECT ati_load_id, load_data FROM rejected_loads ORDER BY rejected_at DESC'
    );

    const loads = rows.reduce((acc, row) => {
      try {
        acc.push(JSON.parse(row.load_data));
      } catch (e) {
        console.error(`[DB_ERROR] Не удалось распарсить JSON для отклоненного груза с ID: ${row.ati_load_id}. Ошибка:`, e);
      }
      return acc;
    }, [] as any[]);

    return loads;
  } catch (error) {
    console.error('Ошибка при получении отклоненных грузов:', error);
    throw error;
  }
}

/**
 * Восстанавливает отклоненный груз обратно в очередь на публикацию.
 * @param atiLoadId ID груза ATI (GUID).
 */
export async function restoreRejectedLoad(atiLoadId: string): Promise<void> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return;
  }
  try {
    // Получаем груз из отклоненных
    const row = await db.get<{ load_data: string }>(
      'SELECT load_data FROM rejected_loads WHERE ati_load_id = ?',
      atiLoadId
    );
    
    if (!row) {
      throw new Error(`Груз с ID ${atiLoadId} не найден в отклоненных.`);
    }
    
    const load = JSON.parse(row.load_data);
    
    // Добавляем обратно в очередь
    await addPendingLoad(load);
    
    // Удаляем из отклоненных
    await db.run('DELETE FROM rejected_loads WHERE ati_load_id = ?', atiLoadId);
    
    console.log(`♻️ Груз с ID ${atiLoadId} восстановлен в очередь.`);
  } catch (error) {
    console.error(`Ошибка при восстановлении груза ${atiLoadId}:`, error);
    throw error;
  }
}

/**
 * Получает несколько грузов, ожидающих публикации, по их ID.
 * @param atiLoadIds Массив ID грузов ATI (GUID).
 * @returns {Promise<any[]>} Массив объектов грузов.
 */
export async function getPendingLoadsByIds(atiLoadIds: string[]): Promise<any[]> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return [];
  }
  if (atiLoadIds.length === 0) {
    return [];
  }

  try {
    const placeholders = atiLoadIds.map(() => '?').join(',');
    const rows = await db.all<{ load_data: string }[]>(
      `SELECT load_data FROM pending_loads WHERE ati_load_id IN (${placeholders})`,
      ...atiLoadIds
    );
    return rows.map(row => JSON.parse(row.load_data));
  } catch (error) {
    console.error(`Ошибка при получении грузов из очереди по IDs:`, error);
    return [];
  }
}

/**
 * Удаляет несколько грузов из списка ожидания.
 * @param atiLoadIds Массив ID грузов ATI (GUID).
 */
export async function removePendingLoads(atiLoadIds: string[]): Promise<void> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return;
  }
  if (atiLoadIds.length === 0) {
    return;
  }

  try {
    await db.exec('BEGIN TRANSACTION');
    const stmt = await db.prepare('DELETE FROM pending_loads WHERE ati_load_id = ?');
    for (const atiLoadId of atiLoadIds) {
      await stmt.run(atiLoadId);
    }
    await stmt.finalize();
    await db.exec('COMMIT');
    console.log(`🗑️ Удалено ${atiLoadIds.length} грузов из очереди.`);
  } catch (error) {
    await db.exec('ROLLBACK');
    console.error(`Ошибка при массовом удалении грузов из очереди:`, error);
    throw error;
  }
}

/**
 * Добавляет несколько грузов в список отклоненных.
 * @param loads Массив объектов грузов.
 */
export async function addRejectedLoads(loads: any[]): Promise<void> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return;
  }
  if (loads.length === 0) {
    return;
  }

  try {
    await db.exec('BEGIN TRANSACTION');
    const stmt = await db.prepare('INSERT OR IGNORE INTO rejected_loads (ati_load_id, load_data) VALUES (?, ?)');
    for (const load of loads) {
      await stmt.run(load.Id, JSON.stringify(load));
    }
    await stmt.finalize();
    await db.exec('COMMIT');
    console.log(`🚫 Добавлено ${loads.length} грузов в список отклоненных.`);
  } catch (error) {
    await db.exec('ROLLBACK');
    console.error(`Ошибка при массовом добавлении грузов в отклоненные:`, error);
    throw error;
  }
}

/**
 * Отмечает несколько грузов как опубликованные.
 * @param atiLoadIds Массив ID грузов ATI (GUID).
 */
export async function markLoadsAsPublished(atiLoadIds: string[]): Promise<void> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return;
  }
  if (atiLoadIds.length === 0) {
    return;
  }

  try {
    await db.exec('BEGIN TRANSACTION');
    const stmt = await db.prepare('INSERT OR IGNORE INTO published_loads (ati_load_id) VALUES (?)');
    for (const atiLoadId of atiLoadIds) {
      await stmt.run(atiLoadId);
    }
    await stmt.finalize();
    await db.exec('COMMIT');
    console.log(`✅ Отмечено ${atiLoadIds.length} грузов как опубликованные.`);
  } catch (error) {
    await db.exec('ROLLBACK');
    console.error(`Ошибка при массовой отметке грузов как опубликованных:`, error);
    throw error;
  }
}

/**
 * Удаляет груз из списка отклоненных навсегда.
 * @param atiLoadId ID груза ATI (GUID).
 */
export async function deleteRejectedLoad(atiLoadId: string): Promise<void> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return;
  }
  try {
    await db.run('DELETE FROM rejected_loads WHERE ati_load_id = ?', atiLoadId);
    console.log(`🗑️ Груз с ID ${atiLoadId} удален из отклоненных навсегда.`);
  } catch (error) {
    console.error(`Ошибка при удалении груза ${atiLoadId} из отклоненных:`, error);
  }
}

/**
 * Удаляет несколько грузов из списка отклоненных навсегда.
 * @param atiLoadIds Массив ID грузов ATI (GUID).
 */
export async function deleteRejectedLoads(atiLoadIds: string[]): Promise<void> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return;
  }
  if (atiLoadIds.length === 0) {
    return;
  }

  try {
    const placeholders = atiLoadIds.map(() => '?').join(',');
    await db.run(`DELETE FROM rejected_loads WHERE ati_load_id IN (${placeholders})`, ...atiLoadIds);
    console.log(`🗑️ Удалено ${atiLoadIds.length} грузов из отклоненных навсегда.`);
  } catch (error) {
    console.error(`Ошибка при массовом удалении грузов из отклоненных:`, error);
    throw error;
  }
}
