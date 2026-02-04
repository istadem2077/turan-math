import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useExam } from "../context/ExamContext";
import { api } from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export function CreateClassroom() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createClassroom } = useExam();

  const [categories, setCategories] = useState<Array<{ id: string; name: string; description?: string }>>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState("30");
  const [questionCount, setQuestionCount] = useState("10");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Fetch categories from API
    const fetchCategories = async () => {
      try {
        const cats = await api.getCategories();
        setCategories(cats);
        if (cats.length > 0) {
          setCategory(cats[0].name);
        }
      } catch (error) {
        toast.error("Failed to load categories");
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!user) {
      toast.error("You must be logged in");
      setIsSubmitting(false);
      return;
    }

    try {
      const classroomId = await createClassroom(
        user.id,
        user.name,
        category,
        parseInt(duration),
        parseInt(questionCount)
      );

      toast.success("Classroom created successfully!");
      navigate(`/teacher/classroom/${classroomId}`);
    } catch (error) {
      toast.error("Failed to create classroom");
    } finally {
      setIsSubmitting(false);
    }
  };

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

      <main className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Create New Classroom</CardTitle>
            <CardDescription>Set up a new exam session for your students</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingCategories ? (
                      <SelectItem value="">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </SelectItem>
                    ) : (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  max="180"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="questionCount">Number of Questions</Label>
                <Input
                  id="questionCount"
                  type="number"
                  min="1"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(e.target.value)}
                  required
                />
                <p className="text-sm text-gray-500">Enter the number of questions for this exam</p>
              </div>

              <div className="flex gap-4">
                <Button type="button" variant="outline" onClick={() => navigate("/teacher/dashboard")} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={isSubmitting || loadingCategories}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Classroom"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}