# ECRM V1.6.1a 新功能 UI/UE 修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 V1.6.0 新功能带来的购物车、仪表盘筛选和运营赠礼配置 UI/UE 问题，让线上版本可直接实测。

**Architecture:** 保持现有 React 页面和 CSS 架构，不做全局导航重构。购物车和仪表盘只调整局部组件结构与样式；运营赠礼扩展配置模型，通过设置归一化函数保持旧数据兼容，并在售卖页根据 SKU/SPU 目标控制赠礼选择范围。

**Tech Stack:** Vite, React, TypeScript, Zustand, Dexie, Vitest, Testing Library.

---

## Task 1: 运营赠礼配置支持 SKU/SPU 目标

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/settings.ts`
- Modify: `src/domain/settings.test.ts`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/SettingsPage.test.tsx`

- [ ] **Step 1: 写失败测试**

Add to `src/domain/settings.test.ts`:

```ts
it("补齐旧运营赠礼配置的目标类型和默认 SPU", () => {
  expect(normalizeCampaignGiftConfig({
    enabled: true,
    activityName: "关注社媒赠礼",
    defaultProductId: "gift-1",
    requireSaleLine: true
  })).toEqual({
    enabled: true,
    activityName: "关注社媒赠礼",
    defaultProductId: "gift-1",
    defaultSpu: "",
    targetType: "sku",
    requireSaleLine: true
  });
});
```

Add to `src/pages/SettingsPage.test.tsx`:

```ts
test("运营赠礼可以切换指定 SKU 和指定 SPU", async () => {
  repositories.listProducts.mockResolvedValue([
    product({ id: "gift-a", name: "赠礼 A", spu: "赠礼SPU", isGiftEligible: true }),
    product({ id: "gift-b", name: "赠礼 B", spu: "赠礼SPU", isGiftEligible: true }),
    product({ id: "normal", name: "普通商品", spu: "普通SPU", isGiftEligible: false })
  ]);

  render(<SettingsPage />);

  expect(await screen.findByLabelText("默认运营赠礼目标类型")).toBeVisible();
  fireEvent.change(screen.getByLabelText("默认运营赠礼目标类型"), { target: { value: "spu" } });

  expect(screen.getByLabelText("默认运营赠礼 SPU")).toBeVisible();
  expect(screen.getByRole("option", { name: "赠礼SPU（2 个 SKU）" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: /普通SPU/ })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("默认运营赠礼目标类型"), { target: { value: "sku" } });

  expect(screen.getByLabelText("默认运营赠礼 SKU")).toBeVisible();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm test -- src/domain/settings.test.ts src/pages/SettingsPage.test.tsx
```

Expected: FAIL because `targetType/defaultSpu` and new controls do not exist.

- [ ] **Step 3: 实现类型和归一化**

Modify `src/domain/types.ts`:

```ts
export type CampaignGiftTargetType = "sku" | "spu";

export type CampaignGiftConfig = {
  enabled: boolean;
  activityName: string;
  targetType: CampaignGiftTargetType;
  defaultProductId: string;
  defaultSpu: string;
  requireSaleLine: boolean;
};
```

Modify `src/domain/settings.ts`:

```ts
export function createDefaultCampaignGiftConfig(): CampaignGiftConfig {
  return {
    enabled: false,
    activityName: "运营赠礼",
    targetType: "sku",
    defaultProductId: "",
    defaultSpu: "",
    requireSaleLine: true
  };
}

export function normalizeCampaignGiftConfig(value: Partial<CampaignGiftConfig> | undefined): CampaignGiftConfig {
  const defaults = createDefaultCampaignGiftConfig();
  const targetType = value?.targetType === "spu" ? "spu" : "sku";

  return {
    enabled: value?.enabled ?? defaults.enabled,
    activityName: value?.activityName?.trim() || defaults.activityName,
    targetType,
    defaultProductId: value?.defaultProductId ?? "",
    defaultSpu: value?.defaultSpu ?? "",
    requireSaleLine: value?.requireSaleLine ?? defaults.requireSaleLine
  };
}
```

- [ ] **Step 4: 实现设置页 UI**

In `src/pages/SettingsPage.tsx`, add gift SPU options:

```ts
const giftSpuOptions = Array.from(
  giftProducts.reduce((map, product) => {
    map.set(product.spu, (map.get(product.spu) ?? 0) + 1);
    return map;
  }, new Map<string, number>())
).sort(([left], [right]) => left.localeCompare(right, "zh-Hans-CN"));
```

Replace campaign gift fields with target type and conditional select:

```tsx
<label>
  <span>默认运营赠礼目标类型</span>
  <select
    aria-label="默认运营赠礼目标类型"
    value={campaignGift.targetType}
    onChange={(event) =>
      updateSettings((current) => ({
        ...current,
        campaignGift: {
          ...normalizeCampaignGiftConfig(current.campaignGift),
          targetType: event.target.value === "spu" ? "spu" : "sku"
        }
      }))
    }
  >
    <option value="sku">指定 SKU</option>
    <option value="spu">指定 SPU</option>
  </select>
</label>
{campaignGift.targetType === "spu" ? (
  <label>
    <span>默认运营赠礼 SPU</span>
    <select aria-label="默认运营赠礼 SPU" ...>
      <option value="">不选择</option>
      {giftSpuOptions.map(([spu, count]) => (
        <option key={spu} value={spu}>{spu}（{count} 个 SKU）</option>
      ))}
    </select>
  </label>
) : (
  <label>
    <span>默认运营赠礼 SKU</span>
    <select aria-label="默认运营赠礼 SKU" ...>...</select>
  </label>
)}
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```powershell
npm test -- src/domain/settings.test.ts src/pages/SettingsPage.test.tsx
```

- [ ] **Step 6: 提交**

```powershell
git add src/domain/types.ts src/domain/settings.ts src/domain/settings.test.ts src/pages/SettingsPage.tsx src/pages/SettingsPage.test.tsx
git commit -m "feat: support campaign gift spu target"
```

## Task 2: 售卖页运营赠礼按 SPU 限定选择

**Files:**
- Modify: `src/pages/SalesPage.tsx`
- Modify: `src/pages/SalesPage.test.tsx`
- Modify: `src/utils/backup.ts`
- Modify: `src/utils/backup.test.ts`

- [ ] **Step 1: 写失败测试**

Add to `src/pages/SalesPage.test.tsx`:

```ts
test("运营赠礼配置为 SPU 时只显示该 SPU 下可赠礼 SKU", async () => {
  repositories.getSettings.mockResolvedValue({
    ...createDefaultSettings(),
    campaignGift: {
      enabled: true,
      activityName: "关注社媒赠礼",
      targetType: "spu",
      defaultProductId: "",
      defaultSpu: "赠礼SPU",
      requireSaleLine: true
    }
  });
  repositories.listProducts.mockResolvedValue([
    product({ id: "sale", name: "销售商品", spu: "销售SPU", stockQty: 5, isSellable: true }),
    product({ id: "gift-a", name: "赠礼 A", spu: "赠礼SPU", stockQty: 5, isGiftEligible: true, isSellable: false }),
    product({ id: "gift-b", name: "赠礼 B", spu: "赠礼SPU", stockQty: 5, isGiftEligible: true, isSellable: false }),
    product({ id: "gift-other", name: "其他赠礼", spu: "其他SPU", stockQty: 5, isGiftEligible: true, isSellable: false })
  ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /添加 销售商品/ }));
  fireEvent.click(screen.getByRole("button", { name: "运营赠礼" }));

  const dialog = await screen.findByRole("dialog", { name: "选择运营赠礼商品" });
  expect(within(dialog).getByText("赠礼 A")).toBeVisible();
  expect(within(dialog).getByText("赠礼 B")).toBeVisible();
  expect(within(dialog).queryByText("其他赠礼")).not.toBeInTheDocument();
});
```

Add to `src/utils/backup.test.ts`:

```ts
test("imports campaign gift target type and default SPU", async () => {
  const importData = vi.fn();
  const payload = validPayload({
    settings: [{
      ...validPayload().data.settings[0],
      campaignGift: {
        enabled: true,
        activityName: "关注社媒赠礼",
        targetType: "spu",
        defaultProductId: "",
        defaultSpu: "赠礼SPU",
        requireSaleLine: true
      }
    }]
  });

  await importJsonBackupFromText(JSON.stringify(payload), { importData });

  expect(importData.mock.calls[0][0].settings[0].campaignGift).toMatchObject({
    targetType: "spu",
    defaultSpu: "赠礼SPU"
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx src/utils/backup.test.ts
```

- [ ] **Step 3: 实现售卖页过滤逻辑**

In `src/pages/SalesPage.tsx`, derive normalized campaign config:

```ts
const campaignGift = settings ? normalizeCampaignGiftConfig(settings.campaignGift) : createDefaultCampaignGiftConfig();
```

Update campaign gift add action:

```ts
if (campaignGift.targetType === "spu") {
  openNonSalesPicker("campaign_gift", { spu: campaignGift.defaultSpu || undefined });
  return;
}
```

Filter picker products:

```ts
if (nonSalesPickerMode === "campaign_gift") {
  return giftEligibleProducts.filter((product) => !campaignGiftPickerSpu || product.spu === campaignGiftPickerSpu);
}
```

Keep SKU mode direct add only when `defaultProductId` is valid and in stock.

- [ ] **Step 4: 实现备份校验**

Modify `src/utils/backup.ts` `validateCampaignGift`:

```ts
if (value.targetType !== undefined) {
  assertEnum(value, "targetType", new Set(["sku", "spu"]));
}
assertOptionalString(value, "defaultSpu");
```

Normalization already fills missing values.

- [ ] **Step 5: 运行测试确认通过**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx src/utils/backup.test.ts
```

- [ ] **Step 6: 提交**

```powershell
git add src/pages/SalesPage.tsx src/pages/SalesPage.test.tsx src/utils/backup.ts src/utils/backup.test.ts
git commit -m "feat: filter campaign gifts by spu target"
```

## Task 3: 购物车非销售入口紧凑化

**Files:**
- Modify: `src/components/CartPanel.tsx`
- Modify: `src/components/CartPanel.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: 写失败测试**

Add to `src/components/CartPanel.test.tsx`:

```ts
test("非销售出库入口使用紧凑操作条", () => {
  renderCartPanel();

  const actions = screen.getByRole("group", { name: "非销售出库" });
  expect(actions).toHaveClass("nonSalesActionBar");
  expect(within(actions).getByRole("button", { name: "+ 运营赠礼" })).toBeVisible();
  expect(within(actions).getByRole("button", { name: "+ 人工赠送" })).toBeVisible();
  expect(within(actions).getByRole("button", { name: "+ 其他出库" })).toBeVisible();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm test -- src/components/CartPanel.test.tsx
```

- [ ] **Step 3: 修改组件文案和类名**

In `src/components/CartPanel.tsx`, change:

```tsx
<div className="nonSalesActionBar" role="group" aria-label="非销售出库">
  ...
  + 运营赠礼
  + 人工赠送
  + 其他出库
</div>
```

- [ ] **Step 4: 修改样式**

In `src/styles.css`:

```css
.nonSalesActionBar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin: 4px 0 8px;
}

.nonSalesActionBar .secondaryButton {
  min-height: 34px;
  padding: 0 8px;
  font-size: 12px;
  line-height: 1;
}
```

Remove or leave unused `.nonSalesQuickActions` only if no references remain.

- [ ] **Step 5: 运行测试确认通过**

Run:

```powershell
npm test -- src/components/CartPanel.test.tsx
```

- [ ] **Step 6: 提交**

```powershell
git add src/components/CartPanel.tsx src/components/CartPanel.test.tsx src/styles.css
git commit -m "fix: compact cart non-sales actions"
```

## Task 4: 仪表盘筛选区重排

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: 写失败测试**

Add to `src/pages/DashboardPage.test.tsx`:

```ts
test("dashboard filters are grouped by range scope and custom dates", async () => {
  render(<DashboardPage />);

  await screen.findByText("统计范围：今日");

  const filterPanel = screen.getByRole("group", { name: "仪表盘筛选" });
  expect(filterPanel).toHaveClass("dashboardFilterPanel");
  expect(within(filterPanel).getByRole("group", { name: "时间范围" })).toHaveClass("dashboardFilterRow");
  expect(within(filterPanel).getByRole("group", { name: "统计口径" })).toHaveClass("dashboardFilterRow");
  expect(within(filterPanel).getByRole("button", { name: "刷新" })).toHaveClass("dashboardRefreshButton");
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm test -- src/pages/DashboardPage.test.tsx
```

- [ ] **Step 3: 调整 JSX 结构**

Wrap controls:

```tsx
<div className="dashboardFilterPanel" role="group" aria-label="仪表盘筛选">
  <div className="dashboardFilterRow" role="group" aria-label="时间范围">
    <div className="dashboardRangeSwitch">...</div>
    <button className="secondaryButton dashboardRefreshButton">...</button>
  </div>
  <div className="dashboardFilterRow dashboardFilterScopeRow" role="group" aria-label="统计口径">...</div>
  {rangePreset === "custom" ? <div className="dashboardCustomRange">...</div> : null}
</div>
```

- [ ] **Step 4: 调整样式**

In `src/styles.css`:

```css
.dashboardFilterPanel {
  display: grid;
  gap: 8px;
  justify-items: end;
}

.dashboardFilterRow {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.dashboardRefreshButton {
  min-height: 34px;
  padding: 0 12px;
  width: auto;
}

.dashboardScopeSwitch {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.dashboardCustomRange {
  justify-self: end;
  max-width: 460px;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```powershell
npm test -- src/pages/DashboardPage.test.tsx
```

- [ ] **Step 6: 提交**

```powershell
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx src/styles.css
git commit -m "fix: regroup dashboard filters"
```

## Task 5: 回归验证和交付记录

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `docs/releases/2026-06-21-ecrm-v1-6-1a-ui-ue-fixes-record.md`

- [ ] **Step 1: 更新版本号**

Run:

```powershell
npm pkg set version=1.6.1
npm install --package-lock-only
```

- [ ] **Step 2: 新增交付记录**

Create `docs/releases/2026-06-21-ecrm-v1-6-1a-ui-ue-fixes-record.md` with Chinese summary of:

- 购物车非销售入口紧凑化。
- 仪表盘筛选区重排。
- 运营赠礼支持 SKU/SPU 目标。
- 未纳入全局左侧导航。

- [ ] **Step 3: 运行目标测试**

Run:

```powershell
npm test -- src/components/CartPanel.test.tsx src/pages/DashboardPage.test.tsx src/pages/SettingsPage.test.tsx src/pages/SalesPage.test.tsx src/domain/settings.test.ts src/utils/backup.test.ts
```

- [ ] **Step 4: 运行全量测试**

Run:

```powershell
npm test
```

- [ ] **Step 5: 构建**

Run:

```powershell
npm run build
```

- [ ] **Step 6: 提交**

```powershell
git add package.json package-lock.json docs/releases/2026-06-21-ecrm-v1-6-1a-ui-ue-fixes-record.md
git commit -m "chore: release v1.6.1 ui ue fixes"
```

## 自检

- 覆盖购物车截图问题：Task 3。
- 覆盖仪表盘筛选截图问题：Task 4。
- 覆盖运营赠礼只能 SKU 的问题：Task 1 和 Task 2。
- 保留全局左侧导航为后续独立版本：Spec 非目标。
- 所有用户可见文字使用中文。
