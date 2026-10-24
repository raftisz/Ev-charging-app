import { defineMessages } from "@/i18n/define";

export const payments = defineMessages(
  {
    methodLabel: "Payment method",
    hint: {
      WALLET: "Instant, no fees",
      CREDIT_CARD: "Visa · Mastercard",
      PROMPTPAY: "Scan to pay",
    },
    balance: (amount: string, short: boolean) =>
      `Balance ${amount}${short ? " · not enough" : ""}`,
    topUpWallet: "Top up your wallet →",
    paidWith: (amount: string, method: string) => `Paid ${amount} with ${method}`,
    // PromptPay dialog
    qrTitle: "Scan to pay with PromptPay",
    amount: (amount: string) => `Amount ${amount}`,
    later: "Later",
    confirm: "Confirm payment",
    qrAlt: (amount: string) => `PromptPay QR code for ${amount}`,
    payTo: (recipient: string) => `PromptPay to ${recipient}`,
    demoRecipient: "Demo recipient: this QR cannot be used to transfer real money.",
    demoConfirm: "Demo mode: after scanning, press Confirm payment to mark the transfer as received.",
    qrFailed: "Could not draw the QR code",
    confirmFailed: "Could not confirm the payment",
    // Paying for a finished session
    payTitle: "Pay for this session",
    payDescription: (station: string, energy: string, rate: string) =>
      `${station} · ${energy} at ${rate}/kWh.`,
    payAmount: (amount: string) => `Pay ${amount}`,
    energy: "Energy",
    rate: "Rate",
    perKwh: (rate: string) => `${rate}/kWh`,
    total: "Total",
    failed: "Payment failed",
    payNow: "Pay now",
    pay: "Pay",
  },
  {
    methodLabel: "วิธีชำระเงิน",
    hint: {
      WALLET: "ทันที ไม่มีค่าธรรมเนียม",
      CREDIT_CARD: "Visa · Mastercard",
      PROMPTPAY: "สแกนเพื่อจ่าย",
    },
    balance: (amount: string, short: boolean) =>
      `ยอดคงเหลือ ${amount}${short ? " · ไม่พอ" : ""}`,
    topUpWallet: "เติมเงินเข้ากระเป๋า →",
    paidWith: (amount: string, method: string) => `ชำระ ${amount} ด้วย${method}แล้ว`,
    qrTitle: "สแกนจ่ายด้วยพร้อมเพย์",
    amount: (amount: string) => `ยอดชำระ ${amount}`,
    later: "ไว้ทีหลัง",
    confirm: "ยืนยันการชำระ",
    qrAlt: (amount: string) => `QR พร้อมเพย์ ยอด ${amount}`,
    payTo: (recipient: string) => `โอนพร้อมเพย์ไปที่ ${recipient}`,
    demoRecipient: "ผู้รับเงินสำหรับทดสอบ: QR นี้ใช้โอนเงินจริงไม่ได้",
    demoConfirm: "โหมดทดสอบ: สแกนแล้วกด “ยืนยันการชำระ” เพื่อบันทึกว่าได้รับเงินแล้ว",
    qrFailed: "สร้าง QR code ไม่สำเร็จ",
    confirmFailed: "ยืนยันการชำระไม่สำเร็จ",
    payTitle: "ชำระค่าชาร์จรายการนี้",
    payDescription: (station: string, energy: string, rate: string) =>
      `${station} · ${energy} อัตรา ${rate}/kWh`,
    payAmount: (amount: string) => `ชำระ ${amount}`,
    energy: "พลังงาน",
    rate: "อัตรา",
    perKwh: (rate: string) => `${rate}/kWh`,
    total: "รวม",
    failed: "ชำระเงินไม่สำเร็จ",
    payNow: "ชำระเลย",
    pay: "ชำระ",
  },
);
