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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ThemeProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </ThemeProvider>
  </ErrorBoundary>
);
