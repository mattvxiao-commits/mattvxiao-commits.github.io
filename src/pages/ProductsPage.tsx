import { Edit3, PackagePlus, Power, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ProductForm, { type ProductFormValues } from "../components/ProductForm";
import { listProducts, makeId, upsertProduct } from "../db/repositories";
import type { Product } from "../domain/types";
import { getImageUrl } from "../utils/image";

type SortKey = "createdAt" | "name" | "spu" | "salePrice";

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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product>();
  const [isLoading, setIsLoading] = useState(true);
  const [deactivatingProductId, setDeactivatingProductId] = useState<string>();
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

  function openCreateForm() {
    setEditingProduct(undefined);
    setIsFormOpen(true);
  }

  function openEditForm(product: Product) {
    setEditingProduct(product);
    setIsFormOpen(true);
  }

  async function handleSave(values: ProductFormValues) {
    setError(undefined);

    const normalizedProductCode = values.productCode.trim();
    const hasDuplicateProductCode = normalizedProductCode.length > 0 && products.some((product) => {
      if (editingProduct && product.id === editingProduct.id) {
        return false;
      }

      return product.productCode?.trim() === normalizedProductCode;
    });

    if (hasDuplicateProductCode) {
      setError("完整商品编码已存在，请调整 SPU 编码或 SKU 编码。");
      return;
    }

    const now = new Date().toISOString();
    const product: Product = editingProduct
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
    setIsFormOpen(false);
    setEditingProduct(undefined);
    await refreshProducts();
  }

  async function deactivateProduct(product: Product) {
    if (product.status === "inactive" || deactivatingProductId) {
      return;
    }

    setError(undefined);
    setDeactivatingProductId(product.id);

    try {
      await upsertProduct({
        ...product,
        status: "inactive",
        updatedAt: new Date().toISOString()
      });
      await refreshProducts();
    } catch {
      setError("商品停用失败，请稍后重试。");
    } finally {
      setDeactivatingProductId(undefined);
    }
  }

  return (
    <section className="productsPage" aria-labelledby="products-title">
      <div className="productsToolbar">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1 id="products-title">商品</h1>
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

      {isFormOpen ? (
        <div className="formPanel">
          <div className="formPanelHeader">
            <div>
              <p className="panelLabel">{editingProduct ? "编辑商品" : "新增商品"}</p>
              <p className="panelText">维护现场售卖和赠品发放需要的基础信息。</p>
            </div>
            <button
              type="button"
              className="iconButton"
              aria-label="关闭表单"
              onClick={() => {
                setIsFormOpen(false);
                setEditingProduct(undefined);
              }}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <ProductForm
            mode={editingProduct ? "edit" : "create"}
            initialProduct={editingProduct}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingProduct(undefined);
            }}
            onSave={handleSave}
          />
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
                  <p>{product.spu}</p>
                </div>
                <span className={`statusBadge ${product.status === "active" ? "isActive" : "isInactive"}`}>
                  {product.status === "active" ? "启用" : "停用"}
                </span>
              </div>
              <div className="productFacts">
                <span>售价 {formatMoney(product.salePrice)}</span>
                <span>成本 {formatMoney(product.costPrice)}</span>
                <span>库存 {product.stockQty}</span>
                <span>{product.isSellable ? "可售卖" : "不可售卖"}</span>
                <span>{product.isGiftEligible ? "可赠品" : "非赠品"}</span>
              </div>
            </div>
            <div className="cardActions">
              <button type="button" className="secondaryButton" onClick={() => openEditForm(product)}>
                <Edit3 size={17} aria-hidden="true" />
                编辑
              </button>
              <button
                type="button"
                className="secondaryButton dangerButton"
                disabled={product.status === "inactive" || deactivatingProductId === product.id}
                onClick={() => void deactivateProduct(product)}
              >
                <Power size={17} aria-hidden="true" />
                {deactivatingProductId === product.id ? "停用中..." : "停用"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
