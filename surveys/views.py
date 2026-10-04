import json
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.http import require_http_methods
from django.db.models import Avg, Count, Q
from .models import Degree, AssessmentRole, Assessment, Answer
from .services import get_degree_hierarchy, get_survey_questions_for_degree, process_survey_submission


def get_academic_years():
    return [
        'AY 2026–2027',
        'AY 2025–2026',
        'AY 2024–2025',
        'AY 2023–2024',
        'AY 2022–2023',
        'AY 2021–2022',
        'AY 2020–2021',
        'Earlier than AY 2020–2021',
    ]


def survey_form_view(request):
    """
    Renders the interactive multi-step survey form.
    Pre-populates hierarchy for cascading dropdowns and handles direct degree linking (e.g. from QR codes).
    """
    hierarchy = get_degree_hierarchy()
    roles = list(AssessmentRole.objects.values('role_id', 'name'))
    
    # Check if a degree_id is specified in the query parameters (e.g. ?degree_id=45)
    selected_degree_id = request.GET.get('degree_id')
    selected_role_id = request.GET.get('role_id')
    
    initial_degree = None
    initial_questions = []
    
    if selected_degree_id and selected_degree_id.isdigit():
        try:
            initial_degree = Degree.objects.get(degree_id=int(selected_degree_id))
            initial_questions = get_survey_questions_for_degree(initial_degree)
        except Degree.DoesNotExist:
            pass

    context = {
        'hierarchy_json': json.dumps(hierarchy),
        'roles': roles,
        'academic_years': get_academic_years(),
        'selected_degree_id': int(selected_degree_id) if selected_degree_id and selected_degree_id.isdigit() else '',
        'selected_role_id': int(selected_role_id) if selected_role_id and selected_role_id.isdigit() else '',
        'initial_degree': initial_degree,
        'initial_questions_json': json.dumps(initial_questions),
    }
    return render(request, 'surveys/survey_form.html', context)


def api_questions_for_degree(request):
    """
    AJAX endpoint: returns the questions associated with a degree program.
    """
    degree_id = request.GET.get('degree_id')
    if not degree_id or not degree_id.isdigit():
        return HttpResponseBadRequest("Invalid degree_id")

    try:
        degree = Degree.objects.get(degree_id=int(degree_id))
    except Degree.DoesNotExist:
        return JsonResponse({'error': 'Degree not found', 'questions': []}, status=404)

    questions = get_survey_questions_for_degree(degree)
    return JsonResponse({
        'degree_id': degree.degree_id,
        'degree_program': degree.degree_program,
        'college': degree.college,
        'department': degree.department,
        'questions': questions,
    })


@require_http_methods(["POST"])
def submit_survey_view(request):
    """
    Handles submission of the survey form (both JSON fetch and standard form post).
    """
    if request.content_type == 'application/json':
        try:
            data = json.loads(request.body.decode('utf-8'))
        except Exception as e:
            return JsonResponse({'success': False, 'error': f'Invalid JSON: {str(e)}'}, status=400)
    else:
        # Standard POST form fallback
        data = {
            'degree_id': request.POST.get('degree_id'),
            'role_id': request.POST.get('role_id'),
            'evaluator_name': request.POST.get('evaluator_name'),
            'basis': request.POST.get('basis'),
            'student_name': request.POST.get('student_name'),
            'student_number': request.POST.get('student_number'),
            'program_year': request.POST.get('program_year'),
            'general_comment': request.POST.get('general_comment'),
            'answers': {},
            'reasons': {},
        }
        for key, value in request.POST.items():
            if key.startswith('rating_'):
                q_id = key.replace('rating_', '')
                data['answers'][q_id] = value
            elif key.startswith('reason_'):
                q_id = key.replace('reason_', '')
                data['reasons'][q_id] = value

    try:
        assessment = process_survey_submission(data)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)

    redirect_url = f"/thanks/{assessment.assessment_id}/"
    if request.content_type == 'application/json':
        return JsonResponse({
            'success': True,
            'assessment_id': assessment.assessment_id,
            'redirect_url': redirect_url,
        })
    return redirect(redirect_url)


def survey_thanks_view(request, assessment_id):
    """
    Displays the submission confirmation screen.
    """
    assessment = get_object_or_404(Assessment.objects.select_related('respondent__degree', 'role'), assessment_id=assessment_id)
    context = {
        'assessment': assessment,
        'degree': assessment.respondent.degree,
        'role': assessment.role,
    }
    return render(request, 'surveys/survey_thanks.html', context)


RATING_SCALE = {
    1: {'text': 'Strongly Disagree', 'badge_class': 'badge-rating-1'},
    2: {'text': 'Disagree', 'badge_class': 'badge-rating-2'},
    3: {'text': 'Neutral', 'badge_class': 'badge-rating-3'},
    4: {'text': 'Agree', 'badge_class': 'badge-rating-4'},
    5: {'text': 'Strongly Agree', 'badge_class': 'badge-rating-5'},
}


def results_list_view(request):
    """
    Basic results viewer: Displays a summary table of survey submissions with simple filtering.
    """
    degree_id = request.GET.get('degree_id', '').strip()
    role_id = request.GET.get('role_id', '').strip()
    search_query = request.GET.get('q', '').strip()

    assessments = Assessment.objects.select_related(
        'respondent__degree',
        'role'
    ).annotate(
        answers_count=Count('answers'),
        avg_rating=Avg('answers__rating'),
    ).order_by('-assessment_date')

    if degree_id.isdigit():
        assessments = assessments.filter(respondent__degree_id=int(degree_id))
    if role_id.isdigit():
        assessments = assessments.filter(role_id=int(role_id))
    if search_query:
        assessments = assessments.filter(
            Q(respondent__name__icontains=search_query) |
            Q(respondent__student_number__icontains=search_query) |
            Q(evaluator_name__icontains=search_query) |
            Q(respondent__degree__degree_program__icontains=search_query)
        )

    # Simple summary statistics
    total_submissions = assessments.count()
    distinct_students = assessments.values('respondent__student_number').distinct().count()

    overall_avg = assessments.aggregate(overall_avg=Avg('answers__rating'))['overall_avg']
    if overall_avg is not None:
        overall_avg = round(float(overall_avg), 2)

    degrees = Degree.objects.all().order_by('degree_program')
    roles = AssessmentRole.objects.all().order_by('name')

    context = {
        'assessments': assessments,
        'total_submissions': total_submissions,
        'distinct_students': distinct_students,
        'overall_avg': overall_avg,
        'degrees': degrees,
        'roles': roles,
        'selected_degree_id': int(degree_id) if degree_id.isdigit() else '',
        'selected_role_id': int(role_id) if role_id.isdigit() else '',
        'search_query': search_query,
    }
    return render(request, 'surveys/results_list.html', context)


def results_detail_view(request, assessment_id):
    """
    Displays the question-by-question response breakdown for an individual submission.
    """
    assessment = get_object_or_404(
        Assessment.objects.select_related('respondent__degree', 'role'),
        assessment_id=assessment_id
    )

    answers = (
        assessment.answers
        .select_related('question')
        .prefetch_related('question__plos')
        .order_by('question__question_id')
    )

    detailed_answers = []
    total_ratings = 0
    rating_sum = 0

    for ans in answers:
        rating_info = RATING_SCALE.get(ans.rating, {'text': f'Rating {ans.rating}', 'badge_class': ''})
        plo_codes = [plo.code for plo in ans.question.plos.all() if plo.degree_id == assessment.respondent.degree_id]
        if not plo_codes:
            plo_codes = [plo.code for plo in ans.question.plos.all()]

        if ans.rating is not None:
            total_ratings += 1
            rating_sum += ans.rating

        detailed_answers.append({
            'answer_id': ans.answer_id,
            'question_id': ans.question.question_id,
            'question_text': ans.question.question_text,
            'rating': ans.rating,
            'rating_text': rating_info['text'],
            'badge_class': rating_info['badge_class'],
            'comment': ans.comment,
            'plo_codes': plo_codes,
        })

    avg_rating = round(rating_sum / total_ratings, 2) if total_ratings > 0 else None

    context = {
        'assessment': assessment,
        'degree': assessment.respondent.degree,
        'respondent': assessment.respondent,
        'role': assessment.role,
        'detailed_answers': detailed_answers,
        'total_answers': len(detailed_answers),
        'avg_rating': avg_rating,
    }
    return render(request, 'surveys/results_detail.html', context)

