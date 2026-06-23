(function () {
  const pageTitles = {
    products: "商品",
    sales: "售卖",
    dashboard: "仪表盘",
    settings: "设置"
  };

  const paymentLabels = {
    wechat: "微信",
    alipay: "支付宝",
    cash: "现金",
    other: "其他"
  };

  const sampleData = {
    products: [
      {
        id: "sample-1",
        name: "角色亚克力挂件 黑猫款",
        spu: "亚克力挂件",
        productCode: "ACRY-24001-BLK",
        costPrice: 8,
        salePrice: 25,
        stockQty: 36,
        isSellable: true,
        isGiftEligible: false,
        status: "active"
      },
      {
        id: "sample-2",
        name: "主题贴纸包 春日款",
        spu: "贴纸",
        productCode: "STKR-24002-SPR",
        costPrice: 2,
        salePrice: 10,
        stockQty: 58,
        isSellable: true,
        isGiftEligible: true,
        status: "active"
      },
      {
        id: "sample-3",
        name: "明信片套组 夜景款",
        spu: "明信片",
        productCode: "CARD-24003-NGT",
        costPrice: 4,
        salePrice: 18,
        stockQty: 22,
        isSellable: true,
        isGiftEligible: false,
        status: "active"
      },
      {
        id: "sample-4",
        name: "关注赠礼小卡",
        spu: "赠礼小卡",
        productCode: "GIFT-24004",
        costPrice: 1,
        salePrice: 0,
        stockQty: 84,
        isSellable: false,
        isGiftEligible: true,
        status: "active"
      }
    ],
    orders: [
      {
        id: "order-1",
        orderNo: "ECRM-20260624-001",
        status: "paid",
        paymentMethod: "wechat",
        subtotalBeforeDiscount: 78,
        discountAmount: 4,
        payableAmount: 74,
        orderNature: "mixed",
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      {
        id: "order-2",
        orderNo: "ECRM-20260624-002",
        status: "paid",
        paymentMethod: "alipay",
        subtotalBeforeDiscount: 35,
        discountAmount: 0,
        payableAmount: 35,
        orderNature: "sale",
        paidAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString()
      }
    ],
    orderItems: [
      {
        id: "item-1",
        orderId: "order-1",
        productId: "sample-1",
        productNameSnapshot: "角色亚克力挂件 黑猫款",
        spuSnapshot: "亚克力挂件",
        quantity: 2,
        finalUnitPrice: 25,
        lineTotal: 50,
        lineType: "normal",
        revenueType: "sale"
      },
      {
        id: "item-2",
        orderId: "order-1",
        productId: "sample-2",
        productNameSnapshot: "主题贴纸包 春日款",
        spuSnapshot: "贴纸",
        quantity: 3,
        finalUnitPrice: 8,
        lineTotal: 24,
        lineType: "discount_addon",
        revenueType: "sale"
      },
      {
        id: "item-3",
        orderId: "order-1",
        productId: "sample-4",
        productNameSnapshot: "关注赠礼小卡",
        spuSnapshot: "赠礼小卡",
        quantity: 1,
        finalUnitPrice: 0,
        lineTotal: 0,
        lineType: "gift",
        revenueType: "non_sales",
        nonSalesReason: "campaign_gift"
      }
    ],
    orderRefunds: [],
    inventoryLogs: [],
    images: [],
    settings: [
      {
        id: "settings",
        shopName: "ECRM 摊位",
        orderPrefix: "ECRM",
        promotion: {
          enabled: true,
          addonDiscount: {
            enabled: true,
            discountSpu: "贴纸",
            discountPrice: 8,
            maxDiscountQty: 3
          },
          giftTiers: [
            { threshold: 35, gifts: [{ targetType: "spu", spu: "赠礼小卡", quantity: 1 }] },
            { threshold: 68, gifts: [{ targetType: "spu", spu: "赠礼小卡", quantity: 2 }] },
            { threshold: 148, gifts: [{ targetType: "spu", spu: "赠礼小卡", quantity: 5 }] }
          ]
        },
        campaignGift: {
          enabled: true,
          activityName: "关注社媒赠礼",
          targetType: "spu",
          defaultProductId: "",
          defaultSpu: "赠礼小卡",
          requireSaleLine: true
        },
        fieldLock: { enabled: true, failedAttempts: 0 }
      }
    ]
  };

  let state = normalizeData(sampleData);

  function formatMoney(value) {
    return `¥${Number(value || 0).toFixed(2)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeData(data) {
    const normalized = {
      products: Array.isArray(data.products) ? data.products : [],
      orders: Array.isArray(data.orders) ? data.orders : [],
      orderItems: Array.isArray(data.orderItems) ? data.orderItems : [],
      orderRefunds: Array.isArray(data.orderRefunds) ? data.orderRefunds : [],
      inventoryLogs: Array.isArray(data.inventoryLogs) ? data.inventoryLogs : [],
      images: Array.isArray(data.images) ? data.images : [],
      settings: Array.isArray(data.settings) ? data.settings : []
    };
    normalized.imageMap = new Map(
      normalized.images.map((image) => [image.id, `data:${image.mimeType};base64,${image.dataBase64}`])
    );
    return normalized;
  }

  function getSettings() {
    return state.settings[0] || sampleData.settings[0];
  }

  function activeProducts() {
    return state.products.filter((product) => product.status !== "inactive");
  }

  function sellableProducts() {
    return activeProducts().filter((product) => product.isSellable !== false);
  }

  function paidOrders() {
    return state.orders.filter((order) => order.status === "paid");
  }

  function productImage(product, className) {
    const src = product.imageId ? state.imageMap.get(product.imageId) : undefined;
    if (src) {
      return `<div class="${className}"><img src="${src}" alt="${escapeHtml(product.name)}" /></div>`;
    }
    return `<div class="${className}">${escapeHtml((product.name || "商").slice(0, 1))}</div>`;
  }

  function renderMetricStrip(items) {
    return `<div class="metricStrip">${items
      .map((item) => `<div><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>`)
      .join("")}</div>`;
  }

  function renderProductsPage() {
    const products = state.products;
    const activeCount = activeProducts().length;
    const sellableCount = sellableProducts().length;
    const totalStock = products.reduce((sum, product) => sum + Number(product.stockQty || 0), 0);
    const rows = products.slice(0, 9).map((product) => `
      <article class="productCard">
        ${productImage(product, "productThumb")}
        <div class="productInfo">
          <h2>${escapeHtml(product.name)}</h2>
          <div class="productFacts">
            <span class="statusBadge isActive">${escapeHtml(product.spu || "未分组")}</span>
            <span>售价 ${formatMoney(product.salePrice)}</span>
            <span>编码 ${escapeHtml(product.productCode || product.skuCode || "-")}</span>
            <span>成本 ${formatMoney(product.costPrice)}</span>
            <span>库存 ${Number(product.stockQty || 0)}</span>
            <span>${product.isSellable === false ? "不可售卖" : "可售卖"}</span>
            <span>${product.isGiftEligible ? "可赠品" : "非赠品"}</span>
          </div>
        </div>
        <div class="cardActions">
          <span class="statusBadge ${product.status === "inactive" ? "" : "isActive"}">${product.status === "inactive" ? "停用" : "启用"}</span>
          <div class="cardActionButtons">
            <button type="button">编辑</button>
            <button type="button">复制</button>
            <button type="button" class="dangerButton">${product.status === "inactive" ? "启用" : "停用"}</button>
          </div>
        </div>
      </article>
    `).join("");

    return `
      <div class="pageHeader">
        <div class="pageHeaderCopy">
          <p class="eyebrow">Catalog</p>
          <h1 id="products-title">商品</h1>
          <p>管理摊位商品、规格、编码、价格、库存和可售状态。</p>
        </div>
        ${renderMetricStrip([
          { value: products.length, label: "全部商品" },
          { value: activeCount, label: "启用中" },
          { value: sellableCount, label: "可售卖" },
          { value: totalStock, label: "总库存" }
        ])}
      </div>
      <div class="toolbarRow">
        <div class="controlGroup">
          <span class="filterChip isActive">创建时间</span>
          <span class="filterChip">名称</span>
          <span class="filterChip">SPU</span>
          <span class="filterChip">售价</span>
        </div>
        <button type="button" class="primaryButton">新增商品</button>
      </div>
      <div class="productList">${rows || `<p class="productCard">还没有商品，导入备份后可预览真实密度。</p>`}</div>
    `;
  }

  function renderSalesPage() {
    const products = sellableProducts();
    const spuList = ["全部", ...Array.from(new Set(products.map((product) => product.spu).filter(Boolean))).slice(0, 5)];
    const cartLines = products.slice(0, 3);
    const payable = cartLines.reduce((sum, product, index) => sum + Number(product.salePrice || 0) * (index === 1 ? 2 : 1), 0);
    const productRows = products.slice(0, 10).map((product) => `
      <article class="salesProductRow">
        ${productImage(product, "salesThumb")}
        <div class="salesProductMain">
          <div>
            <h2>${escapeHtml(product.name)}</h2>
            <p>${escapeHtml(product.spu || "未分组")}</p>
          </div>
          <div class="salesMeta">
            <span class="chip">${formatMoney(product.salePrice)}</span>
            <span class="chip">库存 ${Number(product.stockQty || 0)}</span>
            ${product.isGiftEligible ? `<span class="chip">可赠品</span>` : ""}
          </div>
        </div>
        <button type="button" class="addButton" aria-label="加入购物车">+</button>
      </article>
    `).join("");
    const orderRows = paidOrders().slice(0, 4).map((order) => `
      <article class="orderRow">
        <div>
          <h3>${escapeHtml(order.orderNo)}</h3>
          <p>${formatOrderTime(order.paidAt || order.createdAt)} / ${escapeHtml(paymentLabels[order.paymentMethod] || "未记录")}</p>
        </div>
        <div class="orderMeta">
          <span class="orderChip isGreen">${order.status === "paid" ? "已支付" : "其他"}</span>
          <span class="orderChip ${order.orderNature === "mixed" ? "isWarning" : ""}">${orderNatureLabel(order)}</span>
          <strong>${formatMoney(order.payableAmount)}</strong>
        </div>
      </article>
    `).join("");

    return `
      <div class="pageHeader">
        <div class="pageHeaderCopy">
          <p class="eyebrow">Checkout</p>
          <h1 id="sales-title">售卖</h1>
          <p>选择商品、确认购物车、手动收款后保存订单并扣减库存。</p>
        </div>
        <button type="button" class="secondaryButton">重新锁定</button>
      </div>
      <div class="toolbarRow">
        <div class="controlGroup">${spuList.map((spu, index) => `<span class="filterChip ${index === 0 ? "isActive" : ""}">${escapeHtml(spu)}</span>`).join("")}</div>
        <button type="button" class="secondaryButton">刷新</button>
      </div>
      <div class="salesLayout">
        <div>
          <div class="salesProductList">${productRows || `<p class="salesProductRow">当前没有可售商品。</p>`}</div>
          <section class="orderHistoryBlock">
            <div class="panelHeading">
              <h2>订单记录</h2>
              <span class="chip">${paidOrders().length} 笔</span>
            </div>
            <div class="orderList">${orderRows || `<p class="orderRow">暂无订单记录。</p>`}</div>
          </section>
        </div>
        <aside class="cartPreview">
          <div class="panelHeading">
            <h2>购物车</h2>
            <span class="chip">${cartLines.length} 件</span>
          </div>
          <div class="cartLines">
            ${cartLines.map((product, index) => `
              <div class="cartLine">
                <div><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.spu)} / x${index === 1 ? 2 : 1}</span></div>
                <strong>${formatMoney(Number(product.salePrice || 0) * (index === 1 ? 2 : 1))}</strong>
              </div>
            `).join("")}
          </div>
          <div class="cartTotal">
            <div><span>加购/满赠</span><strong>${getSettings().promotion?.enabled ? "已启用" : "未启用"}</strong></div>
            <div class="payable"><span>应收</span><strong>${formatMoney(payable)}</strong></div>
          </div>
          <div class="cartActions">
            <button type="button" class="secondaryButton">清空</button>
            <button type="button" class="secondaryButton">暂存</button>
            <button type="button" class="primaryButton">收款</button>
          </div>
        </aside>
      </div>
    `;
  }

  function orderNatureLabel(order) {
    if (order.orderNature === "mixed") return "销售+赠送";
    if (order.orderNature === "non_sales") return "非销售出库";
    return "正常销售";
  }

  function formatOrderTime(value) {
    if (!value) return "未记录时间";
    try {
      return new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(value));
    } catch {
      return "时间异常";
    }
  }

  function renderDashboardPage() {
    const orders = paidOrders();
    const refunds = state.orderRefunds || [];
    const paidAmount = orders.reduce((sum, order) => sum + Number(order.payableAmount || 0), 0);
    const refundAmount = refunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
    const soldItems = state.orderItems.filter((item) => (item.revenueType || "sale") === "sale");
    const giftItems = state.orderItems.filter((item) => item.revenueType === "non_sales" || item.lineType === "gift");
    const lowStock = activeProducts().filter((product) => Number(product.stockQty || 0) <= 6).slice(0, 5);
    const topSku = aggregateByProduct(soldItems).slice(0, 5);
    const giftRows = aggregateByProduct(giftItems).slice(0, 5);

    return `
      <div class="pageHeader">
        <div class="pageHeaderCopy">
          <p class="eyebrow">经营看板</p>
          <h1 id="dashboard-title">仪表盘</h1>
          <p>统计范围：今日 / 当前原型按导入备份数据预览首屏密度。</p>
        </div>
        <div class="dashboardToolbar">
          <div class="controlGroup">
            <span class="filterChip isActive">今日</span>
            <span class="filterChip">昨天</span>
            <span class="filterChip">近 3 天</span>
            <span class="filterChip">近 7 天</span>
            <span class="filterChip">自定义</span>
          </div>
          <div class="controlGroup">
            <span class="filterChip isActive">正常销售</span>
            <span class="filterChip">全部活动</span>
            <span class="filterChip">运营赠礼</span>
            <button type="button" class="secondaryButton">刷新</button>
          </div>
        </div>
      </div>
      <div class="dashboardGrid">
        <section class="dashboardGroup">
          <div class="sectionTitle"><div><p class="eyebrow">复盘分区</p><h2>经营概览</h2><p>先看销售、退款、订单性质和售后状态。</p></div></div>
          <div class="dashboardMetricStrip">
            <div><span>${formatMoney(paidAmount)}</span><p>销售额</p></div>
            <div><span>${formatMoney(refundAmount)}</span><p>退款</p></div>
            <div><span>${formatMoney(paidAmount - refundAmount)}</span><p>实收</p></div>
            <div><span>${orders.length}</span><p>订单</p></div>
          </div>
          <div class="dashboardMetricStrip">
            <div><span>${soldItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</span><p>售出件数</p></div>
            <div><span>${giftItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</span><p>赠品/出库</p></div>
            <div><span>${orders.filter((order) => order.orderNature === "mixed").length}</span><p>销售+赠送</p></div>
            <div><span>${orders.filter((order) => order.orderNature === "non_sales").length}</span><p>非销售出库</p></div>
          </div>
        </section>
        <section class="dashboardGroup">
          <div class="sectionTitle"><div><p class="eyebrow">复盘分区</p><h2>销售与库存</h2><p>热销、赠品消耗和库存风险首屏预览。</p></div></div>
          <div class="dashboardGroupGrid">
            ${renderRankSection("热销 SKU", "当前范围销量最高的商品。", topSku)}
            ${renderRankSection("赠品/出库", "运营赠礼、满赠、人工赠送等出库。", giftRows)}
            ${renderRankSection("低库存 SKU", "库存少于或等于 6 的启用商品。", lowStock.map((product) => ({ label: product.name, meta: product.productCode || product.spu, qty: `库存 ${product.stockQty}`, amount: product.stockQty === 0 ? "售罄" : "低库存" })))}
            ${renderRankSection("支付方式", "当前范围已支付订单按支付方式汇总。", aggregatePayments(orders))}
          </div>
        </section>
      </div>
    `;
  }

  function aggregateByProduct(items) {
    const byProduct = new Map();
    for (const item of items) {
      const current = byProduct.get(item.productId) || {
        label: item.productNameSnapshot || "未命名商品",
        meta: item.productCodeSnapshot || item.spuSnapshot || "未分组",
        qty: 0,
        amount: 0
      };
      current.qty += Number(item.quantity || 0);
      current.amount += Number(item.lineTotal || 0);
      byProduct.set(item.productId, current);
    }
    return Array.from(byProduct.values())
      .sort((left, right) => Number(right.qty) - Number(left.qty))
      .map((row) => ({ ...row, qty: `${row.qty} 件`, amount: formatMoney(row.amount) }));
  }

  function aggregatePayments(orders) {
    const byMethod = new Map();
    for (const order of orders) {
      const key = order.paymentMethod || "other";
      const current = byMethod.get(key) || { label: paymentLabels[key] || "其他", meta: "支付方式", qty: 0, amount: 0 };
      current.qty += 1;
      current.amount += Number(order.payableAmount || 0);
      byMethod.set(key, current);
    }
    return Array.from(byMethod.values()).map((row) => ({ ...row, qty: `${row.qty} 单`, amount: formatMoney(row.amount) }));
  }

  function renderRankSection(title, description, rows) {
    return `
      <section class="dashboardSection">
        <div class="sectionTitle"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div></div>
        <div class="dashboardRankList">
          ${(rows || []).slice(0, 5).map((row) => `
            <article class="dashboardRankRow">
              <div><h3>${escapeHtml(row.label)}</h3><p>${escapeHtml(row.meta || "")}</p></div>
              <div class="rowMetric"><span>${escapeHtml(row.qty)}</span><strong>${escapeHtml(row.amount)}</strong></div>
            </article>
          `).join("") || `<article class="dashboardRankRow"><div><h3>暂无数据</h3><p>导入备份后可预览真实列表。</p></div></article>`}
        </div>
      </section>
    `;
  }

  function renderSettingsPage() {
    const settings = getSettings();
    const giftProducts = activeProducts().filter((product) => product.isGiftEligible);
    const spuOptions = Array.from(new Set(state.products.map((product) => product.spu).filter(Boolean)));
    const campaignGift = settings.campaignGift || {};
    const promotion = settings.promotion || sampleData.settings[0].promotion;

    return `
      <div class="pageHeader">
        <div class="pageHeaderCopy">
          <p class="eyebrow">Setup</p>
          <h1 id="settings-title">设置</h1>
          <p>维护摊位资料、现场模式、收款码、促销规则和本机 JSON 备份。</p>
        </div>
        <button type="button" class="primaryButton">保存设置</button>
      </div>
      <div class="settingsGrid">
        <section class="settingsSection">
          <div class="sectionTitle"><div><h2>现场模式</h2><p>锁定商品、设置、仪表盘和订单详情。</p></div><span class="statusBadge isActive">已启用</span></div>
          <div class="fieldGrid">
            <label class="fieldLabel"><span>PIN 位数</span><input value="4 位数字 PIN" readonly /></label>
            <label class="fieldLabel"><span>当前状态</span><input value="管理页面已锁定" readonly /></label>
          </div>
          <div class="backupActions"><button type="button" class="secondaryButton">立即重新锁定</button><button type="button" class="dangerButton">关闭现场模式</button></div>
        </section>
        <section class="settingsSection">
          <div class="sectionTitle"><div><h2>基础信息</h2><p>用于订单抬头和编号前缀。</p></div></div>
          <div class="fieldGrid">
            <label class="fieldLabel"><span>店铺名称</span><input value="${escapeHtml(settings.shopName || "")}" readonly /></label>
            <label class="fieldLabel"><span>订单前缀</span><input value="${escapeHtml(settings.orderPrefix || "")}" readonly /></label>
          </div>
        </section>
        <section class="settingsSection">
          <div class="sectionTitle"><div><h2>收款码</h2><p>当前原型只显示首屏布局，不预览二维码弹窗。</p></div></div>
          <div class="qrStatusGrid"><span class="chip">${settings.wechatQrImageId ? "微信收款码已设置" : "微信收款码未设置"}</span><span class="chip">${settings.alipayQrImageId ? "支付宝收款码已设置" : "支付宝收款码未设置"}</span></div>
        </section>
        <section class="settingsSection isWide">
          <div class="sectionTitle"><div><h2>促销配置</h2><p>加购优惠和满额赠品会在售卖计算中使用。</p></div><span class="statusBadge ${promotion.enabled ? "isActive" : ""}">${promotion.enabled ? "已启用" : "未启用"}</span></div>
          <div class="toggleRow">
            <label class="toggleControl"><input type="checkbox" ${promotion.enabled ? "checked" : ""} disabled /><span>启用促销</span></label>
            <label class="toggleControl"><input type="checkbox" ${promotion.addonDiscount?.enabled ? "checked" : ""} disabled /><span>启用加购优惠</span></label>
          </div>
          <div class="fieldGrid threeColumns">
            <label class="fieldLabel"><span>优惠 SPU</span><select disabled>${renderOptions(spuOptions, promotion.addonDiscount?.discountSpu)}</select></label>
            <label class="fieldLabel"><span>优惠单价</span><input value="${formatMoney(promotion.addonDiscount?.discountPrice)}" readonly /></label>
            <label class="fieldLabel"><span>最多优惠件数</span><input value="${promotion.addonDiscount?.maxDiscountQty || 0}" readonly /></label>
          </div>
        </section>
        <section class="settingsSection isWide">
          <div class="sectionTitle"><div><h2>运营赠礼</h2><p>用于记录关注社媒、加入社群、现场互动等运营活动赠品。</p></div><span class="statusBadge ${campaignGift.enabled ? "isActive" : ""}">${campaignGift.enabled ? "已启用" : "未启用"}</span></div>
          <div class="fieldGrid threeColumns">
            <label class="fieldLabel"><span>运营活动名称</span><input value="${escapeHtml(campaignGift.activityName || "")}" readonly /></label>
            <label class="fieldLabel"><span>默认目标类型</span><input value="${campaignGift.targetType === "spu" ? "指定 SPU" : "指定 SKU"}" readonly /></label>
            <label class="fieldLabel"><span>可赠品数量</span><input value="${giftProducts.length} 个 SKU" readonly /></label>
          </div>
        </section>
        <section class="settingsSection isWide">
          <div class="sectionTitle"><div><h2>备份与恢复</h2><p>这里的导入只用于当前原型预览，不覆盖正式产品数据。</p></div></div>
          <div class="backupActions">
            <label class="backupPreviewButton">导入 JSON 备份预览<input type="file" accept="application/json,.json" data-backup-input /></label>
            <button type="button" class="secondaryButton">导出备份</button>
            <button type="button" class="secondaryButton">导出订单 Excel</button>
          </div>
        </section>
        <section class="settingsSection isWide">
          <div class="sectionTitle"><div><h2>系统信息</h2><p>用于确认当前运行版本、部署方式和数据存储位置。</p></div></div>
          <dl class="systemInfoList">
            <div><dt>当前版本</dt><dd>v1.7 prototype</dd></div>
            <div><dt>部署方式</dt><dd>静态 HTML 草图</dd></div>
            <div><dt>数据存储</dt><dd>当前页面内存预览，不写入 IndexedDB</dd></div>
          </dl>
        </section>
      </div>
    `;
  }

  function renderOptions(options, selected) {
    const optionList = options.length > 0 ? options : [selected || "未配置"];
    return optionList.map((option) => `<option ${option === selected ? "selected" : ""}>${escapeHtml(option || "不选择")}</option>`).join("");
  }

  function renderAll() {
    const renderers = {
      products: renderProductsPage,
      sales: renderSalesPage,
      dashboard: renderDashboardPage,
      settings: renderSettingsPage
    };

    Object.entries(renderers).forEach(([page, renderer]) => {
      const view = document.querySelector(`[data-view="${page}"]`);
      if (view) {
        view.innerHTML = renderer();
      }
    });

    document.querySelectorAll("[data-shop-name]").forEach((node) => {
      node.textContent = getSettings().shopName || "轻量现场经营工具";
    });

    bindBackupInputs();
  }

  function switchPage(page) {
    document.querySelectorAll("[data-page]").forEach((button) => {
      button.classList.toggle("isActive", button.dataset.page === page);
    });
    document.querySelectorAll("[data-view]").forEach((view) => {
      view.classList.toggle("isActive", view.dataset.view === page);
    });
    const title = document.querySelector("[data-page-title]");
    if (title) {
      title.textContent = pageTitles[page] || "商品";
    }
  }

  function bindNavigation() {
    document.querySelectorAll("[data-page]").forEach((button) => {
      button.addEventListener("click", () => switchPage(button.dataset.page));
    });
  }

  function bindBackupInputs() {
    document.querySelectorAll("[data-backup-input]").forEach((input) => {
      if (input.dataset.bound === "true") {
        return;
      }
      input.dataset.bound = "true";
      input.addEventListener("change", async (event) => {
        const file = event.target.files && event.target.files[0];
        event.target.value = "";
        if (!file) {
          return;
        }
        try {
          const text = await file.text();
          const payload = JSON.parse(text);
          if (!payload || !payload.data) {
            throw new Error("missing data");
          }
          state = normalizeData(payload.data);
          renderAll();
          setDataStatus(`已载入 ${state.products.length} 个商品 / ${state.orders.length} 笔订单`);
        } catch {
          setDataStatus("备份读取失败，请使用 ECRM JSON 备份");
        }
      });
    });
  }

  function setDataStatus(text) {
    document.querySelectorAll("[data-data-status]").forEach((node) => {
      node.textContent = text;
    });
  }

  bindNavigation();
  renderAll();
})();
