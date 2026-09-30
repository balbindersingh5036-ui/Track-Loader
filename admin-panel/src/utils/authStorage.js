export const saveToken = async (token) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('token', token);
    }
  } catch (e) {}
};

export const getToken = async () => {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const removeToken = async () => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('token');
    }
  } catch (e) {}
};