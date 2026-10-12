/**
 * СТРАЖИ ТАЧ-ЖЕСТОВ: на iPhone браузер не должен «забирать» жесты у игры.
 *
 * Safari сам обрабатывает часть жестов поверх страницы, и игра от этого «сворачивается»
 * вместо действий с жабами:
 *  - щипок двумя пальцами зумит не карту, а страницу — вместо приближения колонии
 *    выезжает браузерная «шторка» (панель с URL-баром);
 *  - двойной тап приближает страницу вместо гекса (второй тап уходит в зум);
 *  - свайп вниз у верхнего края превращается в pull-to-refresh — приложение
 *    перезагружается, и кажется, что игра закрылась;
 *  - долгое нажатие (удержание жабы ≈0.26 с) поднимает системное меню выделения
 *    «Скопировать / Поделиться» вместо того, чтобы взять жабу в руку.
 *
 * Поэтому на уровне документа гасим только браузерные жесты: жесты карты
 * (`HexMap/HexMapCanvas.tsx`) приходят событиями указателя, а у канваса стоит
 * `touch-action: none`, так что `preventDefault` им не мешает. Однопальцевые движения
 * не трогаем — внутренние списки модалок должны скроллиться как обычно.
 *
 * Логика вынесена чистой функцией с документом-аргументом: правила проверяются
 * без браузера (см. tmp-verify-touch.mjs).
 */

/** Минимальный контракт документа: хватает add/removeEventListener (удобно тестировать в node) */
export type TouchGuardTarget = Pick<
  Document,
  "addEventListener" | "removeEventListener"
>;

/**
 * Собственные жесты Safari — в стандарте их нет, поэтому это обычные события:
 * щипок страницы приходит как gesturestart → gesturechange → gestureend.
 */
export const SAFARI_PAGE_GESTURES = [
  "gesturestart",
  "gesturechange",
  "gestureend",
] as const;

/**
 * Повесить стражи на документ. Возвращает функцию снятия: её вызывает тот, кто
 * поставил стражи (в игре — `main.tsx`, на всё время жизни приложения).
 */
export const installTouchGuards = (doc: TouchGuardTarget): (() => void) => {
  const stop = (event: Event) => {
    event.preventDefault();
  };

  /**
   * Щипок страницы в остальных браузерах (без gesture*): гасим только мультитач,
   * поэтому скролл списков одним пальцем продолжает работать.
   */
  const multiTouch = (event: Event) => {
    const touches = (event as TouchEvent).touches?.length ?? 0;

    if (touches > 1) {
      event.preventDefault();
    }
  };

  const guards: Array<[string, EventListener]> = [
    ...SAFARI_PAGE_GESTURES.map(
      (type) => [type, stop] as [string, EventListener]
    ),
    ["touchmove", multiTouch],
    // Двойной тап Safari превращает в зум страницы — карта ждёт его для приближения
    ["dblclick", stop],
  ];

  guards.forEach(([type, handler]) =>
    doc.addEventListener(type, handler, { passive: false })
  );

  return () =>
    guards.forEach(([type, handler]) => doc.removeEventListener(type, handler));
};
