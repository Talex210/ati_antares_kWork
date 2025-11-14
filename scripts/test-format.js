// scripts/test-format.js
// Тестирование форматирования сообщений

import axios from 'axios';
import * as dotenv from 'dotenv';
import { formatLoadMessage } from '../dist/core/format.js';

dotenv.config();

const ATI_API_BASE_URL = 'https://api.ati.su';
const API_TOKEN = process.env.ATI_API_TOKEN;

async function testFormatting() {
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
      console.log('⚠️ Нет грузов для тестирования');
      return;
    }

    // Тестируем форматирование первых 3 грузов
    const samplesToTest = Math.min(3, loads.length);
    console.log(`📝 Тестирование форматирования первых ${samplesToTest} грузов:\n`);
    console.log('='.repeat(80));

    for (let i = 0; i < samplesToTest; i++) {
      const load = loads[i];
      
      console.log(`\n🚚 Груз #${i + 1}`);
      console.log(`   ID: ${load.Id}`);
      console.log(`   LoadNumber: ${load.LoadNumber}`);
      console.log(`   CarType: ${load.Transport?.CarType}`);
      console.log(`   LoadingType: ${load.Transport?.LoadingType}`);
      console.log(`   UnloadingType: ${load.Transport?.UnloadingType}`);
      
      console.log(`\n📄 Отформатированное сообщение:\n`);
      
      try {
        const message = await formatLoadMessage(load);
        console.log(message);
      } catch (error) {
        console.error(`❌ Ошибка форматирования:`, error.message);
      }
      
      console.log('\n' + '='.repeat(80));
    }

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ Ошибка при запросе к ATI API:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
    } else {
      console.error('❌ Ошибка:', error);
    }
    process.exit(1);
  }
}

testFormatting();
