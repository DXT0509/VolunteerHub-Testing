import { useEffect, useRef, useState } from "react";
import "./App.css";
function App() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.2 } // 20% của phần tử thấy được thì kích hoạt
    );

    observer.observe(el);

    return () => {
      // bỏ quan sát phần tử cụ thể (an toàn hơn than disconnect)
      observer.unobserve(el);
      // observer.disconnect(); // có thể dùng nếu muốn hủy toàn bộ observer
    };
  }, []); // chạy 1 lần

  return (
    <>
    <h1>Welcome to VolunteerHub!</h1>
      <div
        ref={ref}
        className={`dashboard-section ${visible ? "show" : ""}`}
      >
        <h2>Dashboard</h2>
        <p>Dữ liệu hiển thị khi scroll tới đây.</p>
      </div>
    </>
  );
}

function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.body.classList.add("bg-pink");
    return () => document.body.classList.remove("bg-pink");
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const email = e.target.email.value.trim();
    const password = e.target.password.value.trim();
    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Đăng nhập thất bại");
      }
      // Lưu token & user
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      // Điều hướng về trang chủ
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra");
      const noti = document.getElementById("noti");
      if (noti) noti.textContent = err.message || "Có lỗi xảy ra";
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="container d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
        <div className="card p-4 shadow-sm mt-5 bg-grey" style={{ width: "350px", height: "430px" }}>
          <h1 className="text-center mb-0">Đăng nhập</h1>
          <hr></hr>
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input
                type="email"
                name="email"
                className="form-control"
                placeholder="Nhập email"
                style = {{ height: "45px" }}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Mật khẩu</label>
              <input
                type="password"
                name="password"
                className="form-control"
                placeholder="Nhập mật khẩu"
                style = {{ height: "45px" }}
                required
              />
            </div>

            <div className="form-check mb-3">
              <input
                className="form-check-input"
                type="checkbox"
                id="saveAccount"
              />
              <label className="form-check-label" htmlFor="saveAccount">
                Lưu mật khẩu
              </label>
            </div>

            <button type="submit" className="btn btn-pink w-100" style = {{ height: "45px" }} disabled={loading}>
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>

          <pre id="noti" className="text-danger text-center mt-3">{error}</pre>
        </div>
      </div>
    </>
  );
}

export { App, Login };
