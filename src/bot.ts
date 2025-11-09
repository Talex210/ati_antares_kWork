// src/bot.ts

import dotenv = require('dotenv');
import TelegramBot = require('node-telegram-bot-api');

// Загружаем переменные окружения из .env файла
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('Ошибка: Токен Telegram-бота не найден. Проверьте ваш .env файл.');
  process.exit(1);
}

// Создаем экземпляр бота
const bot = new TelegramBot(token, { polling: true });

console.log('✅ Бот успешно запущен и начал слушать обновления...');

// Тестовый обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Привет! Я бот для публикации грузов с ATI.SU. Я готов к работе!');
});

// Обработка ошибок поллинга
bot.on('polling_error', (error) => {
    console.error(`[Polling Error]: ${error.message}`);
});

export = bot;
