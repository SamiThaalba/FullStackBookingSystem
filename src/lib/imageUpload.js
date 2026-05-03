export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function safeImageExtension(file) {
  const raw = (file?.name?.split(".")?.pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  return raw || "jpg";
}

/** @returns {string|null} error message key for i18n or short English fallback */
export function validateImageFile(file, t) {
  if (!file) return null;
  if (!IMAGE_ALLOWED_TYPES.has(file.type)) {
    return t ? t("profile.errorImageType") : "Invalid image type.";
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return t ? t("profile.errorImageSize") : "Image too large.";
  }
  return null;
}
