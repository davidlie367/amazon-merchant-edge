# 🚀 Deployment Guide

This guide details the step-by-step instructions to deploy the Amazon Vine Control Panel to production using **Supabase** (Database), **Render or Railway** (Backend Server), and **Vercel** (Frontend Application).

---

## 🗄️ Step 1: Database & Storage Setup (Supabase)

1. Log in to the [Supabase Dashboard](https://supabase.com/).
2. Create a new project. Note your **Database Password** and region.
3. Once the database is ready, go to the **SQL Editor** tab on the left navigation menu.
4. Click on **New Query** (or **New Blank Query**).
5. Copy the entire content of [backend/database/schema.sql](file:///c:/Users/Microsoft/Desktop/amazon-panel/backend/database/schema.sql) and paste it into the editor.
6. Click **Run** at the bottom right. This will create all required tables, performance indexes, and database-level stored RPC procedures (`decrement_platform_balance`, `increment_user_review_progress`, `adjust_platform_balance`).
7. Go to the **Storage** tab in the left sidebar of your Supabase console.
8. Click **New Bucket**, name it exactly `chat-attachments`, toggle the **Public** bucket setting to enabled, and click save.
9. Go to **Project Settings** > **API**.
10. Copy the following credentials:
   - **Project URL** (e.g., `https://xxxxxx.supabase.co`)
   - **API Key** (Copy the `anon` / `public` key)

---

## 💻 Step 2: Backend Deployment (Render or Railway)

Since we are keeping the server setup simple without Docker container overhead, we will deploy it as a standard **Node.js Web Service**.

### Option A: Render Setup
1. Log in to [Render](https://render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your Git repository.
4. Set the following configuration details:
   - **Name:** `amazon-panel-backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm run build` (This runs `tsc` to compile TypeScript to compiled JS in the `dist/` directory)
   - **Start Command:** `npm run start` (This runs `node dist/server.js`)
5. Click **Advanced** to add **Environment Variables** (see below).

### Option B: Railway Setup
1. Log in to [Railway](https://railway.app/).
2. Click **New Project** > **Deploy from GitHub repo**.
3. Select your repository.
4. Go to the **Variables** tab of the service.
5. Add the environment variables listed below.
6. Railway will automatically detect the build/start commands from `package.json`.

### 🔑 Required Backend Environment Variables
Add these key-value pairs in your hosting dashboard:

| Variable Name | Description | Example / Value |
|---|---|---|
| `NODE_ENV` | Run environment | `production` |
| `PORT` | Listening Port | `5000` (Render/Railway sets this automatically) |
| `JWT_SECRET` | Secret key used to sign Auth tokens | *Provide a secure, long random string* |
| `SUPABASE_URL` | Your Supabase Project URL | `https://xxxxxx.supabase.co` |
| `SUPABASE_KEY` | Your Supabase public API Key | *Your Supabase anon key* |
| `FRONTEND_URL` | Allowed CORS origins for the frontend app | `https://your-frontend-app.vercel.app` |

---

## 🎨 Step 3: Frontend Deployment (Vercel)

1. Log in to [Vercel](https://vercel.com/).
2. Click **Add New** > **Project**.
3. Import your Git repository.
4. Select the **Root Directory** as `frontend`.
5. Vercel will automatically detect **Vite** as the framework.
6. Set the Build and Output settings (keep defaults):
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
7. Click **Deploy**.
8. Once deployed, Vercel will provide your live frontend URL (e.g., `https://your-frontend-app.vercel.app`).
9. **CRITICAL:** Copy this URL, go back to your **Backend Service settings**, and update the `FRONTEND_URL` environment variable with this URL so that CORS allows the frontend to call the API. Redeploy/restart the backend service.

---

## 🧪 Step 4: Verification & Testing

Once both services are active:
1. Open your frontend URL. Try logging in or registering a new user account.
2. Verify you can access the admin login page and stats load cleanly.
3. Check the browser console to ensure there are no CORS or CSP (Content Security Policy) errors blocking connection to your backend server.
