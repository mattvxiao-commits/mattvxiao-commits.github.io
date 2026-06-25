import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { createDefaultFieldLockSettings } from "../domain/fieldLock";
import FieldLockSettingsPanel from "./FieldLockSettingsPanel";

test("groups field mode PIN, lock scope, and actions for compact settings layout", () => {
  render(<FieldLockSettingsPanel fieldLock={createDefaultFieldLockSettings()} onSave={vi.fn()} />);

  expect(screen.getByRole("group", { name: "现场模式 PIN" })).toBeVisible();
  expect(screen.getByRole("group", { name: "锁定范围" })).toBeVisible();
  expect(screen.getByRole("group", { name: "现场模式操作" })).toBeVisible();

  const pinGroup = screen.getByRole("group", { name: "现场模式 PIN" });
  expect(within(pinGroup).getByLabelText("设置现场模式 PIN")).toBeVisible();
  expect(within(pinGroup).getByLabelText("确认现场模式 PIN")).toBeVisible();

  const scopeGroup = screen.getByRole("group", { name: "锁定范围" });
  expect(within(scopeGroup).getByLabelText("锁定商品页")).toBeChecked();
  expect(within(scopeGroup).getByLabelText("锁定订单详情")).toBeChecked();
  expect(within(scopeGroup).getByLabelText("锁定数据页")).toBeChecked();
  expect(within(scopeGroup).getByLabelText("锁定设置页")).toBeChecked();

  expect(within(screen.getByRole("group", { name: "现场模式操作" })).getByRole("button", { name: "开启现场模式" })).toBeVisible();
});

test("explains temporary unlock state and relock paths from field mode help", () => {
  render(<FieldLockSettingsPanel fieldLock={createDefaultFieldLockSettings()} onSave={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "查看现场模式说明" }));
  const helpPanel = screen.getByRole("note");

  expect(within(helpPanel).getByText(/临时解锁/)).toBeVisible();
  expect(within(helpPanel).getByText(/重新锁定/)).toBeVisible();
  expect(within(helpPanel).getByText(/立即重新锁定/)).toBeVisible();
});

test("syncs lock scope checkboxes when field mode settings change from parent", () => {
  const onSave = vi.fn();
  const { rerender } = render(<FieldLockSettingsPanel fieldLock={createDefaultFieldLockSettings()} onSave={onSave} />);

  expect(screen.getByLabelText("锁定商品页")).toBeChecked();
  expect(screen.getByLabelText("锁定设置页")).toBeChecked();

  rerender(
    <FieldLockSettingsPanel
      fieldLock={{
        ...createDefaultFieldLockSettings(),
        protectedScopes: ["settings"]
      }}
      onSave={onSave}
    />
  );

  expect(screen.getByLabelText("锁定商品页")).not.toBeChecked();
  expect(screen.getByLabelText("锁定订单详情")).not.toBeChecked();
  expect(screen.getByLabelText("锁定数据页")).not.toBeChecked();
  expect(screen.getByLabelText("锁定设置页")).toBeChecked();
});
