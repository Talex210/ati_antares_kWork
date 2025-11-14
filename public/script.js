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
    const logistPhoneInput = document.getElementById('logist-phone');
    const logistTelegramInput = document.getElementById('logist-telegram');
    const updateContactsButton = document.getElementById('update-contacts-button');
    
    // Грузы на публикацию
    const pendingLoadsList = document.getElementById('pending-loads-list');
    const refreshLoadsButton = document.getElementById('refresh-loads-button');
    
    // Отклоненные грузы
    const rejectedLoadsList = document.getElementById('rejected-loads-list');
    const refreshRejectedButton = document.getElementById('refresh-rejected-button');

    // Кэш контактов
    let contactsCache = null;

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
                ${logisticians.map(l => {
                    const phone = l.phone ? `<br>📞 ${l.phone}` : '';
                    const telegram = l.telegram ? `<br>⌯⌲ ${l.telegram}` : '';
                    
                    return `
                        <li>
                            <div>
                                <strong>${l.name}</strong> (ATI ID: ${l.ati_id})
                                ${phone}
                                ${telegram}
                            </div>
                            <button class="delete-btn" data-id="${l.id}">🗑️ Удалить</button>
                        </li>
                    `;
                }).join('')}
            </ul>
        `;
    }

    // Валидация Telegram-ника
    function validateTelegram(telegram) {
        // Проверяем, что начинается с @
        if (!telegram.startsWith('@')) {
            return { valid: false, message: 'Telegram-ник должен начинаться с @' };
        }
        
        // Убираем @ для проверки username
        const username = telegram.slice(1);
        
        // Проверяем длину (минимум 5 символов)
        if (username.length < 5) {
            return { valid: false, message: 'Telegram-ник должен содержать минимум 5 символов после @' };
        }
        
        // Проверяем допустимые символы (только буквы, цифры и подчеркивание)
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return { valid: false, message: 'Telegram-ник может содержать только буквы, цифры и подчеркивание' };
        }
        
        // Проверяем, что не начинается с цифры
        if (/^\d/.test(username)) {
            return { valid: false, message: 'Telegram-ник не может начинаться с цифры после @' };
        }
        
        return { valid: true, message: '' };
    }

    // Валидация полей для активации кнопки
    function validateLogistForm() {
        const phone = logistPhoneInput.value.trim();
        const telegram = logistTelegramInput.value.trim();
        
        // Визуальная индикация валидности Telegram
        if (telegram) {
            const validation = validateTelegram(telegram);
            if (validation.valid) {
                logistTelegramInput.style.borderColor = '#28a745';
            } else {
                logistTelegramInput.style.borderColor = '#dc3545';
            }
        } else {
            logistTelegramInput.style.borderColor = '';
        }
        
        addLogistButton.disabled = !phone || !telegram;
    }

    logistPhoneInput.addEventListener('input', validateLogistForm);
    logistTelegramInput.addEventListener('input', validateLogistForm);

    addLogistButton.addEventListener('click', async () => {
        const phone = logistPhoneInput.value.trim();
        const telegram = logistTelegramInput.value.trim();

        // Проверка заполненности полей
        if (!phone || !telegram) {
            alert('❌ Ошибка: Пожалуйста, заполните оба поля!\n\n• Номер телефона\n• Telegram-ник');
            return;
        }

        // Валидация Telegram-ника
        const telegramValidation = validateTelegram(telegram);
        if (!telegramValidation.valid) {
            alert(`❌ Ошибка: ${telegramValidation.message}\n\nПример правильного формата: @username`);
            logistTelegramInput.focus();
            return;
        }

        try {
            addLogistButton.disabled = true;
            addLogistButton.textContent = '⏳ Добавление...';

            const result = await fetchWithAuth('/api/logisticians/add-by-phone', {
                method: 'POST',
                body: JSON.stringify({ phone: phone, telegram: telegram })
            });
            
            logistPhoneInput.value = '';
            logistTelegramInput.value = '';
            logistTelegramInput.style.borderColor = '';
            validateLogistForm();
            
            await loadLogisticians();
            alert(result.message || 'Логист добавлен!');
        } catch (error) {
            // Error is handled in fetchWithAuth
        } finally {
            addLogistButton.textContent = 'Добавить';
            validateLogistForm();
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

    updateContactsButton.addEventListener('click', async () => {
        updateContactsButton.disabled = true;
        updateContactsButton.textContent = '⏳ Обновление...';
        try {
            await fetchWithAuth('/api/logisticians/update-contacts', {
                method: 'POST'
            });
            await loadLogisticians();
            alert('Контактная информация обновлена!');
        } catch (error) {
            // Error is handled in fetchWithAuth
        } finally {
            updateContactsButton.disabled = false;
            updateContactsButton.textContent = '🔄 Обновить контакты';
        }
    });

    // --- Contacts Management ---
    async function loadContacts() {
        if (contactsCache) {
            return contactsCache;
        }
        
        try {
            const contacts = await fetchWithAuth('/api/contacts');
            contactsCache = contacts;
            return contacts;
        } catch (error) {
            console.error('Ошибка при загрузке контактов:', error);
            return [];
        }
    }

    async function getContactInfoWithTelegram(contactId) {
        // Сначала пытаемся получить из белого списка логистов (там есть Telegram)
        try {
            const logisticians = await fetchWithAuth('/api/logisticians');
            const logist = logisticians.find(l => l.ati_id === contactId);
            
            if (logist) {
                return {
                    name: logist.name,
                    phone: logist.phone || 'Не указан',
                    telegram: logist.telegram || ''
                };
            }
        } catch (error) {
            console.error('Ошибка при получении логиста:', error);
        }
        
        // Если не нашли в белом списке, возвращаем базовую информацию
        return {
            name: `Контакт ${contactId}`,
            phone: 'Не указан',
            telegram: ''
        };
    }

    function getContactInfo(contactId, contacts) {
        const contact = contacts.find(c => c.id === contactId);
        if (!contact) {
            return {
                name: `Контакт ${contactId}`,
                phone: 'Не указан',
                telegram: ''
            };
        }

        // API не содержит Telegram, возвращаем только имя и телефон
        return {
            name: contact.name || `Контакт ${contactId}`,
            phone: contact.mobile || contact.phone || 'Не указан',
            telegram: '' // Telegram берем только из белого списка
        };
    }

    // --- Pending Loads Management ---
    let allPendingLoads = []; // Хранилище всех грузов
    let selectedLogisticians = new Set(); // Выбранные логисты для фильтрации (пустой = показываем все)

    async function loadPendingLoads() {
        pendingLoadsList.innerHTML = '<p class="loading">Загрузка...</p>';
        try {
            // Загружаем контакты, грузы и логистов параллельно
            const [loads, contacts, logisticians] = await Promise.all([
                fetchWithAuth('/api/pending-loads'),
                loadContacts(),
                fetchWithAuth('/api/logisticians')
            ]);
            
            allPendingLoads = loads;
            renderLogisticiansFilter(loads, logisticians);
            renderPendingLoads(loads, contacts);
        } catch (error) {
            console.error('Ошибка при загрузке ожидающих грузов:', error);
            pendingLoadsList.innerHTML = '<p style="color: red;">Не удалось загрузить список грузов.</p>';
        }
    }

    function renderLogisticiansFilter(loads, logisticians) {
        const logisticianFilter = document.getElementById('logisticians-filter');
        
        if (!logisticians || logisticians.length === 0) {
            logisticianFilter.innerHTML = '<p style="color: #999; font-size: 14px;">Нет логистов в белом списке</p>';
            return;
        }

        // Подсчитываем количество грузов для каждого логиста
        const logistCounts = {};
        logisticians.forEach(l => {
            logistCounts[l.ati_id] = loads.filter(load => 
                load.ContactId1 === l.ati_id || load.ContactId2 === l.ati_id
            ).length;
        });

        // По умолчанию ничего не выбрано (показываем все)
        const totalLoads = loads.length;
        const allChecked = selectedLogisticians.size === logisticians.length;

        logisticianFilter.innerHTML = `
            <label class="filter-checkbox ${allChecked ? 'checked' : ''}" data-logist-id="all">
                <input type="checkbox" ${allChecked ? 'checked' : ''}>
                <span class="filter-checkbox-label">Все</span>
                <span class="filter-checkbox-count">(${totalLoads})</span>
            </label>
            ${logisticians.map(l => {
                const count = logistCounts[l.ati_id] || 0;
                const isChecked = selectedLogisticians.has(l.ati_id);
                return `
                    <label class="filter-checkbox ${isChecked ? 'checked' : ''}" data-logist-id="${l.ati_id}">
                        <input type="checkbox" ${isChecked ? 'checked' : ''}>
                        <span class="filter-checkbox-label">${l.name}</span>
                        <span class="filter-checkbox-count">(${count})</span>
                    </label>
                `;
            }).join('')}
        `;

        // Добавляем обработчики событий
        logisticianFilter.querySelectorAll('.filter-checkbox').forEach(label => {
            label.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT') return; // Пропускаем клик на чекбокс
                
                const checkbox = label.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
                handleFilterChange(label.dataset.logistId, checkbox.checked);
            });

            const checkbox = label.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                handleFilterChange(label.dataset.logistId, e.target.checked);
            });
        });
    }

    function handleFilterChange(logistId, isChecked) {
        if (logistId === 'all') {
            // Переключаем все чекбоксы
            const allCheckboxes = document.querySelectorAll('#logisticians-filter .filter-checkbox');
            
            if (isChecked) {
                // Выбираем все
                allCheckboxes.forEach(label => {
                    const checkbox = label.querySelector('input[type="checkbox"]');
                    checkbox.checked = true;
                    label.classList.add('checked');
                    
                    const id = label.dataset.logistId;
                    if (id !== 'all') {
                        selectedLogisticians.add(parseInt(id));
                    }
                });
            } else {
                // Снимаем все (показываем все грузы)
                allCheckboxes.forEach(label => {
                    const checkbox = label.querySelector('input[type="checkbox"]');
                    checkbox.checked = false;
                    label.classList.remove('checked');
                });
                selectedLogisticians.clear();
            }
        } else {
            const logistIdNum = parseInt(logistId);
            const label = document.querySelector(`[data-logist-id="${logistId}"]`);
            
            if (isChecked) {
                selectedLogisticians.add(logistIdNum);
                label.classList.add('checked');
            } else {
                selectedLogisticians.delete(logistIdNum);
                label.classList.remove('checked');
            }

            // Обновляем чекбокс "Все"
            const allCheckbox = document.querySelector('[data-logist-id="all"] input');
            const allLabel = document.querySelector('[data-logist-id="all"]');
            const totalLogists = document.querySelectorAll('#logisticians-filter .filter-checkbox').length - 1;
            
            if (selectedLogisticians.size === totalLogists) {
                allCheckbox.checked = true;
                allLabel.classList.add('checked');
            } else {
                allCheckbox.checked = false;
                allLabel.classList.remove('checked');
            }
        }

        // Перерисовываем список грузов с учетом фильтра
        filterAndRenderLoads();
    }

    async function filterAndRenderLoads() {
        const contacts = await loadContacts();
        
        // Если ничего не выбрано - показываем все грузы
        if (selectedLogisticians.size === 0) {
            renderPendingLoads(allPendingLoads, contacts);
            return;
        }
        
        // Фильтруем грузы по выбранным логистам
        const filteredLoads = allPendingLoads.filter(load => 
            selectedLogisticians.has(load.ContactId1) || 
            (load.ContactId2 && selectedLogisticians.has(load.ContactId2))
        );

        renderPendingLoads(filteredLoads, contacts);
    }

    async function renderPendingLoads(loads, contacts) {
        if (!loads || loads.length === 0) {
            pendingLoadsList.innerHTML = '<p>Нет грузов, ожидающих публикации.</p>';
            return;
        }

        const cards = await Promise.all(loads.map(load => createLoadCard(load, 'pending', contacts)));
        pendingLoadsList.innerHTML = cards.join('');
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
        refreshLoadsButton.textContent = '⏳ Сканирование...';
        try {
            // Запускаем пересканирование грузов
            await fetchWithAuth('/api/rescan-loads', {
                method: 'POST'
            });
            
            // Ждем 2 секунды, чтобы дать время на обработку
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Обновляем список
            await loadPendingLoads();
            alert('Пересканирование завершено!');
        } catch (error) {
            // Error is handled in fetchWithAuth
        } finally {
            refreshLoadsButton.disabled = false;
            refreshLoadsButton.textContent = '🔄 Обновить';
        }
    });

    // --- Rejected Loads Management ---
    async function loadRejectedLoads() {
        rejectedLoadsList.innerHTML = '<p class="loading">Загрузка...</p>';
        try {
            // Загружаем контакты и грузы параллельно
            const [loads, contacts] = await Promise.all([
                fetchWithAuth('/api/rejected-loads'),
                loadContacts()
            ]);
            renderRejectedLoads(loads, contacts);
        } catch (error) {
            console.error('Ошибка при загрузке отклоненных грузов:', error);
            rejectedLoadsList.innerHTML = '<p style="color: red;">Не удалось загрузить список отклоненных грузов.</p>';
        }
    }

    async function renderRejectedLoads(loads, contacts) {
        if (!loads || loads.length === 0) {
            rejectedLoadsList.innerHTML = '<p>Нет отклоненных грузов.</p>';
            return;
        }

        const cards = await Promise.all(loads.map(load => createLoadCard(load, 'rejected', contacts)));
        rejectedLoadsList.innerHTML = cards.join('');
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
    async function createLoadCard(load, type, contacts = []) {
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
        const route = await getRoute(load);
        const cargo = getCargo(load);
        const transport = getTransport(load);
        const price = getPrice(load);
        const contact = await getContactDisplay(load);

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
                    <p style="color: #666; font-size: 0.9em; white-space: pre-line;">${contact}</p>
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

    // Кэш городов
    const citiesCache = new Map();

    async function getCityName(cityId) {
        if (!cityId) return 'н/д';
        
        // Проверяем кэш
        if (citiesCache.has(cityId)) {
            return citiesCache.get(cityId);
        }
        
        try {
            const cities = await fetchWithAuth('/api/cities', {
                method: 'POST',
                body: JSON.stringify({ ids: [cityId] })
            });
            
            if (cities && cities.length > 0) {
                const cityName = cities[0].clarified_name || cities[0].name;
                citiesCache.set(cityId, cityName);
                return cityName;
            }
        } catch (error) {
            console.error(`Ошибка при получении города ${cityId}:`, error);
        }
        
        return `${cityId}`;
    }

    async function getRoute(load) {
        const fromId = load.Loading?.CityId;
        const toId = load.Unloading?.CityId;
        
        const from = fromId ? await getCityName(fromId) : 'н/д';
        const to = toId ? await getCityName(toId) : 'н/д';
        
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

    async function getContactDisplay(load) {
        // Получаем информацию из белого списка (с Telegram)
        const contact1 = await getContactInfoWithTelegram(load.ContactId1);
        let result = `👤 Контакты:\n   ${contact1.name}\n   📞 ${contact1.phone}`;
        
        if (contact1.telegram) {
            result += `\n   ⌯⌲ ${contact1.telegram}`;
        }

        if (load.ContactId2) {
            const contact2 = await getContactInfoWithTelegram(load.ContactId2);
            result += `\n\n   ${contact2.name}\n   📞 ${contact2.phone}`;
            if (contact2.telegram) {
                result += `\n   ⌯⌲ ${contact2.telegram}`;
            }
        }

        return result;
    }

    // --- Initial Load ---
    if (sessionStorage.getItem('adminPassword')) {
        showMainContent();
    } else {
        showLogin();
    }
});
