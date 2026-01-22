import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebase.config";

type RotateResult = {
  updates: Array<{
    docId: string;
    encryptedDEK: string;
    kekIv: string;
    dekAuthTag: string;
    kekSalt: string;
  }>;
  total: number;
};

function toArrayBufferStrict(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

async function aesGcmEncryptRaw(data: Uint8Array, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    toArrayBufferStrict(data),
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
async function aesGcmDecrypt(
  ciphertextB64: string,
  ivB64: string,
  authTagB64: string,
  key: CryptoKey,
): Promise<Uint8Array> {
  const cipher = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const tag = Uint8Array.from(atob(authTagB64), (c) => c.charCodeAt(0));

  const combined = new Uint8Array(cipher.length + tag.length);
  combined.set(cipher);
  combined.set(tag, cipher.length);

  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    toArrayBufferStrict(combined),
  );

  return new Uint8Array(plain);
}
async function deriveKEK(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBufferStrict(salt),
      iterations: 150_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function rotateKEKForDoiTuongsClient({
  oldSecret,
  newSecret,
  onProgress,
}: {
  oldSecret: string;
  newSecret: string;
  onProgress?: (info: { docId: string; success: boolean; error?: any }) => void;
}): Promise<RotateResult> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Chưa đăng nhập");
  }

  const ownerUid = user.uid;

  const q = query(
    collection(db, "doituongs"),
    where("ownerUid", "==", ownerUid),
  );

  const snap = await getDocs(q);

  const updates: RotateResult["updates"] = [];

  for (const docSnap of snap.docs) {
    try {
      const d = docSnap.data();

      // 1️⃣ derive old KEK
      const oldSalt = Uint8Array.from(atob(d.kekSalt), (c) => c.charCodeAt(0));
      const oldKEK = await deriveKEK(oldSecret, oldSalt);

      // 2️⃣ decrypt DEK
      const dek = await aesGcmDecrypt(
        d.encryptedDEK,
        d.kekIv,
        d.dekAuthTag,
        oldKEK,
      );

      // 3️⃣ derive new KEK
      const newSalt = crypto.getRandomValues(new Uint8Array(16));
      const newKEK = await deriveKEK(newSecret, newSalt);

      // 4️⃣ re-encrypt DEK
      const wrapped = await aesGcmEncryptRaw(dek, newKEK);

      // 5️⃣ push update (KHÔNG ghi DB)
      updates.push({
        docId: docSnap.id,
        encryptedDEK: wrapped.ciphertext,
        kekIv: wrapped.iv,
        dekAuthTag: wrapped.authTag,
        kekSalt: btoa(String.fromCharCode(...newSalt)),
      });

      onProgress?.({ docId: docSnap.id, success: true });
    } catch (e) {
      console.error("Rotate failed:", docSnap.id, e);
      onProgress?.({ docId: docSnap.id, success: false, error: e });
    }
  }

  return {
    updates,
    total: snap.size,
  };
}
