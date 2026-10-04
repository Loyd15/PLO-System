from django.urls import path
from . import views

app_name = 'surveys'

urlpatterns = [
    path('', views.survey_form_view, name='survey_form'),
    path('api/questions/', views.api_questions_for_degree, name='api_questions'),
    path('submit/', views.submit_survey_view, name='submit_survey'),
    path('thanks/<int:assessment_id>/', views.survey_thanks_view, name='survey_thanks'),
    path('results/', views.results_list_view, name='results_list'),
    path('results/<int:assessment_id>/', views.results_detail_view, name='results_detail'),
]
