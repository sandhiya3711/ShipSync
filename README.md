<<<<<<< HEAD
# ShipSync | AI Courier Billing & Excel Automation SaaS

**ShipSync** is a premium, state-of-the-art AI-powered logistics SaaS platform designed to automate courier billing audits, company consignment segregation, and slip OCR data extraction. Built on a high-fidelity glassmorphic design system, it provides dual dark/light layouts, interactive dashboards, editable OCR scan previews, fuzzy string mergers, and a dynamic weight slabs rate card manager.

---

## 🚀 One-Command Launch (Concurrently)
ShipSync is configured as a multi-package workspace. You can start both the **Express API Server** and the **Next.js Web Application** concurrently with a single terminal command from the root directory:

```bash
# Boot both servers together
npm run dev
```

*   **Unified Full-Stack Portal Link**: **[http://localhost:3000](http://localhost:3000)** (Accesses both frontend UI and backend API routes seamlessly under one address!)

---

## 🔐 Quick Development Logins (Pre-Seeded)
To facilitate immediate pairs testing, the local database comes pre-seeded with encrypted employee and administrator accounts:

*   **Administrator Profile**:
    *   **Username**: `admin`
    *   **Password**: `admin123`
    *   *Privileges*: Upload files, scan slips, full Weight Slab CRUD, Zone rates edits, merge fuzzy groups, and clear ship history databases.
*   **Employee Profile**:
    *   **Username**: `employee`
    *   **Password**: `employee123`
    *   *Privileges*: Upload sheets, run OCR slip parses, edit scans, download segregated xlsx documents, and check general analytical widgets.

---

## 📊 Pre-Seeded Pricing slabs & Custom Tariffs
The billing engine has been pre-configured with the precise rates card matching your shipping specifications (including 18% GST auto-applied on Net rates):

| Zone Region | Up to 250g | 250g to 500g | 500g to 1kg | Excess Weight rate/kg |
| :--- | :---: | :---: | :---: | :---: |
| **Chennai** | $40.00 | $42.00 | $45.00 | $30.00 |
| **Tamil Nadu** | $65.00 | $68.00 | $70.00 | $50.00 |
| **South India** | $75.00 | $78.00 | $80.00 | $60.00 |
| **Hyderabad** | $75.00 | $75.00 | $80.00 | $60.00 |
| **North/East/West** | $100.00 | $150.00 | $230.00 | $100.00 |

*Accrued tax rules automatically append 18% GST on the final base slab fee calculation.*

---

## 🛠️ High-Performance Technology Stack
*   **Frontend**: Next.js 14+ (App Router), Tailwind CSS v4 Theme, Framer Motion (micro-animations), Recharts (KPI area curves, pie segments).
*   **Backend**: Node.js, Express.js.
*   **Database ORM**: Prisma Client configured for SQLite (for seamless local setup with zero friction).
*   **Excel Parsing**: SheetJS (`xlsx`) for processing bulk master uploads.
*   **Excel Rendering**: `exceljs` for styled Excel exports featuring corporate headers, metadata summaries, column autofits, and totals formulas.
*   **OCR Parsing**: Tesseract.js (pure JavaScript OCR engine running natively without requiring binary software installations on Windows).

---

## 📂 Production Folder Structure
```
ShipSync/
├── package.json               # Workspace concurrently boot script
├── README.md                  # System Documentation
├── backend/                   # Express API Server
│   ├── src/
│   │   ├── index.js           # Server Entrypoint
│   │   ├── controllers/       # Auth, Excel, OCR, Billing controllers
│   │   ├── routes/            # Express endpoint mappings
│   │   ├── services/          # OCR, Excel, Billing, Fuzzy Match engines
│   │   ├── middleware/        # JWT Authentication, Multer file filters
│   │   └── utils/             # Database seeding scripts
│   ├── prisma/
│   │   ├── schema.prisma      # DB schema (SQLite switchable to Postgres)
│   │   └── dev.db             # Local SQLite binary database
│   └── uploads/               # Temporary uploads directories
└── frontend/                  # Next.js React Web App
    ├── src/
    │   ├── app/
    │   │   ├── globals.css    # Premium CSS Variables, theme toggles, glassmorphism
    │   │   ├── layout.js      # Head elements, dynamic Google fonts
    │   │   └── page.js        # High-fidelity dashboard application console
    │   └── components/        # Reusable component files
```

---

## ⚙️ How to Switch to PostgreSQL in Production
To swap from SQLite to PostgreSQL when deploying to production:

1.  Open `backend/prisma/schema.prisma` and change the datasource block:
    ```prisma
    datasource db {
      provider = "postgresql"
      url      = env("DATABASE_URL")
    }
    ```
2.  Open `backend/.env` and update the database URL link:
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/shipsync?schema=public"
    ```
3.  Re-run the schema migration commands:
    ```bash
    cd backend
    npx prisma generate
    npx prisma db push
    ```

---

## 💎 Premium Design & Micro-animations
ShipSync focuses heavily on aesthetic value:
*   **Glassmorphic panels** with backdrop blur layers and subtle ambient glows.
*   **Interactive stats widgets** with micro-animations on hover.
*   **Pre-loaded Slip OCR testing**: In case you do not have a cargo receipt image on hand, the uploader features a **"Pre-load Sample Slip"** button which instantly simulates the OCR regex extraction pipeline on your 350g Tamil Nadu rate card!
*   **Fuzzy Merger Console**: Allows manual merging of similar company names, automatically moving all database rows under the parent name and writing a permanent search alias.
=======
# ShipSync
>>>>>>> e46fdca5f7b4acabe1306249b1ef51f3a180f3d1
