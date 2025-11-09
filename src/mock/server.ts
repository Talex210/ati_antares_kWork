// src/mock/server.ts

import express from 'express';
import { mockLoads, mockEmployees } from './data.js';

const app = express();
const PORT = 3001;

// Middleware для логирования запросов
app.use((req, res, next) => {
  console.log(`[Mock-Server] Received ${req.method} request for ${req.url}`);
  next();
});

// Эндпоинт для получения списка опубликованных грузов
app.get('/v1.0/loads/published', (req, res) => {
  res.json(mockLoads);
});

// Эндпоинт для получения списка логистов
app.get('/v1.2/catalogs/organizations/employees', (req, res) => {
    res.json(mockEmployees);
});

// Обработка несуществующих роутов
app.use((req, res) => {
    res.status(404).send({ error: 'Not Found' });
});

app.listen(PORT, () => {
  console.log(`✅ Mock-сервер ATI.SU запущен и слушает порт ${PORT}`);
  console.log('Доступные эндпоинты:');
  console.log(`  GET http://localhost:${PORT}/v1.0/loads/published`);
  console.log(`  GET http://localhost:${PORT}/v1.2/catalogs/organizations/employees`);
});
