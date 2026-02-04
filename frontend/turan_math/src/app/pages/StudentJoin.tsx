import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useExam } from "../context/ExamContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export function StudentJoin() {
  const navigate = useNavigate();
  const { loginAsStudent } = useAuth();
  const { getClassroomByCode, joinClassroom } = useExam();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const classroom = getClassroomByCode(code);

      if (!classroom) {
        toast.error("Invalid classroom code or exam has ended");
        setIsLoading(false);
        return;
      }

      if (!classroom.isActive) {
        toast.error("This exam has already ended");
        setIsLoading(false);
        return;
      }

      // Login as student
      loginAsStudent(name, code);

      // Join the classroom
      const studentId = `${code}-${name}`;
      joinClassroom(classroom.id, studentId, name);

      toast.success("Joined successfully!");
      navigate(`/student/exam/${classroom.id}`);
    } catch (error) {
      toast.error("Failed to join classroom");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Join Classroom</CardTitle>
            <CardDescription>Enter the classroom code provided by your teacher</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Classroom Code</Label>
                <Input
                  id="code"
                  placeholder="ABC123"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                  maxLength={6}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Joining..." : "Join Exam"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
