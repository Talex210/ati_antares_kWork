document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const authSection = document.getElementById('auth-section');
    const mainContent = document.getElementById('main-content');
    const loginButton = document.getElementById('login-button');
    const passwordInput = document.getElementById('password-input');
    const logisticiansList = document.getElementById('logisticians-list');
    const addLogistButton = document.getElementById('add-logist-button');
    const logistAtiIdInput = document.getElementById('logist-ati-id');
    const logistNameInput = document.getElementById('logist-name');
    const pendingLoadsList = document.getElementById('pending-loads-list');
    const refreshLoadsButton = document.getElementById('refresh-loads-button');

    // --- Authentication ---

    async function fetchWithAuth(url, options = {}) {
        const password = sessionStorage.getItem('adminPassword');
        if (!password) {
            alert('Пароль не найден. Пожалуйста, войдите снова.');
            showLogin();
            return;
        }

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${password}`,
        };
        if (options.body) {
            headers['Content-Type'] = 'application/json';
        }

        try {
            const response = await fetch(url, { ...options, headers });

            if (response.status === 401) {
                alert('Неверный пароль. Доступ запрещен.');
                sessionStorage.removeItem('adminPassword');
                showLogin();
                throw new Error('Unauthorized');
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Ошибка сети: ${response.statusText}`);
            }

            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                return response.json();
            } else {
                return; 
            }
        } catch (error) {
            alert(`Произошла ошибка: ${error.message}`);
            throw error;
        }
    }

    function showLogin() {
        authSection.style.display = 'block';
        mainContent.style.display = 'none';
    }

    function showMainContent() {
        authSection.style.display = 'none';
        mainContent.style.display = 'block';
        loadLogisticians();
        loadPendingLoads();
    }

    loginButton.addEventListener('click', () => {
        const password = passwordInput.value;
        if (!password) {
            alert('Пожалуйста, введите пароль.');
            return;
        }
        sessionStorage.setItem('adminPassword', password);
        passwordInput.value = '';
        showMainContent();
    });
    
    passwordInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            loginButton.click();
        }
    });

    // --- Logisticians Management ---

    async function loadLogisticians() {
        logisticiansList.innerHTML = '<p><em>Загрузка...</em></p>';
        try {
            const data = await fetchWithAuth('/api/logisticians');
            renderLogisticians(data);
        } catch (error) {
            logisticiansList.innerHTML = '<p style="color: red;">Не удалось загрузить список логистов.</p>';
        }
    }

    function renderLogisticians(logisticians) {
        if (!logisticians || logisticians.length === 0) {
            logisticiansList.innerHTML = '<p>Список логистов пуст.</p>';
            return;
        }
        logisticiansList.innerHTML = `
            <ul class="styled-list">
                ${logisticians.map(l => `
                    <li>
                        <span>${l.name} (ATI ID: ${l.ati_id})</span>
                        <button class="delete-btn" data-id="${l.id}">Удалить</button>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    addLogistButton.addEventListener('click', async () => {
        const atiId = parseInt(logistAtiIdInput.value, 10);
        const name = logistNameInput.value.trim();

        if (!atiId || !name) {
            alert('Пожалуйста, заполните оба поля: ATI ID и Имя.');
            return;
        }

        try {
            const result = await fetchWithAuth('/api/logisticians', {
                method: 'POST',
                body: JSON.stringify({ ati_id: atiId, name: name })
            });
            
            logistAtiIdInput.value = '';
            logistNameInput.value = '';
            
            // Обновляем список логистов
            await loadLogisticians();
            
            // Показываем сообщение
            alert(result.message || 'Логист добавлен! Грузы будут обновлены автоматически через несколько секунд.');
            
            // Обновляем грузы через 3 секунды (даем время серверу пересканировать)
            setTimeout(async () => {
                await loadPendingLoads();
            }, 3000);
        } catch (error) {
            // Error is handled in fetchWithAuth
        }
    });

    logisticiansList.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const logistId = event.target.dataset.id;
            if (confirm(`Вы уверены, что хотите удалить этого логиста?`)) {
                try {
                    const result = await fetchWithAuth(`/api/logisticians/${logistId}`, {
                        method: 'DELETE'
                    });
                    
                    // Обновляем список логистов
                    await loadLogisticians();
                    
                    // Показываем сообщение
                    alert(result.message || 'Логист удален! Грузы будут обновлены автоматически через несколько секунд.');
                    
                    // Обновляем грузы через 3 секунды (даем время серверу очистить очередь)
                    setTimeout(async () => {
                        await loadPendingLoads();
                    }, 3000);
                } catch (error) {
                    // Error is handled in fetchWithAuth
                }
            }
        }
    });

    // --- Pending Loads Management ---

    async function loadPendingLoads() {
        pendingLoadsList.innerHTML = '<p><em>Загрузка...</em></p>';
        try {
            const loads = await fetchWithAuth('/api/pending-loads');
            renderPendingLoads(loads);
        } catch (error) {
            console.error('Ошибка при загрузке ожидающих грузов:', error); // Добавляем логирование
            pendingLoadsList.innerHTML = '<p style="color: red;">Не удалось загрузить список грузов. Подробности в консоли браузера (F12).</p>';
        }
    }

    function renderPendingLoads(loads) {
        if (!loads || loads.length === 0) {
            pendingLoadsList.innerHTML = '<p>Нет грузов, ожидающих публикации.</p>';
            return;
        }

        const topics = [
            { id: null, name: 'General' },
            { id: 115, name: 'Загрузки вся РФ' },
            { id: 107, name: 'Загрузки из Владивостока' },
            { id: 105, name: 'Загрузки из Екатеринбурга' },
            { id: 101, name: 'Загрузки из Казани' },
            { id: 103, name: 'Загрузки из Москвы и МО' },
            { id: 244, name: 'Загрузки из Набережных Челнов' },
            { id: 113, name: 'Загрузки НЕГАБАРИТ' },
            { id: 109, name: 'Загрузки из Самары' },
            { id: 117, name: 'Курилка' },
            { id: 111, name: 'Международные загрузки' }
        ];

        // Функция для форматирования даты
        function formatDate(dateString) {
            if (!dateString) return 'н/д';
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
            } catch {
                return 'н/д';
            }
        }

        // Функция для получения строки даты
        function getDateString(load) {
            if (load.DateType === 0) {
                return `📅 Дата: ${formatDate(load.FirstDate)}`;
            } else if (load.DateType === 1) {
                return `📅 Дата: ${formatDate(load.FirstDate)} - ${formatDate(load.LastDate)}`;
            } else if (load.DateType === 2) {
                return '📅 Дата: Постоянно';
            } else if (load.DateType === 3) {
                return '📅 Дата: Запрос ставки';
            }
            return '📅 Дата: н/д';
        }

        // Функция для получения маршрута
        function getRoute(load) {
            const from = load.Loading?.CityId || 'н/д';
            const to = load.Unloading?.CityId || 'н/д';
            const distance = load.Distance ? ` (${load.Distance} км)` : '';
            return `📍 Маршрут: ${from} → ${to}${distance}`;
        }

        // Функция для получения характера груза
        function getCargo(load) {
            const type = load.Cargo?.CargoType || 'Груз';
            const weight = load.Cargo?.Weight || 0;
            const volume = load.Cargo?.Volume || 0;
            return `📦 Характер груза: ${type} - ${weight} т / ${volume} м³`;
        }

        // Функция для получения транспорта
        function getTransport(load) {
            const carTypes = {
                1: 'Тент', 2: 'Реф', 3: 'Изотерм', 4: 'Бортовой',
                5: 'Контейнеровоз', 6: 'Автовоз', 7: 'Цистерна',
                8: 'Самосвал', 9: 'Низкорамник', 10: 'Фургон'
            };
            const carType = carTypes[load.Transport?.CarType] || 'Не указан';
            const qty = load.Transport?.TrucksQuantity || 1;
            return `🚛 Транспорт: ${carType}${qty > 1 ? ` x${qty}` : ''}`;
        }

        // Функция для получения ставки
        function getPrice(load) {
            const currencies = { 1: '₽', 2: '$', 3: '€', 4: '₴', 5: '₸' };
            const currency = currencies[load.Payment?.CurrencyId] || '₽';
            
            let price = 'По договоренности';
            if (load.Payment?.RateSum) {
                price = `${load.Payment.RateSum.toLocaleString('ru-RU')} ${currency}`;
            } else if (load.Payment?.SumWithoutNDS) {
                price = `${load.Payment.SumWithoutNDS.toLocaleString('ru-RU')} ${currency}`;
            } else if (load.TruePrice) {
                price = `${load.TruePrice.toLocaleString('ru-RU')} ${currency}`;
            }
            
            if (load.Payment?.Torg) {
                price += ' (торг)';
            }
            
            return `💰 Ставка: ${price}`;
        }

        // Функция для получения контактов
        function getContact(load) {
            return `👤 Контакты: ID ${load.ContactId1}${load.ContactId2 ? `, ${load.ContactId2}` : ''}`;
        }

        pendingLoadsList.innerHTML = loads.map(load => `
            <div class="load-card" data-load-id="${load.Id}">
                <div class="load-details">
                    <p>${getDateString(load)}</p>
                    <p><strong>${getRoute(load)}</strong></p>
                    <p>${getCargo(load)}</p>
                    <p>${getTransport(load)}</p>
                    <p><strong>${getPrice(load)}</strong></p>
                    <p style="color: #666; font-size: 0.9em;">${getContact(load)}</p>
                </div>
                <div class="load-actions">
                    <select class="topic-select">
                        ${topics.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                    </select>
                    <button class="publish-btn">Опубликовать</button>
                    <button class="reject-btn">Отклонить</button>
                </div>
            </div>
        `).join('');
    }

    pendingLoadsList.addEventListener('click', async (event) => {
        const target = event.target;
        const loadCard = target.closest('.load-card');
        if (!loadCard) return;

        const loadId = loadCard.dataset.loadId; // Теперь это GUID (строка), не число

        if (target.classList.contains('publish-btn')) {
            const topicSelect = loadCard.querySelector('.topic-select');
            const topicId = parseInt(topicSelect.value, 10);
            
            if (confirm(`Опубликовать груз в топик "${topicSelect.options[topicSelect.selectedIndex].text}"?`)) {
                try {
                    await fetchWithAuth('/api/publish', {
                        method: 'POST',
                        body: JSON.stringify({ loadId, topicId })
                    });
                    alert('Груз успешно опубликован!');
                    await loadPendingLoads();
                } catch (error) {
                    // Error is handled in fetchWithAuth
                }
            }
        }

        if (target.classList.contains('reject-btn')) {
            if (confirm('Вы уверены, что хотите отклонить этот груз?')) {
                try {
                    await fetchWithAuth('/api/reject-load', {
                        method: 'POST',
                        body: JSON.stringify({ loadId })
                    });
                    alert('Груз отклонен.');
                    await loadPendingLoads();
                } catch (error) {
                    // Error is handled in fetchWithAuth
                }
            }
        }
    });

    // --- Manual Refresh Button ---
    refreshLoadsButton.addEventListener('click', async () => {
        refreshLoadsButton.disabled = true;
        refreshLoadsButton.textContent = '⏳ Обновление...';
        try {
            await loadPendingLoads();
        } finally {
            refreshLoadsButton.disabled = false;
            refreshLoadsButton.textContent = '🔄 Обновить';
        }
    });

    // --- Initial Load ---
    if (sessionStorage.getItem('adminPassword')) {
        showMainContent();
    } else {
        showLogin();
    }
});
