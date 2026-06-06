# FullStackBookingSystem 🏨

A full-stack tourism and hotel booking platform built with **Spring Boot 4** (backend) and **React + Vite** (frontend).

---

## 🚀 Tech Stack

### Backend
- Java 25 + Spring Boot 4
- Spring Security (JWT + Google OAuth2)
- Spring Data JPA + Hibernate 7
- PostgreSQL 18
- WebSocket (STOMP)
- JavaMail (Gmail SMTP)
- Springdoc OpenAPI / Swagger UI
- Lombok

### Frontend
- React 18 + Vite
- React Router
- Axios
- Tailwind CSS

---

## ✨ Features

- 🔐 JWT authentication + Google OAuth2 login
- 👥 Role-based access control (Admin, Manager, User)
- 🏨 Hotel & room management with image support
- 📅 Booking system with availability checking
- ❤️ Wishlist with price & availability alerts
- 📧 Email notifications (booking confirmations, alerts)
- 🌍 Geography-based search (countries & cities)
- 🔔 Real-time WebSocket notifications
- 📊 Admin dashboard with user & role management
- 🤖 AI-powered assistant (Groq API)
- 📖 Swagger UI API documentation

---

## ⚙️ Getting Started

### Prerequisites
- Java 21+
- Node.js 18+
- PostgreSQL 15+
- Maven

### Backend Setup

1. **Clone the repo**
```bash
   git clone https://github.com/SamiThaalba/FullStackBookingSystem.git
   cd FullStackBookingSystem/tourism-booking-backend
```

2. **Create the database**
```bash
   psql -U postgres -c "CREATE DATABASE tourism_booking;"
```

3. **Configure application.properties**
```bash
   cp src/main/resources/application.properties.example src/main/resources/application.properties
```
   Then fill in your values in `application.properties`.

4. **Run the backend**
```bash
   ./mvnw spring-boot:run
```
   API available at: `http://localhost:8080`
   
   Swagger UI: `http://localhost:8080/swagger-ui/index.html`

### Frontend Setup

1. **Navigate to the root directory**
```bash
   cd FullStackBookingSystem
   npm install
```

2. **Configure environment**
```bash
   cp .env.example .env
```

3. **Start the dev server**
```bash
   npm run dev
```
   App available at: `http://localhost:5173`

---

## 🔑 Environment Variables

Copy `application.properties.example` to `application.properties` and fill in:

| Variable | Description |
|----------|-------------|
| `spring.datasource.url` | PostgreSQL connection URL |
| `spring.datasource.username` | Database username |
| `spring.datasource.password` | Database password |
| `app.jwt.secret` | JWT signing secret (min 32 chars) |
| `app.jwt.expiration-ms` | JWT expiry in milliseconds |
| `app.groq.api-key` | Groq AI API key |
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret |
| `MAIL_PASSWORD` | Gmail App Password |
| `app.admin.email` | Default admin email |
| `app.admin.password` | Default admin password |

---

## 📁 Project Structure
