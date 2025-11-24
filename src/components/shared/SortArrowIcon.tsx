export const SortArrowIcon = ({
  direction,
}: {
  direction: "asc" | "desc" | null;
}) => (
  <svg
    className={`w-3 h-3 transition-transform ${
      direction === "desc" ? "rotate-180" : ""
    }`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 16 16"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6l4 4 4-4"
    />
  </svg>
);
