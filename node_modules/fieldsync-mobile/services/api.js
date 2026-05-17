import axios from "axios";

const API = axios.create({
  baseURL: "https://fieldsync-backend-clean-t7vn.onrender.com",
  timeout: 10000,
});

console.log("FINAL API URL:", API.defaults.baseURL);

export default API;

// Report API for timesheets and payslips
export const reportAPI = {
  getTimesheets: async () => {
    try {
      const response = await API.get("/api/reports/timesheets");
      return response.data;
    } catch (error) {
      console.error("Error fetching timesheets:", error);
      return [];
    }
  },

  getPayslips: async () => {
    try {
      const response = await API.get("/api/reports/payslips");
      return response.data;
    } catch (error) {
      console.error("Error fetching payslips:", error);
      return [];
    }
  },
};