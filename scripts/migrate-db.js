// scripts/migrate-db.js
// Скрипт для миграции базы данных - добавление колонок phone и telegram

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'database.db');

async function migrateDatabase() {
    let db;
    try {
        console.log('🔄 Подключение к базе данных...');
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
        });

        console.log('🔄 Проверка структуры таблицы...');
        
        // Проверяем существование колонок
        const tableInfo = await db.all('PRAGMA table_info(whitelisted_logisticians)');
        const hasPhone = tableInfo.some(col => col.name === 'phone');
        const hasTelegram = tableInfo.some(col => col.name === 'telegram');

        if (!hasPhone) {
            console.log('➕ Добавление колонки phone...');
            await db.exec('ALTER TABLE whitelisted_logisticians ADD COLUMN phone TEXT');
            console.log('✅ Колонка phone добавлена');
        } else {
            console.log('✓ Колонка phone уже существует');
        }

        if (!hasTelegram) {
            console.log('➕ Добавление колонки telegram...');
            await db.exec('ALTER TABLE whitelisted_logisticians ADD COLUMN telegram TEXT');
            console.log('✅ Колонка telegram добавлена');
        } else {
            console.log('✓ Колонка telegram уже существует');
        }

        console.log('\n🎉 Миграция завершена успешно!');

    } catch (error) {
        console.error('❌ Ошибка при миграции:', error.message);
        process.exit(1);
    } finally {
        if (db) {
            await db.close();
            console.log('🔒 Соединение с БД закрыто.');
        }
    }
}

migrateDatabase();
