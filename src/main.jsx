import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import "./i18n/config.js";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { BookingUiProvider } from "./context/BookingUiContext.jsx";
import { ThemeProvider } from "./theme/ThemeContext.jsx";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <BookingUiProvider>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </BookingUiProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
