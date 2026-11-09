export const getErrorMessage = (error) => {
  if (!error) return "An unexpected error occurred.";

  if (typeof error === "string") return error;

  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message || error?.response?.data?.error;

  // Server response errors
  if (error.response) {
    if (status === 400) return serverMessage || "Please check the information you entered.";
    if (status === 401) return serverMessage || "Your session has expired. Please sign in again.";
    if (status === 403) return serverMessage || "This service or action is not available.";
    if (status === 404) return serverMessage || "The requested information is no longer available.";
    if (status === 409) return serverMessage || "This action conflicts with the current booking state.";
    if (status >= 500) return serverMessage || "The server could not complete your request.";
    return serverMessage || "Something went wrong.";
  }

  // Axios network error or timeout
  if (error.isAxiosError || error.code === "ECONNABORTED" || error.message === "Network Error") {
    if (error.code === "ECONNABORTED") {
      return "The connection timed out. Please check your internet and try again.";
    }
    return "Cannot connect to the LoadBalbin server. Check your connection and API URL.";
  }

  // Standard JavaScript error or explicit throw new Error(...)
  return error.message || "An unexpected error occurred.";
};
