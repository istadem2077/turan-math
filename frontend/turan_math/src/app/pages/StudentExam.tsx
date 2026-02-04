import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useExam } from "../context/ExamContext";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Label } from "../components/ui/label";
import { Progress } from "../components/ui/progress";
import { toast } from "sonner";
import { Clock, CheckCircle } from "lucide-react";
import type { Classroom, Question } from "../context/ExamContext";

export function StudentExam() {
  const navigate = useNavigate();
  const { classroomId } = useParams<{ classroomId: string }>();
  const { user } = useAuth();
  const { getClassroom, submitAnswer, getStudentProgress } = useExam();

  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (!classroomId || !user) {
      navigate("/student/join");
      return;
    }

    const loadClassroom = () => {
      const c = getClassroom(classroomId);
      if (c) {
        setClassroom(c);
        setTimeRemaining(Math.max(0, c.endTime - Date.now()));

        // Check if exam has ended
        if (!c.isActive || c.endTime <= Date.now()) {
          toast.info("Exam has ended");
          navigate("/student/dashboard");
          return;
        }

        // Load student's saved answer for current question
        const studentId = `${c.code}-${user.name}`;
        const progress = getStudentProgress(classroomId, studentId);
        
        if (progress && progress.questionOrder.length > currentQuestionIndex) {
          const questionId = progress.questionOrder[currentQuestionIndex];
          const savedAnswer = progress.answers[questionId];
          if (savedAnswer !== undefined) {
            setSelectedAnswer(savedAnswer);
          } else {
            setSelectedAnswer(null);
          }
        }
      }
    };

    loadClassroom();

    // Update every second
    const interval = setInterval(() => {
      loadClassroom();
    }, 1000);

    return () => clearInterval(interval);
  }, [classroomId, user, navigate, getClassroom, currentQuestionIndex, getStudentProgress]);

  const handleAnswerSelect = (value: string) => {
    const answerIndex = parseInt(value);
    setSelectedAnswer(answerIndex);

    if (classroom && user) {
      const studentId = `${classroom.code}-${user.name}`;
      const progress = getStudentProgress(classroomId!, studentId);
      
      if (progress && progress.questionOrder.length > currentQuestionIndex) {
        const questionId = progress.questionOrder[currentQuestionIndex];
        submitAnswer(classroom.id, studentId, questionId, answerIndex);
        toast.success("Answer saved");
      }
    }
  };

  const handleNext = () => {
    if (classroom && currentQuestionIndex < classroom.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setSelectedAnswer(null);
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (!classroom || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  const studentId = `${classroom.code}-${user.name}`;
  const progress = getStudentProgress(classroomId!, studentId);

  if (!progress) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Error loading exam</p>
      </div>
    );
  }

  const questionId = progress.questionOrder[currentQuestionIndex];
  const question = classroom.questions.find((q) => q.id === questionId);

  if (!question) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Question not found</p>
      </div>
    );
  }

  // Shuffle answers according to student's personalized order
  const answerOrder = progress.answerOrders[questionId];
  const shuffledAnswers = answerOrder.map((originalIndex) => question.answers[originalIndex]);

  const answeredCount = Object.keys(progress.answers).length;
  const totalQuestions = classroom.questions.length;
  const progressPercentage = (answeredCount / totalQuestions) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl">Exam in Progress</h1>
              <p className="text-sm text-gray-600 capitalize">{classroom.category}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-500" />
                <span className="text-xl">{formatTime(timeRemaining)}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm text-gray-600">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </p>
            <p className="text-sm text-gray-600">
              {answeredCount} answered
            </p>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Question {currentQuestionIndex + 1}</CardTitle>
            <CardDescription className="text-lg pt-2">{question.question}</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selectedAnswer !== null ? selectedAnswer.toString() : undefined}
              onValueChange={handleAnswerSelect}
            >
              <div className="space-y-3">
                {shuffledAnswers.map((answer, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                  >
                    <RadioGroupItem value={index.toString()} id={`answer-${index}`} />
                    <Label htmlFor={`answer-${index}`} className="flex-1 cursor-pointer">
                      {answer}
                    </Label>
                    {selectedAnswer === index && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                ))}
              </div>
            </RadioGroup>

            <div className="flex gap-4 mt-6">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
                className="flex-1"
              >
                Previous
              </Button>
              <Button
                onClick={handleNext}
                disabled={currentQuestionIndex === totalQuestions - 1}
                className="flex-1"
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 grid grid-cols-5 md:grid-cols-10 gap-2">
          {progress.questionOrder.map((qId, index) => {
            const isAnswered = progress.answers[qId] !== undefined;
            const isCurrent = index === currentQuestionIndex;

            return (
              <button
                key={qId}
                onClick={() => {
                  setCurrentQuestionIndex(index);
                  setSelectedAnswer(null);
                }}
                className={`aspect-square rounded-lg border-2 flex items-center justify-center text-sm
                  ${isCurrent ? 'border-blue-600 bg-blue-50' : 'border-gray-300'}
                  ${isAnswered && !isCurrent ? 'bg-green-50 border-green-600' : ''}
                  hover:bg-gray-100 transition-colors
                `}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
