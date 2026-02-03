package com.istadem2077.turan_math.dto;

import java.util.List;
import java.util.Map;

public class ClassroomDTOs {

    // Request from Teacher to create a class
    // Request from Teacher to create a class
    public record CreateClassroomRequest(
            String title,
            int durationMinutes,
            Map<String, Integer> categoryCounts // e.g., "Math": 10
    ) {}

    // NEW: Response DTO to avoid Infinite Recursion (Teacher -> Classroom -> Teacher)
    public record ClassroomResponse(
            Long id,
            Long teacherId,
            String title,
            String accessCode,
            int durationMinutes,
            boolean isActive,
            int studentCount // Optional handy stat
    ) {}
}
