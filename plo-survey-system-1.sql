CREATE SCHEMA IF NOT EXISTS plo_system;
USE plo_system;

CREATE TABLE `degree` (
    `degree_id`      INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `college`        VARCHAR(150) NOT NULL,
    `department`     VARCHAR(150) NOT NULL,
    `degree_level`   VARCHAR(10)  NOT NULL,   -- 'UG' undergraduate, 'GS' graduate studies, 'SHS' senior high school
    `degree_program` VARCHAR(300) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `assessment_role` (
    `role_id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name`    VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `respondent` (
    `respondent_id`  INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `degree_id`      INT UNSIGNED NOT NULL,
    `student_number` VARCHAR(30)  NOT NULL,
    `name`           VARCHAR(150) NOT NULL,
    `program_year`   VARCHAR(20)  NOT NULL,
    CONSTRAINT `respondent_degree_id_foreign`
        FOREIGN KEY (`degree_id`) REFERENCES `degree`(`degree_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `assessment` (
    `assessment_id`   INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `respondent_id`   INT UNSIGNED NOT NULL,
    `role_id`         INT UNSIGNED NOT NULL,
    `assessment_date` DATETIME     NOT NULL,
    `evaluator_name`  VARCHAR(150) NULL,
    `basis`           VARCHAR(100) NULL,
    `general_comment` TEXT         NULL,
    CONSTRAINT `assessment_respondent_id_foreign`
        FOREIGN KEY (`respondent_id`) REFERENCES `respondent`(`respondent_id`),
    CONSTRAINT `assessment_role_id_foreign`
        FOREIGN KEY (`role_id`) REFERENCES `assessment_role`(`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `plo` (
    `plo_id`      INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `degree_id`   INT UNSIGNED NOT NULL,
    `code`        VARCHAR(20)  NOT NULL,   -- e.g. 'PLO 01'
    `description` TEXT         NOT NULL,
    UNIQUE KEY `plo_degree_code_unique` (`degree_id`, `code`),
    CONSTRAINT `plo_degree_id_foreign`
        FOREIGN KEY (`degree_id`) REFERENCES `degree`(`degree_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Approval / submitter details that came with each PLO set in PLOs.xlsx.
-- Optional: drop this table (and its INSERT in plo-survey-data.sql) if you don't need it.
CREATE TABLE `plo_submission` (
    `submission_id`         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `degree_id`             INT UNSIGNED NOT NULL,
    `source_unit_department` VARCHAR(250) NOT NULL,   -- "College | Department" as written in the form
    `source_level`          VARCHAR(60)  NOT NULL,    -- level label as written in the form
    `source_program_name`   VARCHAR(300) NOT NULL,    -- program name as written in the form
    `effectivity`           VARCHAR(100) NOT NULL,    -- e.g. 'AY 2026-2027, Term 1'
    `approving_authority`   VARCHAR(150) NOT NULL,    -- department chair / approving authority
    `completed_by_role`     VARCHAR(150) NOT NULL,
    `submitter_name`        VARCHAR(150) NOT NULL,
    `submitted_at`          DATETIME     NOT NULL,
    `document_url`          VARCHAR(500) NULL,
    UNIQUE KEY `plo_submission_degree_unique` (`degree_id`),
    CONSTRAINT `plo_submission_degree_id_foreign`
        FOREIGN KEY (`degree_id`) REFERENCES `degree`(`degree_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- A question is no longer tied to a degree or a single PLO.
-- If a PLO is itself the question, create a question row whose text is the
-- PLO statement and link it to that PLO in question_plo.
CREATE TABLE `question` (
    `question_id`   INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `question_text` TEXT         NOT NULL,
    `is_active`     BOOLEAN      NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Many-to-many: a question can sit under several PLOs.
CREATE TABLE `question_plo` (
    `question_id` INT UNSIGNED NOT NULL,
    `plo_id`      INT UNSIGNED NOT NULL,
    PRIMARY KEY (`question_id`, `plo_id`),
    KEY `question_plo_plo_id_index` (`plo_id`),
    CONSTRAINT `question_plo_question_id_foreign`
        FOREIGN KEY (`question_id`) REFERENCES `question`(`question_id`) ON DELETE CASCADE,
    CONSTRAINT `question_plo_plo_id_foreign`
        FOREIGN KEY (`plo_id`) REFERENCES `plo`(`plo_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `answer` (
    `answer_id`     INT UNSIGNED      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `assessment_id` INT UNSIGNED      NOT NULL,
    `question_id`   INT UNSIGNED      NOT NULL,
    `rating`        SMALLINT UNSIGNED NULL,   -- 1..5 scale, or 0/NULL for not enough info
    `comment`       TEXT              NULL,   -- optional, e.g. why a rating is low
    UNIQUE KEY `answer_assessment_question_unique` (`assessment_id`, `question_id`),
    KEY `answer_question_id_index` (`question_id`),
    CONSTRAINT `answer_rating_range` CHECK (`rating` IS NULL OR (`rating` BETWEEN 0 AND 5)),
    CONSTRAINT `answer_assessment_id_foreign`
        FOREIGN KEY (`assessment_id`) REFERENCES `assessment`(`assessment_id`) ON DELETE CASCADE,
    CONSTRAINT `answer_question_id_foreign`
        FOREIGN KEY (`question_id`) REFERENCES `question`(`question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed roles from the wireframe
INSERT INTO `assessment_role` (`name`) VALUES
    ('Thesis adviser'),
    ('Capstone project mentor'),
    ('Internship host / supervisor'),
    ('Student (rating myself)');
