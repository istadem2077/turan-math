package com.istadem2077.turan_math.entity;

import com.istadem2077.turan_math.model.json.QuestionOption;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.List;

@Entity
@Table(name = "questions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Question {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(nullable = false, name = "category")
    private String category;

    @Column(name = "difficulty_level")
    private Integer difficultyLevel;

    @Column(columnDefinition = "TEXT", nullable = false, name = "content")
    private String content;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", name = "options")
    private List<QuestionOption> options;

    @Column(nullable = false, name = "correct_option_key")
    private String correctOptionKey;
}
