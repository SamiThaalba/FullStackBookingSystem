const PUBLIC_MARKER = "/storage/v1/object/public/";

/**
 * Parse a Supabase Storage public object URL into bucket + object path (decoded).
 * @returns {{ bucket: string, objectPath: string } | null}
 */
export function parseSupabasePublicObjectUrl(url) {
  if (!url || typeof url !== "string") return null;
  const i = url.indexOf(PUBLIC_MARKER);
  if (i === -1) return null;
  const after = url.slice(i + PUBLIC_MARKER.length);
  const slash = after.indexOf("/");
  if (slash <= 0) return null;
  const bucket = after.slice(0, slash);
  let objectPath = after.slice(slash + 1);
  objectPath = objectPath.split("#")[0];
  objectPath = objectPath.split("?")[0];
  try {
    objectPath = decodeURIComponent(objectPath);
  } catch {
    /* keep raw */
  }
  if (!bucket || !objectPath) return null;
  return { bucket, objectPath };
}

/**
 * Remove one object if the URL points at the given bucket (no-op otherwise).
 */
export async function removeSupabaseObjectByPublicUrl(supabase, publicUrl, expectedBucket) {
  if (!supabase || !publicUrl || !expectedBucket) return;
  const parsed = parseSupabasePublicObjectUrl(publicUrl);
  if (!parsed || parsed.bucket !== expectedBucket) return;
  const { error } = await supabase.storage.from(expectedBucket).remove([parsed.objectPath]);
  if (error) {
    console.warn("[supabaseStorage] remove failed:", error.message);
  }
}

async function uploadToPath(supabase, bucket, objectPath, file) {
  const { error: upErr } = await supabase.storage.from(bucket).upload(objectPath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (upErr) throw new Error(upErr.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) throw new Error("Missing public URL");
  return publicUrl;
}

/** Profile photos: `{userId}/{uuid}.ext` (same layout as before). */
export async function uploadUserProfileImage(supabase, bucket, userId, file, ext) {
  const objectPath = `${userId}/${crypto.randomUUID()}.${ext}`;
  return uploadToPath(supabase, bucket, objectPath, file);
}

/** Hotel cover: `hotels/{hotelId}/{uuid}.ext` inside the same bucket. */
export async function uploadHotelCoverImage(supabase, bucket, hotelId, file, ext) {
  const objectPath = `hotels/${hotelId}/${crypto.randomUUID()}.${ext}`;
  return uploadToPath(supabase, bucket, objectPath, file);
}
