import API from './api';

export const login = async (email, password) => {
  try {
    const res = await API.post('/auth/login', {
      email,
      password
    });

    // ✅ STORE BACKEND TOKEN (THIS FIXES EVERYTHING)
    localStorage.setItem('token', res.data.token);

    return res.data;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    throw error;
  }
};

export const logout = () => {
  localStorage.removeItem('token');
};

export const getToken = () => {
  return localStorage.getItem('token');

};

