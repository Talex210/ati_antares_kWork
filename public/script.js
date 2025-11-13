document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const authSection = document.getElementById('auth-section');
    const mainContent = document.getElementById('main-content');
    const loginButton = document.getElementById('login-button');
    const passwordInput = document.getElementById('password-input');
    
    // Вкладки
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Логисты
    const logisticiansList = document.getElementById('logisticians-list');
    const addLogistButton = document.getElementById('add-logist-button');
    const logistAtiIdInput = document.getElementById('logist-ati-id');
    const logistNameInput = document.getElementById('logist-name');
    
    // Грузы на публикацию
    const pendingLoadsList = document.getElementById('pending-loads-list');
    const refreshLoadsButton = document.getElementById('refresh-loads-button');
    
    // Отклоненные грузы
    const rejectedLoadsList = document.getElementById('rejected-loads-list');
    const refreshRejectedButton = document.getElementById('refresh-rejected-button');

    // --- Tabs Management ---
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            // Убираем активный класс со всех кнопок и контента
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Добавляем активный класс к выбранной вкладке
            button.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
            
            // Загружаем данные для вкладки
            if (tabName === 'logisticians') {
                loadLogisticians();
            } else if (tabName === 'pending') {
                loadPendingLoads();
            } else if (tabName === 'rejected') {
                loadRejectedLoads();
            }
        });
    });

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
        authSection.style.display = 'flex';
        mainContent.style.display = 'none';
    }

    function showMainContent() {
        authSection.style.display = 'none';
        mainContent.style.display = 'block';
        loadLogisticians();
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
        logisticiansList.innerHTML = '<p class="loading">Загрузка...</p>';
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
                        <span><strong>${l.name}</strong> (ATI ID: ${l.ati_id})</span>
                        <button class="delete-btn" data-id="${l.id}">🗑️ Удалить</button>
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
            
            await loadLogisticians();
            alert(result.message || 'Логист добавлен!');
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
                    
                    await loadLogisticians();
                    alert(result.message || 'Логист удален!');
                } catch (error) {
                    // Error is handled in fetchWithAuth
                }
            }
        }
    });

    // --- Pending Loads Management ---
    async function loadPendingLoads() {
        pendingLoadsList.innerHTML = '<p class="loading">Загрузка...</p>';
        try {
            const loads = await fetchWithAuth('/api/pending-loads');
            renderPendingLoads(loads);
        } catch (error) {
            console.error('Ошибка при загрузке ожидающих грузов:', error);
            pendingLoadsList.innerHTML = '<p style="color: red;">Не удалось загрузить список грузов.</p>';
        }
    }

    function renderPendingLoads(loads) {
        if (!loads || loads.length === 0) {
            pendingLoadsList.innerHTML = '<p>Нет грузов, ожидающих публикации.</p>';
            return;
        }

        pendingLoadsList.innerHTML = loads.map(load => createLoadCard(load, 'pending')).join('');
    }

    pendingLoadsList.addEventListener('click', async (event) => {
        const target = event.target;
        const loadCard = target.closest('.load-card');
        if (!loadCard) return;

        const loadId = loadCard.dataset.loadId;

        if (target.classList.contains('publish-btn')) {
            const topicSelect = loadCard.querySelector('.topic-select');
            const topicId = parseInt(topicSelect.value, 10);
            
            if (confirm(`Опубликовать груз в топик "${topicSelect.options[topicSelect.selectedIndex].text}"?`)) {
                try {
                    await fetchWithAuth('/api/publish', {
                        method: 'POST',
                        body: JSON.stringify({ loadId, topicId })
                    });
                    loadCard.remove();
                    alert('Груз успешно опубликован!');
                    await loadPendingLoads();
                } catch (error) {
                    await loadPendingLoads();
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
                    loadCard.remove();
                    alert('Груз отклонен и сохранен в архив.');
                    await loadPendingLoads();
                } catch (error) {
                    await loadPendingLoads();
                }
            }
        }
    });

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

    // --- Rejected Loads Management ---
    async function loadRejectedLoads() {
        rejectedLoadsList.innerHTML = '<p class="loading">Загрузка...</p>';
        try {
            const loads = await fetchWithAuth('/api/rejected-loads');
            renderRejectedLoads(loads);
        } catch (error) {
            console.error('Ошибка при загрузке отклоненных грузов:', error);
            rejectedLoadsList.innerHTML = '<p style="color: red;">Не удалось загрузить список отклоненных грузов.</p>';
        }
    }

    function renderRejectedLoads(loads) {
        if (!loads || loads.length === 0) {
            rejectedLoadsList.innerHTML = '<p>Нет отклоненных грузов.</p>';
            return;
        }

        rejectedLoadsList.innerHTML = loads.map(load => createLoadCard(load, 'rejected')).join('');
    }

    rejectedLoadsList.addEventListener('click', async (event) => {
        const target = event.target;
        const loadCard = target.closest('.load-card');
        if (!loadCard) return;

        const loadId = loadCard.dataset.loadId;

        if (target.classList.contains('restore-btn')) {
            if (confirm('Восстановить этот груз в очередь на публикацию?')) {
                try {
                    await fetchWithAuth('/api/restore-load', {
                        method: 'POST',
                        body: JSON.stringify({ loadId })
                    });
                    loadCard.remove();
                    alert('Груз восстановлен в очередь!');
                    await loadRejectedLoads();
                } catch (error) {
                    await loadRejectedLoads();
                }
            }
        }

        if (target.classList.contains('delete-forever-btn')) {
            if (confirm('Удалить этот груз навсегда? Это действие нельзя отменить!')) {
                try {
                    await fetchWithAuth(`/api/rejected-loads/${loadId}`, {
                        method: 'DELETE'
                    });
                    loadCard.remove();
                    alert('Груз удален навсегда.');
                    await loadRejectedLoads();
                } catch (error) {
                    await loadRejectedLoads();
                }
            }
        }
    });

    refreshRejectedButton.addEventListener('click', async () => {
        refreshRejectedButton.disabled = true;
        refreshRejectedButton.textContent = '⏳ Обновление...';
        try {
            await loadRejectedLoads();
        } finally {
            refreshRejectedButton.disabled = false;
            refreshRejectedButton.textContent = '🔄 Обновить';
        }
    });

    // --- Helper Functions ---
    function createLoadCard(load, type) {
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

        const dateStr = getDateString(load);
        const route = getRoute(load);
        const cargo = getCargo(load);
        const transport = getTransport(load);
        const price = getPrice(load);
        const contact = getContact(load);

        let actionsHTML = '';
        if (type === 'pending') {
            actionsHTML = `
                <select class="topic-select">
                    ${topics.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                </select>
                <button class="publish-btn">✅ Опубликовать</button>
                <button class="reject-btn">❌ Отклонить</button>
            `;
        } else if (type === 'rejected') {
            actionsHTML = `
                <button class="restore-btn">♻️ Восстановить</button>
                <button class="delete-forever-btn">🗑️ Удалить навсегда</button>
            `;
        }

        return `
            <div class="load-card" data-load-id="${load.Id}">
                <div class="load-details">
                    <p>${dateStr}</p>
                    <p><strong>${route}</strong></p>
                    <p>${cargo}</p>
                    <p>${transport}</p>
                    <p><strong>${price}</strong></p>
                    <p style="color: #666; font-size: 0.9em;">${contact}</p>
                </div>
                <div class="load-actions">
                    ${actionsHTML}
                </div>
            </div>
        `;
    }

    function formatDate(dateString) {
        if (!dateString) return 'н/д';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        } catch {
            return 'н/д';
        }
    }

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

    function getRoute(load) {
        const from = load.Loading?.CityId || 'н/д';
        const to = load.Unloading?.CityId || 'н/д';
        const distance = load.Distance ? ` (${load.Distance} км)` : '';
        return `📍 Маршрут: ${from} → ${to}${distance}`;
    }

    function getCargo(load) {
        const type = load.Cargo?.CargoType || 'Груз';
        const weight = load.Cargo?.Weight || 0;
        const volume = load.Cargo?.Volume || 0;
        return `📦 Характер груза: ${type} - ${weight} т / ${volume} м³`;
    }

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

    function getContact(load) {
        return `👤 Контакты: ID ${load.ContactId1}${load.ContactId2 ? `, ${load.ContactId2}` : ''}`;
    }

    // --- Initial Load ---
    if (sessionStorage.getItem('adminPassword')) {
        showMainContent();
    } else {
        showLogin();
    }
});
