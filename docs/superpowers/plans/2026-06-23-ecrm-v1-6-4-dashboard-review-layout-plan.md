# ECRM V1.6.4 Dashboard Review Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将仪表盘按经营复盘顺序整理为 6 个清晰分区，并增加内部轻量导航。

**Architecture:** 不改领域层统计模型，只重排 `DashboardPage.tsx` 的展示结构。页面继续消费现有 `DashboardModel`，新增 `DashboardGroup` 内部组件和局部 CSS，测试用 Testing Library 验证分区顺序、导航与关键模块不回归。

**Tech Stack:** React、TypeScript、Vitest、Testing Library、CSS。

---

### Task 1: 页面测试锁定分区结构

**Files:**
- Modify: `src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: 写失败测试，验证分区导航和分区顺序**

在 `src/pages/DashboardPage.test.tsx` 中新增测试：

```ts
test("groups dashboard modules by review sections with internal navigation", async () => {
  render(<DashboardPage />);

  expect(await screen.findByText("统计范围：今日")).toBeVisible();

  const sectionNav = screen.getByRole("navigation", { name: "仪表盘分区" });
  expect(within(sectionNav).getAllByRole("link").map((link) => link.textContent)).toEqual([
    "概览",
    "销售",
    "活动",
    "毛利",
    "库存",
    "异常"
  ]);

  const groups = screen.getAllByTestId("dashboard-review-group");
  expect(groups.map((group) => within(group).getByRole("heading", { level: 2 }).textContent)).toEqual([
    "经营概览",
    "销售表现",
    "活动成本",
    "毛利分析",
    "库存风险",
    "订单异常"
  ]);

  expect(within(groups[0]).getByLabelText("经营概览")).toBeVisible();
  expect(within(groups[0]).getByLabelText("售后概览")).toBeVisible();
  expect(within(groups[0]).getByLabelText("订单性质")).toBeVisible();
  expect(within(groups[1]).getByLabelText("出库与客单")).toBeVisible();
  expect(within(groups[1]).getByRole("region", { name: "支付方式" })).toBeVisible();
  expect(within(groups[2]).getByLabelText("活动效果")).toBeVisible();
  expect(within(groups[2]).getByLabelText("非销售拆分")).toBeVisible();
  expect(within(groups[2]).getByLabelText("经营成本口径")).toBeVisible();
  expect(within(groups[3]).getByRole("region", { name: "毛利概览" })).toBeVisible();
  expect(within(groups[4]).getByRole("region", { name: "低库存 SKU" })).toBeVisible();
  expect(within(groups[5]).getByRole("region", { name: "异常订单" })).toBeVisible();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm test -- --run src/pages/DashboardPage.test.tsx -t "groups dashboard modules by review sections with internal navigation"
```

Expected: FAIL，当前页面没有 `仪表盘分区` navigation，也没有 `dashboard-review-group`。

- [ ] **Step 3: 提交测试不单独提交**

本任务只写 RED 测试，和 Task 2 实现一起提交，避免提交长期失败状态。

### Task 2: 重排仪表盘页面结构

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/styles.css`
- Modify: `src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: 新增内部组件和分区导航**

在 `DashboardPage.tsx` 中 `formatPercent` 后新增：

```tsx
type DashboardGroupProps = {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
};

function DashboardGroup({ id, title, description, children }: DashboardGroupProps) {
  return (
    <section className="dashboardReviewGroup" data-testid="dashboard-review-group" id={id} aria-labelledby={`${id}-title`}>
      <div className="dashboardReviewGroupHeader">
        <div>
          <p className="eyebrow">复盘分区</p>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="dashboardReviewGroupGrid">{children}</div>
    </section>
  );
}
```

注意需要把 React import 改为：

```ts
import { useEffect, useMemo, useState, type ReactNode } from "react";
```

并将 `React.ReactNode` 写为 `ReactNode`。

- [ ] **Step 2: 新增分区导航数据**

在 `DashboardPage` 内 `scopeOptions` 后新增：

```ts
const reviewSections = [
  { id: "dashboard-overview", label: "概览" },
  { id: "dashboard-sales", label: "销售" },
  { id: "dashboard-activity", label: "活动" },
  { id: "dashboard-profit", label: "毛利" },
  { id: "dashboard-inventory", label: "库存" },
  { id: "dashboard-exceptions", label: "异常" }
];
```

- [ ] **Step 3: 在数据内容前渲染导航**

在 `{hasLoadedData && dashboard ? (...) : null}` 内、`dashboardGrid` 前增加：

```tsx
<nav className="dashboardSectionNav" aria-label="仪表盘分区">
  {reviewSections.map((section) => (
    <a href={`#${section.id}`} key={section.id}>
      {section.label}
    </a>
  ))}
</nav>
```

- [ ] **Step 4: 用 DashboardGroup 包裹和重排现有模块**

将原 `dashboardGrid` 内模块按以下结构移动：

```tsx
<div className="dashboardGrid">
  <DashboardGroup id="dashboard-overview" title="经营概览" description="先看销售、退款、订单性质和售后状态。">
    {经营概览 strip}
    {售后概览 strip}
    {订单性质 strip}
  </DashboardGroup>

  <DashboardGroup id="dashboard-sales" title="销售表现" description="查看收款、销量和 SPU/SKU 表现。">
    {出库与客单 strip}
    {支付方式 section}
    {热销 SKU section}
    {热销 SPU section}
    {SPU 销售额 section}
  </DashboardGroup>

  <DashboardGroup id="dashboard-activity" title="活动成本" description="拆分优惠、满赠、运营赠礼和非销售出库。">
    {活动效果 strip}
    {非销售拆分 strip}
    {经营成本口径 strip}
    {满赠触发 section}
    {非销售出库分布 conditional section}
  </DashboardGroup>

  <DashboardGroup id="dashboard-profit" title="毛利分析" description="查看成本快照、毛利排行和低毛利商品。">
    {毛利概览 section}
    {SKU 毛利排行 section}
    {SPU 毛利排行 section}
    {低毛利 SKU section}
  </DashboardGroup>

  <DashboardGroup id="dashboard-inventory" title="库存风险" description="查看赠品消耗、低库存、售罄和补货建议。">
    {赠品消耗 section}
    {低库存 SKU section}
    {售罄 SKU section}
    {高风险 SKU section}
    {滞销 SKU section}
    {补货建议 section}
  </DashboardGroup>

  <DashboardGroup id="dashboard-exceptions" title="订单异常" description="集中查看作废、退款、备注和赠品异常。">
    {异常订单 section}
  </DashboardGroup>
</div>
```

- [ ] **Step 5: 新增局部 CSS**

在 `src/styles.css` 仪表盘样式区域新增：

```css
.dashboardSectionNav {
  display: flex;
  gap: 8px;
  align-items: center;
  overflow-x: auto;
  margin-top: 12px;
  padding-bottom: 2px;
}

.dashboardSectionNav a {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 900;
  text-decoration: none;
  white-space: nowrap;
}

.dashboardReviewGroup {
  display: grid;
  grid-column: 1 / -1;
  gap: 10px;
  scroll-margin-top: 14px;
}

.dashboardReviewGroupHeader {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  padding-top: 2px;
}

.dashboardReviewGroupHeader h2 {
  margin: 0;
  color: var(--ink);
  font-size: 19px;
  line-height: 1.15;
}

.dashboardReviewGroupHeader p:not(.eyebrow) {
  margin-top: 4px;
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 800;
}

.dashboardReviewGroupGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
```

在移动端 media query 内新增：

```css
.dashboardReviewGroupGrid {
  grid-template-columns: 1fr;
}
```

- [ ] **Step 6: 运行目标页面测试**

Run:

```powershell
npm test -- --run src/pages/DashboardPage.test.tsx -t "groups dashboard modules by review sections with internal navigation"
```

Expected: PASS。

- [ ] **Step 7: 运行完整页面测试**

Run:

```powershell
npm test -- --run src/pages/DashboardPage.test.tsx
```

Expected: PASS。

- [ ] **Step 8: 提交页面结构变更**

```powershell
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx src/styles.css
git commit -m 'feat: group dashboard review sections'
```

### Task 3: 文档、验证与本地收尾

**Files:**
- Create: `docs/releases/2026-06-23-ecrm-v1-6-4-dashboard-review-layout-record.md`

- [ ] **Step 1: 写中文 release 记录**

记录：

- 新增 6 个仪表盘复盘分区。
- 新增内部轻量导航。
- 未改领域层统计口径。
- 未推送远端。

- [ ] **Step 2: 运行全量验证**

Run:

```powershell
npm test
npm run build
git diff --check
```

Expected:

- 全量测试通过。
- 构建通过，允许既有 chunk-size warning。
- diff check 无输出。

- [ ] **Step 3: 提交 release 记录**

```powershell
git add docs/releases/2026-06-23-ecrm-v1-6-4-dashboard-review-layout-record.md
git commit -m 'docs: record v1.6.4 dashboard layout update'
```

- [ ] **Step 4: 合并回本地 main**

在主目录 `D:\Projects\ECRM` 执行：

```powershell
git merge --no-ff v1.6.4-dashboard-review-layout -m 'merge: v1.6.4 dashboard review layout'
```

合并后再运行：

```powershell
npm test -- --run src/pages/DashboardPage.test.tsx
npm run build
```

- [ ] **Step 5: 清理 worktree**

```powershell
git worktree remove .worktrees/v1.6.4-dashboard-review-layout
git branch -d v1.6.4-dashboard-review-layout
```

不要推送远端。
