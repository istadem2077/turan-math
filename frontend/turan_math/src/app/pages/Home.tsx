import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { GraduationCap, Users } from "lucide-react";

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl mb-4">ExamPro</h1>
          <p className="text-xl text-gray-600">Online Examination Platform</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/teacher/login")}>
            <CardHeader>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                <GraduationCap className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-center">Teacher Portal</CardTitle>
              <CardDescription className="text-center">
                Create and manage exams, monitor student progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" size="lg">
                Login as Teacher
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/student/join")}>
            <CardHeader>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-center">Student Portal</CardTitle>
              <CardDescription className="text-center">
                Join a classroom and take exams
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" size="lg">
                Join as Student
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
