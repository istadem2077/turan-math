import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./context/AuthContext";
import { ExamProvider } from "./context/ExamContext";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <AuthProvider>
      <ExamProvider>
        <RouterProvider router={router} />
        <Toaster />
      </ExamProvider>
    </AuthProvider>
  );
}
