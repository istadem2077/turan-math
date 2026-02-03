package com.istadem2077.turan_math.repository;

import com.istadem2077.turan_math.entity.ExamAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExamAnswerRepository extends JpaRepository<ExamAnswer, Long> {
    List<ExamAnswer> findBySubmissionId(Long id);
}
