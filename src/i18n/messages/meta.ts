import { defineMessages } from "@/i18n/define";

export const meta = defineMessages(
  {
    title: "Volt Grid — EV charging network",
    description:
      "Find a charging station, reserve a slot, run a live charging session and track every kWh across the Bangkok network.",
    page: (name: string) => `${name} · Volt Grid`,
  },
  {
    title: "Volt Grid — เครือข่ายสถานีชาร์จรถยนต์ไฟฟ้า",
    description:
      "ค้นหาสถานีชาร์จ จองช่วงเวลา ติดตามการชาร์จแบบเรียลไทม์ และดูทุก kWh ที่ใช้ทั่วกรุงเทพฯ",
    page: (name: string) => `${name} · Volt Grid`,
  },
);
