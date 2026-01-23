import { signOut } from "firebase/auth";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { handleToastError, handleToastSuccess } from "../constants/handleToast";
import { createSampleDocClient } from "../crypto/createSampleDocClient";
import { rotateKEKForDoiTuongsClient } from "../crypto/rotateKEKForDoiTuongsClient";
import { auth } from "../firebase.config";

function HomePage() {
  const navigate = useNavigate();
  const [secret, setSecret] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [plaintext, setPlaintext] = useState("");
  const [encryptedDoc, setEncryptedDoc] = useState<any>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [rotateStatus, setRotateStatus] = useState<{
    total: number;
    success: number;
    failed: number;
    running: boolean;
    lastRun?: number;
  }>({
    total: 0,
    success: 0,
    failed: 0,
    running: false,
  });
  const [oldSecret, setOldSecret] = useState("");
  const [newSecret, setNewSecret] = useState("");

  const handleCreate = async () => {
    setError("");
    setEncryptedDoc(null);

    if (!secret || !name || !address || !plaintext) {
      setError("❌ Vui lòng nhập đầy đủ các trường");
      return;
    }

    try {
      const encryptedDoc = await createSampleDocClient({
        secret,
        name,
        address,
        plaintext,
      });

      setEncryptedDoc(encryptedDoc);
    } catch (e: any) {
      console.error(e);
      setError("❌ Lỗi khi mã hoá dữ liệu");
    }
  };

  const uploadEncryptedDoc = async (encryptedDoc: any) => {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("Chưa đăng nhập");
    }

    // 🔑 LẤY FIREBASE ID TOKEN
    const idToken = await user.getIdToken();

    const res = await fetch(
      "https://uploadencrypteddoituong-25yevkpmeq-as.a.run.app",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`, // 🔐 BẮT BUỘC
        },
        body: JSON.stringify(encryptedDoc),
      },
    );

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || "Upload failed");
    }

    return res.json(); // { ok: true, id }
  };

  async function callRotateKEKWriteBatch(params: {
    updates: Array<{
      docId: string;
      encryptedDEK: string;
      kekIv: string;
      dekAuthTag: string;
      kekSalt: string;
    }>;
  }) {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("Chưa đăng nhập");
    }

    // 🔑 Firebase ID Token
    const idToken = await user.getIdToken();

    const res = await fetch(
      "https://rotatekekwritebatch-25yevkpmeq-as.a.run.app",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`, // 🔐 BẮT BUỘC
        },
        body: JSON.stringify({
          updates: params.updates, // ❗ KHÔNG gửi ownerUid
        }),
      },
    );

    if (!res.ok) {
      throw new Error(await res.text());
    }

    return res.json() as Promise<{
      ok: boolean;
      total: number;
      updated: number;
      failed: Array<{ docId: string; reason: string }>;
    }>;
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      handleToastSuccess("👋 Đã đăng xuất");
      // redirect nếu bạn dùng router
      navigate("/login");
    } catch (e) {
      console.error(e);
      handleToastError("❌ Logout thất bại");
    }
  };

  return (
    <>
      <div className="app-header">
        <span className="app-user">👤 {auth.currentUser?.email}</span>
        <button className="logout-btn" onClick={handleLogout}>
          🚪 Logout
        </button>
      </div>
      <div className="App app-split">
        {/* LEFT PANEL */}
        <div className="panel left">
          <h2>🔐 Create Encrypto Doc</h2>

          <label>Secret (KEK)</label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="••••••••"
          />

          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nguyễn Văn An"
          />

          <label>Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Hà Nội"
          />

          <label>Plaintext</label>
          <textarea
            rows={6}
            value={plaintext}
            onChange={(e) => setPlaintext(e.target.value)}
            placeholder="Nội dung nhật ký (plaintext)"
          />

          <button onClick={handleCreate}>🔐 Create (Encrypt Offline)</button>

          {error && <p className="error">{error}</p>}
        </div>

        {/* RIGHT PANEL */}
        <div className="panel right">
          <h2>📦 Encrypted Output</h2>

          {!encryptedDoc && (
            <p style={{ opacity: 0.6 }}>Chưa có dữ liệu mã hoá</p>
          )}

          {encryptedDoc && (
            <>
              <div className="json-viewer">
                {Object.entries(encryptedDoc).map(([key, value]) => (
                  <div className="json-row" key={key}>
                    <span className="json-key">"{key}"</span>
                    <span className="json-sep">:</span>
                    <span className="json-value">
                      {typeof value === "string"
                        ? `"${value}"`
                        : JSON.stringify(value)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="actions">
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(
                      JSON.stringify(encryptedDoc, null, 2),
                    )
                  }
                >
                  📋 Copy JSON
                </button>

                <button
                  className="primary"
                  onClick={async () => {
                    if (!encryptedDoc) {
                      alert("❌ Chưa có dữ liệu mã hoá");
                      return;
                    }

                    try {
                      setUploadStatus("⏳ Đang upload...");

                      const result = await uploadEncryptedDoc(encryptedDoc);

                      setUploadStatus(
                        `✅ Upload thành công (docId: ${result.id})`,
                      );
                    } catch (e: any) {
                      console.error(e);
                      setUploadStatus("❌ Upload thất bại");
                    }
                  }}
                >
                  ☁️ Upload Firebase
                </button>
              </div>
              {uploadStatus && (
                <p
                  className="upload-status"
                  style={{
                    marginTop: 8,
                    color: uploadStatus.startsWith("❌")
                      ? "red"
                      : uploadStatus.startsWith("✅")
                        ? "green"
                        : "#666",
                  }}
                >
                  {uploadStatus}
                </p>
              )}
            </>
          )}
        </div>

        {/* =========================
    🔁 ROTATE SECRET (KEK)
========================= */}
        <div className="form-block">
          <h3 className="block-title">🔁 Rotate Secret (KEK)</h3>

          <label>Old Secret</label>
          <input
            type="password"
            placeholder="Secret cũ"
            value={oldSecret}
            onChange={(e) => setOldSecret(e.target.value)}
            disabled={rotateStatus.running}
          />

          <label>New Secret</label>
          <input
            type="password"
            placeholder="Secret mới"
            value={newSecret}
            onChange={(e) => setNewSecret(e.target.value)}
            disabled={rotateStatus.running}
          />

          <button
            className="warning"
            disabled={rotateStatus.running}
            onClick={async () => {
              // =========================
              // 0️⃣ Validate input
              // =========================
              if ( !oldSecret || !newSecret) {
                alert("❌ Thiếu UID / secret");
                return;
              }

              if (oldSecret === newSecret) {
                alert("❌ Secret mới phải khác secret cũ");
                return;
              }

              const ok = window.confirm(
                "⚠️ Bạn chắc chắn muốn rotate secret?\n" +
                  "Thao tác này không thể hoàn tác.",
              );
              if (!ok) return;

              // =========================
              // 1️⃣ Reset & lock UI
              // =========================
              setRotateStatus({
                total: 0,
                success: 0,
                failed: 0,
                running: true,
              });

              try {
                // =========================
                // 2️⃣ Client rotate crypto
                // =========================
                const { updates } = await rotateKEKForDoiTuongsClient({
                  oldSecret,
                  newSecret,
                  onProgress: ({ success }) => {
                    setRotateStatus((prev) => ({
                      ...prev,
                      total: prev.total + 1,
                      success: prev.success + (success ? 1 : 0),
                      failed: prev.failed + (success ? 0 : 1),
                    }));
                  },
                });

                if (updates.length === 0) {
                  alert("ℹ️ Không có document nào để rotate");
                  setRotateStatus((prev) => ({
                    ...prev,
                    running: false,
                    lastRun: Date.now(),
                  }));
                  return;
                }

                // =========================
                // 3️⃣ Gửi batch lên CF
                // =========================
                const result = await callRotateKEKWriteBatch({
                  updates,
                });

                // =========================
                // 4️⃣ Update UI
                // =========================
                setRotateStatus((prev) => ({
                  ...prev,
                  running: false,
                  lastRun: Date.now(),
                }));

                if (result.failed.length > 0) {
                  alert(
                    `⚠️ Rotate xong nhưng có lỗi\n` +
                      `✔ Thành công: ${result.updated}\n` +
                      `❌ Thất bại: ${result.failed.length}`,
                  );
                } else {
                  alert(`✅ Rotate thành công ${result.updated} documents`);
                }

                // =========================
                // 5️⃣ Clear secrets khỏi memory
                // =========================
                setOldSecret("");
                setNewSecret("");
              } catch (e) {
                console.error("❌ ROTATE ERROR", e);
                setRotateStatus((prev) => ({
                  ...prev,
                  running: false,
                }));
                alert("❌ Rotate thất bại – xem console");
              }
            }}
          >
            {rotateStatus.running
              ? "⏳ Đang rotate..."
              : "🔁 Xác nhận đổi Secret"}
          </button>
        </div>

        {/* =========================
    📊 ROTATE STATUS
========================= */}
        <div className="form-block rotate-status">
          <h3 className="block-title">📊 Rotate Status</h3>

          {!rotateStatus.lastRun && !rotateStatus.running && (
            <p className="status muted">Chưa thực hiện</p>
          )}

          {(rotateStatus.running || rotateStatus.lastRun) && (
            <ul className="status-list">
              <li>Documents: {rotateStatus.total}</li>
              <li>Success: {rotateStatus.success}</li>
              <li>Failed: {rotateStatus.failed}</li>
              <li>
                Last run:{" "}
                {rotateStatus.lastRun
                  ? new Date(rotateStatus.lastRun).toLocaleString()
                  : "—"}
              </li>
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

export default HomePage;
