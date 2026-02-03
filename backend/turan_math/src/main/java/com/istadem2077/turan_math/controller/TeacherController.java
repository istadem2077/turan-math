package com.istadem2077.turan_math.controller;

import com.istadem2077.turan_math.dto.ClassroomDTOs.*;
import com.istadem2077.turan_math.dto.ExamDTOs.*;
import com.istadem2077.turan_math.entity.Classroom;
import com.istadem2077.turan_math.service.ClassroomService;
import com.istadem2077.turan_math.service.ExamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/teacher")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class TeacherController {

    private final ClassroomService classroomService;
    private final ExamService examService;

    @PostMapping("/{teacherId}/classroom")
    public ResponseEntity<ClassroomResponse> createClassroom(
            @PathVariable Long teacherId,
            @RequestBody CreateClassroomRequest request) {

        Classroom classroom = classroomService.createClassroom(teacherId, request);
        return ResponseEntity.ok(mapToResponse(classroom));
    }

    @GetMapping("/{teacherId}/classrooms")
    public ResponseEntity<List<ClassroomResponse>> getTeacherClassrooms(@PathVariable Long teacherId) {
        List<Classroom> classrooms = classroomService.findClassroomsByTeacherId(teacherId);

        List<ClassroomResponse> response = classrooms.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{teacherId}/classroom/{classroomId}/results")
    public ResponseEntity<List<StudentResultResponse>> getClassroomResults(
            @PathVariable Long teacherId,
            @PathVariable Long classroomId) {

        List<StudentResultResponse> results = examService.getClassroomResults(classroomId);
        return ResponseEntity.ok(results);
    }

    // Helper mapper to avoid recursion
    private ClassroomResponse mapToResponse(Classroom c) {
        return new ClassroomResponse(
                c.getId(),
                c.getTeacher().getId(),
                c.getTitle(),
                c.getAccessCode(),
                c.getDurationMinutes(),
                c.getIsActive(),
                c.getRegisteredStudents() != null ? c.getRegisteredStudents().size() : 0
        );
    }
}
