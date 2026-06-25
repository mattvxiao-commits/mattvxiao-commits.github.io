import { ImagePlus } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { saveImage } from "../db/repositories";
import { buildProductCode, displayProductCode, validateProductCodeParts } from "../domain/productCode";
import type { Product, ProductStatus } from "../domain/types";
import { getImageUrl } from "../utils/image";

export type ProductFormValues = {
  name: string;
  series: string;
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

export class ProductFormUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductFormUserError";
  }
}

type ProductFormProps = {
  mode: "create" | "edit";
  initialProduct?: Product;
  onSave: (values: ProductFormValues) => void | Promise<void>;
  onCancel: () => void;
};

type Draft = {
  name: string;
  series: string;
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

type FieldErrors = Partial<Record<keyof Draft, string>>;

const requiredFieldLabels: Partial<Record<keyof Draft, string>> = {
  name: "商品名称",
  spu: "SPU",
  spuCode: "SPU 编码",
  skuCode: "SKU 编码",
  costPrice: "成本价",
  salePrice: "售价",
  stockQty: "库存"
};

function productToDraft(product?: Product): Draft {
  return {
    name: product?.name ?? "",
    series: product?.series ?? "",
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

function validateDraft(draft: Draft): { fieldErrors: FieldErrors; formError?: string } {
  const fieldErrors: FieldErrors = {};
  const invalidFields: Array<keyof Draft> = [];

  function addError(field: keyof Draft, message: string) {
    fieldErrors[field] = message;
    invalidFields.push(field);
  }

  if (draft.name.trim().length === 0) {
    addError("name", "请填写商品名称。");
  }

  if (draft.spu.trim().length === 0) {
    addError("spu", "请填写 SPU。");
  }

  if (draft.spuCode.trim().length === 0) {
    addError("spuCode", "请填写 SPU 编码。");
  }

  if (draft.skuCode.trim().length === 0) {
    addError("skuCode", "请填写 SKU 编码。");
  }

  if (!isNonNegativeNumber(draft.costPrice)) {
    addError("costPrice", "请填写有效的成本价。");
  }

  if (!isNonNegativeNumber(draft.salePrice)) {
    addError("salePrice", "请填写有效的售价。");
  }

  if (!isNonNegativeInteger(draft.stockQty)) {
    addError("stockQty", "请填写有效的库存。");
  }

  if (invalidFields.length === 0) {
    return { fieldErrors };
  }

  return {
    fieldErrors,
    formError: `请补全必填信息：${invalidFields.map((field) => requiredFieldLabels[field]).join("、")}。`
  };
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

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

    if (isSavingImage || isSubmitting) {
      return;
    }

    const validation = validateDraft(draft);
    setFieldErrors(validation.fieldErrors);

    if (validation.formError) {
      setSaveError(validation.formError);
      return;
    }

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
        series: draft.series.trim(),
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
    } catch (error) {
      setSaveError(error instanceof ProductFormUserError ? error.message : "商品保存失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateDraft<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
    setSaveError(undefined);
  }

  return (
    <form className="productForm" onSubmit={handleSubmit} aria-label={mode === "edit" ? "编辑商品" : "新增商品"}>
      <div className="formMain">
        <div className="fieldGrid">
          <label>
            <span>商品名称</span>
            <input
              aria-label="商品名称"
              value={draft.name}
              aria-invalid={fieldErrors.name ? "true" : undefined}
              onChange={(event) => updateDraft("name", event.target.value)}
              placeholder="例如：角色徽章"
            />
            {fieldErrors.name ? <p className="fieldError">{fieldErrors.name}</p> : null}
          </label>

          <label>
            <span>系列（筛选）</span>
            <input
              aria-label="系列（筛选）"
              value={draft.series}
              onChange={(event) => updateDraft("series", event.target.value)}
              placeholder="例如：作品A"
            />
          </label>

          <label>
            <span>SPU</span>
            <input
              aria-label="SPU"
              value={draft.spu}
              aria-invalid={fieldErrors.spu ? "true" : undefined}
              onChange={(event) => updateDraft("spu", event.target.value)}
              placeholder="例如：徽章"
            />
            {fieldErrors.spu ? <p className="fieldError">{fieldErrors.spu}</p> : null}
          </label>
        </div>

        <div className="fieldGrid">
          <label>
            <span>SPU 编码</span>
            <input
              aria-label="SPU 编码"
              value={draft.spuCode}
              aria-invalid={fieldErrors.spuCode ? "true" : undefined}
              onChange={(event) => updateDraft("spuCode", event.target.value)}
              placeholder="例如：CLTH-24001"
            />
            {fieldErrors.spuCode ? <p className="fieldError">{fieldErrors.spuCode}</p> : null}
          </label>

          <label>
            <span>SKU 编码</span>
            <input
              aria-label="SKU 编码"
              value={draft.skuCode}
              aria-invalid={fieldErrors.skuCode ? "true" : undefined}
              onChange={(event) => updateDraft("skuCode", event.target.value)}
              placeholder="例如：BLK-M"
            />
            {fieldErrors.skuCode ? <p className="fieldError">{fieldErrors.skuCode}</p> : null}
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
              aria-invalid={fieldErrors.costPrice ? "true" : undefined}
              onChange={(event) => updateDraft("costPrice", event.target.value)}
            />
            {fieldErrors.costPrice ? <p className="fieldError">{fieldErrors.costPrice}</p> : null}
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
              aria-invalid={fieldErrors.salePrice ? "true" : undefined}
              onChange={(event) => updateDraft("salePrice", event.target.value)}
            />
            {fieldErrors.salePrice ? <p className="fieldError">{fieldErrors.salePrice}</p> : null}
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
              aria-invalid={fieldErrors.stockQty ? "true" : undefined}
              onChange={(event) => updateDraft("stockQty", event.target.value)}
            />
            {fieldErrors.stockQty ? <p className="fieldError">{fieldErrors.stockQty}</p> : null}
          </label>
        </div>

        <div className="choiceRow" aria-label="商品开关">
          <label className="checkControl">
            <input
              type="checkbox"
              checked={draft.isSellable}
              onChange={(event) => updateDraft("isSellable", event.target.checked)}
            />
            <span>可售卖</span>
          </label>
          <label className="checkControl">
            <input
              type="checkbox"
              checked={draft.isGiftEligible}
              onChange={(event) => updateDraft("isGiftEligible", event.target.checked)}
            />
            <span>可作为赠品</span>
          </label>
          <label className="statusSelect">
            <span>状态</span>
            <select
              aria-label="状态"
              value={draft.status}
              onChange={(event) => updateDraft("status", event.target.value as ProductStatus)}
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
        <button type="submit" className="primaryButton" disabled={isSavingImage || isSubmitting}>
          {isSubmitting ? "保存中..." : "保存商品"}
        </button>
      </div>
    </form>
  );
}
