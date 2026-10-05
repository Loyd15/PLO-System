import re
from django.db import models
from django.utils import timezone


class Degree(models.Model):
    degree_id = models.AutoField(primary_key=True)
    college = models.CharField(max_length=150)
    department = models.CharField(max_length=150)
    degree_level = models.CharField(max_length=10)
    degree_program = models.CharField(max_length=300)

    class Meta:
        managed = True
        db_table = 'degree'
        ordering = ['college', 'department', 'degree_program']

    @property
    def level_display(self):
        mapping = {
            'UG': 'Undergraduate',
            'GS': 'Graduate Studies',
            'SHS': 'Senior High School',
        }
        return mapping.get(self.degree_level, self.degree_level)

    def __str__(self):
        return f"{self.degree_program} ({self.degree_level})"


class AssessmentRole(models.Model):
    role_id = models.AutoField(primary_key=True)
    name = models.CharField(unique=True, max_length=100)

    class Meta:
        managed = True
        db_table = 'assessment_role'
        ordering = ['role_id']

    def __str__(self):
        return self.name


class Respondent(models.Model):
    respondent_id = models.AutoField(primary_key=True)
    degree = models.ForeignKey(Degree, on_delete=models.CASCADE, db_column='degree_id', related_name='respondents')
    student_number = models.CharField(max_length=30)
    name = models.CharField(max_length=150)
    program_year = models.CharField(max_length=20)

    class Meta:
        managed = True
        db_table = 'respondent'

    def __str__(self):
        return f"{self.name} ({self.student_number})"


class Assessment(models.Model):
    assessment_id = models.AutoField(primary_key=True)
    respondent = models.ForeignKey(Respondent, on_delete=models.CASCADE, db_column='respondent_id', related_name='assessments')
    role = models.ForeignKey(AssessmentRole, on_delete=models.CASCADE, db_column='role_id')
    assessment_date = models.DateTimeField(default=timezone.now)
    evaluator_name = models.CharField(max_length=150, blank=True, null=True)
    basis = models.CharField(max_length=100, blank=True, null=True)
    general_comment = models.TextField(blank=True, null=True)

    class Meta:
        managed = True
        db_table = 'assessment'
        ordering = ['-assessment_date']

    def __str__(self):
        return f"Assessment {self.assessment_id} for {self.respondent.name}"


class Plo(models.Model):
    plo_id = models.AutoField(primary_key=True)
    degree = models.ForeignKey(Degree, on_delete=models.CASCADE, db_column='degree_id', related_name='plos')
    code = models.CharField(max_length=20)
    description = models.TextField()

    class Meta:
        managed = True
        db_table = 'plo'
        unique_together = (('degree', 'code'),)
        ordering = ['code']

    def save(self, *args, **kwargs):
        if self.code:
            match = re.match(r'^PLO\s*(\d+)$', self.code.strip(), re.IGNORECASE)
            if match:
                self.code = f"PLO {int(match.group(1)):02d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} - {self.degree.degree_program}"


class Question(models.Model):
    question_id = models.AutoField(primary_key=True)
    question_text = models.TextField()
    is_active = models.BooleanField(default=True)
    plos = models.ManyToManyField(Plo, through='QuestionPlo', related_name='questions')

    class Meta:
        managed = True
        db_table = 'question'

    def __str__(self):
        return f"Q{self.question_id}: {self.question_text[:50]}"


class QuestionPlo(models.Model):
    pk = models.CompositePrimaryKey('question_id', 'plo_id')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, db_column='question_id')
    plo = models.ForeignKey(Plo, on_delete=models.CASCADE, db_column='plo_id')

    class Meta:
        managed = True
        db_table = 'question_plo'
        unique_together = (('question', 'plo'),)

    def __str__(self):
        return f"Q{self.question_id} -> {self.plo.code}"


class Answer(models.Model):
    answer_id = models.AutoField(primary_key=True)
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE, db_column='assessment_id', related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, db_column='question_id', related_name='answers')
    rating = models.PositiveSmallIntegerField(blank=True, null=True)
    comment = models.TextField(blank=True, null=True)

    class Meta:
        managed = True
        db_table = 'answer'
        unique_together = (('assessment', 'question'),)

    def __str__(self):
        return f"Answer {self.answer_id} (Rating: {self.rating})"
