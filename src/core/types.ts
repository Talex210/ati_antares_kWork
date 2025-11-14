// src/core/types.ts

/**
 * Структура груза от ATI API (упрощенная версия с основными полями)
 */
export interface Load {
  Id: string; // GUID груза
  LoadNumber: string; // Номер груза
  ContactId1: number; // ID первого контакта (логиста)
  ContactId2?: number | null; // ID второго контакта (опционально)
  Note?: string; // Примечание к грузу
  FirstDate: string; // Дата начала актуальности
  LastDate: string; // Дата окончания актуальности
  DateType: number; // Тип готовности груза (0-3)
  AddedAt: string; // Время добавления груза
  UpdatedAt: string; // Время последнего обновления
  Distance?: number; // Расстояние в км
  
  // Загрузка
  Loading: {
    CityId: number; // ID города загрузки
    Street?: string; // Адрес
    Latitude?: number;
    Longitude?: number;
    TimeStart?: string;
    TimeEnd?: string;
    IsRoundTheClock?: boolean;
  };
  
  // Разгрузка
  Unloading: {
    CityId: number; // ID города разгрузки
    Street?: string; // Адрес
    Latitude?: number;
    Longitude?: number;
    TimeStart?: string;
    TimeEnd?: string;
    IsRoundTheClock?: boolean;
  };
  
  // Информация о грузе
  Cargo: {
    Weight: number; // Вес в тоннах
    Volume: number; // Объем в м³
    CargoTypeId: number; // ID типа груза
    CargoType?: string; // Название типа груза
    PackType?: number; // Тип упаковки
    ADR?: number; // Класс опасности
  };
  
  // Транспорт
  Transport: {
    CarType: number | number[]; // Тип транспорта (может быть массивом)
    LoadingType?: number; // Тип загрузки
    LoadingLogicalOperator?: string; // Логический оператор для загрузки
    UnloadingType?: number; // Тип разгрузки
    UnloadingLogicalOperator?: string; // Логический оператор для разгрузки
    TrucksQuantity?: number; // Количество машин
    TemperatureFrom?: number; // Температура от
    TemperatureTo?: number; // Температура до
  };
  
  // Оплата
  Payment: {
    CurrencyId: number; // ID валюты
    MoneyType: number; // Тип оплаты
    RateSum?: number; // Ставка
    SumWithNDS?: number; // Сумма с НДС
    SumWithoutNDS?: number; // Сумма без НДС
    PrepayPercent?: number; // Процент предоплаты
    PayDays?: number; // Дней на оплату
    FixedRate?: boolean; // Фиксированная ставка
    Torg?: boolean; // Торг
  };
  
  // Дополнительные поля
  FirmId?: string; // ID фирмы
  TruePrice?: number; // Озвученная ставка
  TrueCurrencyId?: number; // ID валюты озвученной ставки
  ResponseCount?: number; // Количество откликов
  OfferCount?: number; // Количество встречных предложений
}
