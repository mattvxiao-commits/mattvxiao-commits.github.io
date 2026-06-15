# ECRM Offline Booth Sales Product Plan

Date: 2026-06-15

## 1. Product Positioning

This system is a lightweight offline-first booth sales tool for individual creators selling original or fan derivative merchandise. It is closer to a small POS with product, cart, order, inventory, promotion, and basic dashboard features than a full CRM.

The first release must support real booth operation under time pressure. It should not attempt to become a full CRM, payment platform, warehouse system, or Feishu-style analytics builder.

## 2. Core Goals

The MVP should help the seller:

- Register products quickly.
- Display product images and prices.
- Filter products by SPU.
- Add products to cart during on-site sales.
- Apply the booth promotion rules correctly.
- Show WeChat and Alipay payment QR codes.
- Manually confirm payment.
- Save paid orders.
- Deduct inventory, including gift inventory.
- Review basic sales results.
- Export and restore local data.
- Use the app on Windows, Mac, and iPad after initial setup.

## 3. Platform Strategy

The selected strategy is Scheme C:

- PWA web application.
- Free HTTPS static hosting.
- Offline-first behavior after first successful load.
- Browser install on Windows and Mac.
- Safari Add to Home Screen on iPad.

This avoids:

- Apple Developer account.
- App Store signing.
- TestFlight distribution.
- Native iOS development.
- Paid cloud server.
- Paid domain.
- Payment API integration.

The app still needs a public or reachable HTTPS URL for first install and service worker registration. A free static hosting provider such as GitHub Pages, Cloudflare Pages, Netlify, or Vercel can satisfy this without a traditional cloud server.

## 4. Important Platform Constraints

PWA is the most practical three-platform MVP approach, but it has constraints:

- First install requires network access.
- iPad should install through Safari Add to Home Screen.
- Offline behavior must be tested on the target iPad before booth use.
- Data is stored in browser-managed local storage, so backup is mandatory.
- There is no automatic sync between devices.
- If Windows, Mac, and iPad are all used, one device should be treated as the active sales device for each booth session.
- Cross-device transfer uses export/import backup, not live sync.

The MVP should not support simultaneous sales on multiple devices. Without cloud sync, simultaneous multi-device use creates order conflicts, inventory conflicts, and backup merge problems.

## 5. Recommended Booth Workflow

Before booth day:

- Open the HTTPS app URL on the target device.
- Install the PWA.
- Create products.
- Upload product images.
- Upload WeChat and Alipay QR images.
- Configure promotion rules.
- Create product A and product B for gifts.
- Export an initial backup.
- Test offline mode.

During booth sales:

- Open Sales.
- Filter by SPU or search.
- Add products to cart.
- Let promotion rules calculate payable amount and gifts.
- Show checkout QR codes.
- Confirm payment manually after checking phone payment notice.
- Inventory is deducted only after confirming payment.
- Continue selling offline if network is unavailable.

After booth day:

- Export backup.
- Export orders if available.
- Review dashboard.
- Import backup on another device if needed.

## 6. Page Structure

### Products

Purpose:

- Maintain the product catalog and inventory.

Core functions:

- Add product.
- Edit product.
- Delete or deactivate product.
- Upload product image.
- Set name, SPU, cost price, sale price, stock quantity.
- Mark product as sellable.
- Mark product as gift-eligible.
- Sort by name, SPU, sale price, created order.

Design notes:

- Product images should preserve original aspect ratio.
- The list should be compact and fast to scan.
- The add/edit form should be a modal or drawer.
- Edit save should require confirmation.
- Deletion should be guarded. If a product appears in an order, prefer deactivation.

### Sales

Purpose:

- Support fast on-site checkout.

Core functions:

- Show sellable products.
- Filter by SPU.
- Add products to cart with plus button.
- Show floating cart button.
- Adjust cart quantities.
- Apply add-on discount.
- Apply gift tier.
- Hold or clear cart.
- Checkout.
- Display QR codes.
- Confirm payment.
- Save order and deduct inventory.

Design notes:

- Product selection must be fast on touch screens.
- Buttons should be large enough for iPad use.
- The cart should clearly explain promotion pricing.
- The payment screen should emphasize order number and total amount.

### Dashboard

Purpose:

- Provide a quick operational summary.

MVP widgets:

- Today's paid sales amount.
- Today's paid order count.
- Low inventory products.

Deferred widgets:

- Sales trend charts.
- Hot product ranking.
- SPU sales share.
- Cost and profit charts.
- Custom dashboards.

### Settings

Purpose:

- Configure shop-level data and backups.

Core functions:

- Shop name.
- Order prefix.
- WeChat QR upload.
- Alipay QR upload.
- Promotion settings.
- Backup export.
- Backup import.

## 7. Product Model

Product data should support sale, gift, and inventory use cases.

Fields:

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

Product A should be configured as:

- sellable: yes
- gift-eligible: yes
- stock tracked: yes

Product B should be configured as:

- sellable: no
- gift-eligible: yes
- stock tracked: yes

Normal products should usually be:

- sellable: yes
- gift-eligible: no

## 8. Promotion Model

The MVP supports one active booth promotion configuration.

This is intentionally not a general-purpose marketing rules engine. It is a fixed configuration matching the booth sales rules.

### Add-on Discount

Business statement:

After any original-price consumption exists in the cart, products in one configured SPU can be purchased at the add-on price. The discount applies to at most 3 units in that SPU.

Configured example:

- Discount SPU: product A's SPU.
- Normal price: product sale price, example 5.
- Discount price: 3.
- Max discount units: 3.

Final rule:

- If the cart contains another normal product outside the discount SPU, the first 3 units in the discount SPU get discount price.
- If the cart contains only the discount SPU, the first unit is normal price and acts as the trigger. The second to fourth units are discount price. The fifth and later units return to normal price.
- The max discount quantity is across the entire SPU, not per SKU.
- If there are multiple SKU/products under the discount SPU, discount allocation follows cart add order.

Examples with only product A:

- A x1: 5.
- A x2: 5 + 3 = 8.
- A x3: 5 + 3 + 3 = 11.
- A x4: 5 + 3 + 3 + 3 = 14.
- A x5: 5 + 3 + 3 + 3 + 5 = 19.

Examples with another normal product:

- Normal x1 at 20 and A x3: 20 + 3 + 3 + 3 = 29.
- Normal x1 at 20 and A x4: 20 + 3 + 3 + 3 + 5 = 34.

### Full-Amount Gift

Business statement:

When the payable amount reaches a configured threshold, the cart shows the highest achieved gift tier. Gift tiers do not stack.

Tiers:

- 35: gift A x1.
- 68: gift A x2 and B x1.
- 148: gift A x5 and B x1.

Rules:

- Use final payable amount after add-on discount.
- Only the highest reached tier applies.
- Gift value is zero and does not count toward thresholds.
- Gift items appear in cart and order as gift lines.
- Gift inventory is deducted after payment confirmation.

## 9. Cart Experience

The cart should not hide promotion details behind one averaged price. It should show a clear breakdown.

Example only A x5:

```text
Product A x5
Original price 2 x 5 = 10
Add-on discount 3 x 3 = 9
Subtotal 19
Discount used 3/3
```

Example normal product plus A x4:

```text
Normal Product x1
20

Product A x4
Add-on discount 3 x 3 = 9
Original price 1 x 5 = 5
Subtotal 14
Discount used 3/3

Payable 34
```

Gift tier display:

```text
Reached 68 gift tier: Product A x2, Product B x1
```

For MVP, "amount remaining to next tier" is optional.

## 10. Checkout Experience

Checkout should be explicit and manual:

- Generate order number.
- Show total payable amount.
- Show WeChat QR.
- Show Alipay QR.
- Let seller select payment method.
- Confirm paid after checking real payment notice.

The system should not try to automatically confirm payment in MVP.

Order number format can be:

```text
ECRM-YYYYMMDD-HHMMSS-NNN
```

Example:

```text
ECRM-20260615-143522-001
```

## 11. Inventory Rules

Inventory is deducted after paid confirmation, not when items enter cart and not when checkout page is opened.

Deduct:

- Normal purchased products.
- Discount add-on products.
- Gift products.

If gift inventory is insufficient:

- Show warning in cart or checkout.
- MVP may allow order completion and record warning.
- The seller handles the gift exception manually.

If purchased product inventory is insufficient:

- Warn clearly.
- MVP should prevent increasing quantity beyond current stock if feasible.
- If strict blocking is too risky for schedule, at minimum show a strong warning.

## 12. Order Records

Orders must store snapshots. Historical orders cannot depend on current product or promotion settings.

Order should store:

- order number
- status
- payment method
- original subtotal
- discount amount
- payable amount
- applied gift tier
- promotion snapshot
- created time
- paid time

Order items should store:

- product snapshot name
- SPU snapshot
- quantity
- original unit price
- final unit price
- line type
- line total

Line types:

- normal
- discount_addon
- gift

## 13. Backup and Data Safety

Because the app uses browser-managed local storage, backup is a first-release requirement.

Minimum backup:

- Export JSON backup.
- Import JSON backup.
- Include products.
- Include settings.
- Include promotion configuration.
- Include orders and order items.

Preferred backup:

- Include product images and QR images.
- Export as zip package.

If full image backup cannot be finished before the deadline, the app should still export business data and clearly indicate image backup limitations.

## 14. Offline Requirements

The app must support offline use after first install and cache.

Required offline behavior:

- Open app shell.
- View products.
- View product images if already cached/stored.
- Add products to cart.
- Calculate promotions.
- Create paid order.
- Deduct inventory.
- View order history.

iPad offline validation must happen before booth use. A valid test is:

- Install app from HTTPS in Safari.
- Add to Home Screen.
- Create data.
- Close app.
- Enable airplane mode.
- Reopen from Home Screen.
- Create another order offline.

## 15. Delivery Plan

### Monday 2026-06-15

- Finalize this spec.
- Create PWA project.
- Set up IndexedDB schema.
- Set up page shell.
- Deploy to free HTTPS static host.
- Test iPad install and offline app shell.

### Tuesday 2026-06-16

- Implement product management.
- Implement image storage.
- Implement sales list.
- Implement cart.
- Implement promotion calculator.
- Implement checkout and QR settings.
- Implement paid order save and inventory deduction.

### Wednesday 2026-06-17

- Implement order list.
- Implement backup export/import.
- Implement minimal dashboard.
- Test iPad offline flow.
- Fix critical bugs.

### Thursday 2026-06-18

- Reserve for bug fixing and real data preparation.
- Avoid large new features.
- Enter products.
- Upload QR codes.
- Export initial backup.
- Run final booth rehearsal.

## 16. Risk Assessment

High-risk areas:

- iPad PWA offline behavior.
- IndexedDB image persistence.
- Promotion price allocation across multiple SKU.
- Inventory deduction correctness.
- Backup completeness.

Mitigations:

- Test iPad install on day one.
- Keep promotion rules fixed.
- Use order snapshots.
- Keep dashboard minimal.
- Make backup mandatory.

## 17. Deferred Roadmap

P2:

- Better dashboard charts.
- Hot product ranking.
- CSV/XLSX exports.
- Full held-cart list.
- Refund/cancel adjustment.
- Inventory adjustment logs.

P3:

- Composite payment QR.
- WeChat/Alipay API integration.
- Automatic payment confirmation.
- Cloud sync.
- Multi-device active sales.
- Feishu-style custom dashboard.
- Receipt printing.
- Barcode scanner.
- Customer/member CRM.

## 18. Product Decision Summary

The MVP should optimize for real booth usability under a three-day deadline:

- Choose PWA because it is the only realistic single-codebase path for Windows, Mac, and iPad without Apple signing.
- Use free HTTPS static hosting instead of a paid server.
- Use local IndexedDB and mandatory backup instead of cloud sync.
- Use fixed promotion rules instead of a generic promotion engine.
- Keep dashboard minimal.
- Treat payment confirmation as manual.
- Deduct inventory only after payment is confirmed.

---

# ECRM 离线摊位售卖产品方案中文对照版

日期：2026-06-15

## 1. 产品定位

本系统是一个面向个人创作者的轻量化、离线优先摊位售卖工具，用于线下售卖原创商品和同人衍生周边。它更接近一个包含商品、购物车、订单、库存、促销和基础仪表盘的小型 POS，而不是完整 CRM。

第一版必须在时间紧张的情况下支持真实摆摊使用。因此不应尝试做成完整 CRM、支付平台、仓储系统或飞书式数据分析搭建器。

## 2. 核心目标

MVP 应帮助摊主完成：

- 快速登记商品。
- 展示商品图片和价格。
- 按 SPU 筛选商品。
- 现场售卖时快速加入购物车。
- 正确应用摊位促销规则。
- 展示微信和支付宝收款二维码。
- 人工确认收款。
- 保存已付款订单。
- 扣减库存，包括赠品库存。
- 查看基础销售结果。
- 导出和恢复本地数据。
- 在完成初始安装后，支持 Windows、Mac 和 iPad 使用。

## 3. 平台策略

已选择方案 C：

- PWA 网页应用。
- 免费 HTTPS 静态托管。
- 首次成功加载后离线优先。
- Windows 和 Mac 使用浏览器访问或安装。
- iPad 使用 Safari 添加到主屏幕。

该方案避免：

- Apple 开发者账号。
- App Store 签名。
- TestFlight 分发。
- 原生 iOS 开发。
- 付费云服务器。
- 付费域名。
- 支付接口对接。

应用仍然需要一个公开或可访问的 HTTPS 地址，用于首次安装和 service worker 注册。GitHub Pages、Cloudflare Pages、Netlify、Vercel 等免费静态托管即可满足，不需要传统云服务器。

## 4. 重要平台约束

PWA 是当前最现实的三端 MVP 方案，但存在约束：

- 首次安装需要网络。
- iPad 应通过 Safari 添加到主屏幕。
- 摆摊前必须在目标 iPad 上实测离线行为。
- 数据存放在浏览器管理的本地存储中，因此备份是必需项。
- 设备之间没有自动同步。
- 如果同时拥有 Windows、Mac 和 iPad，应将其中一台设备作为每场摆摊的主售卖设备。
- 跨设备迁移通过备份导出/导入完成，不做实时同步。

MVP 不支持多设备同时售卖。没有云同步时，多设备同时使用会产生订单冲突、库存冲突和备份合并问题。

## 5. 推荐摆摊工作流

摆摊前：

- 在目标设备打开 HTTPS 应用地址。
- 安装 PWA。
- 创建商品。
- 上传商品图片。
- 上传微信和支付宝收款二维码。
- 配置促销规则。
- 创建商品 A 和商品 B 作为赠品相关商品。
- 导出一份初始备份。
- 测试离线模式。

摆摊中：

- 打开售卖页面。
- 按 SPU 筛选或搜索。
- 将商品加入购物车。
- 由促销规则计算应收金额和赠品。
- 展示收款二维码。
- 查看手机到账通知后，手动确认收款。
- 只有确认收款后才扣减库存。
- 网络不可用时继续离线售卖。

摆摊后：

- 导出备份。
- 如果已支持，导出订单。
- 查看仪表盘。
- 如需换设备，在另一设备导入备份。

## 6. 页面结构

### 商品

用途：

- 维护商品目录和库存。

核心功能：

- 添加商品。
- 编辑商品。
- 删除或停用商品。
- 上传商品图片。
- 设置名称、SPU、成本价、售价、库存数量。
- 标记是否允许售卖。
- 标记是否允许作为赠品。
- 按名称、SPU、售价、添加顺序排序。

设计说明：

- 商品图片应保持原图比例。
- 列表应紧凑，方便快速浏览。
- 添加/编辑表单使用弹窗或抽屉。
- 编辑保存需要确认。
- 删除需要保护。如果商品已出现在订单中，优先停用而不是硬删除。

### 售卖

用途：

- 支持现场快速开单。

核心功能：

- 展示可售商品。
- 按 SPU 筛选。
- 用加号按钮添加商品到购物车。
- 显示悬浮购物车按钮。
- 调整购物车数量。
- 应用加购优惠。
- 应用满额赠礼。
- 暂存或清空购物车。
- 下单。
- 展示收款二维码。
- 确认收款。
- 保存订单并扣减库存。

设计说明：

- 商品选择必须适合触屏快速操作。
- 按钮尺寸应适合 iPad 使用。
- 购物车必须清晰解释促销计价。
- 收款页面应突出订单号和总金额。

### 仪表盘

用途：

- 提供快速经营概览。

MVP 组件：

- 今日已付款销售额。
- 今日已付款订单数。
- 低库存商品。

后续组件：

- 销售趋势图。
- 热销商品排行。
- SPU 销售占比。
- 成本和利润图表。
- 自定义仪表盘。

### 设置

用途：

- 配置店铺级数据和备份。

核心功能：

- 店铺/摊位名称。
- 订单号前缀。
- 微信收款二维码上传。
- 支付宝收款二维码上传。
- 促销设置。
- 备份导出。
- 备份导入。

## 7. 商品模型

商品数据需要同时支持售卖、赠品和库存场景。

字段：

- id。
- name，商品名称。
- spu。
- imageId，图片 ID。
- costPrice，成本价。
- salePrice，售价。
- stockQty，库存数量。
- isSellable，是否允许售卖。
- isGiftEligible，是否允许作为赠品。
- status，状态。
- createdAt，创建时间。
- updatedAt，更新时间。

商品 A 应配置为：

- 允许售卖：是。
- 允许作为赠品：是。
- 追踪库存：是。

商品 B 应配置为：

- 允许售卖：否。
- 允许作为赠品：是。
- 追踪库存：是。

普通商品通常配置为：

- 允许售卖：是。
- 允许作为赠品：否。

## 8. 促销模型

MVP 支持一个当前启用的摊位促销配置。

它不是通用营销规则引擎，而是固定匹配当前摆摊规则的配置。

### 加购优惠

业务描述：

购物车中存在任意原价消费后，某一配置 SPU 下的商品可以按加购价购买。该 SPU 最多 3 件享受优惠。

配置示例：

- 优惠 SPU：商品 A 所在 SPU。
- 原价：商品售价，示例为 5。
- 优惠价：3。
- 最大优惠数量：3。

最终规则：

- 如果购物车中存在优惠 SPU 之外的其他普通商品，则优惠 SPU 的前 3 件按优惠价。
- 如果购物车中只有优惠 SPU 商品，则第 1 件按原价并作为触发消费；第 2 至第 4 件按优惠价；第 5 件及之后恢复原价。
- 最大优惠数量按整个 SPU 计算，不是每个 SKU 各自 3 件。
- 如果优惠 SPU 下有多个 SKU/商品，按加入购物车顺序分配优惠。

只买商品 A 的示例：

- A x1：5。
- A x2：5 + 3 = 8。
- A x3：5 + 3 + 3 = 11。
- A x4：5 + 3 + 3 + 3 = 14。
- A x5：5 + 3 + 3 + 3 + 5 = 19。

有其他普通商品的示例：

- 普通商品 x1，20 元；A x3：20 + 3 + 3 + 3 = 29。
- 普通商品 x1，20 元；A x4：20 + 3 + 3 + 3 + 5 = 34。

### 满额赠礼

业务描述：

当应收金额达到配置门槛时，购物车显示已达到的最高赠礼档位。赠礼档位不叠加。

档位：

- 35：赠 A x1。
- 68：赠 A x2 和 B x1。
- 148：赠 A x5 和 B x1。

规则：

- 使用加购优惠后的最终应收金额判断。
- 只取最高已达到档位。
- 赠品价值为 0，不计入门槛金额。
- 赠品在购物车和订单中作为赠品行展示。
- 赠品库存在确认收款后扣减。

## 9. 购物车体验

购物车不应把促销细节隐藏成一个平均价格，而应展示清晰拆分。

只买 A x5 示例：

```text
商品 A x5
原价 2 x 5 = 10
加购优惠 3 x 3 = 9
小计 19
已用优惠 3/3
```

普通商品加 A x4 示例：

```text
普通商品 x1
20

商品 A x4
加购优惠 3 x 3 = 9
原价 1 x 5 = 5
小计 14
已用优惠 3/3

应收 34
```

赠礼档位展示：

```text
已达到 68 档赠礼：商品 A x2，商品 B x1
```

MVP 中“距离下一档还差多少金额”是可选项。

## 10. 收款体验

收款流程必须明确且人工确认：

- 生成订单号。
- 显示应收总金额。
- 显示微信收款二维码。
- 显示支付宝收款二维码。
- 允许摊主选择支付方式。
- 摊主查看真实到账通知后，点击确认已收款。

MVP 不尝试自动确认支付。

订单号格式可以为：

```text
ECRM-YYYYMMDD-HHMMSS-NNN
```

示例：

```text
ECRM-20260615-143522-001
```

## 11. 库存规则

库存只在确认已收款后扣减，不在加入购物车时扣，也不在打开收款页面时扣。

扣减内容：

- 普通购买商品。
- 加购优惠商品。
- 赠品商品。

如果赠品库存不足：

- 在购物车或收款页提示。
- MVP 可以允许完成订单并记录警告。
- 摊主线下人工处理赠品异常。

如果购买商品库存不足：

- 必须明确提示。
- 如果可行，MVP 应阻止数量超过当前库存。
- 如果强阻断影响交付，至少要显示强警告。

## 12. 订单记录

订单必须保存快照。历史订单不能依赖当前商品或促销设置重新计算。

订单应保存：

- 订单号。
- 状态。
- 支付方式。
- 原始小计。
- 优惠金额。
- 应收金额。
- 应用的赠礼档位。
- 促销快照。
- 创建时间。
- 收款确认时间。

订单明细应保存：

- 商品名称快照。
- SPU 快照。
- 数量。
- 原始单价。
- 最终单价。
- 明细类型。
- 行小计。

明细类型：

- normal，普通商品。
- discount_addon，加购优惠商品。
- gift，赠品。

## 13. 备份与数据安全

由于应用使用浏览器管理的本地存储，备份是第一版必需功能。

最低备份要求：

- 导出 JSON 备份。
- 导入 JSON 备份。
- 包含商品。
- 包含设置。
- 包含促销配置。
- 包含订单和订单明细。

理想备份：

- 包含商品图片和收款二维码图片。
- 导出为 zip 包。

如果截止前无法完成完整图片备份，应用仍应导出业务数据，并清晰提示图片备份限制。

## 14. 离线要求

应用必须在首次安装和缓存后支持离线使用。

必需离线能力：

- 打开应用壳。
- 查看商品。
- 查看已缓存/已存储的商品图片。
- 添加商品到购物车。
- 计算促销。
- 创建已付款订单。
- 扣减库存。
- 查看订单历史。

iPad 离线验收必须在摆摊前完成。有效测试流程：

- 在 Safari 中从 HTTPS 地址安装应用。
- 添加到主屏幕。
- 创建数据。
- 关闭应用。
- 开启飞行模式。
- 从主屏幕重新打开。
- 离线再创建一笔订单。

## 15. 交付计划

### 2026-06-15 周一

- 最终确认规格。
- 创建 PWA 项目。
- 建立 IndexedDB 数据结构。
- 建立页面骨架。
- 部署到免费 HTTPS 静态托管。
- 测试 iPad 安装和离线应用壳。

### 2026-06-16 周二

- 实现商品管理。
- 实现图片存储。
- 实现售卖列表。
- 实现购物车。
- 实现促销计算器。
- 实现收款和二维码设置。
- 实现已付款订单保存和库存扣减。

### 2026-06-17 周三

- 实现订单列表。
- 实现备份导出/导入。
- 实现极简仪表盘。
- 测试 iPad 离线流程。
- 修复关键问题。

### 2026-06-18 周四

- 预留给 bug 修复和真实数据准备。
- 避免新增大功能。
- 录入商品。
- 上传收款二维码。
- 导出初始备份。
- 进行最终摆摊演练。

## 16. 风险评估

高风险点：

- iPad PWA 离线行为。
- IndexedDB 图片持久化。
- 多 SKU 下促销价格分配。
- 库存扣减准确性。
- 备份完整性。

缓解方式：

- 第一天就测试 iPad 安装。
- 固定促销规则，不做通用规则引擎。
- 使用订单快照。
- 保持仪表盘极简。
- 强制把备份作为必做项。

## 17. 后续路线

P2：

- 更好的仪表盘图表。
- 热销商品排行。
- CSV/XLSX 导出。
- 完整暂存单列表。
- 退款/取消后的库存调整。
- 库存调整流水。

P3：

- 复合支付二维码。
- 微信/支付宝 API 对接。
- 自动确认支付。
- 云同步。
- 多设备同时售卖。
- 飞书式自定义仪表盘。
- 小票打印。
- 条码/扫码枪。
- 客户/会员 CRM。

## 18. 产品决策总结

MVP 应围绕三天内真实摆摊可用进行优化：

- 选择 PWA，因为它是在无需 Apple 签名的情况下同时支持 Windows、Mac 和 iPad 的最现实单代码库方案。
- 使用免费 HTTPS 静态托管，而不是付费服务器。
- 使用本地 IndexedDB 和强制备份，而不是云同步。
- 使用固定促销规则，而不是通用促销引擎。
- 仪表盘保持极简。
- 支付确认人工完成。
- 只有确认收款后才扣减库存。
