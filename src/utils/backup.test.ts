import "fake-indexeddb/auto";
import { describe, expect, test, vi } from "vitest";
import { db } from "../db/db";
import { exportJsonBackup, importJsonBackupFromText, replaceAllDataInTransaction } from "./backup";
import emptyInventoryOrderBackup from "../../docs/manual-test-data/ecrm-empty-inventory-order-backup.json";

vi.mock("file-saver", () => ({
  saveAs: vi.fn()
}));

function validProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "product-1",
    name: "口红",
    spu: "SPU-1",
    costPrice: 1,
    salePrice: 2,
    stockQty: 1,
    isSellable: true,
    isGiftEligible: true,
    status: "active",
    createdAt: "2026-06-15T00:00:00.000Z",
    updatedAt: "2026-06-15T00:00:00.000Z",
    ...overrides
  };
}

function validOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    orderNo: "ECRM-20260615-001",
    status: "paid",
    paymentMethod: "wechat",
    subtotalBeforeDiscount: 20,
    discountAmount: 0,
    payableAmount: 20,
    promotionSnapshot: {
      enabled: false,
      addonDiscount: {
        enabled: false,
        discountSpu: "",
        discountPrice: 3,
        maxDiscountQty: 3
      },
      giftTiers: []
    },
    giftStockWarning: false,
    createdAt: "2026-06-15T00:00:00.000Z",
    paidAt: "2026-06-15T00:01:00.000Z",
    ...overrides
  };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    exportedAt: "2026-06-15T00:00:00.000Z",
    note: "图片暂不包含在 JSON 备份中",
    data: {
      products: [],
      settings: [
        {
          id: "settings",
          shopName: "ECRM 摊位",
          orderPrefix: "ECRM",
          promotion: {
            enabled: false,
            addonDiscount: {
              enabled: false,
              discountSpu: "",
              discountPrice: 3,
              maxDiscountQty: 3
            },
            giftTiers: []
          }
        }
      ],
      orders: [],
      orderItems: [],
      inventoryLogs: [],
      ...overrides
    }
  };
}

describe("backup utilities", () => {
  test("exports images, refunds, and order item costs in version 4 JSON backup", async () => {
    const saveAsModule = await import("file-saver");
    const saveAsMock = vi.mocked(saveAsModule.saveAs);
    const tableSpies = [
      vi.spyOn(db.products, "toArray").mockResolvedValue([]),
      vi.spyOn(db.settings, "toArray").mockResolvedValue([]),
      vi.spyOn(db.orders, "toArray").mockResolvedValue([]),
      vi.spyOn(db.orderItems, "toArray").mockResolvedValue([
        {
          id: "order-item-1",
          orderId: "order-1",
          productId: "product-1",
          productNameSnapshot: "口红",
          spuSnapshot: "SPU-1",
          quantity: 2,
          originalUnitPrice: 20,
          finalUnitPrice: 20,
          lineType: "normal",
          lineTotal: 40,
          unitCostSnapshot: 8,
          costTotal: 16,
          grossProfit: 24
        }
      ]),
      vi.spyOn(db.inventoryLogs, "toArray").mockResolvedValue([]),
      vi.spyOn(db.orderRefunds, "toArray").mockResolvedValue([
        {
          id: "refund-1",
          orderId: "order-1",
          amount: 5,
          method: "wechat",
          reason: "customer_return",
          note: "客户退单。",
          createdAt: "2026-06-17T10:00:00.000Z"
        }
      ]),
      vi.spyOn(db.images, "toArray").mockResolvedValue([
        {
          id: "image-1",
          blob: new Blob(["image-bytes"], { type: "image/png" }),
          mimeType: "image/png",
          originalName: "product.png",
          createdAt: "2026-06-15T00:00:00.000Z"
        }
      ])
    ];

    await exportJsonBackup();

    expect(saveAsMock).toHaveBeenCalledOnce();
    const blob = saveAsMock.mock.calls[0][0] as Blob;
    const payload = JSON.parse(await blob.text());

    expect(payload.version).toBe(4);
    expect(payload.note).toBe("图片已包含在 JSON 备份中");
    expect(payload.data.orderItems).toEqual([
      expect.objectContaining({
        id: "order-item-1",
        unitCostSnapshot: 8,
        costTotal: 16,
        grossProfit: 24
      })
    ]);
    expect(payload.data.orderRefunds).toEqual([
      expect.objectContaining({
        id: "refund-1",
        orderId: "order-1",
        amount: 5,
        method: "wechat",
        reason: "customer_return",
        note: "客户退单。"
      })
    ]);
    expect(payload.data.images).toEqual([
      expect.objectContaining({
        id: "image-1",
        mimeType: "image/png",
        originalName: "product.png",
        dataBase64: "aW1hZ2UtYnl0ZXM="
      })
    ]);

    for (const spy of tableSpies) {
      spy.mockRestore();
    }
  });

  test("imports version 2 images into the image table", async () => {
    const imageBulkPut = vi.spyOn(db.images, "bulkPut").mockResolvedValue(["image-1"] as never);

    await replaceAllDataInTransaction({
      products: [],
      settings: [
        {
          id: "settings",
          shopName: "ECRM 摊位",
          orderPrefix: "ECRM",
          promotion: {
            enabled: false,
            addonDiscount: {
              enabled: false,
              discountSpu: "",
              discountPrice: 3,
              maxDiscountQty: 3
            },
            giftTiers: []
          }
        }
      ],
      orders: [],
      orderItems: [],
      inventoryLogs: [],
      orderRefunds: [],
      images: [
        {
          id: "image-1",
          mimeType: "image/png",
          originalName: "product.png",
          createdAt: "2026-06-15T00:00:00.000Z",
          dataBase64: "aW1hZ2UtYnl0ZXM="
        }
      ]
    });

    const storedImage = imageBulkPut.mock.calls[0][0][0];

    expect(storedImage).toEqual(
      expect.objectContaining({
        id: "image-1",
        mimeType: "image/png",
        originalName: "product.png"
      })
    );
    await expect(storedImage.blob.text()).resolves.toBe("image-bytes");

    imageBulkPut.mockRestore();
  });

  test("rejects unsupported backup versions before clearing existing data", async () => {
    const importData = vi.fn();

    await expect(
      importJsonBackupFromText(
        JSON.stringify({
          version: 5,
          exportedAt: "2026-06-15T00:00:00.000Z",
          note: "图片暂不包含在 JSON 备份中",
          data: {
            products: [],
            settings: [],
            orders: [],
            orderItems: [],
            inventoryLogs: [],
            images: [],
            orderRefunds: []
          }
        }),
        { importData }
      )
    ).rejects.toThrow("不支持的备份版本");

    expect(importData).not.toHaveBeenCalled();
  });

  test("imports version 4 order item cost fields into parsed backup data", async () => {
    const importData = vi.fn();

    const result = await importJsonBackupFromText(
      JSON.stringify({
        version: 4,
        exportedAt: "2026-06-18T10:00:00.000Z",
        note: "图片已包含在 JSON 备份中",
        data: {
          products: [],
          settings: validPayload().data.settings,
          orders: [],
          orderItems: [
            {
              id: "order-item-1",
              orderId: "order-1",
              productId: "product-1",
              productNameSnapshot: "口红",
              spuSnapshot: "SPU-1",
              quantity: 2,
              originalUnitPrice: 20,
              finalUnitPrice: 20,
              lineType: "normal",
              lineTotal: 40,
              unitCostSnapshot: 8,
              costTotal: 16,
              grossProfit: 24
            }
          ],
          inventoryLogs: [],
          images: [],
          orderRefunds: []
        }
      }),
      { importData }
    );

    expect(result.version).toBe(4);
    expect(importData).toHaveBeenCalledWith(
      expect.objectContaining({
        orderItems: [
          expect.objectContaining({
            unitCostSnapshot: 8,
            costTotal: 16,
            grossProfit: 24
          })
        ]
      })
    );
  });

  test.each([
    [
      1,
      {
        ...validPayload(),
        version: 1
      }
    ],
    [
      2,
      {
        ...validPayload(),
        version: 2,
        note: "图片已包含在 JSON 备份中",
        data: {
          ...validPayload().data,
          images: []
        }
      }
    ],
    [
      3,
      {
        ...validPayload(),
        version: 3,
        note: "图片已包含在 JSON 备份中",
        data: {
          ...validPayload().data,
          images: [],
          orderRefunds: []
        }
      }
    ]
  ] as const)("imports version %s old backups without requiring order item cost fields", async (_version, payload) => {
    const importData = vi.fn();

    await importJsonBackupFromText(
      JSON.stringify({
        ...payload,
        data: {
          ...payload.data,
          orderItems: [
            {
              id: "order-item-1",
              orderId: "order-1",
              productId: "product-1",
              productNameSnapshot: "口红",
              spuSnapshot: "SPU-1",
              quantity: 1,
              originalUnitPrice: 10,
              finalUnitPrice: 8,
              lineType: "normal",
              lineTotal: 8
            }
          ]
        }
      }),
      { importData }
    );

    const importedOrderItem = importData.mock.calls[0][0].orderItems[0];
    expect(importedOrderItem.unitCostSnapshot).toBeUndefined();
    expect(importedOrderItem.costTotal).toBeUndefined();
    expect(importedOrderItem.grossProfit).toBeUndefined();
  });

  test("rejects malformed order item cost fields before replacing data", async () => {
    const importData = vi.fn();

    await expect(
      importJsonBackupFromText(
        JSON.stringify({
          version: 4,
          exportedAt: "2026-06-18T10:00:00.000Z",
          note: "图片已包含在 JSON 备份中",
          data: {
            products: [],
            settings: validPayload().data.settings,
            orders: [],
            orderItems: [
              {
                id: "order-item-1",
                orderId: "order-1",
                productId: "product-1",
                productNameSnapshot: "口红",
                spuSnapshot: "SPU-1",
                quantity: 1,
                originalUnitPrice: 10,
                finalUnitPrice: 8,
                lineType: "normal",
                lineTotal: 8,
                unitCostSnapshot: "8"
              }
            ],
            inventoryLogs: [],
            images: [],
            orderRefunds: []
          }
        }),
        { importData }
      )
    ).rejects.toThrow("备份文件格式不正确");

    expect(importData).not.toHaveBeenCalled();
  });

  test("rejects negative order item unit cost snapshots before replacing data", async () => {
    const importData = vi.fn();

    await expect(
      importJsonBackupFromText(
        JSON.stringify({
          version: 4,
          exportedAt: "2026-06-18T10:00:00.000Z",
          note: "图片已包含在 JSON 备份中",
          data: {
            products: [],
            settings: validPayload().data.settings,
            orders: [],
            orderItems: [
              {
                id: "order-item-1",
                orderId: "order-1",
                productId: "product-1",
                productNameSnapshot: "口红",
                spuSnapshot: "SPU-1",
                quantity: 1,
                originalUnitPrice: 10,
                finalUnitPrice: 8,
                lineType: "normal",
                lineTotal: 8,
                unitCostSnapshot: -1,
                costTotal: 1,
                grossProfit: 7
              }
            ],
            inventoryLogs: [],
            images: [],
            orderRefunds: []
          }
        }),
        { importData }
      )
    ).rejects.toThrow("备份文件格式不正确");

    expect(importData).not.toHaveBeenCalled();
  });

  test("rejects negative order item cost totals before replacing data", async () => {
    const importData = vi.fn();

    await expect(
      importJsonBackupFromText(
        JSON.stringify({
          version: 4,
          exportedAt: "2026-06-18T10:00:00.000Z",
          note: "图片已包含在 JSON 备份中",
          data: {
            products: [],
            settings: validPayload().data.settings,
            orders: [],
            orderItems: [
              {
                id: "order-item-1",
                orderId: "order-1",
                productId: "product-1",
                productNameSnapshot: "口红",
                spuSnapshot: "SPU-1",
                quantity: 1,
                originalUnitPrice: 10,
                finalUnitPrice: 8,
                lineType: "normal",
                lineTotal: 8,
                unitCostSnapshot: 1,
                costTotal: -1,
                grossProfit: 9
              }
            ],
            inventoryLogs: [],
            images: [],
            orderRefunds: []
          }
        }),
        { importData }
      )
    ).rejects.toThrow("备份文件格式不正确");

    expect(importData).not.toHaveBeenCalled();
  });

  test("imports negative order item gross profit for gift or loss lines", async () => {
    const importData = vi.fn();

    await importJsonBackupFromText(
      JSON.stringify({
        version: 4,
        exportedAt: "2026-06-18T10:00:00.000Z",
        note: "图片已包含在 JSON 备份中",
        data: {
          products: [],
          settings: validPayload().data.settings,
          orders: [],
          orderItems: [
            {
              id: "order-item-1",
              orderId: "order-1",
              productId: "product-1",
              productNameSnapshot: "赠品卡",
              spuSnapshot: "赠品",
              quantity: 2,
              originalUnitPrice: 0,
              finalUnitPrice: 0,
              lineType: "gift",
              lineTotal: 0,
              unitCostSnapshot: 1.5,
              costTotal: 3,
              grossProfit: -3
            }
          ],
          inventoryLogs: [],
          images: [],
          orderRefunds: []
        }
      }),
      { importData }
    );

    expect(importData).toHaveBeenCalledWith(
      expect.objectContaining({
        orderItems: [
          expect.objectContaining({
            unitCostSnapshot: 1.5,
            costTotal: 3,
            grossProfit: -3
          })
        ]
      })
    );
  });

  test("imports version 3 order refunds into the refund table", async () => {
    const importData = vi.fn();

    await importJsonBackupFromText(
      JSON.stringify({
        version: 3,
        exportedAt: "2026-06-17T10:00:00.000Z",
        note: "图片已包含在 JSON 备份中",
        data: {
          products: [],
          settings: validPayload().data.settings,
          orders: [],
          orderItems: [],
          inventoryLogs: [],
          images: [],
          orderRefunds: [
            {
              id: "refund-1",
              orderId: "order-1",
              amount: 5,
              method: "cash",
              reason: "customer_return",
              note: "客户退单。",
              createdAt: "2026-06-17T10:00:00.000Z"
            }
          ]
        }
      }),
      { importData }
    );

    expect(importData).toHaveBeenCalledWith(
      expect.objectContaining({
        orderRefunds: [
          expect.objectContaining({
            id: "refund-1",
            orderId: "order-1",
            amount: 5,
            method: "cash",
            reason: "customer_return",
            note: "客户退单。"
          })
        ]
      })
    );
  });

  test("default import replacement writes version 3 order refunds into the refund table", async () => {
    const refundBulkPut = vi.spyOn(db.orderRefunds, "bulkPut").mockResolvedValue(["refund-1"] as never);

    await replaceAllDataInTransaction({
      products: [],
      settings: [
        {
          id: "settings",
          shopName: "ECRM 摊位",
          orderPrefix: "ECRM",
          promotion: {
            enabled: false,
            addonDiscount: {
              enabled: false,
              discountSpu: "",
              discountPrice: 3,
              maxDiscountQty: 3
            },
            giftTiers: []
          }
        }
      ],
      orders: [],
      orderItems: [],
      inventoryLogs: [],
      images: [],
      orderRefunds: [
        {
          id: "refund-1",
          orderId: "order-1",
          amount: 5,
          method: "cash",
          reason: "customer_return",
          createdAt: "2026-06-17T10:00:00.000Z"
        }
      ]
    });

    expect(refundBulkPut).toHaveBeenCalledWith([expect.objectContaining({ id: "refund-1", amount: 5 })]);
    refundBulkPut.mockRestore();
  });

  test.each([
    ["version 1", validPayload()],
    [
      "version 2",
      {
        ...validPayload(),
        version: 2,
        note: "图片已包含在 JSON 备份中",
        data: {
          ...validPayload().data,
          images: []
        }
      }
    ]
  ])("imports old %s backups without order refunds", async (_label, payload) => {
    const importData = vi.fn();

    await importJsonBackupFromText(JSON.stringify(payload), { importData });

    expect(importData).toHaveBeenCalledWith(expect.objectContaining({ orderRefunds: [] }));
  });

  test("rejects malformed order refund amount before replacing data", async () => {
    const importData = vi.fn();

    await expect(
      importJsonBackupFromText(
        JSON.stringify({
          version: 3,
          exportedAt: "2026-06-17T10:00:00.000Z",
          note: "图片已包含在 JSON 备份中",
          data: {
            products: [],
            settings: validPayload().data.settings,
            orders: [],
            orderItems: [],
            inventoryLogs: [],
            images: [],
            orderRefunds: [
              {
                id: "refund-1",
                orderId: "order-1",
                amount: 0,
                method: "cash",
                reason: "customer_return",
                createdAt: "2026-06-17T10:00:00.000Z"
              }
            ]
          }
        }),
        { importData }
      )
    ).rejects.toThrow("备份文件格式不正确");

    expect(importData).not.toHaveBeenCalled();
  });

  test("rejects malformed order refund method before replacing data", async () => {
    const importData = vi.fn();

    await expect(
      importJsonBackupFromText(
        JSON.stringify({
          version: 3,
          exportedAt: "2026-06-17T10:00:00.000Z",
          note: "图片已包含在 JSON 备份中",
          data: {
            products: [],
            settings: validPayload().data.settings,
            orders: [],
            orderItems: [],
            inventoryLogs: [],
            images: [],
            orderRefunds: [
              {
                id: "refund-1",
                orderId: "order-1",
                amount: 5,
                method: "card",
                reason: "customer_return",
                createdAt: "2026-06-17T10:00:00.000Z"
              }
            ]
          }
        }),
        { importData }
      )
    ).rejects.toThrow("备份文件格式不正确");

    expect(importData).not.toHaveBeenCalled();
  });

  test("rejects malformed order refund reason before replacing data", async () => {
    const importData = vi.fn();

    await expect(
      importJsonBackupFromText(
        JSON.stringify({
          version: 3,
          exportedAt: "2026-06-17T10:00:00.000Z",
          note: "图片已包含在 JSON 备份中",
          data: {
            products: [],
            settings: validPayload().data.settings,
            orders: [],
            orderItems: [],
            inventoryLogs: [],
            images: [],
            orderRefunds: [
              {
                id: "refund-1",
                orderId: "order-1",
                amount: 5,
                method: "cash",
                reason: "wrong_reason",
                createdAt: "2026-06-17T10:00:00.000Z"
              }
            ]
          }
        }),
        { importData }
      )
    ).rejects.toThrow("备份文件格式不正确");

    expect(importData).not.toHaveBeenCalled();
  });

  test("rejects malformed settings before replacing data", async () => {
    const importData = vi.fn();

    await expect(
      importJsonBackupFromText(JSON.stringify(validPayload({ settings: [] })), { importData })
    ).rejects.toThrow("备份文件格式不正确");

    expect(importData).not.toHaveBeenCalled();
  });

  test("rejects malformed products before replacing data", async () => {
    const importData = vi.fn();

    await expect(
      importJsonBackupFromText(
        JSON.stringify(
          validPayload({
            products: [
              {
                id: "product-1",
                name: "口红",
                spu: "SPU-1",
                costPrice: 1,
                salePrice: 2,
                stockQty: 1.5,
                isSellable: true,
                isGiftEligible: true,
                status: "active",
                createdAt: "2026-06-15T00:00:00.000Z",
                updatedAt: "2026-06-15T00:00:00.000Z"
              }
            ]
          })
        ),
        { importData }
      )
    ).rejects.toThrow("备份文件格式不正确");

    expect(importData).not.toHaveBeenCalled();
  });

  test("imports old products without code fields", async () => {
    const importData = vi.fn();

    await importJsonBackupFromText(
      JSON.stringify(validPayload({ products: [validProduct()] })),
      { importData }
    );

    expect(importData).toHaveBeenCalledOnce();
  });

  test("imports products with code fields", async () => {
    const importData = vi.fn();

    await importJsonBackupFromText(
      JSON.stringify(
        validPayload({
          products: [
            validProduct({
              spuCode: "CLTH-24001",
              skuCode: "BLK-M",
              productCode: "CLTH-24001-BLK-M"
            })
          ]
        })
      ),
      { importData }
    );

    expect(importData).toHaveBeenCalledOnce();
  });

  test("rejects duplicate non-empty product codes before replacing data", async () => {
    const importData = vi.fn();

    await expect(
      importJsonBackupFromText(
        JSON.stringify(
          validPayload({
            products: [
              validProduct({ id: "product-1", productCode: "DUP-CODE" }),
              validProduct({ id: "product-2", productCode: "DUP-CODE" })
            ]
          })
        ),
        { importData }
      )
    ).rejects.toThrow("完整商品编码重复");

    expect(importData).not.toHaveBeenCalled();
  });

  test("imports old and new gift config shapes", async () => {
    const importData = vi.fn();

    await importJsonBackupFromText(
      JSON.stringify(
        validPayload({
          settings: [
            {
              id: "settings",
              shopName: "ECRM 摊位",
              orderPrefix: "ECRM",
              promotion: {
                enabled: true,
                addonDiscount: {
                  enabled: false,
                  discountSpu: "",
                  discountPrice: 3,
                  maxDiscountQty: 3
                },
                giftTiers: [
                  {
                    threshold: 35,
                    gifts: [
                      { productId: "gift-old", quantity: 1 },
                      { targetType: "sku", productId: "gift-sku", quantity: 1 },
                      { targetType: "spu", spu: "赠品SPU", quantity: 2 }
                    ]
                  }
                ]
              }
            }
          ]
        })
      ),
      { importData }
    );

    expect(importData).toHaveBeenCalledOnce();
  });

  test.each([0, 1.5])(
    "rejects malformed order item quantity %s before replacing data",
    async (quantity) => {
      const importData = vi.fn();

      await expect(
        importJsonBackupFromText(
          JSON.stringify(
            validPayload({
              orderItems: [
                {
                  id: "order-item-1",
                  orderId: "order-1",
                  productId: "product-1",
                  productNameSnapshot: "口红",
                  spuSnapshot: "SPU-1",
                  quantity,
                  originalUnitPrice: 10,
                  finalUnitPrice: 8,
                  lineType: "normal",
                  lineTotal: 8
                }
              ]
            })
          ),
          { importData }
        )
      ).rejects.toThrow("备份文件格式不正确");

      expect(importData).not.toHaveBeenCalled();
    }
  );

  test("imports cancelled orders with cancel reason and note", async () => {
    const importData = vi.fn();

    await importJsonBackupFromText(
      JSON.stringify(
        validPayload({
          orders: [
            validOrder({
              status: "cancelled",
              cancelledAt: "2026-06-17T10:00:00.000Z",
              cancelReason: "customer_cancelled",
              cancelNote: "客户取消购买。"
            })
          ]
        })
      ),
      { importData }
    );

    expect(importData).toHaveBeenCalledOnce();
  });

  test("rejects invalid order cancel reasons", async () => {
    const importData = vi.fn();

    await expect(
      importJsonBackupFromText(
        JSON.stringify(
          validPayload({
            orders: [
              validOrder({
                status: "cancelled",
                cancelledAt: "2026-06-17T10:00:00.000Z",
                cancelReason: "bad_reason"
              })
            ]
          })
        ),
        { importData }
      )
    ).rejects.toThrow("备份文件格式不正确。");

    expect(importData).not.toHaveBeenCalled();
  });

  test("rejects malformed inventory log quantity mismatch before replacing data", async () => {
    const importData = vi.fn();

    await expect(
      importJsonBackupFromText(
        JSON.stringify(
          validPayload({
            inventoryLogs: [
              {
                id: "inventory-log-1",
                productId: "product-1",
                orderId: "order-1",
                changeQty: -2,
                reason: "order_paid",
                beforeQty: 5,
                afterQty: 4,
                createdAt: "2026-06-15T00:00:00.000Z"
              }
            ]
          })
        ),
        { importData }
      )
    ).rejects.toThrow("备份文件格式不正确");

    expect(importData).not.toHaveBeenCalled();
  });

  test("imports order cancelled rollback inventory logs", async () => {
    const importData = vi.fn();

    await importJsonBackupFromText(
      JSON.stringify(
        validPayload({
          inventoryLogs: [
            {
              id: "rollback-log-1",
              productId: "product-1",
              orderId: "order-1",
              changeQty: 2,
              reason: "order_cancelled_rollback",
              beforeQty: 3,
              afterQty: 5,
              createdAt: "2026-06-17T10:00:00.000Z"
            }
          ]
        })
      ),
      { importData }
    );

    expect(importData).toHaveBeenCalledOnce();
  });

  test("imports the manual empty inventory order acceptance backup", async () => {
    const importData = vi.fn();
    const backupText = JSON.stringify(emptyInventoryOrderBackup);

    await importJsonBackupFromText(backupText, { importData });

    expect(importData).toHaveBeenCalledOnce();
  });

  test("default import replacement clears existing refunds when restoring old backup data", async () => {
    await db.orderRefunds.put({
      id: "refund-existing",
      orderId: "old-order",
      amount: 5,
      method: "cash",
      reason: "customer_return",
      createdAt: "2026-06-17T10:00:00.000Z"
    });

    await replaceAllDataInTransaction({
      products: [],
      settings: [
        {
          id: "settings",
          shopName: "ECRM 摊位",
          orderPrefix: "ECRM",
          promotion: {
            enabled: false,
            addonDiscount: {
              enabled: false,
              discountSpu: "",
              discountPrice: 3,
              maxDiscountQty: 3
            },
            giftTiers: []
          }
        }
      ],
      orders: [],
      orderItems: [],
      inventoryLogs: [],
      orderRefunds: [],
      images: []
    });

    await expect(db.orderRefunds.count()).resolves.toBe(0);
  });

  test("default import replacement keeps old data when transaction fails", async () => {
    const tableStubs = [
      db.products,
      db.images,
      db.settings,
      db.orders,
      db.orderItems,
      db.inventoryLogs,
      db.orderRefunds
    ].map((table) => ({
      table,
      clear: vi.spyOn(table, "clear"),
      bulkPut: vi.spyOn(table, "bulkPut")
    }));
    const transaction = vi.spyOn(db, "transaction").mockRejectedValue(new Error("transaction failed"));

    await expect(
      replaceAllDataInTransaction({
        products: [
          {
            id: "existing-product",
            name: "重复商品",
            spu: "DUP",
            costPrice: 1,
            salePrice: 2,
            stockQty: 1,
            isSellable: true,
            isGiftEligible: false,
            status: "active",
            createdAt: "2026-06-15T00:00:00.000Z",
            updatedAt: "2026-06-15T00:00:00.000Z"
          },
          {
            id: "existing-product",
            name: "重复商品 2",
            spu: "DUP2",
            costPrice: 1,
            salePrice: 2,
            stockQty: 1,
            isSellable: true,
            isGiftEligible: false,
            status: "active",
            createdAt: "2026-06-15T00:00:00.000Z",
            updatedAt: "2026-06-15T00:00:00.000Z"
          }
        ],
        settings: [
          {
            id: "settings",
            shopName: "新店铺",
            orderPrefix: "NEW",
            promotion: {
              enabled: false,
              addonDiscount: {
                enabled: false,
                discountSpu: "",
                discountPrice: 3,
                maxDiscountQty: 3
              },
              giftTiers: []
            }
          }
        ],
        orders: [],
        orderItems: [],
        inventoryLogs: [],
        orderRefunds: [],
        images: []
      })
    ).rejects.toThrow("transaction failed");

    expect(transaction).toHaveBeenCalledOnce();
    for (const table of tableStubs) {
      expect(table.clear).not.toHaveBeenCalled();
      expect(table.bulkPut).not.toHaveBeenCalled();
      table.clear.mockRestore();
      table.bulkPut.mockRestore();
    }
    transaction.mockRestore();
  });
});
