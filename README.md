# Whale Transaction Monitor

## Project Setup

### 1. Backend (Node.js/Express)
- Located in `backend/`
- Install dependencies: `cd backend && npm install`
- Create a `.env` file in `backend/` (see `.env.example` for required keys)
- Start server: `node index.js`

### 2. Frontend (React + Vite)
- Located in `frontend/`
- Install dependencies: `cd frontend && npm install`
- Start dev server: `npm run dev`

### 3. API Keys
- **Bitquery API Key:**
  - Register at [bitquery.io](https://bitquery.io/)
  - Go to your dashboard and copy your API key
  - Add it to your `.env` as `BITQUERY_API_KEY`
- **SendGrid API Key (for email alerts):**
  - Register at [sendgrid.com](https://sendgrid.com/)
  - Create an API key in the SendGrid dashboard
  - Add it to your `.env` as `SENDGRID_API_KEY`
- **Supabase (PostgreSQL) Setup:**
  - Register at [supabase.com](https://supabase.com/)
  - Create a new project and get the project URL and service key
  - Add them to your `.env` as `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`

### 4. Running the Project
- Start backend and frontend servers as described above.
- The frontend will connect to the backend for all data and subscription actions.

---

This project is an MVP for monitoring large crypto transactions ("whale" transfers) across multiple blockchains using Bitquery's API.