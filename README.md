# WhatsApp API Dashboard

This project provides a simple API to connect with WhatsApp and a web-based dashboard to interact with it. You can send messages, view received messages, and manage your WhatsApp connection through a user-friendly interface.

## Features

*   **WhatsApp API Backend:** A Node.js server using `whatsapp-web.js` to handle the connection with WhatsApp.
*   **React Frontend:** A dashboard to view the connection status, QR code for authentication, send messages, and view recent conversations.
*   **Single Command Startup:** Run both the backend and frontend with a single command.

## Prerequisites

*   Node.js (v16 or higher recommended)
*   npm

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/leoleli/whatsapp-api.git
    cd whatsapp-api
    ```

2.  **Create an environment file for the backend:**
    Navigate to the `backend` directory and create a `.env` file.
    ```bash
    cd backend
    touch .env
    ```
    Add your secret access tokens to the `.env` file in the following format. You can have multiple tokens, separated by commas.
    ```
    VALID_TOKENS=your_secret_token_1,your_secret_token_2
    ```
    Then, return to the root directory:
    ```bash
    cd ..
    ```

3.  **Install dependencies:**
    From the root directory, run the following command. This will install the dependencies for the root, frontend, and backend all at once.
    ```bash
    npm install
    ```

4.  **Run the application:**
    From the root directory, run the following command. This will start both the backend server and the frontend development server concurrently.
    ```bash
    npm start
    ```
    *   The backend API will be running on `http://localhost:3001`.
    *   The frontend dashboard will be accessible at `http://localhost:3000`.

## API Endpoints

The backend exposes the following API endpoints. All protected routes require a valid `x-access-token` in the header.

### Public Routes

*   `GET /api/status`: Get the current status of the WhatsApp connection (`authenticated`, `scan`, or `loading`).
*   `GET /api/qr`: Get the QR code for authentication if the status is `scan`.
*   `POST /api/validate-token`: Check if an access token is valid.

### Protected Routes

*   `POST /api/reconnect`: Attempt to reconnect to WhatsApp.
*   `POST /api/message`: Send a text message.
    *   **Body:** `{ "number": "5511999999999", "message": "Hello world" }`
*   `POST /api/media`: Send a media message from a URL.
    *   **Body:** `{ "number": "5511999999999", "caption": "My caption", "mediaUrl": "data:image/png;base64,..." }`
*   `POST /api/webhook`: Register a webhook URL to receive incoming messages.
    *   **Body:** `{ "url": "https://your-webhook-url.com" }`
*   `GET /api/messages`: Get the last 50 received messages.
