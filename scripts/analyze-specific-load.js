// scripts/analyze-specific-load.js
// Анализ конкретного груза

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const ATI_API_BASE_URL = 'https://api.ati.su';
const API_TOKEN = process.env.ATI_API_TOKEN;

const carTypes = {
  1: 'Тент', 2: 'Реф', 3: 'Изотерм', 4: 'Бортовой',
  5: 'Контейнеровоз', 6: 'Автовоз', 7: 'Цистерна',
  8: 'Самосвал', 9: 'Низкорамник', 10: 'Фургон',
  11: 'Автобус', 12: 'Манипулятор', 13: 'Эвакуатор',
  14: 'Автокран', 15: 'Бетоносмеситель', 16: 'Бетононасос',
  17: 'Зерновоз', 18: 'Лесовоз', 19: 'Скотовоз',
  20: 'Трал', 21: 'Автотранспортер', 22: 'Негабарит',
  30: 'Негабарит' // Реальный тип из API
};

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

async function analyzeLoad(loadNumber) {
  if (!API_TOKEN) {
    console.error('❌ ATI_API_TOKEN не найден');
    process.exit(1);
  }

  try {
    console.log(`🔍 Ищем груз ${loadNumber}...\n`);
    
    const response = await axios.get(`${ATI_API_BASE_URL}/v1.0/loads`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const loads = response.data || [];
    const load = loads.find(l => l.LoadNumber === loadNumber);

    if (!load) {
      console.log(`❌ Груз ${loadNumber} не найден`);
      console.log(`\nДоступные грузы (первые 10):`);
      loads.slice(0, 10).forEach(l => {
        console.log(`  - ${l.LoadNumber} (CarType: ${l.Transport?.CarType})`);
      });
      return;
    }

    console.log(`✅ Груз найден!\n`);
    console.log(`📦 LoadNumber: ${load.LoadNumber}`);
    console.log(`📦 ID: ${load.Id}`);
    console.log(`📦 ContactId1: ${load.ContactId1}`);
    console.log(`\n🚛 Transport объект:`);
    console.log(JSON.stringify(load.Transport, null, 2));
    
    const carType = load.Transport?.CarType;
    console.log(`\n🔍 Анализ CarType: ${carType}`);
    
    if (carType) {
      const types = decodeCarType(carType);
      console.log(`\n📊 Декодированные типы:`);
      console.log(`   Биты: [${types.join(', ')}]`);
      console.log(`   Названия:`);
      types.forEach(t => {
        const name = carTypes[t] || `Неизвестный тип ${t}`;
        console.log(`      ${t}: ${name}`);
      });
      
      // Проверяем, есть ли Негабарит
      if (types.includes(22) || types.includes(30)) {
        console.log(`\n✅ НЕГАБАРИТ НАЙДЕН! (бит ${types.includes(22) ? '22' : '30'})`);
      } else {
        console.log(`\n⚠️ Негабарита НЕТ в списке типов`);
      }
      
      // Показываем, что должно отображаться
      const validTypes = types.filter(t => (t > 0 && t <= 22) || t === 30);
      console.log(`\n📝 Что должно отображаться:`);
      if (validTypes.length > 3) {
        if (validTypes.includes(22) || validTypes.includes(30)) {
          console.log(`   "Негабарит" (т.к. есть тип 22 или 30 и больше 3 типов)`);
        } else {
          console.log(`   "Различные типы" (т.к. больше 3 типов без негабарита)`);
        }
      } else {
        const names = validTypes.map(t => carTypes[t]).filter(Boolean).join(', ');
        console.log(`   "${names}" (т.к. 1-3 типа)`);
      }
    }
    
    // Показываем полный объект груза
    console.log(`\n📄 Полный объект груза (для справки):`);
    console.log(`   Note: ${load.Note || 'нет'}`);
    console.log(`   Cargo.CargoType: ${load.Cargo?.CargoType || 'нет'}`);

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ Ошибка API:', error.response?.status, error.response?.statusText);
    } else {
      console.error('❌ Ошибка:', error);
    }
    process.exit(1);
  }
}

// Получаем номер груза из аргументов командной строки
const loadNumber = process.argv[2];

if (!loadNumber) {
  console.log('❌ Укажите номер груза!');
  console.log('\nИспользование:');
  console.log('  node scripts/analyze-specific-load.js XVQ192404');
  console.log('\nПример грузов с "негабаритом" из отладки:');
  console.log('  XVQ192404 (CarType: 18726594281984)');
  console.log('  XVQ193760 (CarType: 844424930131980)');
  process.exit(1);
}

analyzeLoad(loadNumber);
