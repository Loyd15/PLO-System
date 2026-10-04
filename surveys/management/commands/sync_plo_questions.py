from django.core.management.base import BaseCommand
from surveys.models import Degree, Plo, Question, QuestionPlo


class Command(BaseCommand):
    help = 'Ensures every PLO without existing questions has a Question row (where PLO statement is the question) mapped in question_plo'

    def handle(self, *args, **options):
        self.stdout.write("Scanning PLOs across all degree programs...")
        total_plos = Plo.objects.count()
        created_questions = 0
        linked_count = 0

        for plo in Plo.objects.all():
            # Check if this PLO is already linked to any question
            if not QuestionPlo.objects.filter(plo=plo).exists():
                q = Question.objects.filter(question_text=plo.description).first()
                if not q:
                    q = Question.objects.create(question_text=plo.description, is_active=True)
                    created_questions += 1
                QuestionPlo.objects.get_or_create(question=q, plo=plo)
                linked_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Sync complete: Processed {total_plos} PLOs. "
            f"Created {created_questions} new questions and established {linked_count} PLO-question linkages."
        ))
