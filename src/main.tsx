import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installTouchGuards } from "./utils/touch-guards";

// До первого рендера: iPhone Safari не должен зумить/перезагружать игру своими
// жестами (щипок, двойной тап, pull-to-refresh) — подробности в utils/touch-guards.ts
installTouchGuards(document);

/**
 * Service worker: приложение (в т.ч. установленная PWA) открывается без сети.
 *
 * Только в сборке: в `vite dev` модули отдаются по своим путям и правятся на лету —
 * воркер кэшировал бы их и «съедал» изменения. Регистрируем после загрузки, чтобы
 * установка кэша не конкурировала с первым рендером игры.
 */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("[sw] не удалось зарегистрировать service worker", error);
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
