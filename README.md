# PLO Assessment Survey System

A web-based survey system for Program Learning Outcome (PLO) assessments built with **Django (Python)**, **MySQL**, and custom **HTML/CSS/JavaScript** reproducing the exact wireframe design and UX flow.

---

## Tech Stack

- **Backend**: Django 5.2 LTS (Python 3.11+)
- **Frontend**: Django Templates + Custom HTML5 & CSS3 + Vanilla JavaScript (informed consent modal, cascading dropdowns, interactive rating buttons, multi-step progress bar)
- **Database**: MySQL 8.0+ (`plo_system` database)
- **Future Integration Ready**: `qrcode` (QR distribution), `pandas` (report calculations), `openpyxl` (Excel export), `WeasyPrint` (PDF generation), `Chart.js` (browser charting)

---

## Key Features & Business Logic

### 1. Multi-Step Assessment Workflow
- **Informed Consent & Data Privacy Popup**:
  - Displays De La Salle University's Informed Consent and Data Privacy notice before starting the survey, requiring explicit toggle agreement.
- **Step 0 - Evaluator & Program Details**:
  - **Cascading Dropdowns**: Select College &rarr; Department &rarr; Degree Level (Undergraduate, Graduate Studies, Senior High School) &rarr; Degree Program (automatically filters out programs/departments/colleges that do not have PLOs).
  - **Evaluator Role**: Thesis adviser, Capstone project mentor, Internship host / supervisor, Student (rating myself).
  - **Assessment Basis**: Pre-selected based on the evaluator's role (Thesis, Capstone project, Internship), editable as needed.
  - **Student Details**: Student's full name, 8-digit student ID number (with instant client-side format validation), and academic year started. (Automatically simplifies when role is student self-rating).
  - **Pre-fill / Direct Links**: Accepts URL parameters (e.g. `/?degree_id=45&role_id=1`) for direct QR code scanning or evaluating a cohort of students consecutively.
- **Step 1..N - Outcome Rating Steps**:
  - Segmented progress bar tracking each question step.
  - **5-Point Scale**:
    1. Far from being achieved
    2. Slightly achieved, needs major intervention
    3. Somewhat achieved, needs minor intervention
    4. Achieved
    5. Exceeded
  - **Not Enough Info / Experience**: Selectable when evaluator cannot rate an outcome.
  - **Conditional Required Explanation**: Smoothly reveals a required text explanation if a rating is 1, 2, or 3, or if "Not enough info/experience" is selected.
- **Step Review - Summary & Edits**:
  - Summary cards for both details and all outcome ratings.
  - Interactive "Edit" buttons allowing the evaluator to jump directly to any previous question to revise answers without losing progress.
  - Optional general feedback / comments textarea (unified non-resizable 3+ line input).
  - Confirmation and secure submission.
- **Thank You / Submission Screen**:
  - Confirmation banner with student program and school year.
  - "Rate another student" button preserving evaluator role and program for rapid batch evaluations.

---

### 2. Flexible PLO & Question Mapping

The database schema and service layer support both cases specified:
1. **The Question is the PLO Itself**:
   - For degree programs where the questions directly evaluate the PLO statements, the system automatically retrieves or initializes a `question` record with the PLO description text and links it in `question_plo`.
2. **A Question Belongs to Several PLOs**:
   - Supported via the many-to-many `question_plo` bridge table. When a question is linked to multiple PLOs (e.g. `PLO 01` and `PLO 03`), both PLO badges are displayed on the question card and tracked in evaluation reports.

---

## Database Setup & Running the Project

### 1. MySQL Database Initialization
Run the schema and seed data scripts in MySQL:
```bash
mysql -u root -p < plo-survey.sql
mysql -u root -p plo_system < plo-survey-data.sql
```

### 2. Configure Database Credentials
Create or edit `.env` in the root folder `PLO-System-main/` to match your local MySQL setup:
```env
DJANGO_SECRET_KEY=django-insecure-plo-survey-system-dev-key-2026
DJANGO_DEBUG=True
DB_NAME=plo_system
DB_USER=root
DB_PASSWORD=password
DB_HOST=127.0.0.1
DB_PORT=3306
```

### 3. Sync Django Tables & PLO Questions
Activate the virtual environment and run migrations + the sync command:
```powershell
.\.venv\Scripts\Activate.ps1
python manage.py migrate
python manage.py sync_plo_questions
```

### 4. Start the Development Server
```powershell
python manage.py runserver
```
Open your browser at: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)

### 5. Run on Debian / Linux
- **With Docker Compose (includes MySQL 8.0 container)**:
  ```bash
  docker compose up -d --build
  ```
- **With Native MySQL & Launcher Script**:
  ```bash
  chmod +x start_debian.sh
  ./start_debian.sh
  ```

---

## File Structure

```
├── config/                  # Django project settings and root routing
│   ├── settings.py          # MySQL & production settings (WhiteNoise)
│   ├── urls.py              # Root URL routing
│   └── wsgi.py
├── surveys/                 # Core survey app
│   ├── models.py            # Degree, Respondent, Assessment, Plo, Question, Answer
│   ├── views.py             # Form, API, Submit, Thanks, Results views
│   ├── services.py          # Business logic: hierarchy, question mapping, transaction save
│   ├── urls.py              # Survey route patterns
│   └── tests.py             # Unit and integration test suite
├── static/
│   ├── css/survey.css       # Styles, consent modal, colors (#1F4D3A), responsive layout
│   ├── images/dlsu-logo.png # De La Salle University seal icon
│   └── js/survey.js         # Consent modal, cascading selects, rating buttons, review wizard
├── templates/
│   ├── surveys/             # survey_form, survey_thanks, results_list, results_detail
│   ├── 404.html             # Custom branded 404 error page
│   └── 500.html             # Custom branded 500 error page
├── plo-survey.sql           # MySQL schema definition
├── plo-survey-data.sql      # Master seed dataset (391 degrees, 464 PLOs)
├── start_debian.sh          # Debian / Ubuntu Linux setup & launcher
├── start_production.bat     # 1-click Windows production launcher
├── Dockerfile               # Docker container definition
├── docker-compose.yml       # Docker Compose orchestration with MySQL 8.0
└── requirements.txt         # Dependencies (Django, PyMySQL, WhiteNoise, Gunicorn, Waitress)
```

