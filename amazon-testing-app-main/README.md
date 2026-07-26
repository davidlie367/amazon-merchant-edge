# Amazon Vine Evaluation & Admin Control Panel

A full-stack administrative control system and user dashboard designed for managing and tracking Amazon Vine reviews, user balances, deposits, withdrawals, and support chats.

---

## 🛠️ Tech Stack

### Frontend
* **Core:** React 19, TypeScript
* **Build Tool:** Vite 6
* **Styling:** Tailwind CSS v4
* **Icons:** Lucide React
* **Animations:** Motion (formerly Framer Motion)

### Backend
* **Core:** Node.js, Express, TypeScript
* **Runtime Runner:** tsx (TypeScript execute)
* **Real-time:** WebSockets (`ws` package)
* **Security:** Helmet (Content Security Policy), Express Rate Limit, CORS

### Database
* **Engine:** PostgreSQL hosted on Supabase
* **Client:** `@supabase/supabase-js`

---

## 📦 Directory Structure

```text
amazon-panel/
├── backend/
│   ├── database/
│   │   └── schema.sql        # Consolidated master database schema
│   ├── public/
│   │   ├── admin/            # Pre-built admin panel static assets
│   │   ├── uploads/          # Local static files upload directory
│   │   └── super.html        # Super admin panel interface
│   ├── src/
│   │   ├── config/           # Database & Store configurations
│   │   ├── middlewares/      # Express authentication & rate-limiting middleware
│   │   ├── routes/           # REST API endpoints (Auth, Admin, Chat, Reviews, Transactions)
│   │   ├── services/         # WebSockets, Audit logging, Caching
│   │   └── server.ts         # Backend entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── pages/            # React pages (Landing, Login, Dashboard, etc.)
│   │   ├── main.tsx          # Frontend entry point
│   │   └── index.css         # Global Tailwind directives
│   ├── package.json
│   └── vite.config.ts
├── README.md                 # Project summary and documentation
└── deployment.md             # Direct instructions for going live
```

---

## 🌟 Core App Features

1. **User Portal:**
   - Onboarding with referral codes.
   - Task view for submitting review screenshots.
   - Wallet manager to request deposits and withdrawals.
   - Live support chat with administrators.

2. **Admin Control Panel (`/admin`):**
   - Live stats dashboard (Growth charts, deposit/withdrawal flow, activity feed).
   - User database management with status editing.
   - Review submission verification (Approve/Reject review requests).
   - Deposit and Withdrawal request verification.
   - Support Chat portal matching admins with users.

3. **Super Admin Control Panel (`/super-admin`):**
   - Admin account management (Create/restrict administrative users).
   - Assigned User Matrix (Bind specific administrators to manage select users).
   - Audit trail tracker (Log IP, timestamp, and details of administrative activities).

---

## 🔄 Core Workflows

```mermaid
graph TD
    A[User Registers] -->|Pending Status| B[Admin Approves Registration]
    B --> C[User Onboarded & Deposits Funds]
    C --> D[Admin Verifies Deposit]
    D -->|From Admin VIP Panel| E[Admin Assigns Products Pool]
    E --> F[User Submits Reviews for Products]
    F -->|Review Auto-Approved Instantly| G[Progress & Balances Updated]
    G -->|Under 25 Reviews| F
    G -->|Complete 25 Reviews Batch| H[User Submits Withdrawal Request]
    H --> I[Admin Audits Withdrawal Request]
    I -->|Approved| J[Withdrawal Completed & Payout Processed]
    I -->|Rejected| K[Withdrawal Rejected & Funds Refunded]
```

### 1. Verification & Wallet Flow
1. **User Registration:** New users sign up and enter a **Pending** status, which blocks dashboard access.
2. **Registration Approval:** Administrative operators inspect and approve registrations, onboarding the users.
3. **Deposit Request & Audit:** Onboarded users request a deposit. Administrators audit the payment details and approve it, crediting the funds to the platform balance.
4. **VIP Products Assignment:** Administrators open the VIP panel and assign specific campaign products (VIP 1/2/3) to the user's account.
5. **Product Reviews:** Users review their assigned products. Submissions are auto-approved instantly, crediting commissions and updating their progress positions.
6. **Withdrawal Request:** Once all 25 products are complete, the user requests a withdrawal.
7. **Withdrawal Audit:** Administrators verify the withdrawal request (ensuring sufficient balance and valid logs). If approved, the payout is processed; if rejected, the balance is refunded.

### 2. Live Support Chat Workflow
1. A user sends a message via the support chat widget.
2. The WebSocket server receives the message and broadcasts a real-time event to all active admins.
3. Any active admin can reply instantly, which sends the message back to the specific user session in real time.

### 3. Super Admin & Assigned Users Matrix
1. **Create Admins:** Super Admins create individual admin accounts.
2. **Restricted Mode:** Admins can be marked as `is_restricted`.
3. **Scope Binding:** Restricted admins can *only* view stats and manage users who have been explicitly assigned to them in the `admin_assigned_users` table.

---

## 🔒 Production-Grade Lifetime Robustness Features

We have audited and upgraded the system architectures to guarantee long-term stability and resilience under production traffic:

1. **Concurrency Protection (No Double-Spends/Overwrites):**
   - **Check Constraint:** Enforces `check_positive_balance` directly at the PostgreSQL layer, preventing `wallet_balance` from ever dropping below zero.
   - **Stored RPC Procedures:** All balance adjustments (withdrawals, task commissions, administrative adjustments, and rejection refunds) run atomically inside Supabase stored database functions (`decrement_platform_balance`, `increment_user_review_progress`, `adjust_platform_balance`). This guarantees thread-safety against rapid clicks and automated API spam.
   - **Defensive Fallbacks:** The API endpoints check for the existence of RPC functions, logging clean fallback warnings and executing manual updates if migrations are not fully populated.

2. **WebSocket Memory leak Prevention (Heartbeat Ping-Pong):**
   - A background heartbeat interval runs every 30 seconds inside [wsService.ts](file:///c:/Users/Microsoft/Desktop/amazon-panel/backend/src/services/wsService.ts).
   - Any client sockets that disconnect abruptly (e.g. signal drops, dead batteries) without a clean TCP handshake are automatically terminated and clean-spliced out, avoiding memory and file descriptor leakages.

3. **Stateless Image Storage (Supabase Storage Buckets):**
   - File uploads in support chats and payment proof receipts upload directly to the public Supabase Storage bucket `chat-attachments` instead of the local filesystem.
   - Keeps backend instances stateless and compatible with modern ephemeral hostings (Vercel, Render, Heroku).
   - Automatically falls back to local disk storage if the storage bucket is offline or unconfigured.

4. **Strict Operator Roles & Permission Checks:**
   - Restricted operator administrative accounts are strictly gated.
   - Restricted admins can only view stats and manage users assigned directly to them. Global campaigns (adding/editing/deleting products), settings changes, and combo checkpoint setups are strictly unauthorized and protected via endpoint permission checks.

---

## 🚀 Running Locally

### 1. Database & Storage Setup
1. Create a PostgreSQL Database on [Supabase](https://supabase.com/).
2. Run the queries inside `backend/database/schema.sql` in the **SQL Editor** on your Supabase dashboard to create the tables and stored RPC procedures.
3. Go to **Storage** in Supabase, create a new public bucket named exactly `chat-attachments` to store support screenshots.

### 2. Run Backend
1. Go into the backend directory:
   ```bash
   cd backend
   ```
2. Create a `.env` file and populate it (see `backend/.env.example`).
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

### 3. Run Frontend
1. Go into the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Access the web app at `http://localhost:3000`.

