// src/ati_api.ts

import axios from 'axios';
import * as dotenv from 'dotenv';
import { Load } from './core/types.js';

// Загружаем переменные окружения из .env файла
dotenv.config();

const ATI_API_BASE_URL = 'https://api.ati.su';
const API_TOKEN = process.env.ATI_API_TOKEN;

/**
 * Интерфейс для контакта из ATI API
 */
export interface AtiContact {
  id: number;
  name: string | null;
  phone: string | null;
  mobile: string | null;
  e_mail: string | null;
  note: string | null;
  skype_name: string | null;
  is_visible: boolean;
}

// Кэш контактов для избежания повторных запросов
let contactsCache: AtiContact[] | null = null;
let contactsCacheTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

/**
 * Получает список всех контактов фирмы из ATI.SU API.
 * @returns {Promise<AtiContact[]>} Список контактов.
 */
export async function getContacts(): Promise<AtiContact[]> {
  // Проверяем кэш
  const now = Date.now();
  if (contactsCache && (now - contactsCacheTime) < CACHE_TTL) {
    console.log('📋 Используем кэшированные контакты');
    return contactsCache;
  }

  if (!API_TOKEN) {
    throw new Error('ATI_API_TOKEN должен быть определен в .env файле.');
  }

  try {
    console.log('🔄 Запрос к ATI API: GET /v1.0/firms/contacts');
    
    const response = await axios.get(`${ATI_API_BASE_URL}/v1.0/firms/contacts`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const contacts: AtiContact[] = response.data || [];
    
    // Обновляем кэш
    contactsCache = contacts;
    contactsCacheTime = now;
    
    console.log(`✅ Получено контактов от ATI API: ${contacts.length}`);
    
    return contacts;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ Ошибка при запросе контактов к ATI.SU API:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      
      if (error.response?.status === 401) {
        throw new Error('Не удалось авторизоваться в ATI.SU API. Проверьте правильность вашего ATI_API_TOKEN.');
      }
    } else {
      console.error('❌ Произошла неизвестная ошибка при получении контактов:', error);
    }
    
    throw new Error('Не удалось получить контакты из ATI.SU.');
  }
}

/**
 * Получает информацию о контакте по его ID.
 * @param contactId ID контакта
 * @returns {Promise<AtiContact | null>} Информация о контакте или null
 */
export async function getContactById(contactId: number): Promise<AtiContact | null> {
  try {
    const contacts = await getContacts();
    return contacts.find(c => c.id === contactId) || null;
  } catch (error) {
    console.error(`❌ Ошибка при получении контакта ${contactId}:`, error);
    return null;
  }
}

/**
 * Получает список опубликованных грузов из ATI.SU API.
 * Использует endpoint /v1.0/loads для получения всех грузов фирмы.
 * @returns {Promise<Load[]>} Список грузов.
 */
export async function getPublishedLoads(): Promise<Load[]> {
  // Проверяем, что токен был предоставлен в .env файле
  if (!API_TOKEN) {
    throw new Error('ATI_API_TOKEN должен быть определен в .env файле.');
  }

  try {
    console.log('🔄 Запрос к ATI API: GET /v1.0/loads');
    
    const response = await axios.get(`${ATI_API_BASE_URL}/v1.0/loads`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const loads: Load[] = response.data || [];
    
    console.log(`✅ Получено грузов от ATI API: ${loads.length}`);
    
    // Логируем структуру первого груза для отладки (если есть)
    if (loads.length > 0) {
      console.log('📦 Пример структуры первого груза:');
      console.log(JSON.stringify(loads[0], null, 2));
    }
    
    return loads;
  } catch (error) {
    // Если axios выдает ошибку, она будет более информативной
    if (axios.isAxiosError(error)) {
      console.error('❌ Ошибка при запросе к ATI.SU API:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      
      if (error.response?.status === 401) {
        throw new Error('Не удалось авторизоваться в ATI.SU API. Проверьте правильность вашего ATI_API_TOKEN.');
      }
      
      if (error.response?.status === 429) {
        throw new Error('Превышен лимит запросов к ATI API (429 Too Many Requests). Попробуйте позже.');
      }
    } else {
      // Для других типов ошибок
      console.error('❌ Произошла неизвестная ошибка при получении грузов:', error);
    }
    
    // Пробрасываем ошибку выше
    throw new Error('Не удалось получить грузы из ATI.SU.');
  }
}
