// src/sync.ts

import { initializeDatabase, db } from './database.js';
import { runFullSync } from './synchronizer.js';

/**
 * Запускает полную синхронизацию и закрывает соединение с БД.
 * Этот скрипт предназначен для запуска по расписанию (например, через cron).
 */
async function runScheduledSync() {
  try {
    await initializeDatabase();
    await runFullSync();
  } catch (error) {
    console.error('❌ Произошла критическая ошибка во время плановой синхронизации:');
    if (error instanceof Error) {
        console.error('Сообщение:', error.message);
        if(error.stack) {
            console.error('Стек:', error.stack);
        }
    } else {
        console.error('Необработанная ошибка:', error);
    }
  } finally {
    if (db) {
      try {
        await db.close();
        console.log('🔌 Соединение с базой данных закрыто после плановой синхронизации.');
      } catch (closeError) {
        console.error('❌ Ошибка при закрытии соединения с БД:', closeError);
      }
    }
  }
}

// Запускаем синхронизацию
runScheduledSync().catch(topLevelError => {
    console.error('🔥🔥🔥 Обнаружена неперехваченная ошибка верхнего уровня в runScheduledSync:', topLevelError);
    process.exit(1);
});

