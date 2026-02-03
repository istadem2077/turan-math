package com.istadem2077.turan_math.service;

import com.istadem2077.turan_math.entity.*;
import com.istadem2077.turan_math.repository.*;
import com.istadem2077.turan_math.dto.ClassroomDTOs.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class ClassroomService {
    private final ClassroomRepository classroomRepository;
    private final QuestionRepository questionRepository;
    private final TeacherRepository teacherRepository;

    // REMOVED internal record CreateClassroomRequest (Conflicted with DTO)

    @Transactional
    public Classroom createClassroom(Long teacherId, CreateClassroomRequest request) {
        Teacher teacher = teacherRepository.findById(teacherId)
                .orElseThrow(() -> new RuntimeException("Teacher not found"));

        List<Question> masterList = new ArrayList<>();

        request.categoryCounts().forEach((category, count) -> {
            List<Question> randomQuestions = questionRepository
                    .findRandomByCategory(category, count);

            if (randomQuestions.size() < count) {
                throw new RuntimeException("Not enough questions in bank for category: " + category);
            }
            masterList.addAll(randomQuestions);
        });

        Classroom classroom = Classroom.builder()
                .teacher(teacher)
                .title(request.title())
                .durationMinutes(request.durationMinutes())
                .accessCode(generateUniqueCode())
                .isActive(true)
                .questions(masterList)
                .build();

        return classroomRepository.save(classroom);
    }

    public List<Classroom> findClassroomsByTeacherId(Long teacherId) {
        return classroomRepository.findByTeacherId(teacherId);
    }

    private String generateUniqueCode() {
        String code;
        do {
            code = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        } while (classroomRepository.findByAccessCode(code).isPresent());
        return code;
    }
}
