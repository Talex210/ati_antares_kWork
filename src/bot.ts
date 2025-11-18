// src/bot.ts

import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

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

export default bot;
