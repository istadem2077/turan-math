import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api, setAuthToken, getAuthToken } from "../services/api";

interface User {
  id: string;
  email: string;
  name: string;
  role: "teacher" | "student";
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: "teacher" | "student") => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  loginAsStudent: (name: string, classroomCode: string) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load user from localStorage and verify token on mount
    const loadUser = async () => {
      const savedUser = localStorage.getItem("examUser");
      const token = getAuthToken();
      
      if (savedUser && token) {
        try {
          // Verify token is still valid by fetching user profile
          const profile = await api.getUserProfile();
          setUser(profile);
        } catch (error) {
          // Token is invalid, clear everything
          console.error("Invalid token, clearing session:", error);
          localStorage.removeItem("examUser");
          setAuthToken(null);
          setUser(null);
        }
      } else if (savedUser) {
        // User exists but no token (student or old session)
        setUser(JSON.parse(savedUser));
      }
      
      setIsLoading(false);
    };

    loadUser();
  }, []);

  const register = async (email: string, password: string, name: string) => {
    try {
      // Call API to register
      const response = await api.register(name, email, password);
      
      const newUser: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: response.user.role,
      };

      localStorage.setItem("examUser", JSON.stringify(newUser));
      setUser(newUser);
    } catch (error) {
      // Fallback to localStorage for development
      console.error("API registration failed, using fallback:", error);
      
      const users = JSON.parse(localStorage.getItem("examUsers") || "[]");
      
      if (users.find((u: any) => u.email === email)) {
        throw new Error("User already exists");
      }

      const newUser: User = {
        id: Math.random().toString(36).substring(7),
        email,
        name,
        role: "teacher",
      };

      users.push({ ...newUser, password });
      localStorage.setItem("examUsers", JSON.stringify(users));
      localStorage.setItem("examUser", JSON.stringify(newUser));
      setUser(newUser);
    }
  };

  const login = async (email: string, password: string, role: "teacher" | "student") => {
    try {
      // Call API to login
      const response = await api.login(email, password);
      
      const loggedInUser: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: response.user.role,
      };

      localStorage.setItem("examUser", JSON.stringify(loggedInUser));
      setUser(loggedInUser);
    } catch (error) {
      // Fallback to localStorage for development
      console.error("API login failed, using fallback:", error);
      
      const users = JSON.parse(localStorage.getItem("examUsers") || "[]");
      const foundUser = users.find((u: any) => u.email === email && u.password === password);

      if (!foundUser) {
        throw new Error("Invalid credentials");
      }

      const user: User = {
        id: foundUser.id,
        email: foundUser.email,
        name: foundUser.name,
        role,
      };

      localStorage.setItem("examUser", JSON.stringify(user));
      setUser(user);
    }
  };

  const loginAsStudent = (name: string, classroomCode: string) => {
    // Students don't use API authentication, they join via classroom code
    const studentUser: User = {
      id: Math.random().toString(36).substring(7),
      email: `${classroomCode}-${name}@student.local`,
      name,
      role: "student",
    };

    localStorage.setItem("examUser", JSON.stringify(studentUser));
    setUser(studentUser);
  };

  const logout = () => {
    api.logout();
    localStorage.removeItem("examUser");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loginAsStudent, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}