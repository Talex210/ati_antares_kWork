// src/bot.ts

import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { AtiApiService } from './api.js';
import {
  addPendingLoad,
  getWhitelistedLogisticiansIds,
  isLoadProcessed,
} from './database.js';

// Загружаем переменные окружения из .env файла
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const POLLING_INTERVAL = 5 * 60 * 1000; // 5 минут в миллисекундах

if (!token) {
  console.error(
    'Ошибка: Токен Telegram-бота не найден. Проверьте ваш .env файл.',
  );
  process.exit(1);
}

// --- Типы данных ---

/**
 * Описывает структуру объекта груза, получаемого от API.
 */
export interface Load {
  id: number;
  title: string;
  creator: {
    id: number;
    name: string;
    phone: string;
  };
  datePublished: string;
  price: number;
  cargoType: string;
  weight: number;
  volume: number;
  route: { from: string; to: string };
}

// --- Форматирование сообщения ---

/**
 * Форматирует данные о грузе в сообщение для Telegram.
 * @param load - Объект с данными о грузе.
 * @returns Отформатированная строка в Markdown.
 */
export const formatLoadMessage = (load: Load): string => {
  const message = [
    `📍 *Маршрут:* ${load.route.from} → ${load.route.to}`,
    `🚚 *Тип транспорта:* ${load.cargoType}`,
    `📦 *Груз:* ${load.weight} т, ${load.volume} м³`,
    `💰 *Ставка:* ${load.price} ₽`,
    `👤 *Контакт:* ${load.creator.name}`,
    `📞 *Телефон:* ${load.creator.phone}`,
  ].join('\n');

  return message;
};

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
      whitelistedLogisticiansIds.includes(load.creator.id),
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
      const alreadyProcessed = await isLoadProcessed(load.id);
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
  bot.sendMessage(
    chatId,
    'Привет! Я бот для публикации грузов с ATI.SU. Я готов к работе!',
  );
});

// Обработка ошибок поллинга
bot.on('polling_error', (error) => {
  console.error(`[Polling Error]: ${error.message}`);
});

export default bot;
