# ECRM V1.5a 订单成本快照交付记录

## 交付范围

- 新订单明细已写入单位成本快照、成本小计和明细毛利。
- 普通商品、优惠加购、赠品均按下单时商品成本价生成快照。
- 赠品明细按 `lineTotal = 0` 计算毛利，因此赠品成本会形成负毛利。
- 已生成订单明细的成本快照不受后续商品成本价修改影响。
- 旧订单不伪造成本快照，订单详情页显示“缺少成本快照”。
- 订单详情页商品明细可显示“成本 ¥X.XX”和“毛利 ¥Y.YY”。
- Dexie 数据库升级到 version 3，`orderItems` 不为成本字段新增索引。
- JSON 备份升级到 version 4，并兼容 version 1、2、3 旧备份导入。
- version 4 备份可保留订单明细成本字段。
- 备份导入时 `unitCostSnapshot` 和 `costTotal` 必须为非负有限数字，`grossProfit` 必须为有限数字且允许为负。

## 验证记录

- `npm test -- src/domain/order.test.ts`
- `npm test -- src/utils/backup.test.ts`
- `npm test -- src/components/OrderDetailDialog.test.tsx`
- `npm run build`

## 审查记录

- V1.5a Task 1 已完成规格审查和代码质量审查。
- V1.5a Task 2 已完成规格审查和代码质量审查，并修复负成本备份导入校验问题。
- V1.5a Task 3 已完成规格审查和代码质量审查。

## 已知边界

- V1.5a 不计算仪表盘毛利汇总。
- V1.5a 不把人工退款拆分到商品明细。
- V1.5a 不为历史订单补写当前成本。
- V1.5a 不实现商品级退款、退货入库、换货、补差价或退差价。

## 下一步

- V1.5b：在仪表盘增加成本、毛利、毛利率、赠品成本、SKU/SPU 毛利排行、低毛利 SKU 和缺少成本快照提示。
- V1.5c：新增订单 Excel 导出，用于表格化统计、盘点和复盘。
