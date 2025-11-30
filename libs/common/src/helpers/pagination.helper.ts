export type PaginationResult<T> = {
  count: number;
  current_page: number;
  total_pages: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type BuildPaginationParams<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  path: string;
  queryString?: string;
  extraParams?: Record<string, string | number | boolean | null | undefined>;
};

export function buildPagination<T>({
  data,
  total,
  page,
  limit,
  path,
  queryString,
  extraParams = {},
}: BuildPaginationParams<T>): PaginationResult<T> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit =
    Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : data.length || 1;

  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  const buildLink = (targetPage: number) => {
    const search = new URLSearchParams();
    search.set('page', String(targetPage));
    search.set('limit', String(safeLimit));
    if (queryString) {
      search.append('query', queryString);
    }
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      search.set(key, String(value));
    });
    const qs = search.toString();
    return `${path}${qs ? `?${qs}` : ''}`;
  };

  const next = safePage < totalPages ? buildLink(safePage + 1) : null;
  const previous = safePage > 1 ? buildLink(safePage - 1) : null;

  return {
    count: total,
    current_page: safePage,
    total_pages: totalPages,
    next,
    previous,
    results: data,
  };
}
