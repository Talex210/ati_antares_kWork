import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001'; // Используем переменную окружения или mock-сервер по умолчанию

/**
 * Сервис для взаимодействия с API ATI.SU.
 * В режиме разработки использует mock-сервер.
 */
export const AtiApiService = {
  /**
   * Получает опубликованные загрузки.
   * @returns {Promise<any>} Данные о загрузках.
   */
  async getPublishedLoads() {
    try {
      const response = await axios.get(`${API_BASE_URL}/v1.0/loads/published`);
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении данных из API:', error);
      throw error;
    }
  },
};
