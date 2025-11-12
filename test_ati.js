import axios from 'axios'
import * as dotenv from 'dotenv'

dotenv.config()

const API_TOKEN = process.env.ATI_API_TOKEN

async function test() {
  try {
    const response = await axios.get('https://api.ati.su/v1.0/loads/search/byboards', {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        Accept: 'application/json',
      },
      params: {
        boardIds: '', // пусто = все площадки
        limit: 10,
        offset: 0
      }
    })

    console.log('✅ Успешный ответ:')
    console.log(response.data)
  } catch (err) {
    console.error('❌ Ошибка:', err.response?.status, err.response?.data)
  }
}

test()
