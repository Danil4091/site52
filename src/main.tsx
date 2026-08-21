import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { ThemeProvider } from "./product/theme";
import { AppProvider } from "./product/store";

/** Ловушка: вместо пустого зелёного экрана — понятная страница с текстом ошибки. */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b1f19", color: "#e4dfcd", fontFamily: "JetBrains Mono, monospace", padding: 24 }}>
          <div style={{ maxWidth: 640 }}>
            <h1 style={{ fontSize: 22, marginBottom: 12 }}>Страница упала с ошибкой</h1>
            <pre style={{ whiteSpace: "pre-wrap", background: "#122b22", padding: 16, borderRadius: 12, fontSize: 12, lineHeight: 1.6 }}>
              {String(this.state.error)}
            </pre>
            <p style={{ marginTop: 12, fontSize: 13, opacity: 0.7 }}>Обновите страницу (Ctrl+R). Если ошибка повторяется — пришлите этот текст разработчику.</p>
            <button onClick={() => location.reload()} style={{ marginTop: 12, padding: "10px 18px", borderRadius: 10, border: 0, background: "#f2c14e", color: "#0b1f19", fontWeight: 700, cursor: "pointer" }}>
              Обновить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Глобальные ловушки: ошибки уровня модулей и асинхронные ошибки
      (их НЕ перехватывает React ErrorBoundary). Вместо пустого экрана
      показываем диагностику, чтобы причину можно было увидеть и прислать. ── */
function showFatal(message: string) {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b1f19;color:#e4dfcd;font-family:'JetBrains Mono',monospace;padding:24px">
      <div style="max-width:640px">
        <h1 style="font-size:22px;margin-bottom:12px">Не удалось запустить приложение</h1>
        <pre style="white-space:pre-wrap;background:#122b22;padding:16px;border-radius:12px;font-size:12px;line-height:1.6">${message}</pre>
        <p style="margin-top:12px;font-size:13px;opacity:.7">Попробуйте жёсткое обновление: Ctrl+Shift+R. Если не помогает — пришлите этот текст разработчику.</p>
        <button onclick="location.reload(true)" style="margin-top:12px;padding:10px 18px;border-radius:10px;border:0;background:#f2c14e;color:#0b1f19;font-weight:700;cursor:pointer">Обновить</button>
      </div>
    </div>`;
}
window.addEventListener("error", (e) => {
  if (e.error instanceof Error) showFatal(`${e.error.name}: ${e.error.message}\n${e.error.stack ?? ""}`);
});
window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason;
  showFatal(r instanceof Error ? `${r.name}: ${r.message}` : String(r));
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ThemeProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </ThemeProvider>
  </ErrorBoundary>
);
