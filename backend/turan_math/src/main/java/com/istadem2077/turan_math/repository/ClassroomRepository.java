package com.istadem2077.turan_math.repository;

import com.istadem2077.turan_math.entity.Classroom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
@Repository
public interface ClassroomRepository extends JpaRepository<Classroom, Long> {
    // Standard fetch (Lazy questions)
    Optional<Classroom> findByAccessCode(String accessCode);

    // Optimized fetch (Eager questions) - Use this in startExam if LazyExceptions occur
    @Query("SELECT c FROM Classroom c LEFT JOIN FETCH c.questions WHERE c.accessCode = :accessCode")
    Optional<Classroom> findByAccessCodeWithQuestions(@Param("accessCode") String accessCode);

    boolean existsByAccessCode(String accessCode);

    List<Classroom> findByTeacherId(Long teacherId);
}
