// src/index.ts
console.log('1. Запуск src/index.ts...');

import { initializeDatabase } from './database.js';
console.log('2. Успешно импортирован initializeDatabase.');

import './bot.js'; // Импортируем и запускаем логику бота
console.log('3. Успешно импортирован bot.js.');

async function startApp() {
  try {
    console.log('4. Вызов initializeDatabase()...');
    await initializeDatabase();
    console.log('5. База данных успешно инициализирована.');
    console.log('🚀 Основное приложение запущено...');
  } catch (error) {
    console.error('❌ Не удалось запустить приложение:', error);
    process.exit(1);
  }
}

startApp();
