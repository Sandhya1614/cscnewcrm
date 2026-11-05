from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from ..staff.models import Staff

# Lead Model
class LeadCapture(models.Model):

    COURSE_CHOICES  = [
        ('python', 'Python Full Stack'),
        ('java', 'Java Full Stack'),
        ('front_end','Front End'),
        ('back_end', 'Back End'),
        ('data_science', 'Data Science'),
        ('ai', 'Artificial Intelligence')
    ]

    SOURCE_CHOICES = [
        ('walk_in', 'Walk-in'),
        ('referral', 'Referral'),
        ('social_media', 'Social Media'),
        ('advertisement', 'Advertisement'),
        ('phone_enquiry', 'Phone Enquiry'),
        ('website', 'Website'),
    ]

    STATUS_CHOICES = [
        ('new', 'New'),
        ('contacted', 'Contacted'),
        ('interested', 'Interested'),
        ('demo_scheduled', 'Demo_Scheduled'),
        ('enrolled', 'Enrolled'),
        ('lost', 'Lost')
    ]

    COURSE_CHOICES = [
    ('fullstack', 'Full Stack Development'),
    ('frontend', 'Front-End Development'),
    ('backend', 'Back-End Development'),
    ('python', 'Python Programming'),
    ('java', 'Java Programming'),
    ('dotnet', '.NET Development'),
    ('mern', 'MERN Stack Development'),
    ('mean', 'MEAN Stack Development'),
    ('data_science', 'Data Science'),
    ('ai_ml', 'AI & Machine Learning'),
    ('cyber_security', 'Cyber Security'),
    ('cloud_computing', 'Cloud Computing'),
    ('uiux', 'UI/UX Design'),
]

    lead_id = models.CharField(max_length=10, unique=True)
    lead_name = models.CharField(max_length=100,)
    email = models.EmailField(blank=True, null=True, unique=True)
    phone_no = models.CharField(unique=True, max_length=13,)
    course_interested = models.CharField(max_length=100, choices=COURSE_CHOICES)
    lead_source = models.CharField(max_length=100, choices=SOURCE_CHOICES)
    assigned_to = models.ForeignKey(Staff, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)    
    initial_notes = models.TextField(null=True, blank=True)
    enquiry_date = models.DateField()
    next_followup_date = models.DateField()
    followup_completed = models.BooleanField(default=False)
    followup_completed_at = models.DateTimeField(null=True, blank=True)
    initial_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    
    
    def __str__(self):
        return self.lead_name
    
# Call-Log model
class CallLog(models.Model):
    LEAD_STATUS_CHOICES = [
        ('Interested', 'Interested'),
        ('Not Reachable', 'Not Reachable'),
        ('Demo Scheduled', 'Demo Scheduled'),
        ('Not Interested', 'Not Interested'),
    ]
    def __str__(self):
        return self.lead_name

    CALL_TYPE_CHOICES = [
        ('outgoing', 'Outgoing'),
        ('answered', 'Answered'),
        ('did_not_connect', 'Did not connect'),
    ]

    lead = models.ForeignKey(
        'LeadCapture', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='calls'
    )

    lead_name = models.CharField(max_length=100,null=True, blank= True)

    call_type = models.CharField(
        max_length=20, choices=CALL_TYPE_CHOICES, default='outgoing'
    )

    call_date = models.DateField(max_length=100,null=True, blank= True)
    call_time = models.TimeField(max_length=100,null=True, blank= True)

    duration = models.IntegerField(null=True, blank= True)  # minutes
    duration_seconds = models.PositiveSmallIntegerField(default=0)  # extra seconds (0-59)

    call_outcome = models.CharField(max_length=50, choices=LEAD_STATUS_CHOICES)


    notes = models.TextField(blank=True, null=True)

    next_followup_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    # ---- mobile call-log style helpers ----
    @property
    def total_seconds(self):
        return (self.duration or 0) * 60 + (self.duration_seconds or 0)

    @property
    def is_connected(self):
        return self.call_type != 'did_not_connect'

    @property
    def duration_display(self):
        """e.g. '2 min 44 s', '9 sec', '' (when not connected)"""
        if not self.is_connected:
            return ''
        mins, secs = divmod(self.total_seconds, 60)
        if mins:
            return f'{mins} min {secs} s'
        return f'{secs} sec'

    @property
    def log_label(self):
        """e.g. 'Outgoing 2 min 44 s' / 'Answered 3 min 9 s' / 'Did not connect'"""
        label = self.get_call_type_display()
        return f'{label} {self.duration_display}'.strip()

    @property
    def timestamp_display(self):
        if self.call_date:
            t = self.call_time.strftime('%H:%M') if self.call_time else ''
            return f'{self.call_date.strftime("%Y/%m/%d")} {t}'.strip()
        return timezone.localtime(self.created_at).strftime('%Y/%m/%d %H:%M')

# ================================ LEAD CAPTURE TARGET (MARKETING) ================================
class LeadCaptureTarget(models.Model):
    """
    Lead Capture Target assigned by a Marketing Lead / Admin / Manager
    to a Marketing team member (e.g. Digital Marketing, Content Creator).
    """

    assigned_to = models.ForeignKey(
        Staff, on_delete=models.CASCADE,
        related_name='lead_capture_targets',
        help_text="Marketing team member this target is assigned to"
    )

    assigned_by = models.ForeignKey(
        Staff, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assigned_lead_capture_targets',
        help_text="Marketing Lead / Admin / Manager who assigned this target"
    )

    target_count = models.PositiveIntegerField(
        help_text="Number of leads to be captured"
    )

    # Stored, not computed live — this is what makes each target
    # independent. Incremented one lead at a time by the signal in
    # signals.py, and frozen (is_completed=True) the moment it hits
    # target_count, so it never changes again after that.
    achieved_count = models.PositiveIntegerField(default=0)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    start_date = models.DateField(default=timezone.localdate)

    end_date = models.DateField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'lead_capture_targets'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.assigned_to.full_name()} - {self.target_count} leads by {self.end_date}"

    @property
    def progress_percent(self):
        if not self.target_count:
            return 0
        return min(round((self.achieved_count / self.target_count) * 100), 100)

    @property
    def is_expired(self):
        return timezone.localdate() > self.end_date

    @property
    def status(self):
        if self.is_completed:
            return 'completed'
        if self.is_expired:
            return 'expired'
        return 'active'