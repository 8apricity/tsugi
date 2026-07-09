const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];
const relativeDateLabels = new Map([
  [-2, "一昨日"],
  [-1, "昨日"],
  [0, "今日"],
  [1, "明日"],
  [2, "明後日"],
]);

export function formatDateHeader(schoolDate: string, currentSchoolDate: string) {
  const date = parseSchoolDate(schoolDate);
  const currentDate = parseSchoolDate(currentSchoolDate);
  const relativeDay = Math.round(
    (date.getTime() - currentDate.getTime()) / 86_400_000,
  );
  const relativeLabel = relativeDateLabels.get(relativeDay);
  const baseLabel = `${date.getUTCFullYear()}年${
    date.getUTCMonth() + 1
  }月 ${date.getUTCDate()}日 (${weekdayLabels[date.getUTCDay()]})`;

  return relativeLabel ? `${baseLabel} ${relativeLabel}` : baseLabel;
}

export function buildDateStrip(selectedSchoolDate: string) {
  const selectedDate = parseSchoolDate(selectedSchoolDate);

  return Array.from({ length: 11 }, (_, index) => {
    const date = addDays(selectedDate, index - 5);

    return {
      schoolDate: formatSchoolDate(date),
      label: `${date.getUTCDate()} ${weekdayLabels[date.getUTCDay()]}`,
    };
  });
}

export function formatCurrentJstSchoolDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return `${valueByType.get("year")}-${valueByType.get(
    "month",
  )}-${valueByType.get("day")}`;
}

function parseSchoolDate(schoolDate: string) {
  const [year, month, day] = schoolDate.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

function formatSchoolDate(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
