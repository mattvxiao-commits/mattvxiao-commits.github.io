import { Copy, Edit3, PackagePlus, Power, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ProductForm, { ProductFormUserError, type ProductFormValues } from "../components/ProductForm";
import { listProducts, makeId, upsertProduct } from "../db/repositories";
import { displayProductCode } from "../domain/productCode";
import type { Product, ProductStatus } from "../domain/types";
import { getImageUrl } from "../utils/image";

type SortKey = "createdAt" | "name" | "spu" | "salePrice";
type ProductFormMode = "create" | "edit" | "copy";

const sortLabels: Record<SortKey, string> = {
  createdAt: "创建时间",
  name: "名称",
  spu: "SPU",
  salePrice: "售价"
};

function formatMoney(value: number): string {
  return `¥${value.toFixed(2)}`;
}

function ProductImage({ imageId, name }: { imageId?: string; name: string }) {
  const [imageUrl, setImageUrl] = useState<string>();

  useEffect(() => {
    let isCurrent = true;

    getImageUrl(imageId).then((url) => {
      if (isCurrent) {
        setImageUrl(url);
      }
    }).catch(() => {
      if (isCurrent) {
        setImageUrl(undefined);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [imageId]);

  return (
    <div className="productThumb">
      {imageUrl ? <img src={imageUrl} alt={name} /> : <span aria-hidden="true">{name.slice(0, 1) || "商"}</span>}
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [formMode, setFormMode] = useState<ProductFormMode>();
  const [editingProduct, setEditingProduct] = useState<Product>();
  const [isLoading, setIsLoading] = useState(true);
  const [statusChangingProductId, setStatusChangingProductId] = useState<string>();
  const [error, setError] = useState<string>();

  async function refreshProducts() {
    setIsLoading(true);
    setError(undefined);

    try {
      setProducts(await listProducts());
    } catch {
      setError("商品加载失败，请刷新后重试。");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshProducts();
  }, []);

  const sortedProducts = useMemo(() => {
    const nextProducts = [...products];

    nextProducts.sort((a, b) => {
      if (sortKey === "salePrice") {
        return b.salePrice - a.salePrice;
      }

      if (sortKey === "createdAt") {
        return b.createdAt.localeCompare(a.createdAt);
      }

      return a[sortKey].localeCompare(b[sortKey], "zh-Hans-CN");
    });

    return nextProducts;
  }, [products, sortKey]);

  const activeCount = products.filter((product) => product.status === "active").length;
  const sellableCount = products.filter((product) => product.isSellable && product.status === "active").length;
  const totalStock = products.reduce((sum, product) => sum + product.stockQty, 0);
  const isFormOpen = formMode !== undefined;
  const formTitle = formMode === "edit" ? "编辑商品" : formMode === "copy" ? "复制创建商品" : "新增商品";

  function openCreateForm() {
    setEditingProduct(undefined);
    setFormMode("create");
  }

  function openEditForm(product: Product) {
    setEditingProduct(product);
    setFormMode("edit");
  }

  function openCopyForm(product: Product) {
    setEditingProduct({
      ...product,
      skuCode: "",
      productCode: "",
      stockQty: 0
    });
    setFormMode("copy");
  }

  function closeForm() {
    setFormMode(undefined);
    setEditingProduct(undefined);
  }

  async function handleSave(values: ProductFormValues) {
    setError(undefined);

    const normalizedProductCode = values.productCode.trim();
    const hasDuplicateProductCode = normalizedProductCode.length > 0 && products.some((product) => {
      if (formMode === "edit" && editingProduct && product.id === editingProduct.id) {
        return false;
      }

      return product.productCode?.trim() === normalizedProductCode;
    });

    if (hasDuplicateProductCode) {
      throw new ProductFormUserError("完整商品编码已存在，请调整 SPU 编码或 SKU 编码。");
    }

    const now = new Date().toISOString();
    const product: Product = formMode === "edit" && editingProduct
      ? {
          ...editingProduct,
          ...values,
          updatedAt: now
        }
      : {
          id: makeId("product"),
          ...values,
          createdAt: now,
          updatedAt: now
        };

    await upsertProduct(product);
    closeForm();
    await refreshProducts();
  }

  async function updateProductStatus(product: Product, nextStatus: ProductStatus) {
    if (product.status === nextStatus || statusChangingProductId) {
      return;
    }

    const confirmationMessage = nextStatus === "inactive"
      ? "确认停用商品？停用后该商品不会出现在售卖商品列表中，已有订单记录不受影响。"
      : "确认启用商品？启用后该商品会重新出现在符合条件的售卖商品列表中。";

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setError(undefined);
    setStatusChangingProductId(product.id);

    try {
      await upsertProduct({
        ...product,
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });
      await refreshProducts();
    } catch {
      setError(nextStatus === "inactive" ? "商品停用失败，请稍后重试。" : "商品启用失败，请稍后重试。");
    } finally {
      setStatusChangingProductId(undefined);
    }
  }

  return (
    <section className="productsPage" aria-labelledby="products-title">
      <div className="productsToolbar">
        <div className="productsTitleBlock">
          <p className="eyebrow">Catalog</p>
          <div className="productsTitleLine">
            <h1 id="products-title">商品</h1>
            <div className="metricStrip" aria-label="商品概览">
              <div>
                <span>{products.length}</span>
                <p>全部商品</p>
              </div>
              <div>
                <span>{activeCount}</span>
                <p>启用中</p>
              </div>
              <div>
                <span>{sellableCount}</span>
                <p>可售卖</p>
              </div>
              <div>
                <span>{totalStock}</span>
                <p>总库存</p>
              </div>
            </div>
          </div>
        </div>
        <div className="toolbarActions">
          <label className="sortControl">
            <span>排序</span>
            <select
              aria-label="商品排序"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
            >
              {(Object.keys(sortLabels) as SortKey[]).map((key) => (
                <option key={key} value={key}>
                  {sortLabels[key]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="primaryButton" onClick={openCreateForm}>
            <PackagePlus size={19} aria-hidden="true" />
            新增商品
          </button>
        </div>
      </div>

      {isFormOpen ? (
        <div className="modalBackdrop" role="presentation">
          <section
            className="productDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-dialog-title"
          >
            <div className="dialogHeader">
              <div>
                <p className="eyebrow">Product</p>
                <h2 id="product-dialog-title">{formTitle}</h2>
                <p>维护现场售卖和赠品发放需要的基础信息。</p>
              </div>
              <button
                type="button"
                className="iconButton"
                aria-label="关闭商品弹窗"
                onClick={closeForm}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="productDialogBody">
              <ProductForm
                mode={formMode === "edit" ? "edit" : "create"}
                initialProduct={editingProduct}
                onCancel={closeForm}
                onSave={handleSave}
              />
            </div>
          </section>
        </div>
      ) : null}

      {error ? <p className="errorBanner">{error}</p> : null}

      <div className="productList" aria-live="polite">
        {isLoading ? <p className="emptyState">正在加载商品...</p> : null}
        {!isLoading && sortedProducts.length === 0 ? <p className="emptyState">还没有商品，点击新增商品开始录入。</p> : null}
        {sortedProducts.map((product) => (
          <article className="productCard" key={product.id}>
            <ProductImage imageId={product.imageId} name={product.name} />
            <div className="productInfo">
              <div className="productTitleRow">
                <div>
                  <h2>{product.name}</h2>
                </div>
              </div>
              <div className="productFacts">
                <span className="productSpuChip">{product.spu}</span>
                {product.series ? <span>系列 {product.series}</span> : null}
                <span>售价 {formatMoney(product.salePrice)}</span>
                <span>编码 {displayProductCode(product.productCode)}</span>
                <span>成本 {formatMoney(product.costPrice)}</span>
                <span>库存 {product.stockQty}</span>
                <span>{product.isSellable ? "可售卖" : "不可售卖"}</span>
                <span>{product.isGiftEligible ? "可赠品" : "非赠品"}</span>
              </div>
            </div>
            <div className="cardActions">
              <span className={`statusBadge ${product.status === "active" ? "isActive" : "isInactive"}`}>
                {product.status === "active" ? "启用" : "停用"}
              </span>
              <button
                type="button"
                className="secondaryButton"
                aria-label={`编辑 ${product.name}`}
                onClick={() => openEditForm(product)}
              >
                <Edit3 size={17} aria-hidden="true" />
                编辑
              </button>
              <button
                type="button"
                className="secondaryButton"
                aria-label={`复制 ${product.name}`}
                onClick={() => openCopyForm(product)}
              >
                <Copy size={17} aria-hidden="true" />
                复制
              </button>
              <button
                type="button"
                className={product.status === "active" ? "secondaryButton dangerButton" : "secondaryButton"}
                aria-label={`${product.status === "active" ? "停用" : "启用"} ${product.name}`}
                disabled={statusChangingProductId === product.id}
                onClick={() => void updateProductStatus(product, product.status === "active" ? "inactive" : "active")}
              >
                <Power size={17} aria-hidden="true" />
                {statusChangingProductId === product.id
                  ? product.status === "active" ? "停用中..." : "启用中..."
                  : product.status === "active" ? "停用" : "启用"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
