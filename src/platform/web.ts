import { deviceStorage } from "./device-storage";
import type { Platform } from "./types";

/**
 * Платформа обычного браузера (а также установленной PWA).
 *
 * Никаких «заглушек с секретом»: если чего-то нет — честно нет. Вибрации в вебе нет,
 * системной кнопки «назад» нет (её роль в вебе играет кнопка браузера), личность
 * пустая — веб-игрок получает анонимную сессию Supabase (см. `backend/auth.ts`).
 */
export const createWebPlatform = (): Platform => ({
  name: "web",

  init() {
    // Приветственных вызовов у браузера нет: fullscreen/тему приложение задаёт
    // своими средствами (meta-теги в index.html, .webmanifest для PWA).
  },

  haptic() {
    // В вебе тактильного отклика нет. Оставлено осознанно: вызывающий код не
    // должен обвешивать каждый вызов проверками платформы.
  },

  identity() {
    return { tgId: null, username: null, initData: null };
  },

  storage: deviceStorage,

  theme() {
    return {
      // Тема игры тёмная, но веб-игрок мог системно выбрать светлую — уважаем это.
      colorScheme: window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light",
      bgColor: null,
    };
  },

  viewport() {
    return {
      height: window.innerHeight,
      stableHeight: window.innerHeight,
      isExpanded: true,
    };
  },

  openLink(url: string) {
    window.open(url, "_blank", "noopener");
  },

  confirm(message: string) {
    return Promise.resolve(window.confirm(message));
  },

  alert(message: string) {
    window.alert(message);
    return Promise.resolve();
  },

  backButton() {
    // В вебе системной кнопки «назад» у приложения нет.
    return () => {};
  },
});
