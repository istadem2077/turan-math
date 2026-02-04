# Exam Platform API Guide

## Overview

This document describes the API endpoints that need to be implemented in your SpringBoot backend for the Exam Platform to function properly.

**Base URL**: `http://localhost:8080`

**Authentication**: Most endpoints require a JWT token in the `Authorization` header.

---

## Authentication Flow

1. User registers or logs in via `/api/auth/register` or `/api/auth/login`
2. Backend returns a JWT token and user information
3. Frontend stores the token and includes it in subsequent requests
4. Token is sent as: `Authorization: Bearer <token>`

---

## CORS Configuration

Your SpringBoot backend must allow CORS requests from the frontend application. Add the following configuration:

```java
@Configuration
public class CorsConfig {
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                    .allowedOrigins("http://localhost:5173", "http://localhost:3000")
                    .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                    .allowedHeaders("*")
                    .allowCredentials(true);
            }
        };
    }
}
```

---

## Data Models

### User

```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "role": "teacher"
}
```

**Note**: `role` is always "teacher" for authenticated users. Students join anonymously via classroom codes.

### Login Response

```json
{
  "user": {
    "id": "string",
    "name": "string",
    "email": "string",
    "role": "teacher"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Category

```json
{
  "id": "string",
  "name": "string",
  "description": "string (optional)"
}
```

### Question

```json
{
  "id": "string",
  "question": "string",
  "answers": ["string", "string", "string", "string"],
  "correctAnswer": 0,
  "category": "string"
}
```

**Note**: `correctAnswer` is a zero-based index (0-3) indicating which answer in the `answers` array is correct.

### Classroom

```json
{
  "id": "string",
  "code": "string",
  "teacherId": "string",
  "teacherName": "string",
  "category": "string",
  "duration": 30,
  "questionCount": 10,
  "startTime": 1234567890000,
  "endTime": 1234569690000,
  "isActive": true
}
```

**Note**: `startTime` and `endTime` are Unix timestamps in milliseconds.

### Student Answer

```json
{
  "classroomId": "string",
  "studentId": "string",
  "studentName": "string",
  "questionId": "string",
  "answerIndex": 0
}
```

### Exam Result

```json
{
  "studentId": "string",
  "studentName": "string",
  "score": 8,
  "totalQuestions": 10,
  "answers": {
    "question1": 2,
    "question2": 0
  }
}
```

---

## API Endpoints

### Authentication Endpoints

#### 1. User Registration

**Endpoint**: `POST /api/auth/register`

**Authentication**: None required

**Description**: Registers a new teacher account.

**Request Body**:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response**: `201 Created`

```json
{
  "user": {
    "id": "teacher123",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "teacher"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses**:
- `400 Bad Request` - Email already exists
- `422 Unprocessable Entity` - Invalid input (e.g., weak password, invalid email format)

**Example Java Controller**:

```java
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
        // Validate input
        if (userService.emailExists(request.getEmail())) {
            throw new BadRequestException("Email already exists");
        }
        
        // Hash password
        String hashedPassword = passwordEncoder.encode(request.getPassword());
        
        // Create user
        User user = userService.createUser(request.getName(), request.getEmail(), hashedPassword);
        
        // Generate JWT token
        String token = jwtService.generateToken(user);
        
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(new AuthResponse(user, token));
    }
}
```

---

#### 2. User Login

**Endpoint**: `POST /api/auth/login`

**Authentication**: None required

**Description**: Authenticates a teacher and returns a JWT token.

**Request Body**:

```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response**: `200 OK`

```json
{
  "user": {
    "id": "teacher123",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "teacher"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses**:
- `401 Unauthorized` - Invalid email or password

**Example Java Controller**:

```java
@PostMapping("/login")
public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
    // Find user by email
    User user = userService.findByEmail(request.getEmail())
        .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));
    
    // Verify password
    if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
        throw new UnauthorizedException("Invalid credentials");
    }
    
    // Generate JWT token
    String token = jwtService.generateToken(user);
    
    return ResponseEntity.ok(new AuthResponse(user, token));
}
```

---

#### 3. Get User Profile

**Endpoint**: `GET /api/auth/profile`

**Authentication**: Required (JWT token)

**Description**: Returns the current authenticated user's profile.

**Request Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response**: `200 OK`

```json
{
  "id": "teacher123",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "teacher"
}
```

**Error Responses**:
- `401 Unauthorized` - Invalid or expired token

**Example Java Controller**:

```java
@GetMapping("/profile")
public ResponseEntity<User> getProfile(@AuthenticationPrincipal User user) {
    return ResponseEntity.ok(user);
}
```

---

### Category & Question Endpoints

#### 4. Get All Categories

**Endpoint**: `GET /api/categories`

**Description**: Returns all available math question categories.

**Request**: None

**Response**: `200 OK`

```json
[
  {
    "id": "1",
    "name": "Algebra",
    "description": "Algebraic equations and expressions"
  },
  {
    "id": "2",
    "name": "Geometry",
    "description": "Shapes, angles, and spatial reasoning"
  },
  {
    "id": "3",
    "name": "Calculus",
    "description": "Derivatives and integrals"
  }
]
```

**Example Java Controller**:

```java
@RestController
@RequestMapping("/api")
public class CategoryController {
    
    @GetMapping("/categories")
    public ResponseEntity<List<Category>> getCategories() {
        // Return all categories from database
        return ResponseEntity.ok(categoryService.getAllCategories());
    }
}
```

---

#### 5. Get Questions by Category

**Endpoint**: `GET /api/questions`

**Description**: Returns a specified number of questions for a given category.

**Query Parameters**:
- `category` (required): Category name (e.g., "Algebra")
- `count` (required): Number of questions to return

**Request**: `GET /api/questions?category=Algebra&count=10`

**Response**: `200 OK`

```json
[
  {
    "id": "q1",
    "question": "Solve for x: 2x + 5 = 13",
    "answers": ["x = 3", "x = 4", "x = 5", "x = 6"],
    "correctAnswer": 1,
    "category": "Algebra"
  },
  {
    "id": "q2",
    "question": "What is x² when x = 5?",
    "answers": ["10", "15", "20", "25"],
    "correctAnswer": 3,
    "category": "Algebra"
  }
]
```

**Important Notes**:
- Questions should be randomized from the database
- There is NO limit on question count - support any number
- Each question must have exactly 4 answer choices
- `correctAnswer` is zero-based (0 = first answer, 3 = fourth answer)

**Example Java Controller**:

```java
@GetMapping("/questions")
public ResponseEntity<List<Question>> getQuestions(
    @RequestParam String category,
    @RequestParam int count
) {
    List<Question> questions = questionService.getRandomQuestions(category, count);
    return ResponseEntity.ok(questions);
}
```

---

### Classroom Endpoints

#### 6. Create Classroom

**Endpoint**: `POST /api/classrooms`

**Description**: Creates a new classroom/exam session.

**Request Body**:

```json
{
  "teacherId": "teacher123",
  "teacherName": "John Doe",
  "category": "Algebra",
  "duration": 30,
  "questionCount": 10
}
```

**Response**: `201 Created`

```json
{
  "id": "classroom456",
  "code": "ABC123",
  "teacherId": "teacher123",
  "teacherName": "John Doe",
  "category": "Algebra",
  "duration": 30,
  "questionCount": 10,
  "startTime": 1234567890000,
  "endTime": 1234569690000,
  "isActive": true
}
```

**Important Notes**:
- Generate a unique 6-character `code` (uppercase alphanumeric)
- Calculate `endTime` as `startTime + (duration * 60 * 1000)` milliseconds
- Set `isActive` to `true` initially

**Example Java Controller**:

```java
@PostMapping("/classrooms")
public ResponseEntity<Classroom> createClassroom(@RequestBody CreateClassroomRequest request) {
    Classroom classroom = classroomService.createClassroom(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(classroom);
}
```

---

#### 7. Get Classroom by Code

**Endpoint**: `GET /api/classrooms/code/{code}`

**Description**: Retrieves classroom information using the join code.

**Path Parameters**:
- `code`: The 6-character classroom code

**Request**: `GET /api/classrooms/code/ABC123`

**Response**: `200 OK` (if found) or `404 Not Found`

```json
{
  "id": "classroom456",
  "code": "ABC123",
  "teacherId": "teacher123",
  "teacherName": "John Doe",
  "category": "Algebra",
  "duration": 30,
  "questionCount": 10,
  "startTime": 1234567890000,
  "endTime": 1234569690000,
  "isActive": true
}
```

---

#### 8. Get Classroom by ID

**Endpoint**: `GET /api/classrooms/{id}`

**Description**: Retrieves classroom information by classroom ID.

**Path Parameters**:
- `id`: The classroom ID

**Request**: `GET /api/classrooms/classroom456`

**Response**: `200 OK` (if found) or `404 Not Found`

```json
{
  "id": "classroom456",
  "code": "ABC123",
  "teacherId": "teacher123",
  "teacherName": "John Doe",
  "category": "Algebra",
  "duration": 30,
  "questionCount": 10,
  "startTime": 1234567890000,
  "endTime": 1234569690000,
  "isActive": true
}
```

---

### Student Answer Endpoints

#### 9. Submit Student Answer

**Endpoint**: `POST /api/answers`

**Description**: Saves a student's answer to a question.

**Request Body**:

```json
{
  "classroomId": "classroom456",
  "studentId": "student789",
  "studentName": "Jane Smith",
  "questionId": "q1",
  "answerIndex": 2
}
```

**Response**: `200 OK` or `201 Created`

```json
{
  "success": true,
  "message": "Answer saved successfully"
}
```

**Important Notes**:
- This endpoint is called frequently as students answer questions
- Should be idempotent (updating the same answer multiple times)
- `answerIndex` is the shuffled answer index (0-3) as displayed to the student

**Example Java Controller**:

```java
@PostMapping("/answers")
public ResponseEntity<Map<String, Object>> submitAnswer(@RequestBody StudentAnswer answer) {
    answerService.saveAnswer(answer);
    return ResponseEntity.ok(Map.of("success", true, "message", "Answer saved successfully"));
}
```

---

#### 10. Get Student Answers

**Endpoint**: `GET /api/answers/{classroomId}/{studentId}`

**Description**: Retrieves all answers for a specific student in a classroom.

**Path Parameters**:
- `classroomId`: The classroom ID
- `studentId`: The student ID

**Request**: `GET /api/answers/classroom456/student789`

**Response**: `200 OK`

```json
{
  "q1": 2,
  "q2": 0,
  "q3": 1
}
```

**Note**: Returns a map of `questionId` to `answerIndex`.

---

### Exam Endpoints

#### 11. End Exam

**Endpoint**: `POST /api/classrooms/{classroomId}/end`

**Description**: Ends the exam early (before the timer expires).

**Path Parameters**:
- `classroomId`: The classroom ID

**Request**: `POST /api/classrooms/classroom456/end`

**Response**: `200 OK`

```json
{
  "success": true,
  "message": "Exam ended successfully"
}
```

**Important Notes**:
- Set `isActive` to `false`
- Update `endTime` to current timestamp
- Calculate final scores for all students

---

#### 12. Get Exam Results

**Endpoint**: `GET /api/classrooms/{classroomId}/results`

**Description**: Retrieves exam results for all students in a classroom.

**Path Parameters**:
- `classroomId`: The classroom ID

**Request**: `GET /api/classrooms/classroom456/results`

**Response**: `200 OK`

```json
[
  {
    "studentId": "student789",
    "studentName": "Jane Smith",
    "score": 8,
    "totalQuestions": 10,
    "answers": {
      "q1": 2,
      "q2": 0,
      "q3": 1
    }
  },
  {
    "studentId": "student101",
    "studentName": "Bob Johnson",
    "score": 7,
    "totalQuestions": 10,
    "answers": {
      "q1": 1,
      "q2": 3,
      "q3": 1
    }
  }
]
```

**Important Notes**:
- Only return results if exam has ended (`isActive = false`)
- Calculate scores by comparing student answers with correct answers

---

#### 13. Get Classroom Progress (Live Monitoring)

**Endpoint**: `GET /api/classrooms/{classroomId}/progress`

**Description**: Gets real-time progress of all students during an active exam.

**Path Parameters**:
- `classroomId`: The classroom ID

**Request**: `GET /api/classrooms/classroom456/progress`

**Response**: `200 OK`

```json
{
  "students": [
    {
      "studentId": "student789",
      "studentName": "Jane Smith",
      "answeredCount": 7,
      "totalQuestions": 10
    },
    {
      "studentId": "student101",
      "studentName": "Bob Johnson",
      "answeredCount": 5,
      "totalQuestions": 10
    }
  ]
}
```

**Important Notes**:
- This endpoint is polled every few seconds by teachers
- Should return count of answered questions per student
- Only for active exams

---

#### 14. Get Teacher's Classrooms

**Endpoint**: `GET /api/teachers/{teacherId}/classrooms`

**Description**: Retrieves all classrooms created by a specific teacher.

**Path Parameters**:
- `teacherId`: The teacher's ID

**Request**: `GET /api/teachers/teacher123/classrooms`

**Response**: `200 OK`

```json
[
  {
    "id": "classroom456",
    "code": "ABC123",
    "teacherId": "teacher123",
    "teacherName": "John Doe",
    "category": "Algebra",
    "duration": 30,
    "questionCount": 10,
    "startTime": 1234567890000,
    "endTime": 1234569690000,
    "isActive": true
  },
  {
    "id": "classroom789",
    "code": "XYZ789",
    "teacherId": "teacher123",
    "teacherName": "John Doe",
    "category": "Geometry",
    "duration": 45,
    "questionCount": 15,
    "startTime": 1234560000000,
    "endTime": 1234562700000,
    "isActive": false
  }
]
```

---

## Testing the API

### Using cURL

```bash
# Register a new teacher
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'

# Get user profile (requires token)
curl http://localhost:8080/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Get categories
curl http://localhost:8080/api/categories

# Get questions
curl "http://localhost:8080/api/questions?category=Algebra&count=10"

# Create classroom (requires token)
curl -X POST http://localhost:8080/api/classrooms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "teacherId": "teacher123",
    "teacherName": "John Doe",
    "category": "Algebra",
    "duration": 30,
    "questionCount": 10
  }'

# Submit answer
curl -X POST http://localhost:8080/api/answers \
  -H "Content-Type: application/json" \
  -d '{
    "classroomId": "classroom456",
    "studentId": "student789",
    "studentName": "Jane Smith",
    "questionId": "q1",
    "answerIndex": 2
  }'
```

---

## Database Schema Suggestions

### Users Table

```sql
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- Hashed password (BCrypt)
    role VARCHAR(50) DEFAULT 'teacher',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

### Categories Table

```sql
CREATE TABLE categories (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT
);
```

### Questions Table

```sql
CREATE TABLE questions (
    id VARCHAR(255) PRIMARY KEY,
    question TEXT NOT NULL,
    answer_1 VARCHAR(255) NOT NULL,
    answer_2 VARCHAR(255) NOT NULL,
    answer_3 VARCHAR(255) NOT NULL,
    answer_4 VARCHAR(255) NOT NULL,
    correct_answer INT NOT NULL, -- 0-3
    category_id VARCHAR(255) NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

### Classrooms Table

```sql
CREATE TABLE classrooms (
    id VARCHAR(255) PRIMARY KEY,
    code VARCHAR(6) NOT NULL UNIQUE,
    teacher_id VARCHAR(255) NOT NULL,
    teacher_name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    duration INT NOT NULL,
    question_count INT NOT NULL,
    start_time BIGINT NOT NULL,
    end_time BIGINT NOT NULL,
    is_active BOOLEAN DEFAULT true
);
```

### Student Answers Table

```sql
CREATE TABLE student_answers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    classroom_id VARCHAR(255) NOT NULL,
    student_id VARCHAR(255) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    question_id VARCHAR(255) NOT NULL,
    answer_index INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_answer (classroom_id, student_id, question_id),
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
);
```

---

## Implementation Checklist

- [ ] Configure CORS to allow frontend requests
- [ ] Implement JWT authentication (Spring Security + JWT)
- [ ] Set up password encryption (BCrypt)
- [ ] Create database tables (users, categories, questions, classrooms, student_answers)
- [ ] Implement Authentication endpoints (register, login, profile)
- [ ] Implement Category endpoints
- [ ] Implement Question endpoints (support unlimited questions)
- [ ] Implement Classroom creation
- [ ] Implement Classroom retrieval (by code and ID)
- [ ] Implement Student Answer submission
- [ ] Implement Answer retrieval
- [ ] Implement End Exam functionality
- [ ] Implement Results calculation
- [ ] Implement Progress monitoring
- [ ] Add error handling and validation
- [ ] Test all endpoints with the frontend

---

## Frontend Configuration

The frontend API service is located at `/src/app/services/api.ts`. The base URL is already configured to `http://localhost:8080`. Once your backend is running, the app will automatically use the real API instead of mock data.

**No changes needed** in the frontend code - it will seamlessly switch from mock data to real API responses.

---

## Notes

1. **Authentication**: This guide assumes no authentication. If you add authentication, include JWT tokens in request headers.

2. **Error Handling**: All endpoints should return appropriate HTTP status codes:
   - `200 OK` - Successful GET/PUT/DELETE
   - `201 Created` - Successful POST
   - `400 Bad Request` - Invalid input
   - `404 Not Found` - Resource not found
   - `500 Internal Server Error` - Server error

3. **Question Shuffling**: The frontend handles question and answer shuffling for each student. The backend only needs to return questions in their original order.

4. **Real-time Updates**: Consider implementing WebSocket support for live progress updates instead of polling.

5. **Scalability**: For production, consider implementing pagination for large result sets.

---

## Support

If you encounter any issues while implementing these endpoints, check:
1. CORS configuration is correct
2. Content-Type headers are set to `application/json`
3. Response format matches the examples exactly
4. Database schema matches the data models

The frontend will fall back to mock data if API calls fail, so you can develop incrementally.