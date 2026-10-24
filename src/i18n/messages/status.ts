import { defineMessages } from "@/i18n/define";

/** Labels for every enum the UI shows. */
export const status = defineMessages(
  {
    station: {
      AVAILABLE: "Available",
      BUSY: "Busy",
      OFFLINE: "Offline",
      MAINTENANCE: "Maintenance",
    },
    stationFree: (available: number, total: number) => `${available} of ${total} free`,
    stationAllBusy: (total: number) => `All ${total} in use`,
    charger: {
      AVAILABLE: "Available",
      CHARGING: "Charging",
      RESERVED: "Reserved",
      OFFLINE: "Offline",
      MAINTENANCE: "Maintenance",
    },
    reservation: {
      PENDING: "Pending",
      CONFIRMED: "Confirmed",
      ACTIVE: "Active",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
      EXPIRED: "Expired",
    },
    session: {
      ACTIVE: "Active",
      COMPLETED: "Completed",
      STOPPED: "Stopped",
      FAULTED: "Faulted",
    },
    payment: {
      PENDING: "Pending",
      PAID: "Paid",
      FAILED: "Failed",
      REFUNDED: "Refunded",
    },
    paymentMethod: {
      WALLET: "Volt Grid wallet",
      CREDIT_CARD: "Credit card",
      PROMPTPAY: "PromptPay QR",
    },
    role: {
      USER: "Driver",
      OPERATOR: "Operator",
      ADMIN: "Admin",
    },
  },
  {
    station: {
      AVAILABLE: "ว่าง",
      BUSY: "ไม่ว่าง",
      OFFLINE: "ปิดให้บริการ",
      MAINTENANCE: "ปิดปรับปรุง",
    },
    stationFree: (available: number, total: number) => `ว่าง ${available} จาก ${total}`,
    stationAllBusy: (total: number) => `ใช้งานครบทั้ง ${total} หัว`,
    charger: {
      AVAILABLE: "ว่าง",
      CHARGING: "กำลังชาร์จ",
      RESERVED: "ถูกจอง",
      OFFLINE: "ออฟไลน์",
      MAINTENANCE: "ปิดปรับปรุง",
    },
    reservation: {
      PENDING: "รอยืนยัน",
      CONFIRMED: "ยืนยันแล้ว",
      ACTIVE: "กำลังใช้งาน",
      COMPLETED: "เสร็จสิ้น",
      CANCELLED: "ยกเลิกแล้ว",
      EXPIRED: "หมดอายุ",
    },
    session: {
      ACTIVE: "กำลังชาร์จ",
      COMPLETED: "เสร็จสิ้น",
      STOPPED: "หยุดแล้ว",
      FAULTED: "ขัดข้อง",
    },
    payment: {
      PENDING: "รอชำระ",
      PAID: "ชำระแล้ว",
      FAILED: "ไม่สำเร็จ",
      REFUNDED: "คืนเงินแล้ว",
    },
    paymentMethod: {
      WALLET: "กระเป๋าเงิน Volt Grid",
      CREDIT_CARD: "บัตรเครดิต",
      PROMPTPAY: "พร้อมเพย์ QR",
    },
    role: {
      USER: "ผู้ขับขี่",
      OPERATOR: "เจ้าหน้าที่",
      ADMIN: "แอดมิน",
    },
  },
);
