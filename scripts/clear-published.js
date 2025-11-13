// scripts/clear-published.js

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'database.db');

async function clearPublishedLoads() {
  let db;
  try {
    console.log('🔄 Подключение к базе данных...');
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    console.log('🗑️  Очистка таблицы published_loads...');
    const result = await db.run('DELETE FROM published_loads');
    
    console.log(`✅ Успешно удалено записей: ${result.changes || 0}`);
    console.log('🎉 Таблица published_loads очищена!');
  } catch (error) {
    console.error('❌ Ошибка при очистке таблицы:', error);
    process.exit(1);
  } finally {
    if (db) {
      await db.close();
      console.log('🔒 Соединение с БД закрыто.');
    }
  }
}

clearPublishedLoads();
