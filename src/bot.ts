// src/bot.ts

import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { AtiApiService } from './api.js';
import { getWhitelistedLogisticians } from './database.js'; // Импортируем функцию для получения белого списка

// Загружаем переменные окружения из .env файла
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const POLLING_INTERVAL = 5 * 60 * 1000; // 5 минут в миллисекундах

if (!token) {
  console.error('Ошибка: Токен Telegram-бота не найден. Проверьте ваш .env файл.');
  process.exit(1);
}

// Создаем экземпляр бота
const bot = new TelegramBot(token, { polling: true });

console.log('✅ Бот успешно запущен и начал слушать обновления...');

// --- Логика опроса API ATI.SU ---

/**
 * Основная функция для опроса API, получения и обработки загрузок.
 */
const pollLoads = async () => {
  console.log('🔍 Опрашиваем API на предмет новых загрузок...');
  try {
    const loads = await AtiApiService.getPublishedLoads();
    
    if (loads && loads.length > 0) {
      console.log(`🚚 Найдено ${loads.length} новых загрузок.`);

      const whitelistedLogisticians = await getWhitelistedLogisticians();
      console.log(`📋 Логисты в белом списке: ${whitelistedLogisticians.join(', ')}`);

      const filteredLoads = loads.filter((load: any) => 
        whitelistedLogisticians.includes(load.logistId) // Предполагаем, что у груза есть поле logistId
      );

      if (filteredLoads.length > 0) {
        console.log(`✅ Найдено ${filteredLoads.length} грузов от логистов из белого списка.`);
        // TODO: Добавить логику публикации в Telegram
        console.log(filteredLoads);
      } else {
        console.log('❌ Грузов от логистов из белого списка не найдено.');
      }
    } else {
      console.log(' новых загрузок не найдено.');
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Ошибка при опросе API:', error.message);
    } else {
      console.error('❌ Неизвестная ошибка при опросе API:', error);
    }
  }
};

// --- Инициализация и запуск ---

// Запускаем первый опрос сразу после старта
pollLoads();

// Устанавливаем интервал для последующих опросов
setInterval(pollLoads, POLLING_INTERVAL);


// Тестовый обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Привет! Я бот для публикации грузов с ATI.SU. Я готов к работе!');
});

// Обработка ошибок поллинга
bot.on('polling_error', (error) => {
    console.error(`[Polling Error]: ${error.message}`);
});

export default bot;
