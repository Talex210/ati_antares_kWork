// src/index.ts

import express from 'express';
import dotenv from 'dotenv';
import { initializeDatabase } from './database.js';
import bot, { pollLoads } from './bot.js';
import { createApiRouter } from './api/router.js';

// Загружаем переменные окружения
dotenv.config();

const PORT = process.env.PORT || 3000;
const POLLING_INTERVAL = 5 * 60 * 1000; // 5 минут

async function startApp() {
  try {
    console.log('1. Инициализация базы данных...');
    await initializeDatabase();
    console.log('✅ База данных успешно инициализирована.');

    const app = express();

    // Подключаем роутер API, передавая ему экземпляр бота
    const apiRouter = createApiRouter(bot);
    app.use('/api', apiRouter);

    // Запускаем Express-сервер
    app.listen(PORT, () => {
      console.log(`✅ Сервер запущен и слушает порт ${PORT}`);
    });

    // Запускаем поллинг Telegram
    bot.startPolling();
    console.log('✅ Бот успешно запущен и слушает обновления...');

    // Запускаем поллинг API ATI.SU
    pollLoads();
    setInterval(pollLoads, POLLING_INTERVAL);

    console.log('🚀 Приложение полностью запущено в рабочем режиме.');

  } catch (error) {
    console.error('❌ Не удалось запустить приложение:', error);
    process.exit(1);
  }
}

startApp();
