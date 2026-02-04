import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useExam } from "../context/ExamContext";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Plus, LogOut, Clock, Users, BookOpen } from "lucide-react";
import type { Classroom } from "../context/ExamContext";

export function TeacherDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { classrooms } = useExam();
  const [teacherClassrooms, setTeacherClassrooms] = useState<Classroom[]>([]);

  useEffect(() => {
    if (!user || user.role !== "teacher") {
      navigate("/teacher/login");
      return;
    }

    // Filter classrooms for this teacher
    const filtered = classrooms.filter((c) => c.teacherId === user.id);
    setTeacherClassrooms(filtered);
  }, [user, classrooms, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const formatTimeRemaining = (endTime: number, isActive: boolean) => {
    if (!isActive) return "Ended";
    
    const remaining = Math.max(0, endTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    if (remaining <= 0) return "Ended";
    
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl">Teacher Dashboard</h1>
            <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl">Your Classrooms</h2>
          <Button onClick={() => navigate("/teacher/create-classroom")}>
            <Plus className="w-4 h-4 mr-2" />
            Create Classroom
          </Button>
        </div>

        {teacherClassrooms.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No classrooms yet</p>
              <Button onClick={() => navigate("/teacher/create-classroom")}>
                Create Your First Classroom
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teacherClassrooms.map((classroom) => (
              <Card
                key={classroom.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/teacher/classroom/${classroom.id}`)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>Code: {classroom.code}</CardTitle>
                    <Badge variant={classroom.isActive ? "default" : "secondary"}>
                      {classroom.isActive ? "Active" : "Ended"}
                    </Badge>
                  </div>
                  <CardDescription className="capitalize">{classroom.category}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      {classroom.isActive ? (
                        <span>Time left: {formatTimeRemaining(classroom.endTime, classroom.isActive)}</span>
                      ) : (
                        <span>Duration: {classroom.duration} min</span>
                      )}
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Users className="w-4 h-4 mr-2" />
                      {Object.keys(classroom.studentAnswers).length} students
                    </div>
                    <div className="flex items-center text-gray-600">
                      <BookOpen className="w-4 h-4 mr-2" />
                      {classroom.questionCount} questions
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
