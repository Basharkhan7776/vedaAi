import axios from "axios";

/** Browser axios client — talks to Next.js route handlers (Gemini stays server-side). */
export const api = axios.create({
  baseURL: "",
  timeout: 120_000,
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error?.response?.data?.error ||
      error?.response?.data?.failure?.summary ||
      error?.message ||
      "Request failed";
    return Promise.reject(new Error(message));
  },
);
