// src/admin/server.ts

import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import {
  initializeDatabase,
  getWhitelistedLogisticians,
  addWhitelistedLogistician,
  deleteWhitelistedLogistician,
  WhitelistedLogistician,
} from '../database.js';

// Загружаем переменные окружения
dotenv.config();

const app = express();
const PORT = process.env.ADMIN_PORT || 3002;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// --- Middleware ---

// Middleware для парсинга JSON-тела запросов
app.use(express.json());

// Middleware для базовой аутентификации
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!ADMIN_PASSWORD) {
    // Если пароль не установлен в .env, доступ запрещен
    console.warn('⚠️ Пароль администратора не установлен. Доступ к API заблокирован.');
    return res.status(500).json({ error: 'Сервер настроен некорректно.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${ADMIN_PASSWORD}`) {
    return res.status(401).json({ error: 'Неавторизованный доступ.' });
  }

  next();
};

// --- API Эндпоинты ---

// Применяем middleware аутентификации ко всем API-маршрутам
const apiRouter = express.Router();
apiRouter.use(authMiddleware);

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
 * Ожидает в теле запроса: { "ati_id": number, "name": "string" }
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

// Подключаем роутер к основному приложению
app.use('/api', apiRouter);

// --- Запуск сервера ---

async function startAdminServer() {
  try {
    // Инициализируем базу данных
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`✅ Сервер админ-панели запущен и слушает порт ${PORT}`);
      if (!ADMIN_PASSWORD) {
        console.warn('🔒 ВНИМАНИЕ: Пароль администратора (ADMIN_PASSWORD) не установлен в .env файле. API не будет работать.');
      } else {
        console.log('🔑 Аутентификация по паролю включена.');
      }
    });
  } catch (error) {
    console.error('❌ Не удалось запустить сервер админ-панели:', error);
    process.exit(1);
  }
}

startAdminServer();
