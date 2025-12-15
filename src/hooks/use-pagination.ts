import { useState, useEffect, useRef, useCallback } from "react";

export const usePagination = <T>(items: T[], itemsPerPage: number) => {
  const [visibleItems, setVisibleItems] = useState<T[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Инициализация видимых элементов
  useEffect(() => {
    const initialVisible = items.slice(0, itemsPerPage);
    setVisibleItems(initialVisible);
    setCurrentPage(1);
    setHasMore(items.length > itemsPerPage);
  }, [JSON.stringify(items), itemsPerPage]);

  // Функция загрузки следующих элементов
  const loadMore = useCallback(() => {
    const nextPage = currentPage + 1;
    const nextIndex = nextPage * itemsPerPage;
    const newVisibleItems = items.slice(0, nextIndex);

    setVisibleItems(newVisibleItems);
    setCurrentPage(nextPage);
    setHasMore(nextIndex < items.length);
  }, [currentPage, items, itemsPerPage]);

  // Настройка Intersection Observer для бесконечного скролла
  const setupObserver = useCallback(() => {
    if (!hasMore || !loadMoreRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.5 }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadMore]);

  useEffect(() => {
    const cleanup = setupObserver();
    return cleanup;
  }, [setupObserver]);

  // Сброс пагинации (например, при изменении фильтров)
  const resetPagination = useCallback(() => {
    const initialVisible = items.slice(0, itemsPerPage);
    setVisibleItems(initialVisible);
    setCurrentPage(1);
    setHasMore(items.length > itemsPerPage);
  }, [items, itemsPerPage]);

  return {
    visibleItems,
    currentPage,
    hasMore,
    loadMoreRef,
    loadMore,
    resetPagination,
    totalItems: items.length,
    totalPages: Math.ceil(items.length / itemsPerPage),
    isInitialLoad: currentPage === 1 && items.length > 0,
  };
};
