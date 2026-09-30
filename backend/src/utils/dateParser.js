export const parseDateRange = (fromStr, toStr) => {
  const result = { from: null, to: null, match: {} };
  
  if (fromStr) {
    const fromDate = new Date(fromStr);
    if (!isNaN(fromDate.getTime())) {
      result.from = fromDate;
      result.match.$gte = fromDate;
    }
  }

  if (toStr) {
    const toDate = new Date(toStr);
    if (!isNaN(toDate.getTime())) {
      // Set to end of day to not accidentally exclude the entire ending day
      toDate.setUTCHours(23, 59, 59, 999);
      result.to = toDate;
      result.match.$lte = toDate;
    }
  }

  if (result.from && result.to && result.from > result.to) {
    throw new Error("'from' date cannot be after 'to' date");
  }

  return result;
};
