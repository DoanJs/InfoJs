import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { handleToastError, handleToastSuccess } from "../constants/handleToast";
import { validateEmail } from "../constants/validateEmailPhone";
import "../css/LoginPage.css";
import { auth } from "../firebase.config";


export default function LoginPage() {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDisabled =
    !form.email ||
    !validateEmail(form.email) ||
    !form.password ||
    loading;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLogin = async () => {
    if (isDisabled) return;

    setError(null);
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        form.email,
        form.password,
      );

      handleToastSuccess(
        `Xin chào ${userCredential.user.displayName || form.email
        } đã đăng nhập thành công!`,
      );

      // 👉 redirect / set auth state tại đây
    } catch (err) {
      console.error(err);
      setError("❌ Đăng nhập thất bại, tài khoản hoặc mật khẩu không đúng");
      handleToastError("Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="App app-split">
      {/* LEFT PANEL */}
      <div className="panel left">
        <h2>🔐 Secure Login</h2>

        <label>Email</label>
        <input
          type="text"
          name="email"
          placeholder="user@example.com"
          value={form.email}
          onChange={handleChange}
          disabled={loading}
        />

        <label>Password</label>
        <input
          name="password"
          type="password"
          placeholder="••••••••"
          value={form.password}
          onChange={handleChange}
          disabled={loading}
        />

        <button
          className="primary"
          onClick={handleLogin}
          disabled={isDisabled}
        >
          {loading ? "⏳ Đang đăng nhập..." : "🔓 Login"}
        </button>


        {error && <p className="error">{error}</p>}
      </div>

      {/* RIGHT PANEL */}
      <div className="panel right">
        <h2>🛡️ Client-side Encryption</h2>

        <p style={{ opacity: 0.7, lineHeight: 1.6 }}>
          Ứng dụng mã hoá dữ liệu phía client.
          <br />
          <br />
          🔐 Secret không bao giờ gửi lên server<br />
          ☁️ Firebase chỉ lưu ciphertext<br />
          🔁 Hỗ trợ rotate secret an toàn
        </p>

        <div className="json-viewer" style={{ marginTop: 16 }}>
          <div className="json-row">
            <span className="json-key">"security"</span>
            <span className="json-sep">:</span>
            <span className="json-value">"E2EE"</span>
          </div>
          <div className="json-row">
            <span className="json-key">"trust_model"</span>
            <span className="json-sep">:</span>
            <span className="json-value">"zero_trust"</span>
          </div>
        </div>
      </div>
    </div>
  );
}
