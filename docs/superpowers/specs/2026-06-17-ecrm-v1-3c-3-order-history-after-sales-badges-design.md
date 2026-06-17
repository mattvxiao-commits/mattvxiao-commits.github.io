# ECRM V1.3c-3 订单记录售后标识方案

## 1. 背景

V1.3b/V1.3c-1/V1.3c-2 已经完成订单作废、作废原因/备注记录、订单详情库存摘要优化。当前订单记录列表仍只显示订单状态、支付方式和金额。操作员需要进入订单详情后，才能知道作废原因和是否有备注。

V1.3c-3 的目标是在订单记录列表中直接显示轻量售后标识，让现场复查时能快速识别“这笔订单为什么被作废”。

## 2. 本版本目标

- 订单记录列表中，已作废订单显示售后标识。
- 售后标识至少包含：
  - `已作废`
  - 作废原因中文，例如 `客户取消`
  - 有作废备注时显示 `有备注`
- 不新增退款记录能力。
- 不新增订单调整表。
- 不修改订单列表筛选规则。
- 不修改 Dexie schema 或备份版本。

## 3. 本版本不包含

- 不做人工退款记录。
- 不做退款金额统计。
- 不做部分退款状态。
- 不做订单调整表。
- 不做仪表盘统计。
- 不新增订单主状态。

## 4. 交互设计

### 4.1 订单记录行

当前订单记录行右侧显示：

- 订单状态。
- 支付方式。
- 应收金额。

V1.3c-3 在状态/支付/金额附近增加一组紧凑售后标识。

显示规则：

- `paid` 订单：不显示售后标识。
- `pending_payment` 订单：不显示售后标识。
- `cancelled` 订单：显示 `已作废`。
- `cancelled` 且有 `cancelReason`：显示对应中文原因。
- `cancelled` 且无 `cancelReason`：原因按默认 `误操作` 显示。
- `cancelled` 且 `cancelNote` trim 后非空：显示 `有备注`。

### 4.2 视觉规则

- 标识必须紧凑，不显著增加订单行高度。
- 标识使用 pill/badge 样式。
- `已作废` 用风险色弱强调。
- 作废原因和 `有备注` 用中性弱强调。
- 文案全部中文。

## 5. 技术设计

### 5.1 领域函数

新增或扩展 `src/domain/orderHistory.ts`：

- 新增 `orderCancelReasonLabels`。
- 新增 `getOrderAfterSalesBadges(order)`。

建议类型：

```ts
export type OrderAfterSalesBadgeTone = "danger" | "neutral";

export type OrderAfterSalesBadge = {
  label: string;
  tone: OrderAfterSalesBadgeTone;
};
```

输出规则：

- 非 `cancelled` 订单返回空数组。
- `cancelled` 订单返回：
  - `{ label: "已作废", tone: "danger" }`
  - `{ label: reasonLabel, tone: "neutral" }`
  - 如果有备注：`{ label: "有备注", tone: "neutral" }`

### 5.2 售卖页接入

修改 `src/pages/SalesPage.tsx`：

- 从 `orderHistory` 引入 `getOrderAfterSalesBadges`。
- 在 `filteredOrders.map` 中计算 badges。
- 在订单记录行右侧 meta 区域内渲染 badge 列表。
- badge `className` 根据 tone 区分。

### 5.3 样式

修改 `src/styles.css`：

- 新增 `.orderAfterSalesBadges`。
- 新增 `.orderAfterSalesBadge`。
- 新增 `.orderAfterSalesBadge.isDanger`。
- 确保窄屏不会导致文字重叠。

## 6. 测试策略

### 6.1 领域测试

修改 `src/domain/orderHistory.test.ts`：

- cancelled 订单返回 `已作废` 和默认 `误操作`。
- 有作废原因和备注时返回 `已作废`、原因、`有备注`。
- paid 订单返回空数组。

### 6.2 页面测试

修改 `src/pages/SalesPage.test.tsx`：

- 订单记录列表展示 cancelled 订单时，行内显示 `已作废`、作废原因、`有备注`。
- paid 订单不显示售后标识。
- 点击订单记录仍能打开订单详情。

## 7. 验收标准

- 订单记录列表中，已作废订单可直接看到 `已作废`。
- 已作废订单可直接看到作废原因。
- 有备注的已作废订单可直接看到 `有备注`。
- 已支付订单不显示售后标识。
- 不改变筛选、排序、打开详情功能。
- 全量测试通过。
- 生产构建通过。

## 8. 主控审查重点

- 不新增退款表。
- 不新增订单调整表。
- 不改订单状态枚举。
- 不改 Dexie schema。
- 不改备份版本。
- UI 文案必须为中文。
