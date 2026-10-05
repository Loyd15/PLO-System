import re
from django.core.management.base import BaseCommand
from django.db import connection
from surveys.models import Degree, Plo, Question, QuestionPlo


class Command(BaseCommand):
    help = 'Upgrades outdated database schema, formats PLO codes (e.g. PLO 01), and ensures every PLO has a linked Question row'

    def handle(self, *args, **options):
        self.stdout.write("1. Checking and upgrading database schema...")
        with connection.cursor() as cur:
            if connection.vendor == 'mysql':
                cur.execute("SHOW COLUMNS FROM `assessment`")
                assessment_cols = [r[0] for r in cur.fetchall()]
                if 'evaluator_name' not in assessment_cols:
                    cur.execute("ALTER TABLE `assessment` ADD COLUMN `evaluator_name` VARCHAR(150) NULL")
                    self.stdout.write("   + Added column assessment.evaluator_name")
                if 'basis' not in assessment_cols:
                    cur.execute("ALTER TABLE `assessment` ADD COLUMN `basis` VARCHAR(100) NULL")
                    self.stdout.write("   + Added column assessment.basis")
                if 'general_comment' not in assessment_cols:
                    cur.execute("ALTER TABLE `assessment` ADD COLUMN `general_comment` TEXT NULL")
                    self.stdout.write("   + Added column assessment.general_comment")

                # Update answer.rating to allow NULL and 0..5 ("Not enough info/experience")
                cur.execute(
                    "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS "
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'answer' AND CONSTRAINT_TYPE = 'CHECK'"
                )
                checks = [r[0] for r in cur.fetchall()]
                for chk in checks:
                    cur.execute(f"ALTER TABLE `answer` DROP CHECK `{chk}`")
                cur.execute("ALTER TABLE `answer` MODIFY COLUMN `rating` SMALLINT UNSIGNED NULL")
                cur.execute(
                    "ALTER TABLE `answer` ADD CONSTRAINT `answer_rating_range` "
                    "CHECK (`rating` IS NULL OR (`rating` BETWEEN 0 AND 5))"
                )
                self.stdout.write("   + Updated answer.rating column and range constraint")

        self.stdout.write("2. Normalizing PLO codes to 2-digit format (e.g. PLO 01)...")
        updated_codes = 0
        for plo in Plo.objects.all():
            match = re.match(r'^PLO\s*(\d+)$', plo.code.strip(), re.IGNORECASE)
            if match:
                new_code = f"PLO {int(match.group(1)):02d}"
                if plo.code != new_code:
                    plo.code = new_code
                    plo.save(update_fields=['code'])
                    updated_codes += 1
        self.stdout.write(f"   + Normalized {updated_codes} PLO codes.")

        self.stdout.write("3. Scanning PLOs across all degree programs...")
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
            f"Updated {updated_codes} PLO codes, created {created_questions} new questions, "
            f"and established {linked_count} PLO-question linkages."
        ))

