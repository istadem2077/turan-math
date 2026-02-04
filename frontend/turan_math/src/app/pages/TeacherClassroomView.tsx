import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useExam } from "../context/ExamContext";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Clock, Users, Copy, CheckCircle2, XCircle } from "lucide-react";
import type { Classroom } from "../context/ExamContext";

export function TeacherClassroomView() {
  const navigate = useNavigate();
  const { classroomId } = useParams<{ classroomId: string }>();
  const { getClassroom, endExam } = useExam();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (!classroomId) return;

    const loadClassroom = () => {
      const c = getClassroom(classroomId);
      if (c) {
        setClassroom(c);
        setTimeRemaining(Math.max(0, c.endTime - Date.now()));
      }
    };

    loadClassroom();

    // Update every second
    const interval = setInterval(() => {
      loadClassroom();
    }, 1000);

    return () => clearInterval(interval);
  }, [classroomId, getClassroom]);

  const handleCopyCode = () => {
    if (classroom) {
      navigator.clipboard.writeText(classroom.code);
      toast.success("Classroom code copied!");
    }
  };

  const handleEndExam = () => {
    if (classroom) {
      endExam(classroom.id);
      toast.success("Exam ended successfully!");
      navigate("/teacher/dashboard");
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (!classroom) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  const students = Object.values(classroom.studentAnswers);
  const totalQuestions = classroom.questions.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/teacher/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Classroom Code</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCopyCode}>
                <Copy className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-3xl">{classroom.code}</div>
              <p className="text-xs text-gray-500 mt-1 capitalize">{classroom.category}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Time Remaining</CardTitle>
              <Clock className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl">
                {classroom.isActive ? formatTime(timeRemaining) : "Ended"}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Duration: {classroom.duration} minutes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Students</CardTitle>
              <Users className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl">{students.length}</div>
              <p className="text-xs text-gray-500 mt-1">Joined this exam</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl">Student Progress</h2>
          {classroom.isActive && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">End Exam</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>End Exam Early?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will immediately end the exam for all students. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleEndExam}>End Exam</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Live Progress</CardTitle>
            <CardDescription>
              {classroom.isActive 
                ? "Monitor how many questions each student has answered"
                : "Final exam results"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No students have joined yet</p>
            ) : (
              <div className="space-y-4">
                {students.map((student) => {
                  const answeredCount = Object.keys(student.answers).length;
                  const progress = (answeredCount / totalQuestions) * 100;

                  return (
                    <div key={student.studentId} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p>{student.studentName}</p>
                          <p className="text-sm text-gray-500">
                            {answeredCount} of {totalQuestions} questions answered
                          </p>
                        </div>
                        {!classroom.isActive && student.score !== undefined && (
                          <Badge variant={student.score >= totalQuestions * 0.7 ? "default" : "secondary"}>
                            Score: {student.score}/{student.totalQuestions}
                          </Badge>
                        )}
                      </div>
                      <Progress value={progress} className="h-2" />
                      
                      {!classroom.isActive && (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center text-green-600">
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Correct: {student.score}
                          </div>
                          <div className="flex items-center text-red-600">
                            <XCircle className="w-4 h-4 mr-1" />
                            Incorrect: {(student.totalQuestions || 0) - (student.score || 0)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
