/**
 * Огноо, цагийн форматлагч.
 *
 * `toLocaleString("mn-MN")`-д найдахгүй байх шалтгаан: сервер (Node) дээр
 * ICU-ийн бүрэн өгөгдөл байдаг ч браузер бүр `mn-MN`-ийг агуулдаггүй.
 * Байхгүй үед чимээгүйхэн англи хэлбэр рүү унадаг — тэгээд нэг л апп дотор
 * "2026.08.25 16:03" ба "8/25/2026, 4:03 PM" зэрэгцэн гарна.
 *
 * Тодорхой бичсэн формат нь хаана ч ижил ажиллана. 24 цагийн бичиглэл —
 * албан бичигт AM/PM хэрэглэдэггүй.
 */
const pad = (value: number) => String(value).padStart(2, "0");

/** "2026.08.25 16:03" */
export function formatDateTime(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "—";
  return (
    `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** "2026.08.25" */
export function formatDate(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}
