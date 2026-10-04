from django.db import transaction
from django.utils import timezone
from .models import Degree, AssessmentRole, Respondent, Assessment, Plo, Question, QuestionPlo, Answer


def get_degree_hierarchy():
    """
    Returns the college -> department -> degree programs tree.
    """
    degrees = Degree.objects.all().order_by('college', 'department', 'degree_program')
    hierarchy = {}
    for deg in degrees:
        c = deg.college
        d = deg.department
        if c not in hierarchy:
            hierarchy[c] = {}
        if d not in hierarchy[c]:
            hierarchy[c][d] = []
        hierarchy[c][d].append({
            'degree_id': deg.degree_id,
            'degree_program': deg.degree_program,
            'degree_level': deg.degree_level,
        })
    return hierarchy


def get_survey_questions_for_degree(degree):
    """
    Retrieves questions for the given degree.
    - If specific questions are already linked to the degree's PLOs via QuestionPlo, return them.
    - Otherwise, since 'sometimes the question is the PLO itself', automatically ensure each PLO
      has a Question row with question_text = plo.description, and link it in QuestionPlo.
    Each returned question object is annotated with its related PLO codes for this degree.
    """
    plos = list(Plo.objects.filter(degree=degree).order_by('plo_id'))
    if not plos:
        return []

    # Check if any active questions are linked to these PLOs
    existing_questions = (
        Question.objects.filter(plos__in=plos, is_active=True)
        .distinct()
        .prefetch_related('plos')
        .order_by('question_id')
    )

    if existing_questions.exists():
        question_list = list(existing_questions)
    else:
        # The question is the PLO itself: create or link Question for each PLO
        question_list = []
        for plo in plos:
            # Check if there is already a Question with this text
            q = Question.objects.filter(plos=plo, question_text=plo.description).first()
            if not q:
                q = Question.objects.create(question_text=plo.description, is_active=True)
                QuestionPlo.objects.get_or_create(question=q, plo=plo)
            question_list.append(q)

    # Attach PLO metadata specific to this degree for display
    plo_map = {p.plo_id: p for p in plos}
    results = []
    for q in question_list:
        # Find which PLOs of THIS degree this question links to (handles many-to-many!)
        q_plos = [p for p in q.plos.all() if p.degree_id == degree.degree_id]
        if not q_plos:
            # fallback if not yet prefetched
            q_plos = list(q.plos.filter(degree=degree))
        
        plo_codes = [p.code for p in q_plos]
        results.append({
            'question_id': q.question_id,
            'question_text': q.question_text,
            'plo_codes': plo_codes,
            'plo_codes_display': ", ".join(plo_codes) if plo_codes else "General PLO",
            'is_plo_itself': len(q_plos) == 1 and q.question_text == q_plos[0].description,
        })
    return results


@transaction.atomic
def process_survey_submission(data):
    """
    Validates and stores the survey response:
    - Creates or updates Respondent
    - Creates Assessment
    - Creates Answer records for each question
    """
    degree_id = data.get('degree_id')
    degree = Degree.objects.get(degree_id=degree_id)

    role_id = data.get('role_id')
    role = AssessmentRole.objects.get(role_id=role_id)

    evaluator_name = (data.get('evaluator_name') or '').strip()
    student_name = (data.get('student_name') or '').strip()
    student_number = (data.get('student_number') or '').strip()
    program_year = (data.get('program_year') or '').strip()
    basis = (data.get('basis') or '').strip()
    general_comment = (data.get('general_comment') or '').strip()

    # If student rating themselves, student_name is evaluator_name if not provided
    if role.name == 'Student (rating myself)' and not student_name:
        student_name = evaluator_name

    # Create or update Respondent
    respondent, created = Respondent.objects.get_or_create(
        student_number=student_number,
        degree=degree,
        defaults={
            'name': student_name,
            'program_year': program_year,
        }
    )
    if not created and student_name and respondent.name != student_name:
        respondent.name = student_name
        respondent.program_year = program_year
        respondent.save(update_fields=['name', 'program_year'])

    # Create Assessment
    assessment = Assessment.objects.create(
        respondent=respondent,
        role=role,
        assessment_date=timezone.now(),
        evaluator_name=evaluator_name,
        basis=basis,
        general_comment=general_comment,
    )

    # Save answers
    answers_data = data.get('answers', {})
    reasons_data = data.get('reasons', {})

    created_answers = []
    for q_id_str, rating_val in answers_data.items():
        try:
            q_id = int(q_id_str)
            question = Question.objects.get(question_id=q_id)
        except (ValueError, Question.DoesNotExist):
            continue

        # rating_val can be 1..5, or None/0 for "Not enough info"
        rating = None
        if rating_val is not None and str(rating_val).isdigit():
            r = int(rating_val)
            if 1 <= r <= 5:
                rating = r
            elif r == 0:
                rating = 0

        comment = reasons_data.get(str(q_id)) or reasons_data.get(q_id) or ''
        comment = comment.strip() if comment else None

        ans = Answer.objects.create(
            assessment=assessment,
            question=question,
            rating=rating,
            comment=comment
        )
        created_answers.append(ans)

    return assessment
