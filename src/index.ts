// src/index.ts

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url'; // Импортируем новую зависимость
import { initializeDatabase } from './database.js';
import bot, { pollLoads } from './bot.js';
import { createApiRouter } from './api/router.js';

// Загружаем переменные окружения
dotenv.config();

// Более надежное определение пути
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const POLLING_INTERVAL = 5 * 60 * 1000; // 5 минут

async function startApp() {
  try {
    console.log('1. Инициализация базы данных...');
    await initializeDatabase();
    console.log('✅ База данных успешно инициализирована.');

    const app = express();

    // Раздача статических файлов из папки 'public'
    // Путь строится от текущего файла, а не от места запуска
    app.use(express.static(path.join(__dirname, '..', 'public')));

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
