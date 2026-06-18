import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import FieldLockDialog from "./FieldLockDialog";

test("shows a four digit PIN error before submit when input is invalid", () => {
  const onVerify = vi.fn();

  render(
    <FieldLockDialog
      isOpen
      onCancel={vi.fn()}
      onVerify={onVerify}
      onVerified={vi.fn()}
    />
  );

  fireEvent.change(screen.getByLabelText("4 位数字密码"), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "解锁" }));

  expect(screen.getByText("请输入 4 位数字密码。")).toBeVisible();
  expect(onVerify).not.toHaveBeenCalled();
});

test("submits a valid PIN and calls onVerified after success", async () => {
  const onVerified = vi.fn();

  render(
    <FieldLockDialog
      isOpen
      onCancel={vi.fn()}
      onVerify={vi.fn().mockResolvedValue({ success: true })}
      onVerified={onVerified}
    />
  );

  fireEvent.change(screen.getByLabelText("4 位数字密码"), { target: { value: "2580" } });
  fireEvent.click(screen.getByRole("button", { name: "解锁" }));

  await waitFor(() => expect(onVerified).toHaveBeenCalled());
});
