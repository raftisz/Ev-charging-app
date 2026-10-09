# Volt Grid — System Diagrams

## 1. Current Architecture (Next.js Full-stack Monolith)

ระบบปัจจุบันเป็น Next.js แอปเดียว ทั้งหน้าเว็บและ REST API (Route Handlers) อยู่ในโปรเจคเดียวกัน ใช้ Prisma ต่อ PostgreSQL ตัวเดียว

```mermaid
flowchart LR
    DRV["Driver<br/>Browser"] --> APP
    ADM["Operator / Admin<br/>Browser"] --> APP
    OSM["OpenStreetMap Tiles"] -.-> DRV

    subgraph APP["Next.js 16 App : Vercel / Render"]
        UI["React 19 Pages<br/>App Router"]
        MW["Auth Guard<br/>JWT httpOnly cookie + roles"]
        subgraph API["REST API Route Handlers"]
            AUTH["Auth"]
            STA["Stations + Chargers<br/>search / filter / favourites"]
            RES["Reservations<br/>clash detection"]
            SES["Charging Sessions<br/>start / live / stop"]
            PAY["Payments"]
            NOTI["Notifications"]
            ADMIN["Admin Console<br/>KPIs + CRUD"]
            HEALTH["/api/health"]
        end
        ORM["Prisma 7 ORM"]
        UI --> MW --> API
        API --> ORM
    end

    ORM --> DB[("PostgreSQL 16")]
```

## 2. Target Microservices Architecture

แผนแยกแต่ละ domain ออกเป็น service อิสระ แต่ละตัวมี database ของตัวเอง สื่อสารผ่าน API Gateway และ event ผ่าน Message Broker (เป็นแผนในอนาคต ยังไม่ได้พัฒนา)

```mermaid
flowchart LR
    WEB["Next.js Frontend<br/>Driver + Admin UI"] --> GW["API Gateway<br/>routing / JWT verify / rate limit"]

    GW --> AUTH["Auth Service"]
    GW --> STA["Station Service"]
    GW --> RES["Reservation Service"]
    GW --> SES["Charging Session Service"]
    GW --> PAY["Payment Service"]
    GW --> ADM["Admin / Analytics Service"]

    AUTH --> DB1[("auth_db")]
    STA --> DB2[("station_db")]
    RES --> DB3[("reservation_db")]
    SES --> DB4[("session_db")]
    PAY --> DB5[("payment_db")]
    ADM --> DB6[("analytics_db")]

    RES -.->|"check charger"| STA
    SES <-->|"OCPP"| CP[["Charger Hardware"]]

    RES -->|"reservation.created"| MQ{{"Message Broker"}}
    SES -->|"session.completed"| MQ
    PAY -->|"payment.succeeded"| MQ
    MQ -->|"create invoice"| PAY
    MQ --> NOTI["Notification Service"]
    MQ --> ADM
```

## 3. Technology Stack

```mermaid
flowchart TB
    subgraph FE["Presentation"]
        F1["React 19"] --- F2["Next.js 16 App Router"] --- F3["Tailwind CSS v4"]
        F4["Leaflet + OpenStreetMap"] --- F5["Poppins / Inter"]
    end

    subgraph BE["Application / API"]
        B1["TypeScript"] --- B2["Next.js Route Handlers<br/>REST API"] --- B3["Node.js 20+"]
    end

    subgraph SEC["Security"]
        S1["JWT in httpOnly cookie"] --- S2["Role-based access<br/>Driver / Operator / Admin"]
    end

    subgraph DATA["Data"]
        D1["Prisma 7 ORM + Migrations"] --- D2[("PostgreSQL 16")]
    end

    subgraph QA["Quality"]
        Q1["ESLint"] --- Q2["tsc typecheck"] --- Q3["API test suite<br/>183 cases"] --- Q4["Playwright UI<br/>102 cases"] --- Q5["Time zone unit<br/>20 cases, TZ=UTC"] --- Q6["Money format unit<br/>9 cases"] --- Q7["PromptPay payload unit<br/>16 cases"] --- Q8["Station photos unit<br/>15 cases"]
    end

    subgraph OPS["DevOps / Deploy"]
        O1["Docker Compose<br/>local DB"] --- O2["Git / GitHub"] --- O3["Vercel"] --- O4["Render"]
    end

    FE -->|"fetch / JSON"| BE
    BE --> SEC
    BE --> DATA
    QA -.-> BE
    OPS -.-> BE
    OPS -.-> DATA
```

## 4. ER Diagram (Database)

ความสัมพันธ์ของตารางทั้งหมดใน `prisma/schema.prisma` (PostgreSQL)

```mermaid
erDiagram
    User ||--o{ Reservation : makes
    User ||--o{ ChargingSession : starts
    User ||--o{ Notification : receives
    User ||--o{ Favorite : saves
    Station ||--o{ Charger : has
    Station ||--o{ Reservation : "booked at"
    Station ||--o{ ChargingSession : hosts
    Station ||--o{ Favorite : "favourited as"
    Charger ||--o{ Connector : offers
    Charger ||--o{ Reservation : reserved
    Charger ||--o{ ChargingSession : used
    Reservation ||--o| ChargingSession : "becomes"
    User ||--o{ Payment : "pays / tops up"
    ChargingSession ||--o{ Payment : "settled by"

    User {
        int id PK
        string email UK
        string passwordHash
        string fullName
        string role "USER / OPERATOR / ADMIN"
        float walletBalance
        boolean isActive
    }
    Station {
        int id PK
        string name
        string address
        float latitude
        float longitude
        string status
        float pricePerKwh
        int imageHue
        string imageUrl "optional, /stations/*.webp"
    }
    Charger {
        int id PK
        int stationId FK
        string chargerCode
        string status
        float powerKw
    }
    Connector {
        int id PK
        int chargerId FK
        string type "CCS2 / TYPE2 / CHADEMO"
        float powerKw
    }
    Reservation {
        int id PK
        int userId FK
        int stationId FK
        int chargerId FK
        datetime startTime
        datetime endTime
        string status
        float estimatedCost
    }
    ChargingSession {
        int id PK
        int userId FK
        int stationId FK
        int chargerId FK
        int reservationId FK "unique, optional"
        string status
        datetime startTime
        float energyKwh
        float cost
        string paymentStatus
    }
    Payment {
        int id PK
        int sessionId FK "optional, null for top-ups"
        int userId FK
        string type "CHARGE / TOPUP / REFUND"
        float amount
        string method "WALLET / CREDIT_CARD / PROMPTPAY"
        string status "PENDING / PAID / FAILED / REFUNDED"
        string providerRef
        datetime createdAt
    }
    Notification {
        int id PK
        int userId FK
        string type
        string title
        boolean isRead
        datetime createdAt
    }
    Favorite {
        int id PK
        int userId FK
        int stationId FK
    }
```

## 5. User Journey

```mermaid
flowchart LR
    A["Landing / Login / Register"] --> B["Dashboard"]
    B --> C["Find a station<br/>map + filters"]
    C --> D["Station detail<br/>chargers + connectors"]
    D --> E["Reserve a time slot<br/>Bangkok time + clash check"]
    D --> F["Start charging"]
    E --> F
    F --> G["Live session<br/>% / kWh / cost"]
    G --> H["Stop charging"]
    H --> I["Pay<br/>wallet / card / PromptPay"]
    I --> J["History + Notifications"]
    I --> R["Receipt<br/>print / save as PDF"]
    I -.->|"balance too low"| W["Wallet<br/>top up + transactions"]
    W --> I
    B --> K["Favourites / Profile / Vehicle"]
    L["Operator / Admin"] --> M["Admin console<br/>stations, chargers,<br/>reservations, sessions, users"]
    M -->|"ADMIN only"| RF["Refund to wallet"]
```

## 6. PromptPay Payment Flow

ทั้งจ่ายค่าชาร์จและเติมเงิน ใช้ QR แบบ EMVCo ที่ใส่ยอดเงินจริง แล้วยืนยันการรับเงินแบบจำลอง (ยังไม่ได้ต่อธนาคาร)

```mermaid
sequenceDiagram
    actor D as Driver
    participant UI as History / Charging / Wallet
    participant API as Next.js API
    participant DB as PostgreSQL

    D->>UI: เลือก PromptPay QR
    UI->>API: PATCH /api/charging-sessions/{id} (pay)<br/>หรือ POST /api/wallet/topup
    API->>DB: Payment PENDING (CHARGE / TOPUP)
    API-->>UI: 202 + EMVCo payload (ยอดเงิน + CRC)<br/>ผู้รับจาก env PROMPTPAY_ID
    UI-->>D: แสดง QR
    D->>UI: กด "ยืนยันการชำระ"
    UI->>API: POST /api/payments/{id}/confirm
    API->>DB: $transaction: Payment PAID +<br/>session PAID หรือ wallet += ยอด
    API->>DB: Notification
    API-->>UI: 200
```

## 7. Refund Flow (Admin)

```mermaid
sequenceDiagram
    actor A as Admin
    participant UI as /admin/sessions
    participant API as POST /api/payments/{id}/refund
    participant DB as PostgreSQL

    A->>UI: กด Refund บนรายการที่ Paid
    UI->>API: refund
    API->>API: role ต้องเป็น ADMIN (OPERATOR ได้ 403)
    API->>DB: $transaction
    Note over DB: Payment PAID → REFUNDED (updateMany แบบมีเงื่อนไข, ซ้ำได้ 409)<br/>Session → REFUNDED<br/>Wallet += ยอด<br/>Payment ใหม่ type REFUND
    API->>DB: Notification "Refund issued"
    API-->>UI: 200 { payment, refund, balance }
```

