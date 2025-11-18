# GEMINI Project Analysis

## Project Overview

This project is a Node.js application that integrates with the ATI.SU API and a Telegram bot. The application automatically monitors the ATI.SU API for new loads, filters them based on a whitelist of logisticians, and adds them to a queue for publication. The application also performs a full synchronization, removing loads from the local database if they are no longer available in the ATI.SU API, ensuring data consistency. Administrators can manage logisticians, view pending loads, and publish them to different topics in a Telegram group through a web-based control panel.

The backend is built with Node.js, TypeScript, and Express.js, using `node-telegram-bot-api` for Telegram integration and `sqlite3` for the database. The frontend is built with vanilla JavaScript, HTML, and CSS.

## Building and Running

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- Telegram Bot Token
- ATI.SU API Token

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/Talex210/ati_antares_kWork.git
    cd ati_antares_kWork
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

### Configuration

Create a `.env` file in the root of the project with the following content:

```env
# Токен Telegram-бота от @BotFather
TELEGRAM_BOT_TOKEN="your_bot_token_here"

# ID Telegram-группы (со знаком минус)
TELEGRAM_CHAT_ID="-1001234567890"

# Пароль для входа в админ-панель
ADMIN_PASSWORD=your_secure_password

# Токен API ATI.SU
ATI_API_TOKEN=your_ati_token_here

# Порт для веб-сервера (опционально, по умолчанию 3000)
PORT=3000
```

### Running the Application

-   **Development:**
    ```bash
    npm run start:dev
    ```
-   **Production:**
    ```bash
    npm start
    ```
-   **With PM2 (recommended for server):**
    ```bash
    pm2 start dist/index.js --name ati-bot
    pm2 save
    pm2 startup
    ```

## Development Conventions

-   **Linting:** The project uses ESLint for code quality. Run `npm run lint` to check for issues and `npm run lint:fix` to automatically fix them.
-   **Formatting:** The project uses Prettier for code formatting. Run `npm run format` to format the code.
-   **Database:** The application uses SQLite for its database. The database is created automatically on the first run.
-   **API:** The API endpoints are defined in `src/api/router.ts`. All endpoints require an `Authorization` header with a bearer token.
-   **Deployment:** The `DEPLOY.md` file contains detailed instructions for deploying the application to a server using `pm2`.
