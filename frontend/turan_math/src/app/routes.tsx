import { createBrowserRouter } from "react-router";
import { Home } from "./pages/Home";
import { TeacherLogin } from "./pages/TeacherLogin";
import { TeacherDashboard } from "./pages/TeacherDashboard";
import { CreateClassroom } from "./pages/CreateClassroom";
import { TeacherClassroomView } from "./pages/TeacherClassroomView";
import { StudentJoin } from "./pages/StudentJoin";
import { StudentExam } from "./pages/StudentExam";
import { StudentDashboard } from "./pages/StudentDashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/teacher/login",
    element: <TeacherLogin />,
  },
  {
    path: "/teacher/dashboard",
    element: <TeacherDashboard />,
  },
  {
    path: "/teacher/create-classroom",
    element: <CreateClassroom />,
  },
  {
    path: "/teacher/classroom/:classroomId",
    element: <TeacherClassroomView />,
  },
  {
    path: "/student/join",
    element: <StudentJoin />,
  },
  {
    path: "/student/exam/:classroomId",
    element: <StudentExam />,
  },
  {
    path: "/student/dashboard",
    element: <StudentDashboard />,
  },
]);