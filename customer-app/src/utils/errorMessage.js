export const getErrorMessage = (error) => {
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message;

  if (!error?.response) {
    return "Cannot connect to the LoadBalbin server. Check your connection and API URL.";
  }
  if (status === 400) return serverMessage || "Please check the information you entered.";
  if (status === 401) return serverMessage || "Your session has expired. Please sign in again.";
  if (status === 403) return serverMessage || "This service or action is not available.";
  if (status === 404) return serverMessage || "The requested information is no longer available.";
  if (status === 409) return serverMessage || "This action conflicts with the current booking state.";
  if (status >= 500) return serverMessage || "The server could not complete your request.";
  return serverMessage || error.message || "Something went wrong.";
};
