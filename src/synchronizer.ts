// src/synchronizer.ts

import {
  initializeDatabase, isLoadProcessed, addPendingLoad,
  getWhitelistedLogisticiansIds, db, getPendingLoads, removePendingLoads
} from './database.js';
import { getPublishedLoads } from './ati_api.js';

/**
 * Выполняет полную синхронизацию грузов:
 * 1. Получает грузы из ATI.SU API.
 * 2. Удаляет из локальной БД грузы, которых больше нет в ATI.
 * 3. Добавляет новые грузы в очередь на публикацию.
 */
export async function runFullSync() {
  console.log('🚀 Запущена полная синхронизация грузов...');

  // Убедимся, что БД инициализирована
  if (!db) {
    await initializeDatabase();
  }

  // 1. Получаем ID логистов из белого списка
  const whitelistedIds = await getWhitelistedLogisticiansIds();
  if (whitelistedIds.length === 0) {
    console.warn('⚠️ В белом списке нет ни одного логиста. Синхронизация не будет выполнена.');
    // Также очистим все ожидающие грузы, так как нет валидных логистов
    const allPendingLoads = await getPendingLoads();
    const allPendingLoadIds = allPendingLoads.map(l => l.Id);
    if (allPendingLoadIds.length > 0) {
        await removePendingLoads(allPendingLoadIds);
        console.log(`🗑️ Очищена очередь ожидания, так как белый список пуст. Удалено: ${allPendingLoadIds.length}`);
    }
    return;
  }
  console.log(`📋 В белом списке найдено логистов: ${whitelistedIds.length}`);

  // 2. Получаем опубликованные грузы из ATI.SU
  const atiLoads = await getPublishedLoads();
  console.log(`📥 Получено грузов из ATI.SU: ${atiLoads.length}`);

  // 3. Удаляем из БД грузы, которых больше нет в ATI
  const pendingLoads = await getPendingLoads();
  const atiLoadIds = new Set(atiLoads.map(load => load.Id));
  const loadsToRemove = pendingLoads
    .filter(pLoad => !atiLoadIds.has(pLoad.Id))
    .map(l => l.Id);

  if (loadsToRemove.length > 0) {
    await removePendingLoads(loadsToRemove);
    console.log(`🗑️ Удалено ${loadsToRemove.length} устаревших грузов из очереди.`);
  } else {
    console.log('ℹ️ Устаревших грузов для удаления не найдено.');
  }

  if (atiLoads.length === 0) {
    console.log('ℹ️ В ATI.SU нет опубликованных грузов для обработки. Очередь очищена.');
    return;
  }

  let newLoadsCount = 0;

  // 4. Обрабатываем каждый груз от ATI и добавляем новые
  for (const load of atiLoads) {
    if (!load.ContactId1) {
      console.warn(`- Пропускаем груз с ID ${load.Id}, так как отсутствует ContactId1.`);
      continue;
    }

    // Проверяем, есть ли ContactId1 или ContactId2 в белом списке
    const isWhitelisted = whitelistedIds.includes(load.ContactId1) ||
      (load.ContactId2 && whitelistedIds.includes(load.ContactId2));

    if (!isWhitelisted) {
      continue; // Пропускаем груз, если логист не в белом списке
    }

    const processed = await isLoadProcessed(load.Id);
    if (processed) {
      continue; // Пропускаем уже обработанный груз
    }

    await addPendingLoad(load);
    newLoadsCount++;
  }

  if (newLoadsCount > 0) {
    console.log(`✅ Успешно добавлено новых грузов в очередь: ${newLoadsCount}`);
  } else {
    console.log('ℹ️ Новых грузов для добавления не найдено.');
  }
  
  console.log('🏁 Полная синхронизация грузов завершена.');
}
