# Database Indexing — Volt Grid (Ev-charging-app)

ทดลองสร้าง index ใน PostgreSQL กับ database ของโปรเจคนี้ (Prisma + PostgreSQL) แล้ววัดผลด้วย `EXPLAIN ANALYZE` ก่อนและหลังสร้าง index

## 1. สภาพแวดล้อมการทดลอง

- PostgreSQL 16 ใน Docker (`docker compose up -d db`, port 5433) สร้าง schema จริงของโปรเจคด้วย `prisma migrate deploy` แล้ว seed ข้อมูลตั้งต้น
- เพิ่มข้อมูลทดสอบด้วย `generate_series` สุ่ม user: `ChargingSession` รวม 500,113 แถว (10 users ละประมาณ 50,000 แถว) และ `Notification` รวม 300,012 แถว
- รัน `ANALYZE` ก่อนวัดทุกครั้ง วิธีวัด "ก่อน" คือลบ index ใหม่ออกจาก database ทดลอง ส่วน "หลัง" คือสร้างคืนด้วยชื่อและคอลัมน์เดียวกับใน migration

## 2. ผลการวัด

| Query | ก่อนมี index | หลังมี index | เร็วขึ้น |
|---|---|---|---|
| ประวัติการชาร์จของ user (`WHERE userId = 1 ORDER BY startTime DESC LIMIT 20`) | 105.769 ms | 0.465 ms | ประมาณ 227 เท่า |
| แจ้งเตือนล่าสุดของ user (`WHERE userId = 1 ORDER BY createdAt DESC LIMIT 20`) | 32.417 ms | 0.173 ms | ประมาณ 187 เท่า |

**ChargingSession**
- ก่อน: Parallel Bitmap Heap Scan ผ่าน index เดิม `ChargingSession_userId_status_idx` อ่าน 50,149 แถวของ user แล้วต้อง Sort เองเพื่อเอา 20 แถวล่าสุด
- หลัง: Index Scan Backward ไม่มี Sort อ่านแถวที่เกี่ยวข้องเพียงเล็กน้อย
- หมายเหตุ: PostgreSQL เลือกใช้ `ChargingSession_startTime_idx` (index เดี่ยว) แทน `(userId, startTime)` เพราะข้อมูลทดสอบมีแค่ 10 users กระจายเท่า ๆ กัน สแกนย้อนหลังแล้วเจอแถวของ user ครบ 20 แถวหลังกรองทิ้งเพียง 199 แถว ถ้ามี user จำนวนมากขึ้น คาดว่า composite จะถูกเลือก (ยังไม่ได้ทดสอบ)

**Notification**
- ก่อน: Bitmap Heap Scan ผ่าน `Notification_userId_isRead_idx` อ่าน 30,044 แถวแล้ว Sort เอง
- หลัง: Index Scan Backward ผ่าน `Notification_userId_createdAt_idx` ไม่มี Sort

## 3. Index ที่เพิ่มและเหตุผลจาก query จริง

| Model | Query ในโค้ด | Index ที่เพิ่ม |
|---|---|---|
| Reservation | รายการจองของ user เรียงตาม startTime (src/app/api/reservations/route.ts) | [userId, startTime] |
| ChargingSession | ประวัติและสถิติของ user ตามช่วงเวลา (src/server/sessions.ts, src/server/stats.ts) | [userId, startTime] |
| ChargingSession | สถิติ admin ย้อนหลัง 30 วัน ทุก user (src/server/stats.ts) | [startTime] |
| Notification | แจ้งเตือนล่าสุดของ user เรียงตาม createdAt (src/app/api/notifications/route.ts) | [userId, createdAt] |

index เดิมที่มีอยู่แล้ว: Reservation [userId, status] และ [chargerId, startTime], ChargingSession [userId, status] และ [status], Notification [userId, isRead], Station [status], Charger [status]

## 4. การนำไปใช้

- แก้ `prisma/schema.prisma` และเพิ่ม migration `prisma/migrations/20261003054500_add_history_indexes/migration.sql` (commit 1220e2f)
- ทดสอบ `prisma migrate deploy` บน PostgreSQL ในเครื่องแล้ว apply สำเร็จทั้งสอง migration
- สคริปต์ `vercel-build` รัน `prisma migrate deploy` ทุกครั้งที่ deploy และ deployment ของ commit นี้บน Vercel สถานะ Ready

## 5. ต้นทุนของ index (ขนาดในการทดลอง)

| Index | ขนาด |
|---|---|
| ChargingSession_userId_startTime_idx (ใหม่) | 15 MB |
| ChargingSession_startTime_idx (ใหม่) | 11 MB |
| Notification_userId_createdAt_idx (ใหม่) | 9,264 kB |
| ChargingSession_pkey (เดิม) | 11 MB |
| ChargingSession_userId_status_idx (เดิม) | 3,208 kB |
| Notification_pkey (เดิม) | 6,600 kB |

index ใหม่ 3 ตัวรวมประมาณ 35 MB สำหรับข้อมูล 800,000 แถว และทุก INSERT/UPDATE/DELETE ต้องอัปเดต index เหล่านี้ด้วย

ข้อสังเกต: ในการวัดนี้ ChargingSession_userId_startTime_idx (15 MB) ไม่ถูก PostgreSQL เลือกใช้กับ query ที่ทดสอบ เพราะข้อมูลทดสอบมี user เพียง 10 คน ควรประเมินความจำเป็นอีกครั้งเมื่อมี user จำนวนมากขึ้น (ยังไม่ได้ทดสอบ)

## 6. ข้อสรุป

1. Index ที่ตรงกับ query ทั้งส่วนกรองและส่วนเรียง ทำให้ไม่ต้อง Sort และอ่านเพียง 20 แถวที่ต้องการ เร็วขึ้นประมาณ 190-230 เท่าในการทดลองนี้
2. ต้องตรวจแผนด้วย `EXPLAIN ANALYZE` เสมอ เพราะ PostgreSQL เลือก index เอง ในกรณี ChargingSession มันเลือกตัวเดี่ยวแทน composite
3. Index มีต้นทุน คือใช้พื้นที่เพิ่ม และทุก INSERT/UPDATE/DELETE ต้องอัปเดต index ด้วย จึงสร้างเฉพาะตัวที่ตรงกับ query ที่ใช้จริง
4. ลำดับคอลัมน์ใน composite index สำคัญ (leftmost prefix rule) ใส่คอลัมน์ที่กรองด้วย = ก่อน แล้วตามด้วยคอลัมน์ที่ใช้ ORDER BY
5. ทดลองเบื้องต้นกับโปรเจคเวอร์ชัน FastAPI ของกลุ่ม (ตาราง bookings 600,007 แถว) ได้ผลแนวเดียวกัน คือ 83.843 ms เหลือ 0.354 ms

ข้อจำกัด: ข้อมูลทดสอบเป็นข้อมูลสังเคราะห์ที่กระจายสม่ำเสมอ วัดบน database ในเครื่องไม่ใช่ production และไม่ได้วัด index ของ Reservation
