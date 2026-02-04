// API Service for SpringBoot Backend
// Replace with your actual backend URL
const API_BASE_URL = "http://localhost:8080";

// Token management
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem("examAuthToken", token);
  } else {
    localStorage.removeItem("examAuthToken");
  }
};

export const getAuthToken = (): string | null => {
  if (!authToken) {
    authToken = localStorage.getItem("examAuthToken");
  }
  return authToken;
};

// Helper function to add auth headers
const getHeaders = (includeAuth: boolean = true): HeadersInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  
  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  
  return headers;
};

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: "teacher" | "student";
}

export interface ApiLoginResponse {
  user: ApiUser;
  token: string;
}

export interface ApiRegisterResponse {
  user: ApiUser;
  token: string;
}

export interface ApiQuestion {
  id: string;
  question: string;
  answers: string[];
  correctAnswer: number;
  category: string;
}

export interface ApiCategory {
  id: string;
  name: string;
  description?: string;
}

export interface ApiClassroom {
  id: string;
  code: string;
  teacherId: string;
  teacherName: string;
  category: string;
  duration: number;
  questionCount: number;
  startTime: number;
  endTime: number;
  isActive: boolean;
}

export interface ApiStudentAnswer {
  classroomId: string;
  studentId: string;
  studentName: string;
  questionId: string;
  answerIndex: number;
}

export interface ApiExamResult {
  studentId: string;
  studentName: string;
  score: number;
  totalQuestions: number;
  answers: Record<string, number>;
}

// API Methods
export const api = {
  // Get all available categories
  async getCategories(): Promise<ApiCategory[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/categories`, {
        method: "GET",
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }
      
      return await response.json();
    } catch (error) {
      console.error("API Error (getCategories):", error);
      // Return mock data as fallback
      return [
        { id: "1", name: "Algebra", description: "Algebraic equations and expressions" },
        { id: "2", name: "Geometry", description: "Shapes, angles, and spatial reasoning" },
        { id: "3", name: "Calculus", description: "Derivatives and integrals" },
        { id: "4", name: "Arithmetic", description: "Basic mathematical operations" },
        { id: "5", name: "Trigonometry", description: "Triangles and trigonometric functions" },
      ];
    }
  },

  // Get questions by category
  async getQuestionsByCategory(category: string, count: number): Promise<ApiQuestion[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/questions?category=${encodeURIComponent(category)}&count=${count}`,
        {
          method: "GET",
          headers: getHeaders(),
        }
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch questions");
      }
      
      return await response.json();
    } catch (error) {
      console.error("API Error (getQuestionsByCategory):", error);
      // Return mock data as fallback
      return Array.from({ length: count }, (_, i) => ({
        id: `q${i + 1}`,
        question: `Sample ${category} question ${i + 1}?`,
        answers: [`Answer A`, `Answer B`, `Answer C`, `Answer D`],
        correctAnswer: Math.floor(Math.random() * 4),
        category,
      }));
    }
  },

  // Create a new classroom
  async createClassroom(data: {
    teacherId: string;
    teacherName: string;
    category: string;
    duration: number;
    questionCount: number;
  }): Promise<ApiClassroom> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/classrooms`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create classroom");
      }
      
      return await response.json();
    } catch (error) {
      console.error("API Error (createClassroom):", error);
      // Return mock data as fallback
      const startTime = Date.now();
      return {
        id: Math.random().toString(36).substring(7),
        code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        teacherId: data.teacherId,
        teacherName: data.teacherName,
        category: data.category,
        duration: data.duration,
        questionCount: data.questionCount,
        startTime,
        endTime: startTime + data.duration * 60 * 1000,
        isActive: true,
      };
    }
  },

  // Get classroom by code
  async getClassroomByCode(code: string): Promise<ApiClassroom | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/classrooms/code/${code}`, {
        method: "GET",
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error("API Error (getClassroomByCode):", error);
      return null;
    }
  },

  // Get classroom by ID
  async getClassroomById(id: string): Promise<ApiClassroom | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/classrooms/${id}`, {
        method: "GET",
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error("API Error (getClassroomById):", error);
      return null;
    }
  },

  // Submit student answer
  async submitAnswer(data: ApiStudentAnswer): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/answers`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("Failed to submit answer");
      }
    } catch (error) {
      console.error("API Error (submitAnswer):", error);
      // Fail silently, answer is saved locally
    }
  },

  // Get student answers for a classroom
  async getStudentAnswers(classroomId: string, studentId: string): Promise<Record<string, number>> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/answers/${classroomId}/${studentId}`,
        {
          method: "GET",
          headers: getHeaders(),
        }
      );
      
      if (!response.ok) {
        return {};
      }
      
      return await response.json();
    } catch (error) {
      console.error("API Error (getStudentAnswers):", error);
      return {};
    }
  },

  // End exam
  async endExam(classroomId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/classrooms/${classroomId}/end`, {
        method: "POST",
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        throw new Error("Failed to end exam");
      }
    } catch (error) {
      console.error("API Error (endExam):", error);
    }
  },

  // Get exam results
  async getExamResults(classroomId: string): Promise<ApiExamResult[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/classrooms/${classroomId}/results`, {
        method: "GET",
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch results");
      }
      
      return await response.json();
    } catch (error) {
      console.error("API Error (getExamResults):", error);
      return [];
    }
  },

  // Get all student progress in a classroom (for live monitoring)
  async getClassroomProgress(classroomId: string): Promise<{
    students: Array<{
      studentId: string;
      studentName: string;
      answeredCount: number;
      totalQuestions: number;
    }>;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/classrooms/${classroomId}/progress`, {
        method: "GET",
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch progress");
      }
      
      return await response.json();
    } catch (error) {
      console.error("API Error (getClassroomProgress):", error);
      return { students: [] };
    }
  },

  // Get teacher's classrooms
  async getTeacherClassrooms(teacherId: string): Promise<ApiClassroom[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/teachers/${teacherId}/classrooms`, {
        method: "GET",
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch classrooms");
      }
      
      return await response.json();
    } catch (error) {
      console.error("API Error (getTeacherClassrooms):", error);
      return [];
    }
  },

  // User authentication
  async login(email: string, password: string): Promise<ApiLoginResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: getHeaders(false),
        body: JSON.stringify({ email, password }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to login");
      }
      
      const data = await response.json();
      setAuthToken(data.token);
      return data;
    } catch (error) {
      console.error("API Error (login):", error);
      throw error;
    }
  },

  async register(name: string, email: string, password: string): Promise<ApiRegisterResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: getHeaders(false),
        body: JSON.stringify({ name, email, password }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to register");
      }
      
      const data = await response.json();
      setAuthToken(data.token);
      return data;
    } catch (error) {
      console.error("API Error (register):", error);
      throw error;
    }
  },

  async logout(): Promise<void> {
    setAuthToken(null);
  },

  async getUserProfile(): Promise<ApiUser> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "GET",
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch user profile");
      }
      
      return await response.json();
    } catch (error) {
      console.error("API Error (getUserProfile):", error);
      throw error;
    }
  },
};