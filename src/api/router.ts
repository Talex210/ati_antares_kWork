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
} from '../database.js';
import { formatLoadMessage } from '../core/format.js';
import { Load } from '../core/types.js';
import { deleteTelegramMessage } from '../bot.js'; // Импортируем новую функцию

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
   * POST /api/logisticians
   * Добавляет нового логиста в белый список.
   */
  apiRouter.post('/logisticians', async (req: Request, res: Response) => {
    const { ati_id, name } = req.body;
    if (!ati_id || !name || typeof ati_id !== 'number' || typeof name !== 'string') {
      return res.status(400).json({ error: 'Неверный формат данных. Ожидается { ati_id: number, name: string }.' });
    }
    try {
      await addWhitelistedLogistician(ati_id, name);
      res.status(201).json({ message: 'Логист успешно добавлен.' });
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'Логист с таким ATI ID уже существует.' });
      }
      res.status(500).json({ error: 'Ошибка сервера при добавлении логиста.' });
    }
  });

  /**
   * DELETE /api/logisticians/:id
   * Удаляет логиста из белого списка по его ID в базе данных.
   */
  apiRouter.delete('/logisticians/:id', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID должен быть числом.' });
    }
    try {
      await deleteWhitelistedLogistician(id);
      res.status(200).json({ message: 'Логист успешно удален.' });
    } catch (error) {
      if (error instanceof Error && error.message.includes('не найден')) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Ошибка сервера при удалении логиста.' });
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

      const message = formatLoadMessage(load);
      
      const telegramOptions: TelegramBot.SendMessageOptions = {
        parse_mode: 'Markdown',
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
   * POST /api/delete-message
   * Удаляет сообщение в Telegram.
   * Принимает chatId (обязательно) и messageId (обязательно).
   */
  apiRouter.post('/delete-message', async (req: Request, res: Response) => {
    const { chatId, messageId } = req.body;

    if (!chatId || !messageId) {
      return res.status(400).json({ error: 'Необходимы chatId и messageId.' });
    }

    try {
      const success = await deleteTelegramMessage(chatId, messageId);
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

  return apiRouter;
}
