// src/mock/data.ts

/**
 * Имитация ответа от API ATI.SU для эндпоинта /v1.0/loads/published
 * Содержит список опубликованных грузов.
 */
// src/mock/data.ts

/**
 * Имитация ответа от API ATI.SU для эндпоинта /v1.0/loads/published
 * Содержит список опубликованных грузов.
 */
const mockLoads = [
  {
    id: 43817239,
    title: 'Казань → Москва',
    creator: {
      id: 1123,
      name: 'Анна Петрова',
      phone: '+7 (937) 0046492',
    },
    datePublished: '2025-11-08T10:35:12Z',
    price: 57000,
    cargoType: 'негабарит',
    weight: 22.5,
    volume: 80,
    route: { from: 'Казань', to: 'Москва' },
  },
  {
    id: 43817240,
    title: 'Санкт-Петербург → Новосибирск',
    creator: {
      id: 1124,
      name: 'Иван Иванов',
      phone: '+7 (921) 1234567',
    },
    datePublished: '2025-11-09T11:00:00Z',
    price: 150000,
    cargoType: 'рефрижератор',
    weight: 20,
    volume: 82,
    route: { from: 'Санкт-Петербург', to: 'Новосибирск' },
  },
  {
    id: 43817241,
    title: 'Ростов-на-Дону → Красноярск',
    creator: {
      id: 1123,
      name: 'Анна Петрова',
      phone: '+7 (937) 0046492',
    },
    datePublished: '2025-11-09T12:15:00Z',
    price: 120000,
    cargoType: 'тентованный',
    weight: 21,
    volume: 90,
    route: { from: 'Ростов-на-Дону', to: 'Красноярск' },
  },
];

/**
 * Имитация ответа от API ATI.SU для эндпоинта /v1.2/catalogs/organizations/employees
 * Содержит список сотрудников (логистов).
 */
const mockEmployees = [
    {
        id: 1123,
        name: 'Анна Петрова',
        phone: '+7 (937) 0046492',
        role: 'Логист',
    },
    {
        id: 1124,
        name: 'Иван Иванов',
        phone: '+7 (921) 1234567',
        role: 'Менеджер по логистике',
    },
    {
        id: 1125,
        name: 'Сергей Сидоров',
        phone: '+7 (950) 7654321',
        role: 'Логист',
    }
];

module.exports = {
    mockLoads,
    mockEmployees,
};

