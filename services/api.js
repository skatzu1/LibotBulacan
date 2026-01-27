import axios from 'axios';

const API_URL = 'http://192.168.100.1:5000/api/users'; // or your computer's IP if testing on a device

export const getUsers = async () => {
  try {
    const res = await axios.get(API_URL);
    return res.data;
  } catch (err) {
    console.error(err);
  }
};

export const createUser = async (user) => {
  try {
    const res = await axios.post(API_URL, user);
    return res.data;
  } catch (err) {
    console.error(err);
  }
};