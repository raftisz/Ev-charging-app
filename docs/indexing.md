# Database Indexing — Volt Grid (Ev-charging-app)

ทดลองสร้าง index ใน PostgreSQL แล้วนำไปใช้กับ database ของโปรเจค (Prisma + PostgreSQL)

## 1. การทดลอง

ทดลองบน PostgreSQL 16 (Docker) ตาราง `bookings` ของโปรเจคเวอร์ชัน FastAPI ของกลุ่ม จำนวน 600,007 แถว วัดด้วย `EXPLAIN ANALYZE` ก่อนและหลังสร้าง index ผลจึงใช้แสดงหลักการ ไม่ใช่ตัวเลขที่วัดจาก Ev-charging-app โดยตรง

| Query | ก่อนมี index | หลังมี index | เร็วขึ้น |
|---|---|---|---|
| ประวัติการจองของ user (กรอง user_id + status เรียงตามเวลา LIMIT 20) | 83.843 ms | 0.354 ms | ประมาณ 237 เท่า |
| การจองตามวันที่ + status (ได้ 3,330 แถว) | 77.780 ms | 36.502 ms | ประมาณ 2.1 เท่า |

- Query แรก: ก่อนมี index ใช้ index เดี่ยวของ user_id อ่าน 54,424 แถว ทิ้ง 36,355 แถว แล้วต้อง Sort เอง หลังมี composite index เป็น Index Scan ไม่มี Sort อ่านแค่ 20 แถว
- Query ที่สอง: จาก Parallel Seq Scan (อ่านทั้งตาราง) เป็น Bitmap Index Scan แต่ต้องดึงข้อมูลจริง 3,330 แถว จึงเร็วขึ้นไม่มากเท่า
- ขนาด index ใหม่ในการทดลอง: 23 MB และ 4.2 MB ต่อ 600,007 แถว

## 2. Query จริงของแอปและ index ที่เพิ่ม

เลือก index จาก query ที่แอปรันจริง (ใน `src/`) เพิ่ม 4 ตัวใน `prisma/schema.prisma`:

| Model | Query ในโค้ด | Index ที่เพิ่ม |
|---|---|---|
| Reservation | รายการจองของ user เรียงตาม startTime (src/app/api/reservations/route.ts) | [userId, startTime] |
| ChargingSession | ประวัติและสถิติของ user ตามช่วงเวลา (src/server/sessions.ts, src/server/stats.ts) | [userId, startTime] |
| ChargingSession | สถิติ admin ย้อนหลัง 30 วัน ทุก user (src/server/stats.ts) | [startTime] |
| Notification | แจ้งเตือนล่าสุดของ user เรียงตาม createdAt (src/app/api/notifications/route.ts) | [userId, createdAt] |

index เดิมที่มีอยู่แล้ว: Reservation [userId, status] และ [chargerId, startTime], ChargingSession [userId, status] และ [status], Notification [userId, isRead], Station [status], Charger [status]

## 3. การนำไปใช้

- แก้ `prisma/schema.prisma` และเพิ่ม migration `prisma/migrations/20261003054500_add_history_indexes/migration.sql` (commit 1220e2f)
- สคริปต์ `vercel-build` ของโปรเจครัน `prisma migrate deploy` ทุกครั้งที่ deploy จึงสร้าง index ใน database ที่ deploy ให้อัตโนมัติ

## 4. ข้อสรุป

1. Composite index ที่เรียงคอลัมน์ตาม query (เงื่อนไข = ก่อน แล้วตามด้วยคอลัมน์ ORDER BY) ให้ผลดีที่สุด เพราะไม่ต้อง Sort และอ่านเฉพาะแถวที่ต้องการ
2. ถ้า query ต้องดึงแถวจำนวนมาก ประโยชน์ของ index ลดลง เพราะคอขวดย้ายไปที่การอ่านข้อมูลจริง
3. Index มีต้นทุน คือใช้พื้นที่เพิ่ม และทุก INSERT/UPDATE/DELETE ต้องอัปเดต index ด้วย จึงสร้างเฉพาะตัวที่ตรงกับ query ที่ใช้จริง
4. ลำดับคอลัมน์ใน composite index สำคัญ (leftmost prefix rule)
5. ข้อมูล seed ของโปรเจคมีน้อย ผลที่เห็นในแอปตอนนี้จึงยังไม่ชัด index เหล่านี้เป็นการเตรียมรองรับข้อมูลที่เพิ่มขึ้น
