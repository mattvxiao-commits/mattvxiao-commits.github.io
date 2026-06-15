import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { expect, test } from "vitest";
import App from "./App";

test("renders the app shell navigation and redirects to products by default", async () => {
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );

  const nav = screen.getByRole("navigation", { name: "主导航" });

  expect(nav).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "商品" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "售卖" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "仪表盘" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "设置" })).toBeInTheDocument();
  expect(
    await screen.findByRole("heading", { level: 1, name: "商品" })
  ).toBeVisible();
});
