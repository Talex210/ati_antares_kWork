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
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Таблица "whitelisted_logisticians" готова.');

  // Создаем таблицу для истории опубликованных грузов
  await db.exec(`
    CREATE TABLE IF NOT EXISTS published_loads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ati_load_id INTEGER NOT NULL UNIQUE,
      published_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Таблица "published_loads" готова.');

  // Создаем таблицу для грузов, ожидающих публикации
  await db.exec(`
    CREATE TABLE IF NOT EXISTS pending_loads (
      ati_load_id INTEGER PRIMARY KEY,
      load_data TEXT NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Таблица "pending_loads" готова.');


  // Пример добавления логиста в белый список (для теста, можно закомментировать)
  // В реальном приложении это будет делаться через админ-панель.
  try {
    await db.run(
      'INSERT INTO whitelisted_logisticians (ati_id, name) VALUES (?, ?)',
      1123, // ID Анны Петровой из mock-данных
      'Анна Петрова'
    );
    console.log('Тестовый логист "Анна Петрова" добавлен в белый список.');
  } catch (error) {
    // Игнорируем ошибку, если логист уже существует (UNIQUE constraint failed)
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        console.log('Тестовый логист "Анна Петрова" уже в белом списке.');
    } else {
        console.error('Ошибка при добавлении тестового логиста:', error);
    }
  }

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
  added_at: string;
}


/**
 * Получает полный список логистов из белого списка.
 * @returns {Promise<WhitelistedLogistician[]>} Массив объектов логистов.
 */
export async function getWhitelistedLogisticians(): Promise<WhitelistedLogistician[]> {
  if (!db) {
    console.error('База данных не инициализирована.');
    return [];
  }
  try {
    const logisticians = await db.all<WhitelistedLogistician[]>(
      'SELECT id, ati_id, name, added_at FROM whitelisted_logisticians ORDER BY added_at DESC'
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
 */
export async function addWhitelistedLogistician(atiId: number, name: string): Promise<void> {
  if (!db) {
    throw new Error('База данных не инициализирована.');
  }
  try {
    await db.run(
      'INSERT INTO whitelisted_logisticians (ati_id, name) VALUES (?, ?)',
      atiId,
      name
    );
    console.log(`Логист "${name}" (ATI ID: ${atiId}) добавлен в белый список.`);
  } catch (error) {
    console.error(`Ошибка при добавлении логиста ${name}:`, error);
    throw error; // Пробрасываем ошибку выше для обработки в API
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
 * @param atiLoadId ID груза ATI.
 * @returns {Promise<boolean>} true, если груз был обработан, иначе false.
 */
export async function isLoadProcessed(atiLoadId: number): Promise<boolean> {
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
 * @param atiLoadId ID груза ATI.
 */
export async function markLoadAsPublished(atiLoadId: number): Promise<void> {
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
      load.id,
      JSON.stringify(load)
    );
    console.log(`📥 Груз с ID ${load.id} добавлен в очередь на публикацию.`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      // Груз уже в очереди, это не ошибка.
    } else {
      console.error(`Ошибка при добавлении груза ${load.id} в очередь:`, error);
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
    const rows = await db.all<{ load_data: string }[]>(
      'SELECT load_data FROM pending_loads ORDER BY added_at ASC'
    );
    return rows.map(row => JSON.parse(row.load_data));
  } catch (error) {
    console.error('Ошибка при получении грузов из очереди:', error);
    return [];
  }
}

/**
 * Удаляет груз из списка ожидания.
 * @param atiLoadId ID груза ATI.
 */
export async function removePendingLoad(atiLoadId: number): Promise<void> {
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
