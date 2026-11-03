from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from django.conf import settings
import uuid
from cloudinary.models import CloudinaryField
from .validators import validate_indian_mobile


def current_year():
    """Callable default - evaluated on every save (not once when the server starts)."""
    return timezone.localdate().year


def current_month():
    return timezone.localdate().month


class Department(models.Model):
    """Department reference data"""
    DEPT_CHOICES = [
        ('Technical', 'Technical'),
        ('Management', 'Management'),
        ('Sales', 'Sales Department'),
        ('Marketing', 'Marketing'),
    ]

    dept_name = models.CharField(max_length=100, unique=True, choices=DEPT_CHOICES)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'departments'
        verbose_name_plural = 'Departments'

    def __str__(self):
        return self.get_dept_name_display()
    
class StaffRole(models.Model):
    """Staff role with permissions"""
    ROLE_CHOICES = [
        ('Developer', 'Developer'),
        ('Trainer', 'Trainer'),
        ('Admin', 'Admin'),
        ('Manager', 'Manager'),
        ('HR', 'HR'),
        ('Sales Exec', 'Sales Exec'),
        ('Sales Exec Lead', 'Sales Exec Lead'),
        ('Digital Marketing', 'Digital Marketing'),
        ('Content Creator', 'Content Creator'),
        ('Marketing Lead', 'Marketing Lead'),
    ]

    role_name = models.CharField(max_length=100, unique=True, choices=ROLE_CHOICES)
    description = models.TextField(blank=True)

    # Permissions
    can_manage_leads = models.BooleanField(default=False)
    can_manage_staff = models.BooleanField(default=False)
    can_view_reports = models.BooleanField(default=False)
    can_mark_attendance = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'staff_roles'
        verbose_name_plural = 'Staff Roles'

    def __str__(self):
        return self.get_role_name_display()
    
class Staff(models.Model):
    """Main Staff Model"""
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('on_leave', 'On Leave'),
        ('terminated', 'Terminated'),
    ]

        # Extended Personal Info
    GENDER_CHOICES = [('male', 'Male'), ('female', 'Female'), ('other', 'Other')]
    BLOOD_GROUP_CHOICES = [('A+','A+'),('A-','A-'),('B+','B+'),('B-','B-'),('O+','O+'),('O-','O-'),('AB+','AB+'),('AB-','AB-')]
   

    # Basic Information
    employee_id = models.CharField(unique=True, max_length=20, db_index=True)
    first_name = models.CharField(max_length=20)
    last_name = models.CharField(max_length=20)
    email = models.EmailField(unique=True, db_index=True)
    phone = models.CharField(max_length=10, unique=True, validators=[validate_indian_mobile])

    # Role & Department
    role = models.ForeignKey(StaffRole, on_delete=models.PROTECT, related_name='staff_members')
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name='staff_members')

    # Photos & Documents
    profile_photo = CloudinaryField('staff/photos/', blank=True, null=True)
    documents = CloudinaryField('staff/documents/', blank=True, null=True)

    # Performance & Target
    monthly_target = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)], blank=True, null=True)
    performance_rating = models.IntegerField(default=3, validators=[MinValueValidator(0), MaxValueValidator(5)], blank=True, null=True)

    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, null=True)
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUP_CHOICES, blank=True, null=True)
    
    address = models.TextField(blank=True, null=True)

    # Employment extra
    
    reporting_manager = models.ForeignKey("self", on_delete=models.SET_NULL,null=True,blank=True, related_name="team_members", limit_choices_to={"status": "active"},)

    # Contact & Emergency
    
    emergency_contact_name = models.CharField(max_length=100, blank=True, null=True)
    emergency_contact_phone = models.CharField(max_length=10, blank=True, null=True, validators=[validate_indian_mobile])

    #password
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='staff_profile', null=True, blank=True)

    # Skills stored as JSON string e.g. [{"name":"Python"}]
    skills = models.TextField(blank=True, null=True)


    # Status & Dates
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', db_index=True)
    date_of_joining = models.DateField()
    date_of_birth = models.DateField(null=True, blank=True)

    # Log-in Tracking
    last_login = models.DateTimeField(null=True, blank=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'staff'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['employee_id']),
            models.Index(fields=['email']),
            models.Index(fields=['status']),
            models.Index(fields=['department'])
        ]
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.employee_id})"
    
    def full_name(self):
        """Return Full Name"""
        return f"{self.first_name} {self.last_name}"
    
    def get_initials(self):
        """Get initial from fullname for Avatar"""
        return f"{self.first_name[0]}{self.last_name[0]}".upper()
    
    def get_last_active_time(self):
        '''Returns formatted last active time'''
        if self.last_login:
            return self.last_login.strftime("%d %b %Y, %I:%M %p")
        return "Never"
    
    def get_last_active_simple(self):
        """Returns simple last active status"""
        if not self.last_login:
            return "Never"
        
        now = timezone.now()
        diff = now - self.last_login

        if diff.total_seconds() < 3600:
            return "Today, " + self.last_login.strftime("%I:%M %p")
        elif diff.days == 0:
            return "Today, " + self.last_login.strftime("%I:%M %p")
        elif diff.days == 1:
            return "Yesterday, " + self.last_login.strftime("%I:%M %p")
        else:
            return self.last_login.strftime("%d %b, %I:%M %p")
        
    def get_status_badge_class(self):
        """Return CSS class for status badge"""
        status_classes = {
            'active': 'badge-success',
            'inactive': 'badge-secondary',
            'on_leave' : 'badge-warning',
            'terminated' : 'badge-danger'
        }
        return status_classes.get(self.status, 'badge-secondary')
    
    def get_performance_star_count(self):
        """Return Performance rating as stars (1-5)"""
        return self.performance_rating
    
# ======================= MULTIPLE FILE UPLOADED =========================

class StaffDocument(models.Model):
    staff = models.ForeignKey(
        Staff,
        on_delete=models.CASCADE,
        related_name='staff_documents'
    )

    document = CloudinaryField('staff/documents/')

    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'staff_documents'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.staff.full_name()} - {self.document.name}"
    
# ===== Overview =====

# Lead
class Lead(models.Model):

    STATUS_CHOICES = [
        ('new', 'New'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('converted', 'Converted'),
        ('lost', 'Lost'),
    ]

    staff = models.ForeignKey(
        'Staff',
        on_delete=models.CASCADE,
        related_name='leads'
    )

    name = models.CharField(max_length=150)

    phone = models.CharField(
        max_length=15,
        db_index=True
    )

    email = models.EmailField(
        blank=True,
        null=True
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='new',
        db_index=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'leads'
        ordering = ['-created_at']

    def __str__(self):
        return self.name


# LEAD ACTIVITIES
class LeadActivity(models.Model):

    ACTIVITY_TYPES = [
        ('created', 'Created'),
        ('call', 'Call'),
        ('meeting', 'Meeting'),
        ('follow_up', 'Follow Up'),
        ('converted', 'Converted'),
    ]

    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name='activities'
    )

    staff = models.ForeignKey(
        'Staff',
        on_delete=models.CASCADE,
        related_name='lead_activities'
    )

    activity_type = models.CharField(
        max_length=20,
        choices=ACTIVITY_TYPES,
        default='created'
    )

    title = models.CharField(max_length=200)

    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'lead_activities'
        ordering = ['-created_at']

    def __str__(self):
        return self.title


# REVENUE
class Revenue(models.Model):

    staff = models.ForeignKey(
        'Staff',
        on_delete=models.CASCADE,
        related_name='revenues'
    )

    lead = models.ForeignKey(
        Lead,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='revenues'
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    source = models.CharField(
        max_length=100,
        default='CRM'
    )

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'revenues'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.amount} - {self.staff}"

# Trainer
class TrainerSchedule(models.Model):

    TYPE_CHOICES = (
        ('class', 'Class'),
        ('meeting', 'Meeting'),
    )

    STATUS_CHOICES = (
        ('upcoming', 'Upcoming'),
        ('completed', 'Completed'),
        ('blocked', 'Blocked'),
    )

    staff = models.ForeignKey(
        Staff,
        on_delete=models.CASCADE,
        related_name="schedules"
    )

    date = models.DateField()

    time = models.TimeField()

    type = models.CharField(max_length=20, choices=TYPE_CHOICES)

    topic = models.CharField(max_length=200)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='upcoming'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "trainer_schedule"
        ordering = ['-date', '-time']

    def __str__(self):
        return f"{self.staff.full_name()} - {self.topic}"

# ================================ WEEKLY REVENUE ==================================
class WeeklyPerformance(models.Model):
    WEEK_CHOICES = (
        (1, "Week 1"),
        (2, "Week 2"),
        (3, "Week 3"),
        (4, "Week 4"),
        (5, "Week 5"),
    )

    staff = models.ForeignKey(
        "Staff",
        on_delete=models.CASCADE,
        related_name="weekly_performances"
    )

    year = models.PositiveIntegerField(default=current_year)
    month = models.PositiveSmallIntegerField(default=current_month)

    week = models.PositiveSmallIntegerField(
        choices=WEEK_CHOICES
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["year", "month", "week"]
        unique_together = ("staff", "year", "month", "week")

    def __str__(self):
        return f"{self.staff.employee_id} - {self.month}/{self.year} - Week {self.week}"

    
# ============================================== ATTENDANCE MODEL ==============================================

class Attendance(models.Model):


    STATUS_CHOICES = (

        ('Present', 'Present'),

        ('Absent', 'Absent'),

        ('Leave', 'Leave'),

        ('Late', 'Late'),

    )


    # STAFF CONNECT

    staff = models.ForeignKey(

        Staff,

        on_delete=models.CASCADE,

        related_name='attendances',

        null=True,

        blank=True

    )


    # DATE

    date = models.DateField(default=timezone.now)


    # LOG IN

    log_in = models.DateTimeField(null=True,blank=True)


    # LOG OUT

    log_out = models.DateTimeField(null=True,blank=True)


    # TOTAL HOURS

    total_hours = models.CharField(max_length=20, null=True,blank=True)


    # STATUS

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='Absent')



    # SAVE METHOD

    def save(self, *args, **kwargs):


        # TOTAL HOURS

        if self.log_in and self.log_out:


            total = self.log_out - self.log_in


            hours = total.seconds // 3600


            minutes = (
                total.seconds % 3600
            ) // 60


            self.total_hours = (
                f"{hours}h {minutes}m"
            )


        super().save(*args, **kwargs)

    def __str__(self):


        if self.staff:

            return f"{self.staff.full_name()} - {self.date}"


        return f"{self.date}"

    class Meta:

        db_table = "staff_attendance"

# ================================ DOCUMENT ================================
