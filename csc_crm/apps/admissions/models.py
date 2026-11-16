from django.db import models
from django.core.validators import RegexValidator
from django.utils import timezone
from django.db.models import Sum
from django.core.validators import MinValueValidator 
from decimal import Decimal
from cloudinary.models import CloudinaryField
from django.core.exceptions import ValidationError

name_validator = RegexValidator( regex=r'^[A-Za-z ]+$', message="Only alphabets and spaces are allowed.")
phone_validator = RegexValidator( regex=r'^[6-9]\d{9}$', message="Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.")
email_validator = RegexValidator(regex=r'^[\w\.-]+@[\w\.-]+\.\w+$', message="Enter a proper email (example: name@gmail.com)")


#==============================Student Model=======================================
class Student(models.Model):
    first_name = models.CharField(max_length=20, blank=False, validators=[name_validator])
    last_name = models.CharField(max_length=20, blank=False, validators=[name_validator])
    dob = models.DateField()
    phone_no = models.CharField(max_length=10, blank=False, validators=[phone_validator], unique=True)
    gender_choice = [('', 'Select Gender'),('M','Male'),('F','Female'),('O','Others')]
    gender = models.CharField(max_length=10, choices=gender_choice)
    email = models.EmailField(validators=[email_validator],unique=True)
    address = models.TextField()
    educational_qualification = models.CharField(max_length=100, blank=False, validators=[name_validator])
    guardian_name = models.CharField(max_length=100, blank=False, validators=[name_validator])
    guardian_phone_no = models.CharField(max_length=10, blank=False, validators=[phone_validator], unique=True)
    photo=CloudinaryField('student_photos/',null=True, blank=True)
    
    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    def total_paid(self):
        return self.payments.filter(
        status='SUCCESS'
    ).aggregate(
        total=Sum('amount')
    )['total'] or 0

    def total_fee(self):
        admission = self.admissions.select_related("course_name").first()
        return admission.course_name.course_fee if admission and admission.course_name else 0

    def total_paid(self):
        return self.payments.aggregate(total=Sum("amount"))["total"] or 0

    def pending_amount(self):
        return max(self.total_fee() - self.total_paid(), 0)
    
    def pending_amount(self):
        pending = self.total_fee() - self.total_paid()
        return max(pending, 0)
    #==============================Student Document Model=======================================
    
class StudentDocument(models.Model):

    DOCUMENT_TYPES = [
        ('id_proof', 'ID Proof'),
        ('certificate', 'Certificate'),
    ]

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='documents'
    )

    document_type = models.CharField(
        max_length=20,
        choices=DOCUMENT_TYPES
    )

    document = CloudinaryField(
        'student_documents/',
        resource_type='raw'
    )

    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student} - {self.document_type}"
#==============================Payment Model=======================================

class Payment(models.Model):
    PAYMENT_MODES = [
        ('UPI', 'UPI'),
        ('CASH', 'Cash'),
        ('CARD', 'Card'),
    ]

    STATUS_CHOICES = [
        ('SUCCESS', 'Success'),
        ('PENDING', 'Pending'),
        ('FAILED', 'Failed'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='payments')
    transaction_id = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True
    )
    amount = models.DecimalField(
    max_digits=10,
    decimal_places=2,
    validators=[MinValueValidator(Decimal('1.00'))]
    )
    mode = models.CharField(max_length=10, choices=PAYMENT_MODES)
    reference_id = models.CharField(max_length=100, blank=True, null=True)
    remarks = models.TextField(blank=True)
    date = models.DateField(default=timezone.now)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='SUCCESS')

    def __str__(self):
        return f"{self.student.first_name} - ₹{self.amount}"
#==============================Course Model=======================================
class Course(models.Model):
    course_name = models.CharField(max_length=50, null=False, blank=False)

    duration = models.PositiveIntegerField(default=3)
    course_fee = models.IntegerField(null=False, blank=False)

    def __str__(self):
        return self.course_name

#==============================Admission Model=======================================
class Admission(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='admissions')
    course_name = models.ForeignKey(Course, on_delete=models.CASCADE)

    STATUS = [
        ('enquiry', 'Enquiry'),
        ('confirmed', 'Confirmed'),
        ('enrolled', 'Enrolled'),
        ('dropped', 'Dropped'),
    ]

    status = models.CharField(max_length=20, choices=STATUS, default='enrolled')
    applied_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student} - {self.course_name}"

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields =['student', 'course_name'],
                name = 'unique_student_course'
            )
        ]
#==============================Enrollment Model=======================================
class Enrollment(models.Model):
    admission = models.OneToOneField(Admission, on_delete=models.CASCADE, related_name='enrollment')

    batch = models.ForeignKey(
    'student_attendance.Batch',
    on_delete=models.CASCADE,
    related_name='enrollments',
    null=True,
    blank=True
    )

    start_date = models.DateField(null=False, blank=False)
    payment_status = models.CharField(max_length=20, choices=[
        ('Paid', 'Paid'),
        ('Pending', 'Pending'),
        ('Partial','Partial')
    ], default='Pending')

    def clean(self):
        if not self.admission_id:
            return

        if self.batch.course_id != self.admission.course_name_id:
            raise ValidationError(
                "Batch course and admission course must match."
            )
        
        if self.batch.enrollments.exclude(pk=self.pk).count() >= self.batch.max_students:
            raise ValidationError(
                "Batch is full. No seats available."
            )

    def save(self, *args, **kwargs):
        self.full_clean()

        super().save(*args, **kwargs)

    @property
    def student(self):

        return self.admission.student

    @property
    def course(self):

        return self.admission.course_name

    def __str__(self):

        return str(self.admission)
    #==============================Student Note Model=======================================
class StudentNote(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='notes')
    content = models.TextField()
    added_by = models.CharField(max_length=100)   # or FK to a Staff/User model if you have one
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']