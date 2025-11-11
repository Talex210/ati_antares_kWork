// src/core/format.ts

import { Load } from './types.js';

/**
 * Форматирует данные о грузе в сообщение для Telegram.
 * @param load - Объект с данными о грузе.
 * @returns Отформатированная строка в Markdown.
 */
export const formatLoadMessage = (load: Load): string => {
  const message = [
    '**⚠️ ТЕСТОВОЕ СООБЩЕНИЕ ⚠️**',
    '--------------------------',
    `📍 *Маршрут:* ${load.route.from} → ${load.route.to}`,
    `🚚 *Тип транспорта:* ${load.cargoType}`,
    `📦 *Груз:* ${load.weight} т, ${load.volume} м³`,
    `👤 *Контакт:* ${load.creator.name}`,
    `📞 *Телефон:* ${load.creator.phone}`,
  ].join('\n');

  return message;
};

