# Booking System Frontend

React frontend for the tourism booking Spring Boot backend.

## Run locally

```bash
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:8080`, which avoids browser CORS issues during local development.

## Environment

Copy `.env.example` to `.env` if you need to point the app at another API origin:

```bash
VITE_API_BASE_URL=/api
```

## Backend notes

The backend protects the hotel catalog with JWT authentication, so guests should register or log in before searching and booking. Manager and admin screens are shown based on JWT roles and permissions.
