import axios from "axios";

const API = axios.create({
  baseURL: "https://fieldsync-backend-clean-t7vn.onrender.com",
});

export default API;