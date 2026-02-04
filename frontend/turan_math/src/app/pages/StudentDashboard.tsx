import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { CheckCircle, LogOut } from "lucide-react";

export function StudentDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!user || user.role !== "student") {
      navigate("/student/join");
    }
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl">Student Dashboard</h1>
            <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Exit
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <Card className="text-center">
          <CardHeader>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle>Exam Completed!</CardTitle>
            <CardDescription className="text-base pt-2">
              Thank you for completing the exam. Your teacher will review the results.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              You can close this window or join another exam.
            </p>
            <Button onClick={() => navigate("/student/join")}>
              Join Another Exam
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
