from django.db.models import Q
from .models import Attendance,Batch
from csc_crm.apps.admissions.models import Enrollment
from django.db.models import Q, Count, Case, When, IntegerField

#=========================== STATUS COLOR MAP (SHARED ACROSS PDF/EXCEL) ==============================#
STATUS_COLOR_HEX = {
    "Excellent": "00B050",
    "Good": "2563EB",
    "Warning": "F59E0B",
    "Critical": "DC2626",
}

#================ ATTENDANCE STATUS CALCULATION (EXCELLENT/GOOD/WARNING/CRITICAL) ======================#
def get_attendance_status(present_count, absent_count, late_count, total_days):
    if total_days == 0:
        return None, 0

    effective_present = present_count + late_count
    attendance_rate = round((effective_present / total_days) * 100, 3)

    if attendance_rate >= 100:
        status = "Excellent"
    elif attendance_rate >= 75:
        status = "Good"
    elif attendance_rate >= 60:
        status = "Warning"
    else:
        status = "Critical"

    if absent_count >= 5:
        status = "Critical"
    elif status == "Critical":
        status = "Warning"

    return status, attendance_rate

# ================= PRESENT / ABSENT / LATE COUNTS - PER ENROLLMENT =================
def get_attendance_counts(enrollment, date_from=None, date_to=None):
    qs = Attendance.objects.filter(enrollment=enrollment)

    if date_from:
        qs = qs.filter(attendance_date__gte=date_from)

    if date_to:
        qs = qs.filter(attendance_date__lte=date_to)

    counts = qs.aggregate(
        present=Count(
            "id",
            filter=Q(status="Present")
        ),
        absent=Count(
            "id",
            filter=Q(status="Absent")
        ),
        late=Count(
            "id",
            filter=Q(status="Late")
        ),
    )

    present_count = counts["present"] or 0
    absent_count = counts["absent"] or 0
    late_count = counts["late"] or 0

    total_days = present_count + absent_count + late_count

    return present_count, absent_count, late_count, total_days


# ================= PRESENT / ABSENT / LATE COUNTS - GENERIC QUERYSET =================
def count_by_status(queryset):
    """
    Returns Present / Absent / Late / Total counts
    using a single database query.
    """

    counts = queryset.aggregate(
        present=Count(
            "id",
            filter=Q(status="Present")
        ),
        absent=Count(
            "id",
            filter=Q(status="Absent")
        ),
        late=Count(
            "id",
            filter=Q(status="Late")
        ),
    )

    present = counts["present"] or 0
    absent = counts["absent"] or 0
    late = counts["late"] or 0

    return {
        "present": present,
        "absent": absent,
        "late": late,
        "total": present + absent + late,
    }

#==================== STUDENT ATTENDANCE % (FOR EMAIL/SMS NOTIFICATIONS) ========================#
def get_student_attendance_percentage(enrollment):
    """
    Attendance % for a single enrollment based on total marked working days
    (present_count / total_working_days). Used by the notification/email/SMS
    flows, which use this simpler percentage rather than the report page's
    present+late/total_days rate.
    """
    total_working_days = Attendance.objects.values('attendance_date').distinct().count()
    present_count = Attendance.objects.filter(enrollment=enrollment, status='Present').count()

    return round((present_count / total_working_days) * 100, 1) if total_working_days > 0 else 100

#================================ LATEST ATTENDANCE DATE HELPERS ===============================#
def get_latest_attendance_date():
    latest = Attendance.objects.order_by('-attendance_date').first()
    return latest.attendance_date if latest else None


def get_formatted_latest_attendance_date(fmt="%d %b %Y", fallback="-"):
    latest_date = get_latest_attendance_date()
    return latest_date.strftime(fmt) if latest_date else fallback

#===================================== BATCH-WISE ATTENDANCE STATS ===================================#
def compute_batch_stats(batch, date_from=None, date_to=None, enrollment_ids=None, fallback_to_latest=False):
    qs = Attendance.objects.filter(batch=batch)

    if enrollment_ids is not None:
        qs = qs.filter(enrollment_id__in=enrollment_ids)

    if date_from:
        qs = qs.filter(attendance_date__gte=date_from)
    if date_to:
        qs = qs.filter(attendance_date__lte=date_to)

    if fallback_to_latest and not date_from and not date_to:
        latest_date = get_latest_attendance_date()
        qs = qs.filter(attendance_date=latest_date)

    counts = count_by_status(qs)
    present, absent, late, total = counts["present"], counts["absent"], counts["late"], counts["total"]

    percentage = round(((present + late) / total) * 100, 1) if total else 0

    return {
        "present": present,
        "absent": absent,
        "late": late,
        "total": total,
        "percentage": percentage,
    }

#==================== STATUS SUMMARY COUNTS (EXCELLENT/GOOD/WARNING/CRITICAL) ==================#
def get_status_summary_counts(report_students):
    counts = {"Excellent": 0, "Good": 0, "Warning": 0, "Critical": 0}
    for student in report_students:
        counts[student["status"]] = counts.get(student["status"], 0) + 1
    return counts

#======================== BATCH ANALYTICS TABLE ROWS (PDF/EXCEL EXPORT) =========================#

def get_batch_analytics_rows(my_staff=None, my_role=None):
    """
    Returns list of rows: [course_name, batch_name, students, total_days, present, absent, late, "xx.x%"]
    Used by both analytics_pdf and analytics_excel to avoid duplicating the batch loop.
    """
    rows = []

    batches = Batch.objects.all()

    if my_role == 'Trainer' and my_staff:
        batches = batches.filter(trainer=my_staff)

    for batch in batches:
        stats = compute_batch_stats(batch)
        students = Enrollment.objects.filter(batch=batch).count()
        rows.append([
            batch.course.course_name,
            batch.batch_name,
            students,
            stats["total"],
            stats["present"],
            stats["absent"],
            stats["late"],
            f"{stats['percentage']}%",
        ])
    return rows

#=============================== TRAINER & TIMING DISPLAY HELPERS ==========================#
def get_trainer_display_name(batch):
    return f"{batch.trainer.first_name} {batch.trainer.last_name}" if batch.trainer else "Not Assigned"


def get_batch_timing_display(batch):
    return f"{batch.start_time.strftime('%I:%M %p')} - {batch.end_time.strftime('%I:%M %p')}"

#================================= BATCH SEARCH FILTER (DASHBOARD) ===========================#
def filter_batches_by_search(queryset, search):
    """
    Shared batch search used by both dashboard_api and dashboard views.
    """
    if not search:
        return queryset

    return queryset.filter(
        Q(batch_name__icontains=search) |
        Q(course__course_name__icontains=search) |
        Q(trainer__first_name__icontains=search) |
        Q(trainer__last_name__icontains=search) |
        Q(timing__icontains=search)
    )

#========================= EMAIL TEMPLATE - LOW/CRITICAL ATTENDANCE ALERT ==============================#
def build_attendance_email(student, attendance_percentage):
    """
    Returns (subject, message) for a low/critical attendance email.
    Shared by send_low_attendance_email, send_bulk_notification and send_email_all
    so wording stays consistent instead of drifting across three copies.
    """
    is_critical = attendance_percentage < 60
    subject = "Critical Attendance Alert" if is_critical else "Low Attendance Warning"

    if is_critical:
        message = f"""

        Dear {student.first_name},
        Your attendance percentage is critically low.
        Attendance Percentage: {attendance_percentage}%
        Immediate action is required. Please contact your trainer.

        Regards,
        CSC Computer Education"""
    else:
        message = f"""

        Dear {student.first_name},
        Your attendance percentage is below the required level.
        Attendance Percentage: {attendance_percentage}%
        Please attend classes regularly.

        Regards,
        CSC Computer Education"""

    return subject, message

#======================= SMS TEMPLATE - LOW/CRITICAL ATTENDANCE ALERT =======================#
def build_attendance_sms(student, attendance_percentage):
    """
    Returns SMS body text for a low/critical attendance alert.
    Shared by send_sms_notification, send_bulk_notification and send_sms_all.
    """
    is_critical = attendance_percentage < 60
    header = "Critical Attendance Alert" if is_critical else "Low Attendance Warning"
    action_line = "Immediate action required." if is_critical else "Please attend classes regularly."

    return f"""

        CSC ALERT
        {header}

        Student:{student.first_name}
        Attendance:{attendance_percentage}%
        {action_line}"""

#====================== ATTENDANCE EXPORT ROW BUILDER (EXCEL/PDF) =====================#
def build_export_rows(qs):
    """
    Flattens an Attendance queryset (with select_related enrollment/batch/trainer)
    into plain row dicts, shared by attendance_export's Excel and PDF branches.
    """
    rows = []
    for r in qs:
        rows.append({
            "date": str(r.attendance_date),
            "student_name": f"{r.enrollment.student.first_name} {r.enrollment.student.last_name}",
            "course_name": r.enrollment.course.course_name,
            "batch_name": r.batch.batch_name,
            "status": str(r.status),
            "trainer_name": getattr(r.trainer, "name", str(r.trainer)),
        })
    return rows

def get_bulk_attendance_counts(enrollment_ids, date_from=None, date_to=None):
    """
    Fetch attendance counts for all enrollments using one grouped query.
    Returns a dictionary keyed by enrollment_id.
    """

    qs = Attendance.objects.filter(
        enrollment_id__in=enrollment_ids
    )

    if date_from:
        qs = qs.filter(attendance_date__gte=date_from)

    if date_to:
        qs = qs.filter(attendance_date__lte=date_to)

    rows = qs.values('enrollment_id').annotate(
        present=Count('id', filter=Q(status='Present')),
        absent=Count('id', filter=Q(status='Absent')),
        late=Count('id', filter=Q(status='Late')),
    )

    result = {}

    for row in rows:
        present = row['present'] or 0
        absent = row['absent'] or 0
        late = row['late'] or 0

        result[row['enrollment_id']] = {
            'present': present,
            'absent': absent,
            'late': late,
            'total': present + absent + late,
        }

    return result