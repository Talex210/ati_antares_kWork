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
            await fetchWithAuth('/api/logisticians', {
                method: 'POST',
                body: JSON.stringify({ ati_id: atiId, name: name })
            });
            logistAtiIdInput.value = '';
            logistNameInput.value = '';
            await loadLogisticians();
        } catch (error) {
            // Error is handled in fetchWithAuth
        }
    });

    logisticiansList.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const logistId = event.target.dataset.id;
            if (confirm(`Вы уверены, что хотите удалить этого логиста?`)) {
                try {
                    await fetchWithAuth(`/api/logisticians/${logistId}`, {
                        method: 'DELETE'
                    });
                    await loadLogisticians();
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

        // TODO: Заменить на динамический список топиков
        const topics = [
            { id: 1, name: 'Общий' },
            { id: 13, name: 'РЭФ' },
            { id: 14, name: 'ТЕНТ' },
        ];

        pendingLoadsList.innerHTML = loads.map(load => `
            <div class="load-card" data-load-id="${load.id}">
                <div class="load-details">
                    <p><strong>Маршрут:</strong> ${load.route?.from || 'Неизвестно'} → ${load.route?.to || 'Неизвестно'}</p>
                    <p><strong>Груз:</strong> ${load.cargoType || 'Тип груза не указан'}</p>
                    <p><strong>Ставка:</strong> ${load.price ? `${load.price} ₽` : 'По запросу'}</p>
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

        const loadId = parseInt(loadCard.dataset.loadId, 10);

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

    // --- Initial Load ---
    if (sessionStorage.getItem('adminPassword')) {
        showMainContent();
    } else {
        showLogin();
    }
});
