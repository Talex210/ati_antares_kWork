// scripts/update-telegram.js
// Скрипт для обновления Telegram у существующих логистов

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const dbPath = path.resolve(process.cwd(), 'database.db');
const ATI_API_BASE_URL = 'https://api.ati.su';
const API_TOKEN = process.env.ATI_API_TOKEN;

// Список логистов с телефонами и Telegram
const logisticians = [
    { phone: '+7 (987) 2135280', telegram: '@sergey_antares116' },
    { phone: '+7 (937) 5266972', telegram: '@AdeJIbka' },
    { phone: '+7 (937) 5266986', telegram: '@Opakipik' },
    { phone: '+7 (927) 0443376', telegram: '@rolldens' },
    { phone: '+7 937 613-78-86', telegram: '@Maxwelllord116' },
    { phone: '+7 (937) 0046492', telegram: '@missantares' },
    { phone: '+7 (927) 0301770', telegram: '@AntaresTK' },
    { phone: '+7 902 116-58-41', telegram: '@Almaz221085' },
    { phone: '+7 937 004-64-78', telegram: '@AlenkaAntares' },
    { phone: '+7 927 478-78-11', telegram: '@antares_gr' },
    { phone: '+7 927 406-38-24', telegram: '@Antareskzn' },
    { phone: '+7 927 244-95-16', telegram: '@antareskzn16' },
    { phone: '+7 927 243-70-24', telegram: '@AntaresMapaT' }
];

// Нормализация номера телефона (убираем все кроме цифр)
function normalizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
}

async function getContactsFromAPI() {
    if (!API_TOKEN) {
        throw new Error('ATI_API_TOKEN не найден в .env файле');
    }

    try {
        console.log('🔄 Получение контактов из ATI API...');
        const response = await axios.get(`${ATI_API_BASE_URL}/v1.0/firms/contacts`, {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });

        return response.data || [];
    } catch (error) {
        console.error('❌ Ошибка при получении контактов:', error.message);
        throw error;
    }
}

async function updateTelegramInDatabase() {
    let db;
    try {
        console.log('🔄 Подключение к базе данных...');
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
        });

        console.log('🔄 Получение контактов из ATI API...');
        const contacts = await getContactsFromAPI();
        console.log(`✅ Получено ${contacts.length} контактов`);

        let updatedCount = 0;
        let notFoundCount = 0;

        for (const logist of logisticians) {
            const normalizedPhone = normalizePhone(logist.phone);
            
            // Ищем контакт по номеру телефона
            const contact = contacts.find(c => {
                const contactPhone = normalizePhone(c.phone);
                const contactMobile = normalizePhone(c.mobile);
                return contactPhone === normalizedPhone || contactMobile === normalizedPhone;
            });

            if (contact) {
                try {
                    // Обновляем Telegram
                    const result = await db.run(
                        'UPDATE whitelisted_logisticians SET telegram = ? WHERE ati_id = ?',
                        logist.telegram,
                        contact.id
                    );
                    
                    if (result.changes > 0) {
                        console.log(`✅ Обновлен: ${contact.name} (ID: ${contact.id}, Telegram: ${logist.telegram})`);
                        updatedCount++;
                    } else {
                        console.log(`⚠️  Не найден в БД: ${contact.name} (ID: ${contact.id})`);
                    }
                } catch (error) {
                    console.error(`❌ Ошибка при обновлении ${contact.name}:`, error.message);
                }
            } else {
                console.log(`❌ Не найден контакт с телефоном: ${logist.phone}`);
                notFoundCount++;
            }
        }

        console.log('\n📊 Итоги:');
        console.log(`   ✅ Обновлено: ${updatedCount}`);
        console.log(`   ❌ Не найдено в ATI: ${notFoundCount}`);
        console.log('\n🎉 Скрипт завершен!');

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        process.exit(1);
    } finally {
        if (db) {
            await db.close();
            console.log('🔒 Соединение с БД закрыто.');
        }
    }
}

updateTelegramInDatabase();
