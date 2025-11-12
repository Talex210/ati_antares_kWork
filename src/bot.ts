// src/bot.ts

import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { AtiApiService } from './api.js';
import {
  addPendingLoad,
  getWhitelistedLogisticiansIds,
  isLoadProcessed,
  cleanupPendingLoads,
} from './database.js';
import { Load } from './core/types.js';

// Загружаем переменные окружения из .env файла
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error('Ошибка: Токен Telegram-бота не найден. Проверьте ваш .env файл.');
}

// --- Инициализация бота ---

// Создаем экземпляр бота, но без polling, так как он будет запускаться из index.ts
const bot = new TelegramBot(token);

// Универсальный обработчик для логирования chat_id
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  // Логируем ID, чтобы его можно было легко найти
  console.log(`>>> Message received in chat ID: ${chatId}`);
});

// Тестовый обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  console.log(`Received /start command in chat ID: ${chatId}`);
  bot.sendMessage(
    chatId,
    'Привет! Я бот для публикации грузов с ATI.SU. Я готов к работе!',
  );
});

// Обработка ошибок поллинга
bot.on('polling_error', (error) => {
  console.error(`[Polling Error]: ${error.message}`);
});

/**
 * Удаляет сообщение в указанном чате.
 * @param chatId ID чата.
 * @param messageId ID сообщения.
 */
export const deleteTelegramMessage = async (
  chatId: number | string,
  messageId: number,
): Promise<boolean> => {
  try {
    await bot.deleteMessage(chatId, messageId);
    console.log(`✅ Сообщение ${messageId} в чате ${chatId} успешно удалено.`);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        `❌ Ошибка при удалении сообщения ${messageId} в чате ${chatId}:`,
        error.message,
      );
    } else {
      console.error(
        `❌ Неизвестная ошибка при удалении сообщения ${messageId} в чате ${chatId}:`,
        error,
      );
    }
    return false;
  }
};

// --- Логика опроса API ATI.SU ---

/**
 * Основная функция для опроса API, получения и обработки загрузок.
 */
export const pollLoads = async () => {
  console.log('🔍 Опрашиваем API на предмет новых загрузок...');
  try {
    // Сначала очищаем очередь от грузов, которые больше не соответствуют белому списку
    await cleanupPendingLoads();
    
    const loads: Load[] = await AtiApiService.getPublishedLoads();

    if (!loads || loads.length === 0) {
      console.log('ℹ️ Новых загрузок не найдено.');
      return;
    }

    console.log(`🚚 Найдено ${loads.length} активных загрузок.`);

    const whitelistedLogisticiansIds = await getWhitelistedLogisticiansIds();
    if (whitelistedLogisticiansIds.length === 0) {
      console.log('⚠️ Белый список логистов пуст. Пропускаем обработку.');
      return;
    }
    console.log(
      `📋 ID логистов в белом списке: ${whitelistedLogisticiansIds.join(', ')}`,
    );

    const filteredLoads = loads.filter((load: Load) =>
      whitelistedLogisticiansIds.includes(load.ContactId1) ||
      (load.ContactId2 && whitelistedLogisticiansIds.includes(load.ContactId2)),
    );

    if (filteredLoads.length === 0) {
      console.log('❌ Грузов от логистов из белого списка не найдено.');
      return;
    }

    console.log(
      `✅ Найдено ${filteredLoads.length} грузов от логистов из белого списка.`,
    );

    let newLoadsFound = 0;
    for (const load of filteredLoads) {
      // Используем Id (GUID) как уникальный идентификатор
      const loadId = load.Id;
      const alreadyProcessed = await isLoadProcessed(loadId);
      if (!alreadyProcessed) {
        newLoadsFound++;
        // Вместо немедленной публикации, добавляем груз в очередь на модерацию
        await addPendingLoad(load);
      }
    }

    if (newLoadsFound === 0) {
      console.log(
        'ℹ️ Новых, еще не обработанных, грузов среди найденных нет.',
      );
    } else {
      console.log(`✨ Добавлено ${newLoadsFound} новых грузов в очередь на публикацию.`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Ошибка при опросе API:', error.message);
    } else {
      console.error('❌ Неизвестная ошибка при опросе API:', error);
    }
  }
};

export default bot;
