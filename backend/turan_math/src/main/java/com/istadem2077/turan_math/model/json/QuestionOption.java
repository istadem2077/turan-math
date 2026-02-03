package com.istadem2077.turan_math.model.json;

import java.io.Serializable;

// This maps to the JSON inside the database: [{"key": "A", "text": "42"}]
public record QuestionOption(String key, String text) implements Serializable {}