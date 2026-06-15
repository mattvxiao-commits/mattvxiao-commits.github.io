# ECRM MVP Development Spec

Date: 2026-06-15

## 1. Objective

Build a lightweight offline-first POS/CRM MVP for selling original and fan derivative merchandise at offline booths.

The MVP must be usable by Wednesday/Thursday after 2026-06-15, so scope is intentionally constrained. The system prioritizes product setup, quick checkout, promotion pricing, QR collection display, order records, inventory deduction, and backup.

## 2. Target Platforms

Use the recommended Scheme C:

- PWA web app.
- Free HTTPS static hosting for install and first load.
- Offline-first local storage after first successful load.
- Windows laptop: Chrome/Edge/Safari-compatible browser access or install.
- Mac laptop: Chrome/Edge/Safari-compatible browser access or install.
- iPad: Safari access, then Add to Home Screen.

No Apple Developer account, App Store signing, TestFlight, native iOS build, paid cloud server, custom domain, or app store distribution is required for MVP.

## 3. Recommended Stack

- Vite
- React
- TypeScript
- PWA service worker
- IndexedDB via Dexie.js
- Zustand or simple React state for cart/session state
- Recharts only if dashboard chart is still feasible
- JSZip or JSON export for backup
- CSV export for orders if time permits

## 4. MVP Scope

### P0 Required

- PWA app shell with offline cache.
- IndexedDB persistence.
- Product management.
- Product image upload and preview.
- Product SPU.
- Product sellable flag.
- Product gift-eligible flag.
- Product inventory.
- Product list sorting by name, SPU, sale price, and created order.
- Sales product list.
- SPU filter.
- Cart.
- Promotion calculation.
- Gift tier calculation.
- WeChat and Alipay QR image settings.
- Checkout payment page.
- Manual paid confirmation.
- Order save.
- Inventory deduction after paid confirmation.
- Order list and order detail.
- Backup export and import.

### P1 If Time Allows

- Today sales amount.
- Today order count.
- Low inventory list.
- Order CSV export.
- Gift stock warning.
- Promotion enable/disable switch.

### Out of Scope for MVP

- Composite WeChat/Alipay QR code.
- Automatic payment confirmation.
- Payment provider APIs.
- Cloud sync.
- Multi-device merge.
- Custom Feishu-style dashboard.
- Complex charts.
- Refund workflow.
- Receipt printing.
- Barcode scanner.
- Customer/member CRM.
- Multi-user permissions.

## 5. Navigation

Use three primary pages plus lightweight settings access:

- Products
- Sales
- Dashboard
- Settings, reachable from top navigation or overflow menu

Order history may live inside Sales for MVP if a fourth primary tab would slow delivery.

## 6. Product Management

### Product Fields

Required fields:

- id
- name
- spu
- imageId
- costPrice
- salePrice
- stockQty
- isSellable
- isGiftEligible
- status
- createdAt
- updatedAt

Optional if time allows:

- sku
- note
- lowStockThreshold

### Product Rules

- Product name is required.
- SPU is required.
- Cost price and sale price must be non-negative numbers.
- Stock quantity must be a non-negative integer.
- Product image is optional for MVP.
- Product images must preserve original aspect ratio in preview.
- Sales page only shows products where `isSellable = true` and `status = active`.
- Gift configuration only shows products where `isGiftEligible = true` and `status = active`.
- Deleting a product that already appears in orders should be avoided. For MVP, use soft delete/status inactive if possible.

## 7. Sales Flow

### Product Selection

- Show sellable products.
- Allow SPU filter.
- Allow search by product name or SPU if time allows.
- Each product has a plus button to add one unit to cart.
- Floating cart button shows item count and payable amount.

### Cart

- Show all cart items.
- Quantity can be adjusted with plus/minus controls.
- Quantity cannot go below zero.
- Removing the last unit removes the item from cart.
- Show line-level promotion breakdown.
- Show total payable amount.
- Show triggered gift tier text.
- Buttons:
  - Clear
  - Hold
  - Checkout

### Hold Cart

- MVP behavior: save current cart state and return to product list.
- If full held-cart list is too much for delivery, keep only one current held cart.

### Checkout

- Generate order number.
- Show order number.
- Show payable total.
- Show WeChat QR code if configured.
- Show Alipay QR code if configured.
- Allow payment method selection:
  - WeChat
  - Alipay
  - Cash
  - Other
- Buttons:
  - Confirm Paid
  - Back to Cart
  - Cancel Order

### Paid Confirmation

On Confirm Paid:

- Save order.
- Save order item snapshots.
- Deduct purchased item inventory.
- Deduct gift item inventory.
- Save inventory logs if feasible.
- Clear current cart.
- Return to Sales or Order Detail.

## 8. Promotion Rules

The MVP implements one active promotion configuration with two rule families:

- Add-on discount by SPU.
- Highest-tier full-amount gift.

### Add-on Discount Rule

Configurable values:

- enabled
- discountSpu
- discountPrice, example `3`
- maxDiscountQty, example `3`

Business rule:

- The selected SPU contains all eligible SKU/products.
- Normal sale price is taken from each product's `salePrice`, expected example `5`.
- At most 3 units in the selected SPU receive add-on discount price.
- A cart must have an original-price consumption trigger before discounted add-ons are applied.
- Other normal products can act as the trigger.
- If the cart contains only the discount SPU, the first unit of that SPU is original price and acts as the trigger. The next 3 units are discounted. Units after that return to original price.
- If the cart contains other normal products, the first 3 units of the discount SPU are discounted. Units after that are original price.
- Multi-SKU allocation within the discount SPU is by cart add order.

Examples:

Only discount SPU product A:

- A x1: `5`
- A x2: `5 + 3 = 8`
- A x3: `5 + 3 + 3 = 11`
- A x4: `5 + 3 + 3 + 3 = 14`
- A x5: `5 + 3 + 3 + 3 + 5 = 19`

Other normal product present:

- Normal product x1 at 20, A x3: `20 + 3 + 3 + 3 = 29`
- Normal product x1 at 20, A x4: `20 + 3 + 3 + 3 + 5 = 34`

### Gift Tier Rule

Gift tiers are not cumulative. Only the highest reached tier applies.

Thresholds:

- Payable amount >= 35: gift product A x1.
- Payable amount >= 68: gift product A x2 and product B x1.
- Payable amount >= 148: gift product A x5 and product B x1.

Rules:

- Threshold uses final payable amount after add-on discount.
- Gift item value does not count toward payable amount.
- Gift items do not trigger higher tiers.
- Product A can be sellable and gift-eligible.
- Product B can be gift-eligible but not sellable.
- Gift inventory is deducted only after paid confirmation.
- If gift stock is insufficient, show warning. MVP may still allow paid confirmation and record the warning.

## 9. Cart Calculation Contract

Cart source data should stay simple:

- productId
- quantity
- addedAt or lineOrder

Derived calculation result should include:

- normal lines
- discount lines
- gift lines
- subtotalBeforeDiscount
- discountAmount
- payableAmount
- appliedDiscountQty
- maxDiscountQty
- triggeredGiftTier
- giftStockWarnings

All cart totals should be recalculated whenever product, quantity, or promotion config changes.

## 10. Order Data

### Order Fields

- id
- orderNo
- status
- paymentMethod
- subtotalBeforeDiscount
- discountAmount
- payableAmount
- triggeredGiftTier
- promotionSnapshot
- giftStockWarning
- createdAt
- paidAt
- cancelledAt

### Order Item Fields

- id
- orderId
- productId
- productNameSnapshot
- spuSnapshot
- quantity
- originalUnitPrice
- finalUnitPrice
- lineType
- lineTotal

`lineType` values:

- normal
- discount_addon
- gift

Historical orders must use snapshots and must not be recalculated from changed product or promotion settings.

## 11. Settings

Settings page should include:

- Shop name.
- Order prefix.
- WeChat QR image upload.
- Alipay QR image upload.
- Promotion configuration.
- Backup export.
- Backup import.

## 12. Backup

MVP must provide at least JSON export/import of:

- products
- images if feasible
- settings
- promotion config
- orders
- order items

If image backup is too slow for the first delivery, clearly label that image backup is limited and prioritize product/order data export.

## 13. Dashboard

MVP dashboard is intentionally minimal:

- Today's sales amount.
- Today's paid order count.
- Low inventory products.

Charts are optional and should be skipped if they threaten checkout reliability.

## 14. Offline Acceptance Tests

iPad acceptance flow:

1. Open HTTPS app URL in Safari.
2. Add to Home Screen.
3. Open app from Home Screen.
4. Create products including product A and product B.
5. Configure product A as sellable and gift-eligible.
6. Configure product B as gift-eligible but not sellable.
7. Upload WeChat and Alipay QR images.
8. Add cart items and trigger add-on discount.
9. Trigger full-amount gift tier.
10. Confirm paid.
11. Verify inventory deduction.
12. Close app.
13. Enable airplane mode.
14. Reopen app from Home Screen.
15. Verify products, QR images, orders, and inventory remain available.
16. Create another offline order.
17. Export backup after reconnecting or while offline if browser allows saving.

## 15. Delivery Priorities

If schedule slips, cut in this order:

1. Dashboard charts.
2. Dashboard low inventory list.
3. CSV export.
4. Full held-cart list.
5. Inventory logs.
6. Gift stock blocking behavior.

Do not cut:

- Product management.
- Sales cart.
- Promotion calculation.
- Checkout QR display.
- Manual paid confirmation.
- Order save.
- Inventory deduction.
- Basic backup.

---

# ECRM MVP 开发规格中文对照版

日期：2026-06-15

## 1. 目标

开发一个轻量化、离线优先的 POS/CRM MVP，用于个人创作者在线下摊位售卖原创商品和同人衍生周边。

本 MVP 需要在 2026-06-15 之后的周三/周四可用，因此范围必须收敛。系统优先保证商品配置、快速开单、促销计价、收款二维码展示、订单记录、库存扣减和数据备份。

## 2. 目标平台

采用已确认的方案 C：

- PWA 网页应用。
- 使用免费 HTTPS 静态托管完成首次访问和安装。
- 首次成功加载后，本地离线优先使用。
- Windows 笔记本：通过 Chrome、Edge 或兼容浏览器访问/安装。
- Mac 笔记本：通过 Chrome、Edge、Safari 或兼容浏览器访问/安装。
- iPad：通过 Safari 打开，再添加到主屏幕。

MVP 不需要 Apple 开发者账号、App Store 签名、TestFlight、原生 iOS 构建、付费云服务器、自有域名或应用商店分发。

## 3. 推荐技术栈

- Vite。
- React。
- TypeScript。
- PWA service worker。
- IndexedDB，建议使用 Dexie.js 封装。
- Zustand 或简单 React 状态管理，用于购物车和当前会话状态。
- Recharts 仅在仪表盘图表不影响核心功能交付时使用。
- JSZip 或 JSON 导出，用于备份。
- 如果时间允许，支持订单 CSV 导出。

## 4. MVP 范围

### P0 必须完成

- PWA 应用壳和离线缓存。
- IndexedDB 本地持久化。
- 商品管理。
- 商品图片上传和预览。
- 商品 SPU。
- 商品是否允许售卖标记。
- 商品是否允许作为赠品标记。
- 商品库存。
- 商品列表按名称、SPU、售价、添加顺序排序。
- 售卖商品列表。
- SPU 筛选。
- 购物车。
- 促销计算。
- 满额赠礼档位计算。
- 微信和支付宝收款二维码图片设置。
- 收款/结账页面。
- 手动确认已收款。
- 订单保存。
- 确认收款后扣减库存。
- 订单列表和订单详情。
- 备份导出和导入。

### P1 时间允许时完成

- 今日销售额。
- 今日订单数。
- 低库存列表。
- 订单 CSV 导出。
- 赠品库存不足提示。
- 促销活动开启/关闭开关。

### MVP 不做

- 微信/支付宝复合二维码。
- 自动确认支付。
- 微信/支付宝支付接口。
- 云同步。
- 多设备数据合并。
- 飞书式自定义仪表盘。
- 复杂图表。
- 退款流程。
- 小票打印。
- 条码/扫码枪。
- 客户/会员 CRM。
- 多用户权限。

## 5. 导航结构

使用三个主页面，加一个轻量设置入口：

- 商品。
- 售卖。
- 仪表盘。
- 设置，可从顶部导航或更多菜单进入。

如果增加第四个主导航会拖慢交付，订单历史可以先放在售卖页面内。

## 6. 商品管理

### 商品字段

必需字段：

- id。
- name，商品名称。
- spu。
- imageId，商品图片 ID。
- costPrice，成本价。
- salePrice，售价。
- stockQty，库存数量。
- isSellable，是否允许售卖。
- isGiftEligible，是否允许作为赠品。
- status，状态。
- createdAt，创建时间。
- updatedAt，更新时间。

时间允许时可选字段：

- sku。
- note，备注。
- lowStockThreshold，低库存预警值。

### 商品规则

- 商品名称必填。
- SPU 必填。
- 成本价和售价必须是非负数字。
- 库存数量必须是非负整数。
- MVP 阶段商品图片可选。
- 商品图片预览必须保持原图比例。
- 售卖页面只展示 `isSellable = true` 且 `status = active` 的商品。
- 赠品配置只展示 `isGiftEligible = true` 且 `status = active` 的商品。
- 已出现在订单中的商品应避免硬删除。MVP 优先使用软删除或 inactive 状态。

## 7. 售卖流程

### 商品选择

- 展示允许售卖的商品。
- 支持 SPU 筛选。
- 如果时间允许，支持按商品名称或 SPU 搜索。
- 每个商品有加号按钮，每次添加 1 件到购物车。
- 右下角或固定位置显示购物车入口，展示件数和应收金额。

### 购物车

- 展示全部购物车商品。
- 数量可通过加减按钮调整。
- 数量不能低于 0。
- 某商品数量减到 0 时，从购物车移除。
- 显示每行促销计价明细。
- 显示总应收金额。
- 显示已触发的赠礼档位文字。
- 按钮：
  - 清空。
  - 暂存。
  - 下单。

### 暂存购物车

- MVP 行为：保存当前购物车状态并返回商品列表。
- 如果完整暂存单列表影响交付，可以先只保留一个当前暂存购物车。

### 下单/收款

- 生成订单编号。
- 显示订单编号。
- 显示应收总额。
- 如果已配置，显示微信收款二维码。
- 如果已配置，显示支付宝收款二维码。
- 允许选择支付方式：
  - 微信。
  - 支付宝。
  - 现金。
  - 其他。
- 按钮：
  - 确认已收款。
  - 返回购物车。
  - 取消订单。

### 确认收款

点击确认已收款后：

- 保存订单。
- 保存订单明细快照。
- 扣减购买商品库存。
- 扣减赠品库存。
- 如果时间允许，保存库存流水。
- 清空当前购物车。
- 返回售卖页面或订单详情。

## 8. 促销规则

MVP 只实现一个当前活动配置，包含两类规则：

- 按 SPU 的加购优惠。
- 满额赠礼，仅取最高档。

### 加购优惠规则

可配置项：

- enabled，是否启用。
- discountSpu，优惠 SPU。
- discountPrice，优惠价，示例为 `3`。
- maxDiscountQty，最大优惠数量，示例为 `3`。

业务规则：

- 被选中的 SPU 包含该 SPU 下所有符合条件的 SKU/商品。
- 原价取每个商品自身 `salePrice`，当前预期示例为 `5`。
- 该 SPU 最多 3 件享受加购优惠价。
- 购物车中必须存在一个原价消费触发项后，优惠加购才生效。
- 其他普通商品可以作为触发项。
- 如果购物车里只有优惠 SPU 商品，则该 SPU 第 1 件按原价，并作为触发项；接下来 3 件享受优惠；之后恢复原价。
- 如果购物车中存在其他普通商品，则优惠 SPU 的前 3 件直接享受优惠；之后恢复原价。
- 多 SKU 时，按加入购物车顺序分配优惠。

示例：只购买优惠 SPU 商品 A：

- A x1：`5`。
- A x2：`5 + 3 = 8`。
- A x3：`5 + 3 + 3 = 11`。
- A x4：`5 + 3 + 3 + 3 = 14`。
- A x5：`5 + 3 + 3 + 3 + 5 = 19`。

示例：购物车已有其他普通商品：

- 普通商品 x1，20 元；A x3：`20 + 3 + 3 + 3 = 29`。
- 普通商品 x1，20 元；A x4：`20 + 3 + 3 + 3 + 5 = 34`。

### 满额赠礼规则

赠礼档位不叠加，只按已达到的最高档位生效。

档位：

- 应收金额 >= 35：赠商品 A x1。
- 应收金额 >= 68：赠商品 A x2 和商品 B x1。
- 应收金额 >= 148：赠商品 A x5 和商品 B x1。

规则：

- 门槛金额使用加购优惠后的最终应收金额。
- 赠品价值不计入应收金额。
- 赠品不会触发更高档位。
- 商品 A 可以同时允许售卖和允许作为赠品。
- 商品 B 可以允许作为赠品，但不允许售卖。
- 赠品库存只在确认已收款后扣减。
- 如果赠品库存不足，显示提示。MVP 可以仍允许确认收款，并记录库存不足警告。

## 9. 购物车计算契约

购物车源数据保持简单：

- productId。
- quantity。
- addedAt 或 lineOrder，用于记录加入顺序。

派生计算结果应包括：

- normal lines，普通商品行。
- discount lines，优惠商品行。
- gift lines，赠品行。
- subtotalBeforeDiscount，优惠前小计。
- discountAmount，优惠金额。
- payableAmount，应收金额。
- appliedDiscountQty，已使用优惠数量。
- maxDiscountQty，最大优惠数量。
- triggeredGiftTier，已触发赠礼档位。
- giftStockWarnings，赠品库存警告。

每次商品、数量或促销配置变化时，都应重新计算购物车总额。

## 10. 订单数据

### 订单字段

- id。
- orderNo，订单号。
- status，订单状态。
- paymentMethod，支付方式。
- subtotalBeforeDiscount，优惠前小计。
- discountAmount，优惠金额。
- payableAmount，应收金额。
- triggeredGiftTier，触发赠礼档位。
- promotionSnapshot，促销规则快照。
- giftStockWarning，赠品库存警告。
- createdAt，创建时间。
- paidAt，收款确认时间。
- cancelledAt，取消时间。

### 订单明细字段

- id。
- orderId。
- productId。
- productNameSnapshot，商品名称快照。
- spuSnapshot，SPU 快照。
- quantity，数量。
- originalUnitPrice，原始单价。
- finalUnitPrice，最终单价。
- lineType，明细类型。
- lineTotal，行小计。

`lineType` 取值：

- normal，普通商品。
- discount_addon，加购优惠商品。
- gift，赠品。

历史订单必须使用快照数据，不允许根据修改后的商品或促销配置重新计算。

## 11. 设置

设置页面应包含：

- 店铺/摊位名称。
- 订单号前缀。
- 微信收款二维码上传。
- 支付宝收款二维码上传。
- 促销配置。
- 备份导出。
- 备份导入。

## 12. 备份

MVP 至少必须支持 JSON 导出/导入：

- 商品。
- 图片，如果时间允许。
- 设置。
- 促销配置。
- 订单。
- 订单明细。

如果第一版来不及完成图片备份，必须在界面中清晰说明图片备份受限，并优先保证商品、订单等业务数据导出。

## 13. 仪表盘

MVP 仪表盘保持极简：

- 今日销售额。
- 今日已付款订单数。
- 低库存商品。

图表是可选项。如果图表影响开单可靠性，应直接跳过。

## 14. 离线验收测试

iPad 验收流程：

1. 在 Safari 中打开 HTTPS 应用地址。
2. 添加到主屏幕。
3. 从主屏幕打开应用。
4. 创建商品，包括商品 A 和商品 B。
5. 将商品 A 配置为允许售卖且允许作为赠品。
6. 将商品 B 配置为允许作为赠品但不允许售卖。
7. 上传微信和支付宝收款二维码。
8. 添加购物车商品并触发加购优惠。
9. 触发满额赠礼档位。
10. 确认已收款。
11. 验证库存扣减。
12. 关闭应用。
13. 开启飞行模式。
14. 从主屏幕重新打开应用。
15. 验证商品、二维码、订单和库存仍可用。
16. 再创建一笔离线订单。
17. 恢复网络后导出备份；如果浏览器允许，也可以离线导出。

## 15. 交付优先级

如果进度延迟，按以下顺序裁剪：

1. 仪表盘图表。
2. 仪表盘低库存列表。
3. CSV 导出。
4. 完整暂存单列表。
5. 库存流水。
6. 赠品库存不足时的强阻断逻辑。

不能裁剪：

- 商品管理。
- 售卖购物车。
- 促销计算。
- 收款二维码展示。
- 手动确认收款。
- 订单保存。
- 库存扣减。
- 基础备份。
