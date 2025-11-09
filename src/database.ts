// src/database.ts

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

// Обеспечиваем, чтобы путь к БД был корректным вне зависимости от того, откуда запускается скрипт
const dbPath = path.resolve(process.cwd(), 'database.db');

/**
 * Инициализирует базу данных и создает необходимые таблицы, если они не существуют.
 */
export async function initializeDatabase() {
  // Упрощаем инициализацию драйвера, чтобы избежать потенциальных проблем с .verbose()
  const db = await open({
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
