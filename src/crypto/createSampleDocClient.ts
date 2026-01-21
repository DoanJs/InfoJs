
// --------------------------------HELPER------------------------------

const normalizeVN = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD") // tách dấu
    .replace(/[\u0300-\u036f]/g, "") // bỏ dấu
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, "") // bỏ ký tự lạ
    .replace(/\s+/g, " ") // gộp space
    .trim();
};
const buildSlugAndTokens = (input: string) => {
  const normalized = normalizeVN(input);

  const parts = normalized.split(" ");

  return {
    slugName: parts.join("_"), // nguyen_van_an
    tokens: parts, // ["nguyen", "van", "an"]
  };
};
async function importDEK(dek: Uint8Array) {
  return crypto.subtle.importKey(
    "raw",
    dek.buffer as ArrayBuffer, // ⭐ nên ép luôn cho nhất quán
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
}
async function aesGcmEncrypt(
  data: Uint8Array,
  key: CryptoKey
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data.buffer as ArrayBuffer // ⭐ FIX Ở ĐÂY
  );

  const buf = new Uint8Array(encrypted);
  const ciphertext = buf.slice(0, buf.length - 16);
  const authTag = buf.slice(buf.length - 16);

  return {
    ciphertext: btoa(String.fromCharCode(...ciphertext)),
    iv: btoa(String.fromCharCode(...iv)),
    authTag: btoa(String.fromCharCode(...authTag)),
  };
}
async function deriveKEK(secret: string, salt: Uint8Array) {
  const enc = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer, // ⭐ FIX
      iterations: 150_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
}

// ------------------------------------

export async function createSampleDocClient({
  uid,
  secret,
  name,
  address,
  plaintext,
}: {
  uid: string;
  secret: string;
  name: string;
  address: string;
  plaintext: string;
}) {
  // =========================
  // 1️⃣ Sinh DEK (32 bytes)
  // =========================
  const dek = crypto.getRandomValues(new Uint8Array(32));

  // =========================
  // 2️⃣ Encrypt plaintext bằng DEK
  // =========================
  const dekKey = await importDEK(dek);
  const plainBytes = new TextEncoder().encode(plaintext);

  const cipher = await aesGcmEncrypt(plainBytes, dekKey);

  // =========================
  // 3️⃣ Derive KEK từ secret
  // =========================
  const kekSalt = crypto.getRandomValues(new Uint8Array(16));
  const kekKey = await deriveKEK(secret, kekSalt);

  // =========================
  // 4️⃣ Encrypt DEK bằng KEK
  // =========================
  const dekWrap = await aesGcmEncrypt(dek, kekKey);

  // =========================
  // 5️⃣ Metadata (giữ y như CF)
  // =========================
  const dataName = buildSlugAndTokens(name);

  // =========================
  // 6️⃣ Object gửi lên Firestore
  // =========================
  return {
    // 🔐 crypto data
    ciphertext: cipher.ciphertext,
    cipherIv: cipher.iv,
    cipherAuthTag: cipher.authTag,

    encryptedDEK: dekWrap.ciphertext,
    kekIv: dekWrap.iv,
    dekAuthTag: dekWrap.authTag,
    kekSalt: btoa(String.fromCharCode(...kekSalt)),

    version: 2,
    createdAt: Date.now(),

    // 🔎 search / display
    slugName: dataName.slugName,
    tokens: dataName.tokens,
    name,
    address,

    // 🔐 permission
    ownerUid: uid,
    sharedWith: [],
    public: false,
  };
}






