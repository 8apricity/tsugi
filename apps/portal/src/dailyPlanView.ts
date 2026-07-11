const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];
const relativeDateLabels = new Map([
  [-2, "一昨日"],
  [-1, "昨日"],
  [0, "今日"],
  [1, "明日"],
  [2, "明後日"],
]);
const dailyLessonEndSeconds = new Map([
  [1, 9 * 3_600 + 10 * 60],
  [2, 10 * 3_600 + 10 * 60],
  [3, 11 * 3_600 + 10 * 60],
  [4, 12 * 3_600 + 10 * 60],
  [5, 13 * 3_600 + 45 * 60],
  [6, 14 * 3_600 + 45 * 60],
  [7, 15 * 3_600 + 45 * 60],
]);

export function formatDateHeader(schoolDate: string, currentSchoolDate: string) {
  const dateHeader = buildDateHeader(schoolDate, currentSchoolDate);

  return dateHeader.relativeLabel
    ? `${dateHeader.year}年${dateHeader.month}月 ${dateHeader.day}日 (${dateHeader.weekdayLabel}) ${dateHeader.relativeLabel}`
    : `${dateHeader.year}年${dateHeader.month}月 ${dateHeader.day}日 (${dateHeader.weekdayLabel})`;
}

export function buildDateHeader(schoolDate: string, currentSchoolDate: string) {
  const date = parseSchoolDate(schoolDate);
  const currentDate = parseSchoolDate(currentSchoolDate);
  const relativeDay = Math.round(
    (date.getTime() - currentDate.getTime()) / 86_400_000,
  );

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekdayLabel: weekdayLabels[date.getUTCDay()],
    relativeLabel: relativeDateLabels.get(relativeDay) ?? null,
  };
}

export function buildDateStrip(selectedSchoolDate: string, radius = 5) {
  const selectedDate = parseSchoolDate(selectedSchoolDate);

  return Array.from({ length: radius * 2 + 1 }, (_, index) => {
    const date = addDays(selectedDate, index - radius);

    return buildDateStripItem(date);
  });
}

export function buildSchoolYearDateStrip(startsOn: string, endsOn: string) {
  const start = parseSchoolDate(startsOn);
  const end = parseSchoolDate(endsOn);
  const dayCount = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;

  return Array.from({ length: Math.max(0, dayCount) }, (_, index) => {
    const date = addDays(start, index);

    return buildDateStripItem(date);
  });
}

export function isAfterLastDailyLesson(
  now: Date,
  dailyLessons: Array<{ periodNumber: number; lessonName: string }>,
) {
  const lastScheduledDailyLesson = dailyLessons
    .filter((dailyLesson) => dailyLesson.lessonName.trim() !== "")
    .sort((left, right) => right.periodNumber - left.periodNumber)[0];
  const endSeconds = lastScheduledDailyLesson
    ? dailyLessonEndSeconds.get(lastScheduledDailyLesson.periodNumber)
    : undefined;

  if (endSeconds === undefined) {
    return false;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  const currentSeconds =
    Number(valueByType.get("hour")) * 3_600 +
    Number(valueByType.get("minute")) * 60 +
    Number(valueByType.get("second"));

  return currentSeconds >= endSeconds;
}

export function shiftSchoolDate(schoolDate: string, days: number) {
  return formatSchoolDate(addDays(parseSchoolDate(schoolDate), days));
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

function buildDateStripItem(date: Date) {
  return {
    schoolDate: formatSchoolDate(date),
    label: `${date.getUTCDate()} ${weekdayLabels[date.getUTCDay()]}`,
    day: date.getUTCDate(),
    weekdayLabel: weekdayLabels[date.getUTCDay()],
  };
}
