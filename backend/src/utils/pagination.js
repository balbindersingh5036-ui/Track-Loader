export const parsePagination = (
  query = {},
  { defaultPage = 1, defaultLimit = 10, maxLimit = 100 } = {}
) => {
  const hasPage = Object.prototype.hasOwnProperty.call(query, "page");
  const hasLimit = Object.prototype.hasOwnProperty.call(query, "limit");
  const pageInput = hasPage ? query.page : defaultPage;
  const limitInput = hasLimit ? query.limit : defaultLimit;

  const page = Number(pageInput);
  const limit = Number(limitInput);

  if (
    (hasPage && (
      pageInput === null ||
      pageInput === undefined ||
      (typeof pageInput === "string" && !pageInput.trim()) ||
      !Number.isFinite(Number(pageInput))
    )) ||
    !Number.isInteger(page) ||
    page < 1 ||
    (hasLimit && (
      limitInput === null ||
      limitInput === undefined ||
      (typeof limitInput === "string" && !limitInput.trim()) ||
      !Number.isFinite(Number(limitInput))
    )) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > maxLimit
  ) {
    throw new Error("page and limit must be valid integers (limit max 100)");
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
};
