package com.istadem2077.turan_math.dto;

import java.time.LocalDateTime;
import java.util.List;

public class ExamDTOs {

    // REQUEST: Student starts an exam
    public record StartExamRequest(
            String accessCode,
            String email
    ) {}

    // RESPONSE: The exam payload (Questions WITHOUT answers)
    public record ExamStartResponse(
            Long classroomId,
            String title,
            int durationMinutes,
            LocalDateTime submissionStartTime,
            List<QuestionDTO> questions
    ) {}

    // HELPER: Individual Question structure for the frontend
    public record QuestionDTO(
            Long id,
            String content,
            List<Object> options
    ) {}

    // REQUEST: Student submits answers
    public record SubmitExamRequest(
            Long submissionId,
            List<AnswerDTO> answers
    ) {}

    // HELPER: Individual Answer submission
    public record AnswerDTO(
            Long questionId,
            String selectedKey
    ) {}

    // RESPONSE: Final Score
    public record ScoreDTO(
            int score,
            int totalQuestions,
            String status
    ) {}

    public record StudentResultResponse(
            String studentName,
            String studentEmail,
            int score,
            int totalQuestions,
            List<AnswerDetailDTO> answers
    ) {}

    public record AnswerDetailDTO(
            Long questionId,
            String questionContent,
            String selectedKey,
            String correctKey,
            boolean isCorrect
    ) {}
}
