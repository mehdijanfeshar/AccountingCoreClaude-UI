interface PaginationProps {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (pageNumber: number) => void;
}

export function Pagination({ pageNumber, pageSize, totalCount, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <nav className="pagination" aria-label="صفحه‌بندی">
      <button type="button" disabled={pageNumber <= 1} onClick={() => onPageChange(pageNumber - 1)}>
        قبلی
      </button>
      <span>
        صفحه {pageNumber} از {totalPages} ({totalCount} مورد)
      </span>
      <button
        type="button"
        disabled={pageNumber >= totalPages}
        onClick={() => onPageChange(pageNumber + 1)}
      >
        بعدی
      </button>
    </nav>
  );
}
