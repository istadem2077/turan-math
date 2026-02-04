package com.istadem2077.turan_math.service;

import com.istadem2077.turan_math.dto.ExamDTOs.*;

import com.istadem2077.turan_math.entity.*;
import com.istadem2077.turan_math.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExamService {
    private final ClassroomRepository classroomRepository;
    private final StudentRepository studentRepository;
    private final ExamSubmissionRepository submissionRepository;
    private final QuestionRepository questionRepository;
    private final ExamAnswerRepository examAnswerRepository;

    @Transactional
    public ExamStartResponse startExam(String accessCode, String studentEmail) {
        // 1. Find Classroom (Performance fix: Ensure questions are fetched eagerly if needed)
        // Using standard findByAccessCode. If Lazy loading causes issues, use "JOIN FETCH" query in Repo.
        Classroom classroom = classroomRepository.findByAccessCode(accessCode)
                .orElseThrow(() -> new RuntimeException("Invalid Code"));

        if (!Boolean.TRUE.equals(classroom.getIsActive())) {
            throw new RuntimeException("This exam is not currently active.");
        }

        Student student = studentRepository.findByEmail(studentEmail)
                .orElseThrow(() -> new RuntimeException("Student not registered"));

        boolean isRegistered = classroom.getRegisteredStudents().stream()
                .anyMatch(s -> s.getId().equals(student.getId()));

        if (!isRegistered) {
            throw new RuntimeException("You are not registered for this classroom.");
        }

        // 2. Initialize Submission
        ExamSubmission submission = submissionRepository
                .findByClassroomIdAndStudentId(classroom.getId(), student.getId())
                .orElseGet(() -> {
                    ExamSubmission newSub = ExamSubmission.builder()
                            .classroom(classroom)
                            .student(student)
                            .startTime(LocalDateTime.now())
                            .status(ExamSubmission.SubmissionStatus.IN_PROGRESS)
                            .build();
                    return submissionRepository.save(newSub);
                });

        if (submission.getStatus() == ExamSubmission.SubmissionStatus.COMPLETED) {
            throw new RuntimeException("You have already completed this exam.");
        }

        // 3. Shuffle Questions
        List<Question> questions = new ArrayList<>(classroom.getQuestions());
        Collections.shuffle(questions);

        // 4. Map to DTO
        List<QuestionDTO> questionDTOs = questions.stream().map(q ->
                new QuestionDTO(q.getId(), q.getContent(), (List) q.getOptions())
        ).collect(Collectors.toList());

        return new ExamStartResponse(
                classroom.getId(),
                classroom.getTitle(),
                classroom.getDurationMinutes(),
                submission.getStartTime(),
                questionDTOs
        );
    }

    @Transactional
    public ScoreDTO submitExam(SubmitExamRequest request) {
        ExamSubmission submission = submissionRepository.findById(request.submissionId())
                .orElseThrow(() -> new RuntimeException("Submission not found"));

        if (submission.getStatus() == ExamSubmission.SubmissionStatus.COMPLETED) {
            throw new RuntimeException("Exam already submitted.");
        }

        // Timer Check
        LocalDateTime timeLimit = submission.getStartTime()
                .plusMinutes(submission.getClassroom().getDurationMinutes())
                .plusMinutes(2); // Grace period

        if (LocalDateTime.now().isAfter(timeLimit)) {
             throw new RuntimeException("Time limit exceeded");
        }

        // SECURITY: Whitelist Valid Question IDs for this Class
        Set<Long> validQuestionIds = submission.getClassroom().getQuestions().stream()
                .map(Question::getId)
                .collect(Collectors.toSet());

        // Fetch Questions submitted
        List<Long> incomingIds = request.answers().stream()
                .map(AnswerDTO::questionId)
                .collect(Collectors.toList());

        Map<Long, Question> questionMap = questionRepository.findAllById(incomingIds)
                .stream()
                .collect(Collectors.toMap(Question::getId, Function.identity()));

        int totalScore = 0;
        List<ExamAnswer> answerLog = new ArrayList<>();

        for (AnswerDTO answerDTO : request.answers()) {
            // Security check: Is this question actually in this exam?
            if (!validQuestionIds.contains(answerDTO.questionId())) {
                continue; // Ignore injected questions
            }

            Question question = questionMap.get(answerDTO.questionId());
            if (question == null) continue;

            // Simple Key comparison (A == A)
            // Note: DB correct key is Integer in your Entity, make sure types match!
            // If DB is String "A", Entity should be String.
            // Your DDL said VARCHAR, but Entity said Integer. Assuming String for now.
            boolean isCorrect = question.getCorrectOptionKey().trim().equalsIgnoreCase(answerDTO.selectedKey().trim());

            if (isCorrect) totalScore++;

            ExamAnswer examAnswer = ExamAnswer.builder()
                    .submission(submission)
                    .question(question)
                    .selectedOptionKey(answerDTO.selectedKey())
                    .isCorrect(isCorrect)
                    .build();

            answerLog.add(examAnswer);
        }

        examAnswerRepository.saveAll(answerLog);

        submission.setTotalScore(totalScore);
        submission.setSubmitTime(LocalDateTime.now());
        submission.setStatus(ExamSubmission.SubmissionStatus.COMPLETED);
        submissionRepository.save(submission);

        return new ScoreDTO(
                totalScore,
                validQuestionIds.size(),
                "COMPLETED"
        );
    }

    @Transactional
    public List<StudentResultResponse> getClassroomResults(Long classroomId) {
        // 1. Fetch all submissions for the classroom
        // You might need to add 'List<ExamSubmission> findByClassroomId(Long id)' to ExamSubmissionRepository
        List<ExamSubmission> submissions = submissionRepository.findByClassroomId(classroomId);

        return submissions.stream().map(submission -> {
            // 2. Fetch answers for each submission
            // You might need to add 'List<ExamAnswer> findBySubmissionId(Long id)' to ExamAnswerRepository
            List<ExamAnswer> answers = examAnswerRepository.findBySubmissionId(submission.getId());

            List<AnswerDetailDTO> answerDetails = answers.stream().map(a -> new AnswerDetailDTO(
                    a.getQuestion().getId(),
                    a.getQuestion().getContent(),
                    a.getSelectedOptionKey(),
                    a.getQuestion().getCorrectOptionKey(),
                    a.getIsCorrect()
            )).collect(Collectors.toList());

            return new StudentResultResponse(
                    submission.getStudent().getFullName(),
                    submission.getStudent().getEmail(),
                    submission.getTotalScore(),
                    submission.getClassroom().getQuestions().size(),
                    answerDetails
            );
        }).collect(Collectors.toList());
    }
}
