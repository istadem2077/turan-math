package com.istadem2077.turan_math.repository;

import com.istadem2077.turan_math.entity.ExamSubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExamSubmissionRepository extends JpaRepository<ExamSubmission, Long> {
    Optional<ExamSubmission> findByClassroomIdAndStudentId(Long classroomId, Long studentId);

    List<ExamSubmission> findByClassroomId(Long classroomId);
}
