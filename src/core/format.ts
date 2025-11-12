// src/core/format.ts

import { Load } from './types.js';

/**
 * Словарь типов готовности груза
 */
const DATE_TYPES: Record<number, string> = {
  0: '🟢 Готов к загрузке',
  1: '📅 С даты по дату',
  2: '🔄 Постоянно',
  3: '❓ Груза нет, запрос ставки',
};

/**
 * Словарь валют
 */
const CURRENCIES: Record<number, string> = {
  1: '₽', // Рубль
  2: '$', // Доллар
  3: '€', // Евро
  4: '₴', // Гривна
  5: '₸', // Тенге
};

/**
 * Форматирует дату в читаемый вид
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Форматирует данные о грузе в сообщение для Telegram.
 * @param load - Объект с данными о грузе от ATI API.
 * @returns Отформатированная строка в Markdown.
 */
export const formatLoadMessage = (load: Load): string => {
  const lines: string[] = [];
  
  // Заголовок
  lines.push(`🚚 *ГРУЗ №${load.LoadNumber || load.Id}*`);
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  
  // Маршрут
  const fromCity = load.Loading?.CityId ? `Город ID: ${load.Loading.CityId}` : 'Не указан';
  const toCity = load.Unloading?.CityId ? `Город ID: ${load.Unloading.CityId}` : 'Не указан';
  lines.push(`📍 *Маршрут:* ${fromCity} → ${toCity}`);
  
  // Адреса (если есть)
  if (load.Loading?.Street) {
    lines.push(`   Загрузка: ${load.Loading.Street}`);
  }
  if (load.Unloading?.Street) {
    lines.push(`   Разгрузка: ${load.Unloading.Street}`);
  }
  
  // Расстояние
  if (load.Distance) {
    lines.push(`🛣 *Расстояние:* ${load.Distance} км`);
  }
  
  lines.push(''); // Пустая строка
  
  // Информация о грузе
  if (load.Cargo) {
    lines.push(`📦 *Груз:* ${load.Cargo.Weight || 0} т, ${load.Cargo.Volume || 0} м³`);
    if (load.Cargo.CargoType) {
      lines.push(`   Тип: ${load.Cargo.CargoType}`);
    }
  }
  
  // Даты
  const dateType = DATE_TYPES[load.DateType] || 'Не указано';
  lines.push(`📅 *Готовность:* ${dateType}`);
  
  if (load.FirstDate) {
    lines.push(`   С: ${formatDate(load.FirstDate)}`);
  }
  if (load.LastDate && load.DateType !== 3) {
    lines.push(`   До: ${formatDate(load.LastDate)}`);
  }
  
  lines.push(''); // Пустая строка
  
  // Оплата
  if (load.Payment) {
    const currency = CURRENCIES[load.Payment.CurrencyId] || '';
    
    if (load.Payment.RateSum) {
      lines.push(`💰 *Ставка:* ${load.Payment.RateSum} ${currency}`);
    } else if (load.Payment.SumWithoutNDS) {
      lines.push(`💰 *Сумма:* ${load.Payment.SumWithoutNDS} ${currency} (без НДС)`);
    } else if (load.Payment.SumWithNDS) {
      lines.push(`💰 *Сумма:* ${load.Payment.SumWithNDS} ${currency} (с НДС)`);
    }
    
    if (load.Payment.Torg) {
      lines.push('   💬 Торг возможен');
    }
    
    if (load.Payment.PrepayPercent) {
      lines.push(`   💳 Предоплата: ${load.Payment.PrepayPercent}%`);
    }
  }
  
  // Озвученная ставка (если есть)
  if (load.TruePrice) {
    const trueCurrency = CURRENCIES[load.TrueCurrencyId || 1] || '';
    lines.push(`✅ *Озвученная ставка:* ${load.TruePrice} ${trueCurrency}`);
  }
  
  // Примечание
  if (load.Note) {
    lines.push('');
    lines.push(`📝 *Примечание:*`);
    lines.push(load.Note);
  }
  
  // Контакты
  lines.push('');
  lines.push(`👤 *Контакт ID:* ${load.ContactId1}`);
  if (load.ContactId2) {
    lines.push(`👤 *Контакт 2 ID:* ${load.ContactId2}`);
  }
  
  // Дата добавления
  if (load.AddedAt) {
    lines.push(`🕐 *Добавлено:* ${formatDate(load.AddedAt)}`);
  }
  
  return lines.join('\n');
};

