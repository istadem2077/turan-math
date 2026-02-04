import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "sonner";
import { api } from "../services/api";

export interface Question {
  id: string;
  question: string;
  answers: string[];
  correctAnswer: number;
  category: string;
}

export interface Classroom {
  id: string;
  code: string;
  teacherId: string;
  teacherName: string;
  category: string;
  duration: number; // in minutes
  questionCount: number;
  questions: Question[];
  startTime: number; // timestamp
  endTime: number; // timestamp
  isActive: boolean;
  studentAnswers: Record<string, StudentAnswers>;
}

export interface StudentAnswers {
  studentId: string;
  studentName: string;
  answers: Record<string, number>; // questionId -> answerIndex
  questionOrder: string[]; // personalized question order
  answerOrders: Record<string, number[]>; // questionId -> answer order
  score?: number;
  totalQuestions?: number;
}

interface ExamContextType {
  classrooms: Classroom[];
  createClassroom: (teacherId: string, teacherName: string, category: string, duration: number, questionCount: number) => Promise<string>;
  getClassroom: (id: string) => Classroom | undefined;
  getClassroomByCode: (code: string) => Classroom | undefined;
  joinClassroom: (classroomId: string, studentId: string, studentName: string) => void;
  submitAnswer: (classroomId: string, studentId: string, questionId: string, answerIndex: number) => void;
  endExam: (classroomId: string) => void;
  getStudentProgress: (classroomId: string, studentId: string) => StudentAnswers | undefined;
}

const ExamContext = createContext<ExamContextType | undefined>(undefined);

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function ExamProvider({ children }: { children: ReactNode }) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);

  useEffect(() => {
    // Load classrooms from localStorage
    const saved = localStorage.getItem("examClassrooms");
    if (saved) {
      setClassrooms(JSON.parse(saved));
    }

    // Check for expired exams every second
    const interval = setInterval(() => {
      const now = Date.now();
      const saved = localStorage.getItem("examClassrooms");
      if (saved) {
        const rooms: Classroom[] = JSON.parse(saved);
        let updated = false;

        rooms.forEach((room) => {
          if (room.isActive && now >= room.endTime) {
            room.isActive = false;
            updated = true;
            
            // Show notification to teacher
            const currentUser = localStorage.getItem("examUser");
            if (currentUser) {
              const user = JSON.parse(currentUser);
              if (user.role === "teacher" && user.id === room.teacherId) {
                toast.success("Exam Ended", {
                  description: `The exam in classroom ${room.code} has ended.`,
                });
              }
            }
          }
        });

        if (updated) {
          localStorage.setItem("examClassrooms", JSON.stringify(rooms));
          setClassrooms(rooms);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const createClassroom = async (
    teacherId: string,
    teacherName: string,
    category: string,
    duration: number,
    questionCount: number
  ): Promise<string> => {
    try {
      // Fetch questions from API
      const questionsFromApi = await api.getQuestionsByCategory(category, questionCount);
      
      const code = generateCode();
      const startTime = Date.now();
      const endTime = startTime + duration * 60 * 1000;

      const classroom: Classroom = {
        id: Math.random().toString(36).substring(7),
        code,
        teacherId,
        teacherName,
        category,
        duration,
        questionCount,
        questions: questionsFromApi,
        startTime,
        endTime,
        isActive: true,
        studentAnswers: {},
      };

      const updated = [...classrooms, classroom];
      setClassrooms(updated);
      localStorage.setItem("examClassrooms", JSON.stringify(updated));

      return classroom.id;
    } catch (error) {
      console.error("Error creating classroom:", error);
      throw error;
    }
  };

  const getClassroom = (id: string): Classroom | undefined => {
    const saved = localStorage.getItem("examClassrooms");
    if (saved) {
      const rooms: Classroom[] = JSON.parse(saved);
      return rooms.find((c) => c.id === id);
    }
    return classrooms.find((c) => c.id === id);
  };

  const getClassroomByCode = (code: string): Classroom | undefined => {
    const saved = localStorage.getItem("examClassrooms");
    if (saved) {
      const rooms: Classroom[] = JSON.parse(saved);
      return rooms.find((c) => c.code === code.toUpperCase() && c.isActive);
    }
    return classrooms.find((c) => c.code === code.toUpperCase() && c.isActive);
  };

  const joinClassroom = (classroomId: string, studentId: string, studentName: string) => {
    const saved = localStorage.getItem("examClassrooms");
    if (saved) {
      const rooms: Classroom[] = JSON.parse(saved);
      const classroom = rooms.find((c) => c.id === classroomId);

      if (classroom && !classroom.studentAnswers[studentId]) {
        // Generate personalized question and answer orders
        const questionOrder = shuffleArray(classroom.questions.map((q) => q.id));
        const answerOrders: Record<string, number[]> = {};

        classroom.questions.forEach((q) => {
          answerOrders[q.id] = shuffleArray(Array.from({ length: q.answers.length }, (_, i) => i));
        });

        classroom.studentAnswers[studentId] = {
          studentId,
          studentName,
          answers: {},
          questionOrder,
          answerOrders,
        };

        localStorage.setItem("examClassrooms", JSON.stringify(rooms));
        setClassrooms(rooms);
      }
    }
  };

  const submitAnswer = (classroomId: string, studentId: string, questionId: string, answerIndex: number) => {
    const saved = localStorage.getItem("examClassrooms");
    if (saved) {
      const rooms: Classroom[] = JSON.parse(saved);
      const classroom = rooms.find((c) => c.id === classroomId);

      if (classroom && classroom.studentAnswers[studentId]) {
        classroom.studentAnswers[studentId].answers[questionId] = answerIndex;
        localStorage.setItem("examClassrooms", JSON.stringify(rooms));
        setClassrooms(rooms);

        // Send to API (non-blocking)
        api.submitAnswer({
          classroomId,
          studentId,
          studentName: classroom.studentAnswers[studentId].studentName,
          questionId,
          answerIndex,
        }).catch((error) => {
          console.error("Failed to sync answer to API:", error);
        });
      }
    }
  };

  const endExam = (classroomId: string) => {
    const saved = localStorage.getItem("examClassrooms");
    if (saved) {
      const rooms: Classroom[] = JSON.parse(saved);
      const classroom = rooms.find((c) => c.id === classroomId);

      if (classroom) {
        classroom.isActive = false;
        classroom.endTime = Date.now();

        // Calculate scores
        Object.values(classroom.studentAnswers).forEach((studentAnswer) => {
          let score = 0;
          classroom.questions.forEach((question) => {
            const studentAnswerIndex = studentAnswer.answers[question.id];
            if (studentAnswerIndex !== undefined) {
              const originalAnswerIndex = studentAnswer.answerOrders[question.id][studentAnswerIndex];
              if (originalAnswerIndex === question.correctAnswer) {
                score++;
              }
            }
          });
          studentAnswer.score = score;
          studentAnswer.totalQuestions = classroom.questions.length;
        });

        localStorage.setItem("examClassrooms", JSON.stringify(rooms));
        setClassrooms(rooms);
      }
    }
  };

  const getStudentProgress = (classroomId: string, studentId: string): StudentAnswers | undefined => {
    const classroom = getClassroom(classroomId);
    return classroom?.studentAnswers[studentId];
  };

  return (
    <ExamContext.Provider
      value={{
        classrooms,
        createClassroom,
        getClassroom,
        getClassroomByCode,
        joinClassroom,
        submitAnswer,
        endExam,
        getStudentProgress,
      }}
    >
      {children}
    </ExamContext.Provider>
  );
}

export function useExam() {
  const context = useContext(ExamContext);
  if (context === undefined) {
    throw new Error("useExam must be used within an ExamProvider");
  }
  return context;
}