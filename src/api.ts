// src/api.ts

import { getPublishedLoads } from './ati_api.js';
import { Load } from './core/types.js';

/**
 * Сервис для взаимодействия с API ATI.SU.
 * Использует реальный ATI API через модуль ati_api.ts
 */
export const AtiApiService = {
  /**
   * Получает опубликованные загрузки из реального ATI API.
   * @returns {Promise<Load[]>} Данные о загрузках.
   */
  async getPublishedLoads(): Promise<Load[]> {
    try {
      return await getPublishedLoads();
    } catch (error) {
      console.error('❌ Ошибка при получении данных из ATI API:', error);
      throw error;
    }
  },
};
