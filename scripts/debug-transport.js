// scripts/debug-transport.js
// Скрипт для отладки данных о транспорте из ATI API

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const ATI_API_BASE_URL = 'https://api.ati.su';
const API_TOKEN = process.env.ATI_API_TOKEN;

async function debugTransportData() {
  if (!API_TOKEN) {
    console.error('❌ ATI_API_TOKEN не найден в .env файле');
    process.exit(1);
  }

  try {
    console.log('🔍 Получаем грузы из ATI API...\n');
    
    const response = await axios.get(`${ATI_API_BASE_URL}/v1.0/loads`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const loads = response.data || [];
    console.log(`✅ Получено грузов: ${loads.length}\n`);

    if (loads.length === 0) {
      console.log('⚠️ Нет грузов для анализа');
      return;
    }

    // Анализируем первые 10 грузов
    const samplesToAnalyze = Math.min(10, loads.length);
    console.log(`📊 Анализ первых ${samplesToAnalyze} грузов:\n`);
    console.log('='.repeat(80));

    const transportTypes = new Set();
    const loadingTypes = new Set();
    const unloadingTypes = new Set();

    for (let i = 0; i < samplesToAnalyze; i++) {
      const load = loads[i];
      const transport = load.Transport;

      console.log(`\n🚚 Груз #${i + 1} (ID: ${load.Id})`);
      console.log(`   LoadNumber: ${load.LoadNumber}`);
      console.log(`   ContactId1: ${load.ContactId1}`);
      
      if (transport) {
        console.log(`\n   📦 Transport объект:`);
        console.log(`      CarType: ${transport.CarType} (тип: ${typeof transport.CarType})`);
        console.log(`      LoadingType: ${transport.LoadingType} (тип: ${typeof transport.LoadingType})`);
        console.log(`      UnloadingType: ${transport.UnloadingType} (тип: ${typeof transport.UnloadingType})`);
        console.log(`      LoadingLogicalOperator: ${transport.LoadingLogicalOperator}`);
        console.log(`      UnloadingLogicalOperator: ${transport.UnloadingLogicalOperator}`);
        console.log(`      TrucksQuantity: ${transport.TrucksQuantity}`);
        console.log(`      TemperatureFrom: ${transport.TemperatureFrom}`);
        console.log(`      TemperatureTo: ${transport.TemperatureTo}`);
        
        // Проверяем, является ли CarType массивом или числом
        if (Array.isArray(transport.CarType)) {
          console.log(`      ⚠️ CarType - это МАССИВ: [${transport.CarType.join(', ')}]`);
          transport.CarType.forEach(type => transportTypes.add(type));
        } else {
          transportTypes.add(transport.CarType);
        }

        if (transport.LoadingType !== undefined && transport.LoadingType !== null) {
          loadingTypes.add(transport.LoadingType);
        }
        
        if (transport.UnloadingType !== undefined && transport.UnloadingType !== null) {
          unloadingTypes.add(transport.UnloadingType);
        }

        // Полный JSON для детального анализа
        console.log(`\n      Полный Transport JSON:`);
        console.log(JSON.stringify(transport, null, 2));
      } else {
        console.log(`   ⚠️ Transport объект отсутствует`);
      }

      console.log('\n' + '-'.repeat(80));
    }

    // Статистика
    console.log(`\n\n📈 СТАТИСТИКА:`);
    console.log(`\n🚛 Уникальные значения CarType:`);
    console.log(Array.from(transportTypes).sort((a, b) => a - b));
    
    console.log(`\n📥 Уникальные значения LoadingType:`);
    console.log(Array.from(loadingTypes).sort((a, b) => a - b));
    
    console.log(`\n📤 Уникальные значения UnloadingType:`);
    console.log(Array.from(unloadingTypes).sort((a, b) => a - b));

    // Проверяем все грузы на наличие массивов в CarType
    console.log(`\n\n🔍 Проверка всех ${loads.length} грузов на массивы в CarType:`);
    let arrayCount = 0;
    let numberCount = 0;
    let nullCount = 0;
    let strangeValues = [];

    loads.forEach(load => {
      if (load.Transport) {
        if (Array.isArray(load.Transport.CarType)) {
          arrayCount++;
        } else if (typeof load.Transport.CarType === 'number') {
          numberCount++;
          // Проверяем на странные значения (больше 100)
          if (load.Transport.CarType > 100) {
            strangeValues.push({
              id: load.Id,
              loadNumber: load.LoadNumber,
              carType: load.Transport.CarType,
              contactId: load.ContactId1
            });
          }
        } else {
          nullCount++;
        }
      }
    });

    console.log(`   Массивы: ${arrayCount}`);
    console.log(`   Числа: ${numberCount}`);
    console.log(`   Null/Undefined: ${nullCount}`);
    
    if (strangeValues.length > 0) {
      console.log(`\n⚠️ Найдено ${strangeValues.length} грузов со странными значениями CarType (>100):`);
      strangeValues.forEach(item => {
        console.log(`   LoadNumber: ${item.loadNumber}, CarType: ${item.carType}, ContactId: ${item.contactId}`);
      });
    }

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ Ошибка при запросе к ATI API:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
    } else {
      console.error('❌ Ошибка:', error);
    }
    process.exit(1);
  }
}

debugTransportData();
