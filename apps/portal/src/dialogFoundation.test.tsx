import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DialogBody, DialogHeader, DialogSurface } from "./dialogFoundation";

describe("dialog foundation", () => {
  it("renders a modal surface with a back chevron and header draft action", () => {
    const html = renderToStaticMarkup(
      <DialogSurface
        labelledBy="task-editor-title"
        className="task-editor-dialog"
      >
        <form>
          <DialogHeader
            title="タスクを追加"
            titleId="task-editor-title"
            onBack={() => undefined}
            actionLabel="下書きを保存"
          />
          <DialogBody>入力欄</DialogBody>
        </form>
      </DialogSurface>,
    );

    expect(html).toContain('class="editor-dialog-backdrop"');
    expect(html).toContain('class="timetable-editor-dialog task-editor-dialog"');
    expect(html).toContain('aria-label="戻る"');
    expect(html).toContain("‹");
    expect(html).toContain("下書きを保存");
    expect(html).not.toContain('aria-label="閉じる"');
  });

  it("provides one scroll boundary for modal content below the header", () => {
    const html = renderToStaticMarkup(<DialogBody>履歴</DialogBody>);

    expect(html).toContain('class="editor-dialog-scroll-body"');
    expect(html).toContain("履歴");
  });

  it("keeps the action disabled state and submit semantics in the header", () => {
    const html = renderToStaticMarkup(
      <DialogHeader
        title="ノートを編集"
        titleId="note-editor-title"
        onBack={() => undefined}
        actionLabel="下書きを更新"
        actionDisabled
      />,
    );

    expect(html).toContain('type="submit"');
    expect(html).toContain('disabled=""');
    expect(html).toContain("下書きを更新");
  });
});
