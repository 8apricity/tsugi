import { describe, expect, it } from "vitest";
import {
  buildDateStrip,
  buildSchoolYearDateStrip,
  formatDateHeader,
  isAfterLastDailyLesson,
  shiftSchoolDate,
} from "./dailyPlanView";

describe("Daily Plan date display", () => {
  it("formats the selected School Date with a nearby relative label", () => {
    expect(formatDateHeader("2026-07-09", "2026-07-09")).toBe(
      "2026年7月 9日 (木) 今日",
    );
    expect(formatDateHeader("2026-07-10", "2026-07-09")).toBe(
      "2026年7月 10日 (金) 明日",
    );
    expect(formatDateHeader("2026-07-11", "2026-07-09")).toBe(
      "2026年7月 11日 (土) 明後日",
    );
    expect(formatDateHeader("2026-07-07", "2026-07-09")).toBe(
      "2026年7月 7日 (火) 一昨日",
    );
    expect(formatDateHeader("2026-07-12", "2026-07-09")).toBe(
      "2026年7月 12日 (日)",
    );
  });

  it("builds a selectable 11-day bottom date strip around the selected School Date", () => {
    expect(buildDateStrip("2026-07-09")).toEqual([
      { schoolDate: "2026-07-04", label: "4 土", day: 4, weekdayLabel: "土" },
      { schoolDate: "2026-07-05", label: "5 日", day: 5, weekdayLabel: "日" },
      { schoolDate: "2026-07-06", label: "6 月", day: 6, weekdayLabel: "月" },
      { schoolDate: "2026-07-07", label: "7 火", day: 7, weekdayLabel: "火" },
      { schoolDate: "2026-07-08", label: "8 水", day: 8, weekdayLabel: "水" },
      { schoolDate: "2026-07-09", label: "9 木", day: 9, weekdayLabel: "木" },
      { schoolDate: "2026-07-10", label: "10 金", day: 10, weekdayLabel: "金" },
      { schoolDate: "2026-07-11", label: "11 土", day: 11, weekdayLabel: "土" },
      { schoolDate: "2026-07-12", label: "12 日", day: 12, weekdayLabel: "日" },
      { schoolDate: "2026-07-13", label: "13 月", day: 13, weekdayLabel: "月" },
      { schoolDate: "2026-07-14", label: "14 火", day: 14, weekdayLabel: "火" },
    ]);
  });

  it("can build a wider continuous date strip", () => {
    expect(buildDateStrip("2026-07-09", 1)).toEqual([
      { schoolDate: "2026-07-08", label: "8 水", day: 8, weekdayLabel: "水" },
      { schoolDate: "2026-07-09", label: "9 木", day: 9, weekdayLabel: "木" },
      { schoolDate: "2026-07-10", label: "10 金", day: 10, weekdayLabel: "金" },
    ]);
  });

  it("shifts a School Date by day count", () => {
    expect(shiftSchoolDate("2026-07-09", -1)).toBe("2026-07-08");
    expect(shiftSchoolDate("2026-07-09", 1)).toBe("2026-07-10");
  });

  it("builds the selectable range from the School Year boundaries", () => {
    expect(buildSchoolYearDateStrip("2026-04-01", "2026-04-03")).toEqual([
      { schoolDate: "2026-04-01", label: "1 水", day: 1, weekdayLabel: "水" },
      { schoolDate: "2026-04-02", label: "2 木", day: 2, weekdayLabel: "木" },
      { schoolDate: "2026-04-03", label: "3 金", day: 3, weekdayLabel: "金" },
    ]);
  });

  it("treats the end of the last scheduled lesson as after school", () => {
    const sixPeriodDay = [1, 2, 3, 4, 5, 6, 7].map((periodNumber) => ({
      periodNumber,
      lessonName: periodNumber <= 6 ? "授業" : "",
    }));

    expect(
      isAfterLastDailyLesson(
        new Date("2026-07-10T05:44:59.000Z"),
        sixPeriodDay,
      ),
    ).toBe(false);
    expect(
      isAfterLastDailyLesson(
        new Date("2026-07-10T05:45:00.000Z"),
        sixPeriodDay,
      ),
    ).toBe(true);
  });

  it("does not treat a day without lessons as after school", () => {
    expect(
      isAfterLastDailyLesson(new Date("2026-07-10T09:00:00.000Z"), [
        { periodNumber: 1, lessonName: "" },
      ]),
    ).toBe(false);
  });
});
