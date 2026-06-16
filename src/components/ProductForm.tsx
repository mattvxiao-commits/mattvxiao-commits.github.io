import { ImagePlus } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { saveImage } from "../db/repositories";
import { buildProductCode, displayProductCode, validateProductCodeParts } from "../domain/productCode";
import type { Product, ProductStatus } from "../domain/types";
import { getImageUrl } from "../utils/image";

export type ProductFormValues = {
  name: string;
  spu: string;
  spuCode: string;
  skuCode: string;
  productCode: string;
  imageId?: string;
  costPrice: number;
  salePrice: number;
  stockQty: number;
  isSellable: boolean;
  isGiftEligible: boolean;
  status: ProductStatus;
};

type ProductFormProps = {
  mode: "create" | "edit";
  initialProduct?: Product;
  onSave: (values: ProductFormValues) => void | Promise<void>;
  onCancel: () => void;
};

type Draft = {
  name: string;
  spu: string;
  spuCode: string;
  skuCode: string;
  imageId?: string;
  costPrice: string;
  salePrice: string;
  stockQty: string;
  isSellable: boolean;
  isGiftEligible: boolean;
  status: ProductStatus;
};

function productToDraft(product?: Product): Draft {
  return {
    name: product?.name ?? "",
    spu: product?.spu ?? "",
    spuCode: product?.spuCode ?? "",
    skuCode: product?.skuCode ?? "",
    imageId: product?.imageId,
    costPrice: product ? String(product.costPrice) : "0",
    salePrice: product ? String(product.salePrice) : "0",
    stockQty: product ? String(product.stockQty) : "0",
    isSellable: product?.isSellable ?? true,
    isGiftEligible: product?.isGiftEligible ?? false,
    status: product?.status ?? "active"
  };
}

function isNonNegativeNumber(value: string): boolean {
  if (value.trim() === "") {
    return false;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0;
}

function isNonNegativeInteger(value: string): boolean {
  if (value.trim() === "") {
    return false;
  }

  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue >= 0;
}

export default function ProductForm({
  mode,
  initialProduct,
  onSave,
  onCancel
}: ProductFormProps) {
  const [draft, setDraft] = useState<Draft>(() => productToDraft(initialProduct));
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageError, setImageError] = useState<string>();
  const [saveError, setSaveError] = useState<string>();

  const productCodePreview = useMemo(() => {
    return buildProductCode(draft.spuCode, draft.skuCode);
  }, [draft.spuCode, draft.skuCode]);

  useEffect(() => {
    setDraft(productToDraft(initialProduct));
  }, [initialProduct]);

  useEffect(() => {
    let isCurrent = true;

    getImageUrl(draft.imageId)
      .then((url) => {
        if (isCurrent) {
          setPreviewUrl(url);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setPreviewUrl(undefined);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [draft.imageId]);

  const isValid = useMemo(() => {
    return (
      draft.name.trim().length > 0 &&
      draft.spu.trim().length > 0 &&
      draft.spuCode.trim().length > 0 &&
      draft.skuCode.trim().length > 0 &&
      isNonNegativeNumber(draft.costPrice) &&
      isNonNegativeNumber(draft.salePrice) &&
      isNonNegativeInteger(draft.stockQty)
    );
  }, [draft]);

  async function handleImageChange(file?: File) {
    if (!file) {
      return;
    }

    setImageError(undefined);
    setIsSavingImage(true);

    try {
      const image = await saveImage(file);
      setDraft((current) => ({ ...current, imageId: image.id }));
    } catch {
      setImageError("图片保存失败，请重新选择。");
    } finally {
      setIsSavingImage(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValid || isSavingImage || isSubmitting) {
      return;
    }

    setSaveError(undefined);

    const codeValidation = validateProductCodeParts(draft.spuCode, draft.skuCode);
    if (!codeValidation.ok) {
      setSaveError(codeValidation.message);
      return;
    }

    if (mode === "edit" && !window.confirm("确认保存商品修改？")) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSave({
        name: draft.name.trim(),
        spu: draft.spu.trim(),
        spuCode: draft.spuCode.trim(),
        skuCode: draft.skuCode.trim(),
        productCode: codeValidation.productCode,
        imageId: draft.imageId,
        costPrice: Number(draft.costPrice),
        salePrice: Number(draft.salePrice),
        stockQty: Number(draft.stockQty),
        isSellable: draft.isSellable,
        isGiftEligible: draft.isGiftEligible,
        status: draft.status
      });
    } catch {
      setSaveError("商品保存失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="productForm" onSubmit={handleSubmit} aria-label={mode === "edit" ? "编辑商品" : "新增商品"}>
      <div className="formMain">
        <label>
          <span>商品名称</span>
          <input
            aria-label="商品名称"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="例如：手作柠檬茶"
          />
        </label>

        <label>
          <span>SPU</span>
          <input
            aria-label="SPU"
            value={draft.spu}
            onChange={(event) => setDraft((current) => ({ ...current, spu: event.target.value }))}
            placeholder="例如：DRINK-LEMON"
          />
        </label>

        <div className="fieldGrid">
          <label>
            <span>SPU 编码</span>
            <input
              aria-label="SPU 编码"
              value={draft.spuCode}
              onChange={(event) => setDraft((current) => ({ ...current, spuCode: event.target.value }))}
              placeholder="例如：CLTH-24001"
            />
          </label>

          <label>
            <span>SKU 编码</span>
            <input
              aria-label="SKU 编码"
              value={draft.skuCode}
              onChange={(event) => setDraft((current) => ({ ...current, skuCode: event.target.value }))}
              placeholder="例如：BLK-M"
            />
          </label>

          <label>
            <span>完整商品编码</span>
            <input aria-label="完整商品编码" value={displayProductCode(productCodePreview)} readOnly />
          </label>
        </div>

        <div className="fieldGrid">
          <label>
            <span>成本价</span>
            <input
              aria-label="成本价"
              inputMode="decimal"
              type="number"
              min="0"
              step="0.01"
              value={draft.costPrice}
              onChange={(event) => setDraft((current) => ({ ...current, costPrice: event.target.value }))}
            />
          </label>

          <label>
            <span>售价</span>
            <input
              aria-label="售价"
              inputMode="decimal"
              type="number"
              min="0"
              step="0.01"
              value={draft.salePrice}
              onChange={(event) => setDraft((current) => ({ ...current, salePrice: event.target.value }))}
            />
          </label>

          <label>
            <span>库存</span>
            <input
              aria-label="库存"
              inputMode="numeric"
              type="number"
              min="0"
              step="1"
              value={draft.stockQty}
              onChange={(event) => setDraft((current) => ({ ...current, stockQty: event.target.value }))}
            />
          </label>
        </div>

        <div className="choiceRow" aria-label="商品开关">
          <label className="checkControl">
            <input
              type="checkbox"
              checked={draft.isSellable}
              onChange={(event) => setDraft((current) => ({ ...current, isSellable: event.target.checked }))}
            />
            <span>可售卖</span>
          </label>
          <label className="checkControl">
            <input
              type="checkbox"
              checked={draft.isGiftEligible}
              onChange={(event) => setDraft((current) => ({ ...current, isGiftEligible: event.target.checked }))}
            />
            <span>可作为赠品</span>
          </label>
          <label className="statusSelect">
            <span>状态</span>
            <select
              aria-label="状态"
              value={draft.status}
              onChange={(event) =>
                setDraft((current) => ({ ...current, status: event.target.value as ProductStatus }))
              }
            >
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </label>
        </div>
      </div>

      <div className="imageField">
        <div className="imagePreview" aria-label="商品图片预览">
          {previewUrl ? <img src={previewUrl} alt="" /> : <ImagePlus size={34} strokeWidth={1.8} aria-hidden="true" />}
        </div>
        <label className="uploadButton">
          <ImagePlus size={18} aria-hidden="true" />
          <span>{isSavingImage ? "保存图片中" : "上传图片"}</span>
          <input
            type="file"
            accept="image/*"
            disabled={isSavingImage}
            onChange={(event) => void handleImageChange(event.target.files?.[0])}
          />
        </label>
        {imageError ? <p className="fieldError">{imageError}</p> : null}
      </div>

      {saveError ? <p className="formError">{saveError}</p> : null}

      <div className="formActions">
        <button type="button" className="secondaryButton" onClick={onCancel} disabled={isSubmitting}>
          取消
        </button>
        <button type="submit" className="primaryButton" disabled={!isValid || isSavingImage || isSubmitting}>
          {isSubmitting ? "保存中..." : "保存商品"}
        </button>
      </div>
    </form>
  );
}
