// src/index.ts

import { initializeDatabase } from './database.js';
import './bot.js'; // Импортируем и запускаем логику бота

async function startApp() {
  try {
    await initializeDatabase();
    console.log('🚀 Основное приложение запущено...');
  } catch (error) {
    console.error('Не удалось запустить приложение:', error);
    process.exit(1);
  }
}

startApp();
