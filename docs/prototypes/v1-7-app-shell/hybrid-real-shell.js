(function () {
  const pageTitles = {
    mode: "模式",
    products: "商品",
    sales: "售卖",
    orders: "订单",
    dashboard: "数据",
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
        series: "灵感",
        productCode: "ACRY-24001-BLK",
        costPrice: 8,
        salePrice: 25,
        stockQty: 36,
        isSellable: true,
        isGiftEligible: false,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "sample-2",
        name: "主题贴纸包 春日款",
        spu: "贴纸",
        series: "灵感",
        productCode: "STKR-24002-SPR",
        costPrice: 2,
        salePrice: 10,
        stockQty: 58,
        isSellable: true,
        isGiftEligible: true,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "sample-3",
        name: "明信片套组 夜景款",
        spu: "明信片",
        series: "生成",
        productCode: "CARD-24003-NGT",
        costPrice: 4,
        salePrice: 18,
        stockQty: 22,
        isSellable: true,
        isGiftEligible: false,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "sample-4",
        name: "关注赠礼小卡",
        spu: "赠礼小卡",
        series: "生成",
        productCode: "GIFT-24004",
        costPrice: 1,
        salePrice: 0,
        stockQty: 84,
        isSellable: false,
        isGiftEligible: true,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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
  let cart = [
    { productId: "sample-1", quantity: 1 },
    { productId: "sample-2", quantity: 2 },
    { productId: "sample-3", quantity: 1 }
  ];
  let selectedSeries = "全部";
  let selectedSpu = "全部";
  let paymentMethod = "wechat";

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

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function normalizeData(data) {
    const normalized = {
      products: Array.isArray(data.products) ? data.products.map((product) => ({ series: "", ...product })) : [],
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

  function uniqueValues(values) {
    return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "zh-Hans-CN")
    );
  }

  function seriesOptions(products = sellableProducts()) {
    return uniqueValues(products.map((product) => product.series));
  }

  function shouldShowSeriesFilter(products = sellableProducts()) {
    return seriesOptions(products).length >= 2;
  }

  function filteredSalesProducts() {
    let products = sellableProducts();
    if (shouldShowSeriesFilter(products) && selectedSeries !== "全部") {
      products = products.filter((product) => (product.series || "").trim() === selectedSeries);
    }
    if (selectedSpu !== "全部") {
      products = products.filter((product) => product.spu === selectedSpu);
    }
    return products;
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

  function renderModePage() {
    return `
      <div class="pageHeader">
        <div class="pageHeaderCopy">
          <p class="eyebrow">Field Mode</p>
          <h1 id="mode-title">现场模式</h1>
          <p>锁定管理页面、订单详情和敏感经营信息，适合现场收款时使用。</p>
        </div>
        <button type="button" class="primaryButton" data-action="open-field-lock">重新锁定</button>
      </div>
      <section class="settingsSection modeHero">
        <div class="sectionTitle">
          <div><h2>当前状态：已锁定</h2><p>商品、设置、数据页和订单详情需要 PIN 才能进入。</p></div>
          <span class="statusBadge isActive">生效中</span>
        </div>
        <div class="fieldGrid">
          <label class="fieldLabel"><span>PIN 位数</span><input value="4 位数字 PIN" readonly /></label>
          <label class="fieldLabel"><span>锁定范围</span><input value="商品 / 数据 / 设置 / 订单详情" readonly /></label>
        </div>
        <div class="backupActions">
          <button type="button" class="secondaryButton" data-action="open-field-lock">立即重新锁定</button>
          <button type="button" class="dangerButton" data-action="open-field-lock">关闭现场模式</button>
        </div>
      </section>
    `;
  }

  function renderProductsPage() {
    const products = state.products;
    const activeCount = activeProducts().length;
    const sellableCount = sellableProducts().length;
    const totalStock = products.reduce((sum, product) => sum + Number(product.stockQty || 0), 0);
    const rows = products.slice(0, 12).map((product) => `
      <article class="productCard">
        ${productImage(product, "productThumb")}
        <div class="productInfo">
          <h2>${escapeHtml(product.name)}</h2>
          <div class="productFacts">
            ${product.series ? `<span class="statusBadge isActive">系列 ${escapeHtml(product.series)}</span>` : ""}
            <span>${escapeHtml(product.spu || "未分组")}</span>
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
            <button type="button" data-action="open-product-edit" data-product-id="${escapeHtml(product.id)}">编辑</button>
            <button type="button" data-action="open-product-copy" data-product-id="${escapeHtml(product.id)}">复制</button>
            <button type="button" class="dangerButton" data-action="toggle-product-status" data-product-id="${escapeHtml(product.id)}">${product.status === "inactive" ? "启用" : "停用"}</button>
          </div>
        </div>
      </article>
    `).join("");

    return `
      <div class="pageHeader">
        <div class="pageHeaderCopy">
          <p class="eyebrow">Catalog</p>
          <h1 id="products-title">商品</h1>
          <p>管理摊位商品、规格、系列、编码、价格、库存和可售状态。</p>
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
        <button type="button" class="primaryButton" data-action="open-product-create">新增商品</button>
      </div>
      <div class="productList">${rows || `<p class="productCard">还没有商品，导入备份后可预览真实密度。</p>`}</div>
    `;
  }

  function renderSalesPage() {
    const allProducts = sellableProducts();
    if (!allProducts.some((product) => product.spu === selectedSpu)) {
      selectedSpu = "全部";
    }
    const seriesList = seriesOptions(allProducts);
    if (!seriesList.includes(selectedSeries) && selectedSeries !== "全部") {
      selectedSeries = "全部";
    }
    const seriesFiltered = selectedSeries === "全部"
      ? allProducts
      : allProducts.filter((product) => (product.series || "").trim() === selectedSeries);
    const spuList = ["全部", ...uniqueValues(seriesFiltered.map((product) => product.spu))];
    const visibleProducts = filteredSalesProducts();
    const cartModel = buildCartModel();

    const productRows = visibleProducts.slice(0, 16).map((product) => `
      <article class="salesProductRow">
        ${productImage(product, "salesThumb")}
        <div class="salesProductMain">
          <div>
            <h2>${escapeHtml(product.name)}</h2>
            <p>${escapeHtml(product.spu || "未分组")}${product.series ? ` / ${escapeHtml(product.series)}` : ""}</p>
          </div>
          <div class="salesMeta">
            <span class="chip">${formatMoney(product.salePrice)}</span>
            <span class="chip">库存 ${Number(product.stockQty || 0)}</span>
            ${product.isGiftEligible ? `<span class="chip">可赠品</span>` : ""}
          </div>
        </div>
        <button type="button" class="addButton" aria-label="加入购物车" data-action="add-cart" data-product-id="${escapeHtml(product.id)}">+</button>
      </article>
    `).join("");

    return `
      <div class="pageHeader">
        <div class="pageHeaderCopy">
          <p class="eyebrow">Checkout</p>
          <h1 id="sales-title">售卖</h1>
          <p>选择商品、确认购物车、手动收款后保存订单并扣减库存。</p>
        </div>
        <button type="button" class="secondaryButton" data-action="open-field-lock">重新锁定</button>
      </div>
      <div class="salesFilterStack">
        ${shouldShowSeriesFilter(allProducts) ? `
          <div class="controlGroup seriesFilter" aria-label="系列筛选">
            ${["全部", ...seriesList].map((series) => `<button type="button" class="filterChip ${selectedSeries === series ? "isActive" : ""}" data-action="select-series" data-series="${escapeHtml(series)}">${escapeHtml(series)}</button>`).join("")}
          </div>
        ` : ""}
        <div class="toolbarRow">
          <div class="controlGroup" aria-label="SPU 筛选">
            ${spuList.map((spu) => `<button type="button" class="filterChip ${selectedSpu === spu ? "isActive" : ""}" data-action="select-spu" data-spu="${escapeHtml(spu)}">${escapeHtml(spu)}</button>`).join("")}
          </div>
          <button type="button" class="secondaryButton" data-action="refresh-prototype">刷新</button>
        </div>
      </div>
      <div class="salesLayout">
        <div>
          <div class="salesProductList">${productRows || `<p class="salesProductRow">当前筛选下没有可售商品。</p>`}</div>
        </div>
        ${renderCartPreview(cartModel)}
      </div>
    `;
  }

  function buildCartModel() {
    const productById = new Map(state.products.map((product) => [product.id, product]));
    const lines = cart
      .map((item) => ({ item, product: productById.get(item.productId) }))
      .filter((entry) => entry.product)
      .map(({ item, product }) => {
        const lineType = item.lineType || "normal";
        const unitPrice = typeof item.unitPriceOverride === "number"
          ? item.unitPriceOverride
          : Number(product.salePrice || 0);
        return {
          key: item.key || `normal-${product.id}`,
          product,
          quantity: item.quantity,
          unitPrice,
          lineType,
          note: item.note || "",
          revenueType: lineType === "normal" ? "sale" : "non_sales",
          lineTotal: unitPrice * item.quantity
        };
      });
    const payable = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const count = lines.reduce((sum, line) => sum + line.quantity, 0);
    return { lines, payable, count };
  }

  function lineTypeLabel(lineType) {
    if (lineType === "campaign_gift") return "运营赠礼";
    if (lineType === "manual_gift") return "人工赠送";
    if (lineType === "other_non_sales") return "其他出库";
    return "正常";
  }

  function inferOrderNature(lines) {
    const hasSale = lines.some((line) => line.revenueType === "sale");
    const hasNonSales = lines.some((line) => line.revenueType === "non_sales");
    if (hasSale && hasNonSales) return "mixed";
    if (hasNonSales) return "non_sales";
    return "sale";
  }

  function renderCartPreview(model) {
    const lines = model.lines.map((line) => `
      <div class="cartLine">
        ${productImage(line.product, "cartThumb")}
        <div class="cartLineMain">
          <strong>${escapeHtml(line.product.name)}</strong>
          <span>${escapeHtml(line.product.spu)} / 单价 ${formatMoney(line.unitPrice)}</span>
          <em class="lineTypeBadge ${line.lineType === "normal" ? "" : "isNonSale"}">${lineTypeLabel(line.lineType)}${line.note ? ` / ${escapeHtml(line.note)}` : ""}</em>
        </div>
        <div class="cartLineControls">
          <button type="button" data-action="cart-dec" data-cart-key="${escapeHtml(line.key)}">-</button>
          <span>${line.quantity}</span>
          <button type="button" data-action="cart-inc" data-cart-key="${escapeHtml(line.key)}">+</button>
        </div>
        <strong class="cartLineAmount">${formatMoney(line.lineTotal)}</strong>
      </div>
    `).join("");

    return `
      <aside class="cartPreview" data-cart-preview>
        <button type="button" class="cartCollapsedButton" data-action="toggle-cart">
          <span>购物车</span>
          <strong>${model.count} 件 / ${formatMoney(model.payable)}</strong>
        </button>
        <div class="cartExpandedBody">
          <div class="panelHeading">
            <h2>购物车</h2>
            <span class="chip">${model.count} 件</span>
          </div>
          <div class="cartLines">${lines || `<p class="cartEmpty">还没有选择商品。</p>`}</div>
          <div class="nonSalesActions">
            <button type="button" class="secondaryButton" data-action="open-nonsales" data-reason="campaign_gift">运营赠礼</button>
            <button type="button" class="secondaryButton" data-action="open-nonsales" data-reason="manual_gift">人工赠送</button>
            <button type="button" class="secondaryButton" data-action="open-nonsales" data-reason="other_non_sales">其他出库</button>
          </div>
          <div class="cartTotal">
            <div><span>加购/满赠</span><strong>${getSettings().promotion?.enabled ? "已启用" : "未启用"}</strong></div>
            <div class="payable"><span>应收</span><strong>${formatMoney(model.payable)}</strong></div>
          </div>
          <div class="cartActions">
            <button type="button" class="secondaryButton" data-action="clear-cart">清空</button>
            <button type="button" class="secondaryButton" data-action="hold-cart">暂存</button>
            <button type="button" class="primaryButton" data-action="open-checkout">收款</button>
          </div>
        </div>
      </aside>
    `;
  }

  function renderOrderRow(order) {
    return `
      <article class="orderRow">
        <button type="button" class="orderOpenButton" data-action="open-order-detail" data-order-id="${escapeHtml(order.id)}">
          <span>
            <h3>${escapeHtml(order.orderNo)}</h3>
            <p>${formatOrderTime(order.paidAt || order.createdAt)} / ${escapeHtml(paymentLabels[order.paymentMethod] || "未记录")}</p>
          </span>
          <span class="orderMeta">
            <span class="orderChip isGreen">${order.status === "paid" ? "已支付" : "其他"}</span>
            <span class="orderChip ${order.orderNature === "mixed" ? "isWarning" : ""}">${orderNatureLabel(order)}</span>
            <strong>${formatMoney(order.payableAmount)}</strong>
          </span>
        </button>
      </article>
    `;
  }

  function renderOrdersPage() {
    const rows = paidOrders().slice(0, 12).map(renderOrderRow).join("");
    return `
      <div class="pageHeader">
        <div class="pageHeaderCopy">
          <p class="eyebrow">Orders</p>
          <h1 id="orders-title">订单</h1>
          <p>订单记录独立成页，点击任意订单可查看详情。</p>
        </div>
        <div class="controlGroup">
          <button type="button" class="filterChip isActive">今日</button>
          <button type="button" class="filterChip">全部状态</button>
          <button type="button" class="filterChip">全部方式</button>
          <button type="button" class="secondaryButton">刷新</button>
        </div>
      </div>
      <div class="orderList orderPageList">${rows || `<p class="orderRow">暂无订单记录。</p>`}</div>
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
          <h1 id="dashboard-title">数据</h1>
          <p>统计范围：今日 / 当前原型按导入备份数据预览首屏密度。</p>
        </div>
        <div class="dashboardToolbar">
          <div class="controlGroup">
            <button type="button" class="filterChip isActive">今日</button>
            <button type="button" class="filterChip">昨天</button>
            <button type="button" class="filterChip">近 3 天</button>
            <button type="button" class="filterChip">近 7 天</button>
            <button type="button" class="filterChip">自定义</button>
          </div>
          <div class="controlGroup">
            <button type="button" class="filterChip isActive">正常销售</button>
            <button type="button" class="filterChip">全部活动</button>
            <button type="button" class="filterChip">运营赠礼</button>
            <button type="button" class="filterChip">人工赠送</button>
            <button type="button" class="filterChip">其他出库</button>
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
    const spuOptions = uniqueValues(state.products.map((product) => product.spu));
    const campaignGift = settings.campaignGift || {};
    const promotion = settings.promotion || sampleData.settings[0].promotion;

    return `
      <div class="pageHeader">
        <div class="pageHeaderCopy">
          <p class="eyebrow">Setup</p>
          <h1 id="settings-title">设置</h1>
          <p>维护摊位资料、现场模式、收款码、促销规则和本机 JSON 备份。</p>
        </div>
        <button type="button" class="primaryButton" data-action="show-toast">保存设置</button>
      </div>
      <div class="settingsGrid">
        <section class="settingsSection">
          <div class="sectionTitle"><div><h2>现场模式</h2><p>锁定商品、设置、数据和订单详情。</p></div><span class="statusBadge isActive">已启用</span></div>
          <div class="fieldGrid">
            <label class="fieldLabel"><span>PIN 位数</span><input value="4 位数字 PIN" readonly /></label>
            <label class="fieldLabel"><span>当前状态</span><input value="管理页面已锁定" readonly /></label>
          </div>
          <div class="backupActions"><button type="button" class="secondaryButton" data-action="open-field-lock">立即重新锁定</button><button type="button" class="dangerButton" data-action="open-field-lock">关闭现场模式</button></div>
        </section>
        <div class="settingsSaveBridge"><button type="button" class="primaryButton" data-action="show-toast">保存设置</button></div>
        <section class="settingsSection">
          <div class="sectionTitle"><div><h2>基础信息</h2><p>用于订单抬头和编号前缀。</p></div></div>
          <div class="fieldGrid">
            <label class="fieldLabel"><span>店铺名称</span><input value="${escapeHtml(settings.shopName || "")}" readonly /></label>
            <label class="fieldLabel"><span>订单前缀</span><input value="${escapeHtml(settings.orderPrefix || "")}" readonly /></label>
          </div>
        </section>
        <section class="settingsSection">
          <div class="sectionTitle"><div><h2>收款码</h2><p>上传微信、支付宝收款码。</p></div></div>
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
      mode: renderModePage,
      products: renderProductsPage,
      sales: renderSalesPage,
      orders: renderOrdersPage,
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

  function openModal(html) {
    const host = document.querySelector("[data-modal-host]");
    if (!host) return;
    host.innerHTML = html;
    document.body.classList.add("hasModal");
  }

  function closeModal() {
    const host = document.querySelector("[data-modal-host]");
    if (host) host.innerHTML = "";
    document.body.classList.remove("hasModal");
  }

  function openProductDialog(mode, productId) {
    const sourceProduct = state.products.find((product) => product.id === productId);
    const product = sourceProduct || {};
    const isCopy = mode === "copy";
    const title = mode === "edit" ? "编辑商品" : isCopy ? "复制创建商品" : "新增商品";
    openModal(`
      <div class="modalBackdrop">
        <section class="prototypeDialog productDialog" role="dialog" aria-modal="true">
          <div class="dialogHeader">
            <div><p class="eyebrow">Product</p><h2>${title}</h2><p>维护现场售卖、赠品发放和系列筛选需要的基础信息。</p></div>
            <button type="button" class="iconButton" data-action="close-modal">×</button>
          </div>
          <form class="productForm" data-product-form data-mode="${mode}" data-product-id="${escapeHtml(productId || "")}">
            <div class="fieldGrid threeColumns">
              <label class="fieldLabel"><span>商品名称</span><input name="name" value="${escapeHtml(isCopy ? `${product.name || ""} 副本` : product.name || "")}" required /></label>
              <label class="fieldLabel"><span>SPU</span><input name="spu" value="${escapeHtml(product.spu || "")}" required /></label>
              <label class="fieldLabel"><span>系列（筛选）</span><input name="series" value="${escapeHtml(product.series || "")}" placeholder="可空，例如：某 IP / 某系列" /></label>
              <label class="fieldLabel"><span>完整商品编码</span><input name="productCode" value="${escapeHtml(isCopy ? "" : product.productCode || "")}" /></label>
              <label class="fieldLabel"><span>成本价</span><input name="costPrice" type="number" step="0.01" value="${Number(product.costPrice || 0)}" /></label>
              <label class="fieldLabel"><span>售价</span><input name="salePrice" type="number" step="0.01" value="${Number(product.salePrice || 0)}" /></label>
              <label class="fieldLabel"><span>库存数量</span><input name="stockQty" type="number" step="1" value="${Number(isCopy ? 0 : product.stockQty || 0)}" /></label>
              <label class="toggleControl"><input name="isSellable" type="checkbox" ${product.isSellable === false ? "" : "checked"} /><span>可售卖</span></label>
              <label class="toggleControl"><input name="isGiftEligible" type="checkbox" ${product.isGiftEligible ? "checked" : ""} /><span>可赠品</span></label>
            </div>
            <p class="fieldHint">系列字段非必填；只有商品库内存在 2 个及以上不同系列时，售卖页才显示系列筛选。</p>
            <div class="dialogActions">
              <button type="button" class="secondaryButton" data-action="close-modal">取消</button>
              <button type="submit" class="primaryButton">保存</button>
            </div>
          </form>
        </section>
      </div>
    `);
  }

  function saveProductFromForm(form) {
    const data = new FormData(form);
    const mode = form.dataset.mode;
    const productId = form.dataset.productId;
    const existing = state.products.find((product) => product.id === productId);
    const now = new Date().toISOString();
    const nextProduct = {
      id: mode === "edit" && existing ? existing.id : makeId("product"),
      name: String(data.get("name") || "").trim() || "未命名商品",
      spu: String(data.get("spu") || "").trim() || "未分组",
      series: String(data.get("series") || "").trim(),
      productCode: String(data.get("productCode") || "").trim(),
      costPrice: Number(data.get("costPrice") || 0),
      salePrice: Number(data.get("salePrice") || 0),
      stockQty: Math.max(0, Math.floor(Number(data.get("stockQty") || 0))),
      isSellable: data.get("isSellable") === "on",
      isGiftEligible: data.get("isGiftEligible") === "on",
      status: existing?.status || "active",
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    if (mode === "edit" && existing) {
      state.products = state.products.map((product) => (product.id === existing.id ? nextProduct : product));
    } else {
      state.products = [nextProduct, ...state.products];
    }
    closeModal();
    renderAll();
  }

  function openCheckoutModal() {
    const model = buildCartModel();
    openModal(`
      <div class="modalBackdrop">
        <section class="prototypeDialog checkoutDialog" role="dialog" aria-modal="true">
          <div class="dialogHeader">
            <div><p class="eyebrow">Checkout</p><h2>收款</h2><p>复核本单商品，确认收款方式后保存订单。</p></div>
            <button type="button" class="iconButton" data-action="close-modal">×</button>
          </div>
          <div class="checkoutBody">
            <section class="checkoutReview">
              <div class="panelHeading"><h2>本单商品</h2><span class="chip">${model.count} 件</span></div>
              <div class="cartLines">${model.lines.map((line) => `
                <div class="cartLine">
                  ${productImage(line.product, "cartThumb")}
                  <div class="cartLineMain">
                    <strong>${escapeHtml(line.product.name)}</strong>
                    <span>${escapeHtml(line.product.spu)} / x${line.quantity} / 单价 ${formatMoney(line.unitPrice)}</span>
                    <em class="lineTypeBadge ${line.lineType === "normal" ? "" : "isNonSale"}">${lineTypeLabel(line.lineType)}${line.note ? ` / ${escapeHtml(line.note)}` : ""}</em>
                  </div>
                  <strong class="cartLineAmount">${formatMoney(line.lineTotal)}</strong>
                </div>
              `).join("") || `<p class="cartEmpty">还没有选择商品。</p>`}</div>
              <div class="cartTotal"><div><span>加购/满赠</span><strong>已启用</strong></div><div class="payable"><span>应收</span><strong>${formatMoney(model.payable)}</strong></div></div>
            </section>
            <section class="paymentPanel">
              <div class="controlGroup">
                ${Object.entries(paymentLabels).map(([key, label]) => `<button type="button" class="filterChip ${paymentMethod === key ? "isActive" : ""}" data-action="select-payment" data-method="${key}">${label}</button>`).join("")}
              </div>
              <div class="qrPreview"><strong>${paymentLabels[paymentMethod] || "微信"}收款码</strong><span>二维码占位</span></div>
              <div class="dialogActions">
                <button type="button" class="secondaryButton" data-action="close-modal">返回购物车</button>
                <button type="button" class="primaryButton" data-action="confirm-paid">确认已收款</button>
              </div>
            </section>
          </div>
        </section>
      </div>
    `);
  }

  function openOrderDetail(orderId) {
    const order = state.orders.find((item) => item.id === orderId) || state.orders[0];
    if (!order) return;
    const items = state.orderItems.filter((item) => item.orderId === order.id);
    openModal(`
      <div class="modalBackdrop">
        <section class="prototypeDialog orderDetailDialog" role="dialog" aria-modal="true">
          <div class="dialogHeader">
            <div><p class="eyebrow">Order</p><h2>${escapeHtml(order.orderNo)}</h2><p>${formatOrderTime(order.paidAt || order.createdAt)} / ${escapeHtml(paymentLabels[order.paymentMethod] || "未记录")}</p></div>
            <button type="button" class="iconButton" data-action="close-modal">×</button>
          </div>
          <div class="orderDetailBody">
            <div class="dashboardMetricStrip">
              <div><span>${formatMoney(order.subtotalBeforeDiscount)}</span><p>原价</p></div>
              <div><span>${formatMoney(order.discountAmount)}</span><p>优惠</p></div>
              <div><span>${formatMoney(order.payableAmount)}</span><p>应收</p></div>
              <div><span>${orderNatureLabel(order)}</span><p>订单性质</p></div>
            </div>
            <section class="settingsSection isWide">
              <div class="sectionTitle"><div><h2>商品明细</h2><p>展示订单内商品、数量、类型和金额。</p></div></div>
              <div class="orderList">${items.map((item) => `
                <article class="orderRow">
                  <div><h3>${escapeHtml(item.productNameSnapshot)}</h3><p>${escapeHtml(item.spuSnapshot)} / ${item.lineType}</p></div>
                  <div class="orderMeta"><span class="orderChip">${item.quantity} 件</span><strong>${formatMoney(item.lineTotal)}</strong></div>
                </article>
              `).join("") || `<p class="emptyStateText">暂无商品明细。</p>`}</div>
            </section>
            <section class="settingsSection isWide">
              <div class="sectionTitle"><div><h2>售后与修正</h2><p>原型展示作废、退款、统计口径修正入口。</p></div></div>
              <div class="backupActions">
                <button type="button" class="dangerButton" data-action="show-toast">作废订单</button>
                <button type="button" class="secondaryButton" data-action="show-toast">记录退款</button>
                <button type="button" class="secondaryButton" data-action="show-toast">修正统计口径</button>
              </div>
            </section>
          </div>
        </section>
      </div>
    `);
  }

  function openNonSalesModal(reason) {
    const label = reason === "campaign_gift" ? "运营赠礼" : reason === "manual_gift" ? "人工赠送" : "其他出库";
    const selectableProducts = reason === "campaign_gift"
      ? activeProducts().filter((product) => product.isGiftEligible)
      : activeProducts();
    openModal(`
      <div class="modalBackdrop">
        <section class="prototypeDialog fieldLockDialog" role="dialog" aria-modal="true">
          <div class="dialogHeader">
            <div><p class="eyebrow">Outbound</p><h2>${label}</h2><p>选择商品并填写备注后，以 0 元出库方式加入购物车。</p></div>
            <button type="button" class="iconButton" data-action="close-modal">×</button>
          </div>
          <div class="nonSalesList">
            ${selectableProducts.slice(0, 8).map((product) => `
              <button type="button" class="nonSalesProductOption" data-action="add-nonsales" data-product-id="${escapeHtml(product.id)}" data-reason="${escapeHtml(reason)}" data-note="${escapeHtml(label)}">
                <span><strong>${escapeHtml(product.name)}</strong><em>${escapeHtml(product.spu)}</em></span>
                <span>库存 ${Number(product.stockQty || 0)}</span>
              </button>
            `).join("") || `<p class="emptyStateText">当前没有可选择商品。</p>`}
          </div>
          <label class="fieldLabel"><span>备注</span><input value="${label}" /></label>
          <div class="dialogActions"><button type="button" class="secondaryButton" data-action="close-modal">取消</button></div>
        </section>
      </div>
    `);
  }

  function openFieldLockModal() {
    openModal(`
      <div class="modalBackdrop">
        <section class="prototypeDialog fieldLockDialog" role="dialog" aria-modal="true">
          <div class="dialogHeader">
            <div><p class="eyebrow">Field Mode</p><h2>现场模式</h2><p>输入 4 位数字 PIN 后可解锁管理页面。</p></div>
            <button type="button" class="iconButton" data-action="close-modal">×</button>
          </div>
          <label class="fieldLabel"><span>PIN</span><input inputmode="numeric" maxlength="4" placeholder="0000" /></label>
          <div class="dialogActions"><button type="button" class="secondaryButton" data-action="close-modal">取消</button><button type="button" class="primaryButton" data-action="close-modal">确认</button></div>
        </section>
      </div>
    `);
  }

  function showToast(message = "原型操作已触发。") {
    openModal(`
      <div class="modalBackdrop">
        <section class="prototypeDialog fieldLockDialog" role="dialog" aria-modal="true">
          <div class="dialogHeader"><div><p class="eyebrow">Prototype</p><h2>${escapeHtml(message)}</h2><p>当前 HTML 只用于 UI/UE 验证，不写入正式数据库。</p></div></div>
          <div class="dialogActions"><button type="button" class="primaryButton" data-action="close-modal">知道了</button></div>
        </section>
      </div>
    `);
  }

  function addToCart(productId) {
    const current = cart.find((item) => item.productId === productId && (item.lineType || "normal") === "normal");
    if (current) current.quantity += 1;
    else cart.push({ key: `normal-${productId}`, productId, quantity: 1, lineType: "normal" });
    document.body.classList.add("isCartExpanded");
    renderAll();
  }

  function addNonSalesToCart(productId, reason, note) {
    cart.push({
      key: makeId("cart"),
      productId,
      quantity: 1,
      lineType: reason || "other_non_sales",
      unitPriceOverride: 0,
      note: note || lineTypeLabel(reason)
    });
    document.body.classList.add("isCartExpanded");
    renderAll();
  }

  function savePaidOrder() {
    const model = buildCartModel();
    if (model.count === 0) {
      showToast("购物车为空");
      return;
    }
    const now = new Date().toISOString();
    const orderId = makeId("order");
    const orderNo = `${getSettings().orderPrefix || "ECRM"}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(state.orders.length + 1).padStart(3, "0")}`;
    state.orders = [{
      id: orderId,
      orderNo,
      status: "paid",
      paymentMethod,
      subtotalBeforeDiscount: model.payable,
      discountAmount: 0,
      payableAmount: model.payable,
      orderNature: inferOrderNature(model.lines),
      createdAt: now,
      paidAt: now
    }, ...state.orders];
    state.orderItems = [
      ...model.lines.map((line) => ({
        id: makeId("item"),
        orderId,
        productId: line.product.id,
        productNameSnapshot: line.product.name,
        spuSnapshot: line.product.spu,
        quantity: line.quantity,
        finalUnitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        lineType: line.lineType,
        revenueType: line.revenueType,
        nonSalesReason: line.lineType === "normal" ? undefined : line.lineType,
        nonSalesNote: line.note
      })),
      ...state.orderItems
    ];
    cart = [];
    closeModal();
    switchPage("orders");
    renderAll();
  }

  function handleDocumentClick(event) {
    const target = event.target.closest("[data-action], [data-page]");
    if (!target) return;

    if (target.dataset.page) {
      switchPage(target.dataset.page);
      return;
    }

    const action = target.dataset.action;
    if (action === "close-modal") closeModal();
    if (action === "open-product-create") openProductDialog("create");
    if (action === "open-product-edit") openProductDialog("edit", target.dataset.productId);
    if (action === "open-product-copy") openProductDialog("copy", target.dataset.productId);
    if (action === "toggle-product-status") {
      state.products = state.products.map((product) => product.id === target.dataset.productId ? { ...product, status: product.status === "inactive" ? "active" : "inactive" } : product);
      renderAll();
    }
    if (action === "select-series") {
      selectedSeries = target.dataset.series || "全部";
      selectedSpu = "全部";
      renderAll();
    }
    if (action === "select-spu") {
      selectedSpu = target.dataset.spu || "全部";
      renderAll();
    }
    if (action === "add-cart") addToCart(target.dataset.productId);
    if (action === "toggle-cart") document.body.classList.toggle("isCartExpanded");
    if (action === "cart-inc") {
      cart = cart.map((item) => (item.key || `normal-${item.productId}`) === target.dataset.cartKey ? { ...item, quantity: item.quantity + 1 } : item);
      renderAll();
    }
    if (action === "cart-dec") {
      cart = cart
        .map((item) => (item.key || `normal-${item.productId}`) === target.dataset.cartKey ? { ...item, quantity: item.quantity - 1 } : item)
        .filter((item) => item.quantity > 0);
      renderAll();
    }
    if (action === "clear-cart") {
      cart = [];
      renderAll();
    }
    if (action === "hold-cart") {
      document.body.classList.remove("isCartExpanded");
      showToast("购物车已暂存");
    }
    if (action === "open-checkout") openCheckoutModal();
    if (action === "select-payment") {
      paymentMethod = target.dataset.method || "wechat";
      openCheckoutModal();
    }
    if (action === "confirm-paid") savePaidOrder();
    if (action === "open-order-detail") openOrderDetail(target.dataset.orderId);
    if (action === "open-nonsales") openNonSalesModal(target.dataset.reason);
    if (action === "add-nonsales") {
      addNonSalesToCart(target.dataset.productId, target.dataset.reason, target.dataset.note);
      closeModal();
    }
    if (action === "open-field-lock") openFieldLockModal();
    if (action === "refresh-prototype") renderAll();
    if (action === "show-toast") showToast("操作已记录");
  }

  function bindBackupInputs() {
    document.querySelectorAll("[data-backup-input]").forEach((input) => {
      if (input.dataset.bound === "true") return;
      input.dataset.bound = "true";
      input.addEventListener("change", async (event) => {
        const file = event.target.files && event.target.files[0];
        event.target.value = "";
        if (!file) return;
        try {
          const text = await file.text();
          const payload = JSON.parse(text);
          if (!payload || !payload.data) throw new Error("missing data");
          state = normalizeData(payload.data);
          cart = [];
          selectedSeries = "全部";
          selectedSpu = "全部";
          renderAll();
          showToast(`已载入 ${state.products.length} 个商品 / ${state.orders.length} 笔订单`);
        } catch {
          showToast("备份读取失败，请使用 ECRM JSON 备份");
        }
      });
    });
  }

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("submit", (event) => {
    if (event.target.matches("[data-product-form]")) {
      event.preventDefault();
      saveProductFromForm(event.target);
    }
  });
  renderAll();
})();
