// scripts/find-negabarit.js
// Поиск грузов с негабаритом

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const ATI_API_BASE_URL = 'https://api.ati.su';
const API_TOKEN = process.env.ATI_API_TOKEN;

function decodeCarType(carType) {
  if (carType <= 22) {
    return [carType];
  }
  
  const types = [];
  for (let bit = 0; bit < 64; bit++) {
    const mask = Math.pow(2, bit);
    if ((carType & mask) !== 0) {
      types.push(bit + 1);
    }
  }
  return types;
}

async function findNegabarit() {
  if (!API_TOKEN) {
    console.error('❌ ATI_API_TOKEN не найден');
    process.exit(1);
  }

  try {
    console.log('🔍 Ищем грузы с негабаритом (тип 22)...\n');
    
    const response = await axios.get(`${ATI_API_BASE_URL}/v1.0/loads`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const loads = response.data || [];
    console.log(`✅ Получено грузов: ${loads.length}\n`);

    // Ищем грузы с типом 22 (Негабарит)
    const negabaritLoads = [];
    
    loads.forEach(load => {
      const carType = load.Transport?.CarType;
      if (carType) {
        const types = decodeCarType(carType);
        if (types.includes(22)) {
          negabaritLoads.push({
            loadNumber: load.LoadNumber,
            carType: carType,
            types: types,
            contactId: load.ContactId1
          });
        }
      }
    });

    console.log(`📊 Найдено грузов с негабаритом: ${negabaritLoads.length}\n`);

    if (negabaritLoads.length > 0) {
      console.log('Примеры грузов с негабаритом:');
      negabaritLoads.slice(0, 5).forEach(item => {
        console.log(`  ${item.loadNumber}: CarType=${item.carType}, Типы=[${item.types.join(', ')}]`);
      });
    } else {
      console.log('⚠️ Грузов с негабаритом не найдено!');
      console.log('\nВозможно, тип 22 кодируется по-другому.');
      console.log('Давайте проверим, какие типы вообще используются:\n');
      
      // Собираем статистику по всем типам
      const typeStats = {};
      loads.forEach(load => {
        const carType = load.Transport?.CarType;
        if (carType) {
          const types = decodeCarType(carType);
          types.forEach(t => {
            typeStats[t] = (typeStats[t] || 0) + 1;
          });
        }
      });
      
      console.log('Статистика по типам транспорта:');
      Object.keys(typeStats)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .forEach(type => {
          console.log(`  Тип ${type}: ${typeStats[type]} грузов`);
        });
    }

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ Ошибка API:', error.response?.status);
    } else {
      console.error('❌ Ошибка:', error);
    }
    process.exit(1);
  }
}

findNegabarit();
