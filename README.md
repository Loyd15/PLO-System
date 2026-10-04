# PLO Assessment Survey System

A web-based survey system for Program Learning Outcome (PLO) assessments built with **Django (Python)**, **MySQL**, and custom **HTML/CSS/JavaScript** reproducing the exact wireframe design and UX flow.

---

## Tech Stack

- **Backend**: Django 5.2 LTS (Python 3.14)
- **Frontend**: Django Templates + Custom HTML5 & CSS3 + Vanilla JavaScript (cascading dropdowns, interactive rating buttons, multi-step progress bar)
- **Database**: MySQL 8.0 (Schema: `plo_system`)
- **Future Integration Ready**: `qrcode` (QR distribution), `pandas` (report calculations), `openpyxl` (Excel export), `WeasyPrint` (PDF generation), `Chart.js` (browser charting)

---

## Key Features & Business Logic

### 1. Multi-Step Assessment Workflow
- **Step 0 - Evaluator & Program Details**:
  - **Cascading Dropdowns**: Select College &rarr; Department &rarr; Degree Level (Undergraduate, Graduate Studies, Senior High School) &rarr; Degree Program (loads dynamically from the 391 academic degrees).
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
  - Optional general feedback / comments textarea.
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
   - Supported via the many-to-many `question_plo` bridge table. When a question is linked to multiple PLOs (e.g. `PLO 1` and `PLO 3`), both PLO badges are displayed on the question card and tracked in evaluation reports.

---

## Database Configuration

The system connects to MySQL using the credentials in `config/settings.py` (or environment variables):

```env
DB_NAME=plo_system
DB_USER=root
DB_PASSWORD=password
DB_HOST=127.0.0.1
DB_PORT=3306
```

---

## How to Run

1. **Activate Virtual Environment**:
   ```powershell
   .venv\Scripts\Activate.ps1
   ```

2. **Sync PLOs to Questions** (Optional / One-time):
   ```powershell
   python manage.py sync_plo_questions
   ```

3. **Run the Development Server**:
   ```powershell
   python manage.py runserver
   ```
   Open your browser at: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)

4. **Run Automated Tests**:
   ```powershell
   python manage.py test surveys
   ```

---

## Production Deployment Guide

The application is fully configured for production deployment using industry best practices.

### 1. Configure `.env`
Copy the provided template to create your `.env` file:
```powershell
copy .env.example .env
```
Inside `.env`, configure:
- `DJANGO_DEBUG=False`
- `DJANGO_SECRET_KEY`: Set a long random string.
- `DJANGO_ALLOWED_HOSTS`: Set your server's domain/IP.
- `DB_*`: Set your production MySQL credentials.

### 2. Run in Production (3 Options)

#### Option A: Windows Server (Waitress WSGI)
Double-click `start_production.bat` or run:
```powershell
.\.venv\Scripts\waitress-serve.exe --listen=0.0.0.0:8000 --threads=8 config.wsgi:application
```

#### Option B: Linux Server (Gunicorn WSGI)
```bash
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --threads 2
```

#### Option C: Docker & Docker Compose (One-Click)
```bash
docker compose up -d
```

### 3. Static Files in Production
WhiteNoise is pre-configured to automatically serve compressed (gzip/brotli), cached static files directly through the WSGI server. Run:
```powershell
python manage.py collectstatic --noinput
```

---

## File Structure

```
├── config/                  # Django project settings and root routing
│   ├── settings.py          # Production & dev settings (WhiteNoise, env vars)
│   ├── urls.py              # Root URL routing
│   └── wsgi.py
├── surveys/                 # Core survey app
│   ├── models.py            # Degree, Respondent, Assessment, Plo, Question, Answer
│   ├── views.py             # Form, API, Submit, Thanks, Results views
│   ├── services.py          # Business logic: hierarchy, question mapping, transaction save
│   ├── urls.py              # Survey route patterns
│   └── tests.py             # Unit and integration test suite
├── static/
│   ├── css/survey.css       # Wireframe styles, colors (#1F4D3A), responsive layout
│   └── js/survey.js         # Cascading selects, rating buttons, validation, review wizard
├── templates/
│   ├── surveys/             # survey_form, survey_thanks, results_list, results_detail
│   ├── 404.html             # Custom branded 404 error page
│   └── 500.html             # Custom branded 500 error page
├── .env.example             # Production environment variables template
├── Dockerfile               # Production Docker container definition
├── docker-compose.yml       # 1-click Docker orchestration (App + MySQL)
├── start_production.bat     # 1-click Windows production launcher
└── requirements.txt         # Dependencies (Django, PyMySQL, WhiteNoise, Gunicorn, Waitress)
```
