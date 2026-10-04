from django.test import TestCase, Client
from django.urls import reverse
from surveys.models import Degree, AssessmentRole, Respondent, Assessment, Plo, Question, QuestionPlo, Answer
from surveys.services import get_survey_questions_for_degree


class SurveySystemTests(TestCase):
    def setUp(self):
        self.client = Client()
        # Create Degree for test
        self.degree = Degree.objects.create(
            college='College of Computer Studies (CCS)',
            department='Department of Information Technology',
            degree_level='UG',
            degree_program='Bachelor of Science in Information Systems'
        )
        # Create PLOs for this degree
        self.plo1 = Plo.objects.create(
            degree=self.degree,
            code='PLO 1',
            description='Apply knowledge of computing fundamentals and solution models.'
        )
        self.plo2 = Plo.objects.create(
            degree=self.degree,
            code='PLO 2',
            description='Identify and analyze user needs to solve complex information systems problems.'
        )
        # Create role
        self.role = AssessmentRole.objects.create(name='Thesis adviser')

    def test_survey_form_renders(self):
        response = self.client.get(reverse('surveys:survey_form'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Program Learning Outcome Assessment')
        self.assertContains(response, 'PLO Survey')
        self.assertContains(response, 'window.SURVEY_HIERARCHY')

    def test_api_questions_plo_is_question(self):
        response = self.client.get(reverse('surveys:api_questions'), {'degree_id': self.degree.degree_id})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('questions', data)
        self.assertEqual(len(data['questions']), 2)
        
        # Check first question is PLO itself
        q1 = data['questions'][0]
        self.assertEqual(q1['question_text'], self.plo1.description)
        self.assertIn('PLO 1', q1['plo_codes'])
        self.assertTrue(q1['is_plo_itself'])

    def test_question_belonging_to_several_plos(self):
        # Create a question mapped to several PLOs
        multi_q = Question.objects.create(
            question_text='Demonstrates both software architecture and user-needs analysis.',
            is_active=True
        )
        QuestionPlo.objects.create(question=multi_q, plo=self.plo1)
        QuestionPlo.objects.create(question=multi_q, plo=self.plo2)

        questions = get_survey_questions_for_degree(self.degree)
        found = next((q for q in questions if q['question_id'] == multi_q.question_id), None)
        self.assertIsNotNone(found)
        self.assertEqual(len(found['plo_codes']), 2)
        self.assertIn('PLO 1', found['plo_codes'])
        self.assertIn('PLO 2', found['plo_codes'])
        self.assertFalse(found['is_plo_itself'])

    def test_survey_submission_and_thanks(self):
        questions = get_survey_questions_for_degree(self.degree)
        self.assertEqual(len(questions), 2)

        payload = {
            'degree_id': self.degree.degree_id,
            'role_id': self.role.role_id,
            'evaluator_name': 'Prof. Alan Turing',
            'basis': 'Thesis',
            'student_name': 'Juan Dela Cruz',
            'student_number': '12212345',
            'program_year': 'AY 2022–2023',
            'general_comment': 'Demonstrates exceptional critical thinking skills.',
            'answers': {
                str(questions[0]['question_id']): 4,
                str(questions[1]['question_id']): 2,
            },
            'reasons': {
                str(questions[1]['question_id']): 'Needs improvement in requirement tracing.',
            },
        }

        response = self.client.post(
            reverse('surveys:submit_survey'),
            data=payload,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        resp_data = response.json()
        self.assertTrue(resp_data.get('success'))
        assessment_id = resp_data.get('assessment_id')

        # Verify database records
        assessment = Assessment.objects.get(assessment_id=assessment_id)
        self.assertEqual(assessment.evaluator_name, 'Prof. Alan Turing')
        self.assertEqual(assessment.basis, 'Thesis')
        self.assertEqual(assessment.general_comment, 'Demonstrates exceptional critical thinking skills.')
        self.assertEqual(assessment.respondent.student_number, '12212345')
        self.assertEqual(assessment.answers.count(), 2)

        ans2 = assessment.answers.get(question_id=questions[1]['question_id'])
        self.assertEqual(ans2.rating, 2)
        self.assertEqual(ans2.comment, 'Needs improvement in requirement tracing.')

        # Test thanks view
        thanks_url = reverse('surveys:survey_thanks', kwargs={'assessment_id': assessment_id})
        thanks_resp = self.client.get(thanks_url)
        self.assertEqual(thanks_resp.status_code, 200)
        self.assertContains(thanks_resp, 'Thank you! Your response was submitted.')
        self.assertContains(thanks_resp, self.degree.degree_program)

    def test_results_views(self):
        # 1. Empty results view
        resp_empty = self.client.get(reverse('surveys:results_list'))
        self.assertEqual(resp_empty.status_code, 200)
        self.assertContains(resp_empty, 'Student Assessment Results')
        self.assertContains(resp_empty, 'No assessment results found')

        # 2. Create respondent, assessment, and answers
        resp_obj = Respondent.objects.create(
            degree=self.degree,
            student_number='12299999',
            name='Ada Lovelace',
            program_year='AY 2026–2027'
        )
        assess = Assessment.objects.create(
            respondent=resp_obj,
            role=self.role,
            evaluator_name='Charles Babbage',
            basis='Capstone Defense',
            general_comment='Outstanding algorithmic analysis.'
        )
        q1 = Question.objects.create(question_text='Analytical problem formulation.', is_active=True)
        QuestionPlo.objects.create(question=q1, plo=self.plo1)
        Answer.objects.create(assessment=assess, question=q1, rating=5, comment='Exceptional')

        # 3. List view with data
        resp_list = self.client.get(reverse('surveys:results_list'))
        self.assertEqual(resp_list.status_code, 200)
        self.assertContains(resp_list, 'Ada Lovelace')
        self.assertContains(resp_list, '12299999')
        self.assertContains(resp_list, 'Charles Babbage')
        self.assertContains(resp_list, 'Capstone Defense')

        # 4. Filter list view
        resp_filtered = self.client.get(reverse('surveys:results_list'), {'q': 'Ada'})
        self.assertEqual(resp_filtered.status_code, 200)
        self.assertContains(resp_filtered, 'Ada Lovelace')

        resp_filtered_none = self.client.get(reverse('surveys:results_list'), {'q': 'NonExistentStudent'})
        self.assertEqual(resp_filtered_none.status_code, 200)
        self.assertNotContains(resp_filtered_none, 'Ada Lovelace')

        # 5. Detail view
        detail_url = reverse('surveys:results_detail', kwargs={'assessment_id': assess.assessment_id})
        resp_detail = self.client.get(detail_url)
        self.assertEqual(resp_detail.status_code, 200)
        self.assertContains(resp_detail, 'Ada Lovelace')
        self.assertContains(resp_detail, 'Outstanding algorithmic analysis.')
        self.assertContains(resp_detail, 'Analytical problem formulation.')
        self.assertContains(resp_detail, 'Exceptional')
        self.assertContains(resp_detail, 'PLO 1')

