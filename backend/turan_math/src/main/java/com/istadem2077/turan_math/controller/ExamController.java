package com.istadem2077.turan_math.controller;

import com.istadem2077.turan_math.service.ExamService;
import com.istadem2077.turan_math.dto.ExamDTOs.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exam")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class ExamController {

    private final ExamService examService;

    @PostMapping("/start")
    public ResponseEntity<ExamStartResponse> startExam(@RequestBody StartExamRequest request) {
        return ResponseEntity.ok(
                examService.startExam(request.accessCode(), request.email())
        );
    }

    @PostMapping("/submit")
    public ResponseEntity<ScoreDTO> submitExam(@RequestBody SubmitExamRequest request) {
        return ResponseEntity.ok(
                examService.submitExam(request)
        );
    }
}
