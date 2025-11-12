// migrate_database.js
// Скрипт для миграции базы данных (пересоздание таблиц с новой структурой)

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve(process.cwd(), 'database.db');

async function migrateDatabase() {
  console.log('🔄 Начало миграции базы данных...');
  
  // Создаем резервную копию старой базы
  if (fs.existsSync(dbPath)) {
    const backupPath = path.resolve(process.cwd(), `database_backup_${Date.now()}.db`);
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ Создана резервная копия: ${backupPath}`);
    
    // Удаляем старую базу
    fs.unlinkSync(dbPath);
    console.log('🗑️ Старая база данных удалена.');
  }
  
  // Создаем новую базу с правильной структурой
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
  
  console.log('📦 Создание новых таблиц...');
  
  // Таблица для белого списка логистов
  await db.exec(`
    CREATE TABLE IF NOT EXISTS whitelisted_logisticians (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ati_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Таблица "whitelisted_logisticians" создана.');
  
  // Таблица для опубликованных грузов (с TEXT вместо INTEGER)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS published_loads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ati_load_id TEXT NOT NULL UNIQUE,
      published_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Таблица "published_loads" создана.');
  
  // Таблица для грузов в очереди (с TEXT вместо INTEGER)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS pending_loads (
      ati_load_id TEXT PRIMARY KEY,
      load_data TEXT NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Таблица "pending_loads" создана.');
  
  await db.close();
  console.log('🎉 Миграция завершена успешно!');
}

migrateDatabase().catch(error => {
  console.error('❌ Ошибка при миграции:', error);
  process.exit(1);
});
