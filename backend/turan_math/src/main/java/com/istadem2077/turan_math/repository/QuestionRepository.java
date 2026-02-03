package com.istadem2077.turan_math.repository;

import com.istadem2077.turan_math.entity.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuestionRepository extends JpaRepository<Question, Long> {
    @Query (value = "SELECT * FROM questions q " +
                    "WHERE q.category = :category " +
                    "ORDER BY RANDOM() " +
                    "LIMIT :limit",
            nativeQuery = true
    )
    List<Question> findRandomByCategory(@Param("category") String category, @Param("limit") Integer limit);
}
