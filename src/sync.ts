// src/sync.ts

import { initializeDatabase, isLoadProcessed, addPendingLoad, getWhitelistedLogisticiansIds, db } from './database.js';
import { getPublishedLoads } from './ati_api.js';

/**
 * Основная функция для синхронизации грузов.
 * 1. Получает грузы из ATI.SU API.
 * 2. Фильтрует их по белому списку логистов.
 * 3. Проверяет, не были ли они обработаны ранее.
 * 4. Добавляет новые грузы в очередь на публикацию.
 */
async function synchronizeLoads() {
  console.log('🚀 Начало синхронизации грузов с ATI.SU...');

  try {
    // 1. Инициализация базы данных
    await initializeDatabase();

    // 2. Получаем ID логистов из белого списка
    const whitelistedIds = await getWhitelistedLogisticiansIds();
    if (whitelistedIds.length === 0) {
      console.warn('⚠️ В белом списке нет ни одного логиста. Новые грузы не будут добавлены.');
    }
    console.log(`📋 В белом списке найдено логистов: ${whitelistedIds.length}`);

    // 3. Получаем опубликованные грузы из ATI.SU
    const atiLoads = await getPublishedLoads();
    if (atiLoads.length === 0) {
      console.log('ℹ️ В ATI.SU нет опубликованных грузов для обработки.');
      return;
    }
    console.log(`📥 Получено грузов из ATI.SU: ${atiLoads.length}`);

    let newLoadsCount = 0;

    // 4. Обрабатываем каждый груз
    for (const load of atiLoads) {
      if (!load.ContactId1) {
        console.warn(`- Пропускаем груз с ID ${load.Id}, так как отсутствует ContactId1.`);
        continue;
      }

      // Проверяем, есть ли ContactId1 или ContactId2 в белом списке
      const isWhitelisted = whitelistedIds.length === 0 || 
        whitelistedIds.includes(load.ContactId1) ||
        (load.ContactId2 && whitelistedIds.includes(load.ContactId2));

      if (!isWhitelisted) {
        continue;
      }

      const processed = await isLoadProcessed(load.Id);
      if (processed) {
        continue;
      }

      await addPendingLoad(load);
      newLoadsCount++;
    }

    if (newLoadsCount > 0) {
      console.log(`✅ Успешно добавлено новых грузов в очередь: ${newLoadsCount}`);
    } else {
      console.log('ℹ️ Новых грузов для добавления не найдено.');
    }

  } catch (error) {
    console.error('❌ Произошла критическая ошибка во время синхронизации:');
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
        console.log('🔌 Соединение с базой данных закрыто.');
      } catch (closeError) {
        console.error('❌ Ошибка при закрытии соединения с БД:', closeError);
      }
    }
    console.log('🏁 Синхронизация завершена.');
  }
}

// Запускаем синхронизацию и ловим любые ошибки на верхнем уровне
synchronizeLoads().catch(topLevelError => {
    console.error('🔥🔥🔥 Обнаружена неперехваченная ошибка верхнего уровня:', topLevelError);
    process.exit(1); // Выходим с кодом ошибки
});
