// scripts/clear-published.ts

import { initializeDatabase, db } from '../src/database.js';

/**
 * Скрипт для очистки таблицы published_loads.
 * Используется во время разработки и тестирования.
 */
async function clearPublishedLoads() {
  try {
    console.log('🔄 Инициализация базы данных...');
    await initializeDatabase();

    console.log('🗑️  Очистка таблицы published_loads...');
    const result = await db.run('DELETE FROM published_loads');
    
    console.log(`✅ Успешно удалено записей: ${result.changes || 0}`);
    console.log('🎉 Таблица published_loads очищена!');
  } catch (error) {
    console.error('❌ Ошибка при очистке таблицы:', error);
    process.exit(1);
  } finally {
    await db.close();
    console.log('🔒 Соединение с БД закрыто.');
  }
}

clearPublishedLoads();
