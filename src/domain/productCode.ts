export type ProductCodeValidationResult =
  | { ok: true; productCode: string }
  | { ok: false; message: string };

export function normalizeCodePart(value: string): string {
  return value.trim();
}

export function buildProductCode(spuCode: string, skuCode: string): string {
  const normalizedSpu = normalizeCodePart(spuCode);
  const normalizedSku = normalizeCodePart(skuCode);

  if (!normalizedSku) {
    return normalizedSpu;
  }

  return `${normalizedSpu}-${normalizedSku}`;
}

export function validateProductCodeParts(spuCode: string, skuCode: string): ProductCodeValidationResult {
  const normalizedSpu = normalizeCodePart(spuCode);
  const normalizedSku = normalizeCodePart(skuCode);

  if (!normalizedSpu || !normalizedSku) {
    return { ok: false, message: "SPU 编码和 SKU 编码均为必填。" };
  }

  if (normalizedSku.toLocaleUpperCase().startsWith(normalizedSpu.toLocaleUpperCase())) {
    const suggestedSku = normalizedSku.slice(normalizedSpu.length).replace(/^-/, "") || "BLK-M";

    return {
      ok: false,
      message: `SPU 编码与 SKU 编码存在重复内容。SKU 编码只需填写规格/变体部分，例如：${suggestedSku}。完整商品编码将由系统自动生成：${buildProductCode(normalizedSpu, suggestedSku)}。`
    };
  }

  return { ok: true, productCode: buildProductCode(normalizedSpu, normalizedSku) };
}

export function displayProductCode(productCode?: string): string {
  return productCode && productCode.trim().length > 0 ? productCode : "未设置编码";
}
