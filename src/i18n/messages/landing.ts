import { defineMessages } from "@/i18n/define";

export const landing = defineMessages(
  {
    network: "Bangkok network",
    signIn: "Sign in",
    eyebrow: "EV charging, minus the guesswork",
    headline1: "Charge with a plan,",
    headline2: "not a hope.",
    lead: (stations: number, chargers: number) =>
      `${stations} stations and ${chargers} chargers across Bangkok, with live availability, reservations and a session monitor that shows exactly what you are paying for.`,
    createAccount: "Create an account",
    demoAccounts: "Demo accounts",
    password: "password",
    demoUsers: "user1@example.com (driver) · admin@example.com (admin)",
    oneClick: "Or try it in one click",
    resetsDaily: "resets daily",
    fastSites: (count: number) => `${count} fast sites`,
    fastSitesNote: "100 kW and above",
    points: [
      ["F", "Find", "Live availability, price per kWh and distance for every site."],
      ["R", "Reserve", "Hold a charger for a half-hour slot before you drive over."],
      ["C", "Charge", "Watch the session tick up in real time, then pay in one tap."],
    ] as [string, string, string][],
  },
  {
    network: "เครือข่ายกรุงเทพฯ",
    signIn: "เข้าสู่ระบบ",
    eyebrow: "ชาร์จรถไฟฟ้าแบบไม่ต้องลุ้น",
    headline1: "ชาร์จอย่างมีแผน",
    headline2: "ไม่ต้องหวังลมๆ แล้งๆ",
    lead: (stations: number, chargers: number) =>
      `${stations} สถานี ${chargers} หัวชาร์จทั่วกรุงเทพฯ ดูสถานะว่างแบบสด จองล่วงหน้าได้ และติดตามการชาร์จที่บอกชัดว่าคุณจ่ายค่าอะไรบ้าง`,
    createAccount: "สมัครสมาชิก",
    demoAccounts: "บัญชีทดลอง",
    password: "รหัสผ่าน",
    demoUsers: "user1@example.com (ผู้ขับขี่) · admin@example.com (แอดมิน)",
    oneClick: "หรือลองใช้ได้ในคลิกเดียว",
    resetsDaily: "รีเซ็ตทุกวัน",
    fastSites: (count: number) => `ชาร์จเร็ว ${count} สถานี`,
    fastSitesNote: "ตั้งแต่ 100 kW ขึ้นไป",
    points: [
      ["ค", "ค้นหา", "ดูสถานะว่าง ราคาต่อ kWh และระยะทางของทุกสถานีแบบสด"],
      ["จ", "จอง", "จองหัวชาร์จล่วงหน้าเป็นช่วงครึ่งชั่วโมงก่อนออกเดินทาง"],
      ["ช", "ชาร์จ", "ดูการชาร์จเพิ่มขึ้นแบบเรียลไทม์ แล้วจ่ายเงินได้ในแตะเดียว"],
    ],
  },
);
