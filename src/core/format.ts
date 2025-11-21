// src/core/format.ts

import { Load } from './types.js';
import { getContactById, AtiContact, getCityName } from '../ati_api.js';
import { 
  CURRENCIES, 
  DATE_TYPES, 
  getCarTypeName, 
  getLoadingTypeName 
} from './dictionaries.js';

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
 * Форматирует номер телефона
 */
function formatPhone(phone: string | null, mobile: string | null): string {
  if (mobile) return mobile;
  if (phone) return phone;
  return 'Не указан';
}

/**
 * Получает контактную информацию по ContactId из БД (с Telegram) или из API
 */
async function getContactInfo(contactId: number): Promise<{ phone: string; telegram: string; name: string }> {
  try {
    // Сначала пытаемся получить из белого списка (там есть Telegram)
    const { getWhitelistedLogisticians } = await import('../database.js');
    const logisticians = await getWhitelistedLogisticians();
    const logist = logisticians.find(l => l.ati_id === contactId);
    
    if (logist) {
      return {
        name: logist.name,
        phone: logist.phone || 'Не указан',
        telegram: logist.telegram || '',
      };
    }
    
    // Если не нашли в белом списке, получаем из API (без Telegram)
    const contact = await getContactById(contactId);
    
    if (contact) {
      return {
        name: contact.name || `Контакт ${contactId}`,
        phone: formatPhone(contact.phone, contact.mobile),
        telegram: '',
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
  const fromCityId = load.Loading?.CityId;
  const toCityId = load.Unloading?.CityId;
  
  const fromCity = fromCityId ? await getCityName(fromCityId) : 'н/д';
  const toCity = toCityId ? await getCityName(toCityId) : 'н/д';
  
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
  const carTypeValue = load.Transport?.CarType;
  
  // Логируем странные значения для отладки
  if (carTypeValue && typeof carTypeValue === 'number' && carTypeValue > 100) {
    console.warn(`⚠️ Странное значение CarType: ${carTypeValue} для груза ${load.LoadNumber}`);
  }
  
  const carType = getCarTypeName(carTypeValue);
  const trucksQty = load.Transport?.TrucksQuantity || 1;
  
  let transportStr = `🚛 <b>Транспорт:</b> ${carType}`;
  if (trucksQty > 1) {
    transportStr += ` x${trucksQty}`;
  }
  
  lines.push(transportStr);
  
  // Способ загрузки/разгрузки
  const loadingType = getLoadingTypeName(load.Transport?.LoadingType);
  const unloadingType = getLoadingTypeName(load.Transport?.UnloadingType);
  
  if (loadingType || unloadingType) {
    let loadingStr = '   📦 ';
    if (loadingType) {
      loadingStr += `Загрузка: ${loadingType}`;
    }
    if (unloadingType) {
      if (loadingType) loadingStr += ' | ';
      loadingStr += `Разгрузка: ${unloadingType}`;
    }
    lines.push(loadingStr);
  }
  
  // 5. СТАВКА
  const currency = CURRENCIES[load.Payment?.CurrencyId || 1] || '₽';
  let priceStr = '💰 <b>Ставка:</b> ';
  
  const sumWithoutNDS = load.Payment?.SumWithoutNDS;
  const sumWithNDS = load.Payment?.SumWithNDS;

  let priceValue = '';

  if (sumWithoutNDS && sumWithNDS && sumWithoutNDS !== sumWithNDS) {
    priceValue = `${sumWithoutNDS.toLocaleString('ru-RU')} ${currency} (без НДС), ${sumWithNDS.toLocaleString('ru-RU')} ${currency} (с НДС)`;
  } else if (sumWithoutNDS) {
    priceValue = `${sumWithoutNDS.toLocaleString('ru-RU')} ${currency} (без НДС)`;
  } else if (sumWithNDS) {
    priceValue = `${sumWithNDS.toLocaleString('ru-RU')} ${currency} (с НДС)`;
  } else if (load.Payment?.RateSum) {
    priceValue = `${load.Payment.RateSum.toLocaleString('ru-RU')} ${currency}`;
  } else if (load.TruePrice) {
    priceValue = `${load.TruePrice.toLocaleString('ru-RU')} ${currency}`;
  } else {
    priceValue = 'По договоренности';
  }
  
  priceStr += priceValue;

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
    lines.push(`   ⌯⌲ ${escapeHtml(contact.telegram)}`);
  }
  
  // Если есть второй контакт
  if (load.ContactId2) {
    const contact2 = await getContactInfo(load.ContactId2);
    lines.push('');
    lines.push(`   ${escapeHtml(contact2.name)}`);
    lines.push(`   📞 ${escapeHtml(contact2.phone)}`);
    if (contact2.telegram) {
      lines.push(`   ⌯⌲ ${escapeHtml(contact2.telegram)}`);
    }
  }
  
  return lines.join('\n');
};

