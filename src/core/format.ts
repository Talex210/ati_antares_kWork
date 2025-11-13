// src/core/format.ts

import { Load } from './types.js';
import { getContactById, AtiContact } from '../ati_api.js';

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
 * Словарь типов транспорта (примерные значения)
 */
const CAR_TYPES: Record<number, string> = {
  1: 'Тент',
  2: 'Реф',
  3: 'Изотерм',
  4: 'Бортовой',
  5: 'Контейнеровоз',
  6: 'Автовоз',
  7: 'Цистерна',
  8: 'Самосвал',
  9: 'Низкорамник',
  10: 'Фургон',
};

/**
 * Экранирует специальные символы HTML для Telegram
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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
 * Извлекает Telegram из примечания контакта
 */
function extractTelegram(note: string | null): string {
  if (!note) return '';
  
  // Ищем @username или t.me/username
  const telegramMatch = note.match(/@[\w]+|t\.me\/([\w]+)/i);
  if (telegramMatch) {
    return telegramMatch[0].startsWith('@') ? telegramMatch[0] : `@${telegramMatch[1]}`;
  }
  
  return '';
}

/**
 * Форматирует номер телефона
 */
function formatPhone(phone: string | null, mobile: string | null): string {
  if (mobile) return mobile;
  if (phone) return phone;
  return 'Не указан';
}

/**
 * Получает контактную информацию по ContactId из ATI API
 */
async function getContactInfo(contactId: number): Promise<{ phone: string; telegram: string; name: string }> {
  try {
    const contact = await getContactById(contactId);
    
    if (contact) {
      return {
        name: contact.name || `Контакт ${contactId}`,
        phone: formatPhone(contact.phone, contact.mobile),
        telegram: extractTelegram(contact.note),
      };
    }
  } catch (error) {
    console.error(`Ошибка при получении контакта ${contactId}:`, error);
  }
  
  // Fallback если не удалось получить контакт
  return {
    phone: 'Не указан',
    telegram: '',
    name: `Контакт ${contactId}`,
  };
}

/**
 * Форматирует дату и время для отображения
 */
function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Форматирует данные о грузе в сообщение для Telegram.
 * Формат: Дата | Маршрут | Характер груза | Транспорт | Ставка | Контакты
 * @param load - Объект с данными о грузе от ATI API.
 * @returns Отформатированная строка в HTML.
 */
export const formatLoadMessage = async (load: Load): Promise<string> => {
  const lines: string[] = [];
  
  // 1. ДАТА
  let dateStr = '';
  if (load.DateType === 0) {
    // Готов к загрузке
    dateStr = `📅 <b>Дата:</b> ${formatDateTime(load.FirstDate)}`;
  } else if (load.DateType === 1) {
    // С даты по дату
    dateStr = `📅 <b>Дата:</b> ${formatDateTime(load.FirstDate)} - ${formatDateTime(load.LastDate)}`;
  } else if (load.DateType === 2) {
    // Постоянно
    dateStr = '📅 <b>Дата:</b> Постоянно';
  } else if (load.DateType === 3) {
    // Груза нет, запрос ставки
    dateStr = '📅 <b>Дата:</b> Запрос ставки';
  }
  lines.push(dateStr);
  
  // 2. МАРШРУТ
  const fromCity = load.Loading?.CityId || 'н/д';
  const toCity = load.Unloading?.CityId || 'н/д';
  const fromStreet = load.Loading?.Street ? ` (${escapeHtml(load.Loading.Street)})` : '';
  const toStreet = load.Unloading?.Street ? ` (${escapeHtml(load.Unloading.Street)})` : '';
  
  lines.push(`📍 <b>Маршрут:</b> ${fromCity}${fromStreet} → ${toCity}${toStreet}`);
  
  if (load.Distance) {
    lines.push(`   🛣 Расстояние: ${load.Distance} км`);
  }
  
  // 3. ХАРАКТЕР ГРУЗА
  const weight = load.Cargo?.Weight || 0;
  const volume = load.Cargo?.Volume || 0;
  const cargoType = escapeHtml(load.Cargo?.CargoType || 'Груз');
  
  lines.push(`📦 <b>Характер груза:</b> ${cargoType} - ${weight} т / ${volume} м³`);
  
  // Примечание к грузу (если есть)
  if (load.Note && load.Note.length < 100) {
    lines.push(`   💬 ${escapeHtml(load.Note)}`);
  }
  
  // 4. ТРАНСПОРТ
  const carType = CAR_TYPES[load.Transport?.CarType || 1] || 'Не указан';
  const trucksQty = load.Transport?.TrucksQuantity || 1;
  
  let transportStr = `🚛 <b>Транспорт:</b> ${carType}`;
  if (trucksQty > 1) {
    transportStr += ` x${trucksQty}`;
  }
  
  // Температурный режим
  if (load.Transport?.TemperatureFrom !== undefined || load.Transport?.TemperatureTo !== undefined) {
    const tempFrom = load.Transport.TemperatureFrom || 0;
    const tempTo = load.Transport.TemperatureTo || 0;
    transportStr += ` 🌡 ${tempFrom}°C...${tempTo}°C`;
  }
  
  lines.push(transportStr);
  
  // 5. СТАВКА
  const currency = CURRENCIES[load.Payment?.CurrencyId || 1] || '₽';
  let priceStr = '💰 <b>Ставка:</b> ';
  
  if (load.Payment?.RateSum) {
    priceStr += `${load.Payment.RateSum.toLocaleString('ru-RU')} ${currency}`;
  } else if (load.Payment?.SumWithoutNDS) {
    priceStr += `${load.Payment.SumWithoutNDS.toLocaleString('ru-RU')} ${currency}`;
  } else if (load.TruePrice) {
    priceStr += `${load.TruePrice.toLocaleString('ru-RU')} ${currency}`;
  } else {
    priceStr += 'По договоренности';
  }
  
  // Торг
  if (load.Payment?.Torg) {
    priceStr += ' (торг)';
  }
  
  // Предоплата
  if (load.Payment?.PrepayPercent) {
    priceStr += ` | Предоплата ${load.Payment.PrepayPercent}%`;
  }
  
  lines.push(priceStr);
  
  // 6. КОНТАКТЫ
  lines.push('');
  lines.push('👤 <b>Контакты:</b>');
  
  const contact = await getContactInfo(load.ContactId1);
  lines.push(`   ${escapeHtml(contact.name)}`);
  lines.push(`   📞 ${escapeHtml(contact.phone)}`);
  
  if (contact.telegram) {
    lines.push(`   💬 ${escapeHtml(contact.telegram)}`);
  }
  
  // Если есть второй контакт
  if (load.ContactId2) {
    const contact2 = await getContactInfo(load.ContactId2);
    lines.push('');
    lines.push(`   ${escapeHtml(contact2.name)}`);
    lines.push(`   📞 ${escapeHtml(contact2.phone)}`);
    if (contact2.telegram) {
      lines.push(`   💬 ${escapeHtml(contact2.telegram)}`);
    }
  }
  
  return lines.join('\n');
};

