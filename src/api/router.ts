// src/api/router.ts

import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import {
  getWhitelistedLogisticians,
  addWhitelistedLogistician,
  deleteWhitelistedLogistician,
  getPendingLoads,
  getPendingLoadById,
  removePendingLoad,
  markLoadAsPublished,
  addRejectedLoad,
  getRejectedLoads,
  restoreRejectedLoad,
  deleteRejectedLoad,
  updateLogisticianContactInfo,
  getPendingLoadsByIds,
  addRejectedLoads,
  removePendingLoads,
  markLoadsAsPublished,
  Topic, // Добавляем импорт интерфейса Topic
  addTopic, // Добавляем импорт функции addTopic
  getTopics, // Добавляем импорт функции getTopics
  updateTopic, // Добавляем импорт функции updateTopic
  deleteTopic, // Добавляем импорт функции deleteTopic
} from '../database.js';
import { formatLoadMessage } from '../core/format.js';
import { Load } from '../core/types.js';
import { deleteTelegramMessage } from '../bot.js';
import { runFullSync } from '../synchronizer.js';

// Загружаем переменные окружения
dotenv.config();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Middleware для базовой аутентификации
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!ADMIN_PASSWORD) {
    console.warn('⚠️ Пароль администратора не установлен. Доступ к API заблокирован.');
    return res.status(500).json({ error: 'Сервер настроен некорректно.' });
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${ADMIN_PASSWORD}`) {
    return res.status(401).json({ error: 'Неавторизованный доступ.' });
  }
  next();
};

export function createApiRouter(bot: TelegramBot) {
  const apiRouter = express.Router();
  
  // Применяем middleware аутентификации ко всем API-маршрутам
  apiRouter.use(authMiddleware);
  
  // Middleware для парсинга JSON-тела запросов
  apiRouter.use(express.json());

  /**
   * GET /api/logisticians
   * Получает список всех логистов из белого списка.
   */
  apiRouter.get('/logisticians', async (req: Request, res: Response) => {
    try {
      const logisticians = await getWhitelistedLogisticians();
      res.json(logisticians);
    } catch (error) {
      res.status(500).json({ error: 'Ошибка сервера при получении списка логистов.' });
    }
  });

  /**
   * POST /api/logisticians/update-contacts
   * Обновляет контактную информацию (телефон и Telegram) всех логистов из ATI API.
   */
  apiRouter.post('/logisticians/update-contacts', async (req: Request, res: Response) => {
    try {
      const { updateLogisticianContactInfo } = await import('../database.js');
      await updateLogisticianContactInfo();
      res.status(200).json({ message: 'Контактная информация обновлена.' });
    } catch (error) {
      console.error('❌ Ошибка при обновлении контактов:', error);
      res.status(500).json({ error: 'Ошибка сервера при обновлении контактов.' });
    }
  });

  /**
   * POST /api/logisticians
   * Добавляет нового логиста в белый список.
   * После добавления автоматически запускает пересканирование грузов.
   */
  apiRouter.post('/logisticians', async (req: Request, res: Response) => {
    const { ati_id, name } = req.body;
    if (!ati_id || !name || typeof ati_id !== 'number' || typeof name !== 'string') {
      return res.status(400).json({ error: 'Неверный формат данных. Ожидается { ati_id: number, name: string }.' });
    }
    try {
      await addWhitelistedLogistician(ati_id, name);
      
      // Запускаем полную синхронизацию в фоне
      runFullSync().catch(error => {
        console.error('❌ Ошибка при автоматической синхронизации после добавления логиста:', error);
      });
      
      res.status(201).json({ 
        message: 'Логист успешно добавлен. Запущена полная синхронизация грузов.' 
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'Логист с таким ATI ID уже существует.' });
      }
      res.status(500).json({ error: 'Ошибка сервера при добавлении логиста.' });
    }
  });

  /**
   * POST /api/logisticians/add-by-phone
   * Добавляет логиста по номеру телефона.
   * Ищет контакт в ATI API по телефону и добавляет с указанным Telegram.
   */
  apiRouter.post('/logisticians/add-by-phone', async (req: Request, res: Response) => {
    const { phone, telegram } = req.body;
    
    if (!phone || !telegram || typeof phone !== 'string' || typeof telegram !== 'string') {
      return res.status(400).json({ error: 'Неверный формат данных. Ожидается { phone: string, telegram: string }.' });
    }

    try {
      const { getContacts } = await import('../ati_api.js');
      const contacts = await getContacts();
      
      // Нормализуем номер телефона (убираем все кроме цифр)
      const normalizePhone = (p: string) => p.replace(/\D/g, '');
      const normalizedPhone = normalizePhone(phone);
      
      // Ищем контакт по номеру телефона
      const contact = contacts.find(c => {
        const contactPhone = normalizePhone(c.phone || '');
        const contactMobile = normalizePhone(c.mobile || '');
        return contactPhone === normalizedPhone || contactMobile === normalizedPhone;
      });

      if (!contact) {
        return res.status(404).json({ error: 'Контакт с таким номером телефона не найден в ATI.' });
      }

      // Добавляем логиста
      await addWhitelistedLogistician(
        contact.id,
        contact.name || `Контакт ${contact.id}`,
        contact.mobile || contact.phone || undefined,
        telegram
      );
      
      // Запускаем полную синхронизацию в фоне
      runFullSync().catch(error => {
        console.error('❌ Ошибка при автоматической синхронизации после добавления логиста:', error);
      });
      
      res.status(201).json({ 
        message: `Логист ${contact.name} успешно добавлен. Запущена полная синхронизация грузов.` 
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'Логист с таким номером телефона уже существует в белом списке.' });
      }
      console.error('❌ Ошибка при добавлении логиста по телефону:', error);
      res.status(500).json({ error: 'Ошибка сервера при добавлении логиста.' });
    }
  });

  /**
   * DELETE /api/logisticians/:id
   * Удаляет логиста из белого списка по его ID в базе данных.
   * После удаления автоматически запускает полную синхронизацию.
   */
  apiRouter.delete('/logisticians/:id', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID должен быть числом.' });
    }
    try {
      await deleteWhitelistedLogistician(id);
      
      // Запускаем полную синхронизацию в фоне
      runFullSync().catch(error => {
        console.error('❌ Ошибка при автоматической синхронизации после удаления логиста:', error);
      });
      
      res.status(200).json({ 
        message: 'Логист успешно удален. Запущена полная синхронизация грузов.' 
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('не найден')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Ошибка сервера при удалении логиста.' });
    }
  });

  /**
   * GET /api/topics
   * Получает список всех топиков.
   */
  apiRouter.get('/topics', async (req: Request, res: Response) => {
    try {
      const topics = await getTopics();
      res.json(topics);
    } catch (error) {
      res.status(500).json({ error: 'Ошибка сервера при получении списка топиков.' });
    }
  });

  /**
   * POST /api/topics
   * Добавляет новый топик.
   */
  apiRouter.post('/topics', async (req: Request, res: Response) => {
    const { name, topic_id } = req.body;
    if (!name || !topic_id || typeof name !== 'string' || typeof topic_id !== 'number') {
      return res.status(400).json({ error: 'Неверный формат данных. Ожидается { name: string, topic_id: number }.' });
    }
    try {
      await addTopic(name, topic_id);
      res.status(201).json({ message: 'Топик успешно добавлен.' });
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'Топик с таким ID уже существует.' });
      }
      res.status(500).json({ error: 'Ошибка сервера при добавлении топика.' });
    }
  });

  /**
   * PUT /api/topics/:id
   * Обновляет существующий топик.
   */
  apiRouter.put('/topics/:id', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { name, topic_id } = req.body;
    if (isNaN(id) || !name || !topic_id || typeof name !== 'string' || typeof topic_id !== 'number') {
      return res.status(400).json({ error: 'Неверный формат данных. Ожидается { id: number, name: string, topic_id: number }.' });
    }
    try {
      await updateTopic(id, name, topic_id);
      res.status(200).json({ message: 'Топик успешно обновлен.' });
    } catch (error) {
      if (error instanceof Error && error.message.includes('не найден')) {
        return res.status(404).json({ error: error.message });
      }
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'Топик с таким ID уже существует.' });
      }
      res.status(500).json({ error: 'Ошибка сервера при обновлении топика.' });
    }
  });

  /**
   * DELETE /api/topics/:id
   * Удаляет топик.
   */
  apiRouter.delete('/topics/:id', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID должен быть числом.' });
    }
    try {
      await deleteTopic(id);
      res.status(200).json({ message: 'Топик успешно удален.' });
    } catch (error) {
      if (error instanceof Error && error.message.includes('не найден')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Ошибка сервера при удалении топика.' });
    }
  });

  /**
   * GET /api/pending-loads
   * Получает список всех грузов, ожидающих публикации.
   */
  apiRouter.get('/pending-loads', async (req: Request, res: Response) => {
    try {
      const pendingLoads = await getPendingLoads();
      res.json(pendingLoads);
    } catch (error) {
      res.status(500).json({ error: 'Ошибка сервера при получении ожидающих грузов.' });
    }
  });

  /**
   * POST /api/rescan-loads
   * Принудительно запускает полную синхронизацию грузов.
   */
  apiRouter.post('/rescan-loads', async (req: Request, res: Response) => {
    try {
      // Запускаем полную синхронизацию в фоне
      runFullSync().catch(error => {
        console.error('❌ Ошибка при ручной полной синхронизации:', error);
      });
      
      res.status(200).json({ 
        message: 'Полная синхронизация грузов запущена.' 
      });
    } catch (error) {
      console.error('❌ Ошибка при запуске полной синхронизации:', error);
      res.status(500).json({ error: 'Ошибка сервера при запуске синхронизации.' });
    }
  });

  /**
   * GET /api/contacts
   * Получает список всех контактов из ATI API.
   */
  apiRouter.get('/contacts', async (req: Request, res: Response) => {
    try {
      const { getContacts } = await import('../ati_api.js');
      const contacts = await getContacts();
      res.json(contacts);
    } catch (error) {
      console.error('❌ Ошибка при получении контактов:', error);
      res.status(500).json({ error: 'Ошибка сервера при получении контактов.' });
    }
  });

  /**
   * POST /api/cities
   * Получает информацию о городах по их ID.
   */
  apiRouter.post('/cities', async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids)) {
        return res.status(400).json({ error: 'Ожидается массив ids.' });
      }
      
      const { getCitiesByIds } = await import('../ati_api.js');
      const cities = await getCitiesByIds(ids);
      
      res.json(cities);
    } catch (error) {
      console.error('❌ Ошибка при получении городов:', error);
      res.status(500).json({ error: 'Ошибка сервера при получении городов.' });
    }
  });

  /**
   * POST /api/publish
   * Публикует груз в Telegram.
   * Принимает loadId (обязательно) и topicId (опционально).
   * Возвращает message_id опубликованного сообщения.
   */
  apiRouter.post('/publish', async (req: Request, res: Response) => {
    const { loadId, topicId } = req.body;

    if (!loadId) {
      return res.status(400).json({ error: 'Необходим loadId.' });
    }
    if (!CHAT_ID) {
        return res.status(500).json({ error: 'TELEGRAM_CHAT_ID не указан в .env файле.' });
    }

    try {
      const load: Load | null = await getPendingLoadById(loadId);
      if (!load) {
        return res.status(404).json({ error: `Груз с ID ${loadId} не найден в очереди.` });
      }

      const message = await formatLoadMessage(load);
      
      const telegramOptions: TelegramBot.SendMessageOptions = {
        parse_mode: 'HTML',
      };

      // Если topicId предоставлен и является числом, добавляем его в опции
      if (topicId && typeof topicId === 'number') {
        telegramOptions.message_thread_id = topicId;
      }

      const sentMessage = await bot.sendMessage(CHAT_ID, message, telegramOptions);

      // Перемещаем груз из ожидающих в опубликованные
      await removePendingLoad(loadId);
      await markLoadAsPublished(loadId);

      console.log(`✅ Груз ${loadId} успешно опубликован. Message ID: ${sentMessage.message_id}`);
      if (topicId && typeof topicId === 'number') {
        console.log(`В топик ${topicId}.`);
      }
      res.status(200).json({ 
        message: 'Груз успешно опубликован.',
        messageId: sentMessage.message_id 
      });

    } catch (error) {
      console.error('❌ Ошибка при публикации груза:', error);
      res.status(500).json({ error: 'Ошибка сервера при публикации груза.' });
    }
  });

  /**
   * POST /api/publish-loads
   * Массово публикует грузы в Telegram.
   */
  apiRouter.post('/publish-loads', async (req: Request, res: Response) => {
    const { loadIds, topicId } = req.body;

    if (!Array.isArray(loadIds) || loadIds.length === 0) {
      return res.status(400).json({ error: 'Необходим массив loadIds.' });
    }
    if (!CHAT_ID) {
      return res.status(500).json({ error: 'TELEGRAM_CHAT_ID не указан в .env файле.' });
    }

    try {
      const loads = await getPendingLoadsByIds(loadIds);
      if (loads.length === 0) {
        return res.status(404).json({ error: 'Указанные грузы не найдены в очереди.' });
      }

      const telegramOptions: TelegramBot.SendMessageOptions = { parse_mode: 'HTML' };
      if (topicId && typeof topicId === 'number') {
        telegramOptions.message_thread_id = topicId;
      }

      let successfulPublications = 0;
      let failedPublications = 0;

      for (const load of loads) {
        try {
          const message = await formatLoadMessage(load);
          await bot.sendMessage(CHAT_ID, message, telegramOptions);
          successfulPublications++;
        } catch (error) {
          failedPublications++;
          console.error(`❌ Ошибка при публикации груза ${load.Id} в Telegram:`, error);
        }
      }

      // Массово обновляем базу данных
      const publishedLoadIds = loads.map(l => l.Id);
      await removePendingLoads(publishedLoadIds);
      await markLoadsAsPublished(publishedLoadIds);

      console.log(`✅ Массовая публикация завершена. Успешно: ${successfulPublications}, Ошибки: ${failedPublications}`);
      res.status(200).json({
        message: `Публикация завершена. Успешно: ${successfulPublications}, Ошибки: ${failedPublications}`,
      });

    } catch (error) {
      console.error('❌ Ошибка при массовой публикации грузов:', error);
      res.status(500).json({ error: 'Ошибка сервера при массовой публикации.' });
    }
  });

  /**
   * POST /api/delete-message
   * Удаляет сообщение в Telegram.
   * Принимает messageId (обязательно) и chatId (опционально).
   * Если chatId не указан, используется TELEGRAM_CHAT_ID из .env.
   */
  apiRouter.post('/delete-message', async (req: Request, res: Response) => {
    const { messageId, chatId } = req.body;
    const targetChatId = chatId || CHAT_ID;

    if (!messageId) {
      return res.status(400).json({ error: 'Необходим messageId.' });
    }
    if (!targetChatId) {
      return res.status(500).json({ error: 'chatId не указан ни в запросе, ни в .env файле.' });
    }

    try {
      const success = await deleteTelegramMessage(targetChatId, messageId);
      if (success) {
        res.status(200).json({ message: 'Сообщение успешно удалено.' });
      } else {
        res.status(500).json({ error: 'Не удалось удалить сообщение.' });
      }
    } catch (error) {
      console.error('❌ Ошибка при удалении сообщения через API:', error);
      res.status(500).json({ error: 'Ошибка сервера при удалении сообщения.' });
    }
  });

  /**
   * POST /api/reject-load
   * Отклоняет груз из очереди на публикацию и сохраняет в rejected_loads.
   * Принимает loadId (обязательно).
   */
  apiRouter.post('/reject-load', async (req: Request, res: Response) => {
    const { loadId } = req.body;

    if (!loadId) {
      return res.status(400).json({ error: 'Необходим loadId.' });
    }

    try {
      // Проверяем, существует ли груз, перед удалением
      const load = await getPendingLoadById(loadId);
      if (!load) {
        return res.status(404).json({ error: `Груз с ID ${loadId} не найден в очереди.` });
      }

      // Сохраняем в отклоненные
      await addRejectedLoad(load);
      
      // Удаляем из очереди
      await removePendingLoad(loadId);

      console.log(`🗑️ Груз ${loadId} отклонен и перемещен в архив.`);
      res.status(200).json({ message: 'Груз успешно отклонен и сохранен в архив.' });

    } catch (error) {
      console.error('❌ Ошибка при отклонении груза:', error);
      res.status(500).json({ error: 'Ошибка сервера при отклонении груза.' });
    }
  });

  /**
   * POST /api/reject-loads
   * Массово отклоняет грузы из очереди на публикацию.
   * Принимает { loadIds: string[] }
   */
  apiRouter.post('/reject-loads', async (req: Request, res: Response) => {
    const { loadIds } = req.body;

    if (!Array.isArray(loadIds) || loadIds.length === 0) {
      return res.status(400).json({ error: 'Необходим массив loadIds.' });
    }

    try {
      // 1. Получаем данные грузов, которые нужно отклонить
      const loadsToReject = await getPendingLoadsByIds(loadIds);
      if (loadsToReject.length === 0) {
        return res.status(404).json({ error: 'Указанные грузы не найдены в очереди.' });
      }

      // 2. Добавляем их в таблицу отклоненных
      await addRejectedLoads(loadsToReject);
      
      // 3. Удаляем их из очереди
      await removePendingLoads(loadIds);

      console.log(`🗑️ Массово отклонено ${loadIds.length} грузов.`);
      res.status(200).json({ message: `Успешно отклонено ${loadIds.length} грузов.` });

    } catch (error) {
      console.error('❌ Ошибка при массовом отклонении грузов:', error);
      res.status(500).json({ error: 'Ошибка сервера при массовом отклонении грузов.' });
    }
  });

  /**
   * GET /api/rejected-loads
   * Получает список всех отклоненных грузов.
   */
  apiRouter.get('/rejected-loads', async (req: Request, res: Response) => {
    try {
      const rejectedLoads = await getRejectedLoads();
      res.json(rejectedLoads);
    } catch (error) {
      res.status(500).json({ error: 'Ошибка сервера при получении отклоненных грузов.' });
    }
  });

  /**
   * POST /api/restore-load
   * Восстанавливает отклоненный груз обратно в очередь.
   * Принимает loadId (обязательно).
   */
  apiRouter.post('/restore-load', async (req: Request, res: Response) => {
    const { loadId } = req.body;

    if (!loadId) {
      return res.status(400).json({ error: 'Необходим loadId.' });
    }

    try {
      await restoreRejectedLoad(loadId);
      res.status(200).json({ message: 'Груз успешно восстановлен в очередь.' });
    } catch (error) {
      console.error('❌ Ошибка при восстановлении груза:', error);
      res.status(500).json({ error: 'Ошибка сервера при восстановлении груза.' });
    }
  });

  /**
   * DELETE /api/rejected-loads/:loadId
   * Удаляет отклоненный груз навсегда.
   */
  apiRouter.delete('/rejected-loads/:loadId', async (req: Request, res: Response) => {
    const { loadId } = req.params;

    if (!loadId) {
      return res.status(400).json({ error: 'Необходим loadId.' });
    }

    try {
      await deleteRejectedLoad(loadId);
      res.status(200).json({ message: 'Груз успешно удален навсегда.' });
    } catch (error) {
      console.error('❌ Ошибка при удалении груза:', error);
      res.status(500).json({ error: 'Ошибка сервера при удалении груза.' });
    }
  });

  return apiRouter;
}
