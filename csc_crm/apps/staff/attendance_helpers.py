"""
Student Overview helpers for the Staff Dashboard (Requirement 01).
They only READ the student attendance / batch data - nothing outside the
staff module is changed.
"""
from django.db.models import Q
from django.utils import timezone

from csc_crm.apps.student_attendance.models import Attendance

from .constants import LONG_ABSENT_CONSECUTIVE_DAYS


#========================= LONG-ABSENT STUDENTS (STAFF DASHBOARD - STUDENT OVERVIEW) =========================#
def get_long_absent_streaks(enrollments, min_days=None):
    """
    Returns {enrollment_id: consecutive_absent_days} for every enrollment in
    `enrollments` whose most recent attendance records are ABSENT for
    `min_days` days in a row (default: LONG_ABSENT_CONSECUTIVE_DAYS in constants.py).

    Data comes from the real attendance records - nothing is entered by hand.
    """
    if min_days is None:
        min_days = LONG_ABSENT_CONSECUTIVE_DAYS

    ids = list(enrollments.values_list('id', flat=True))
    if not ids:
        return {}

    records = (
        Attendance.objects
        .filter(enrollment_id__in=ids)
        .order_by('enrollment_id', '-attendance_date')
        .values_list('enrollment_id', 'status')
    )

    streaks = {}
    finished = set()

    for enrollment_id, status in records:
        if enrollment_id in finished:
            continue
        if status == 'Absent':
            streaks[enrollment_id] = streaks.get(enrollment_id, 0) + 1
        else:
            finished.add(enrollment_id)      # streak broken by Present / Late

    return {eid: n for eid, n in streaks.items() if n >= min_days}


#============ BATCH STATE FROM DATES (same rule as Batch.display_status) - used by Student Overview ============#
def ongoing_batch_q(prefix=''):
    """Q for batches that are running today: started, not ended, not Completed/Cancelled."""
    today = timezone.localdate()
    p = prefix
    return (
        ~Q(**{f'{p}status__in': ['Cancelled', 'Completed']})
        & Q(**{f'{p}start_date__lte': today})
        & (Q(**{f'{p}end_date__isnull': True}) | Q(**{f'{p}end_date__gte': today}))
    )


def completed_batch_q(prefix=''):
    """Q for batches that are finished: marked Completed, or end date has passed."""
    today = timezone.localdate()
    p = prefix
    return (
        Q(**{f'{p}status': 'Completed'})
        | (~Q(**{f'{p}status': 'Cancelled'}) & Q(**{f'{p}end_date__lt': today}))
    )


def upcoming_batch_q(prefix=''):
    """Q for batches that have not started yet: start date is in the future, not Completed/Cancelled."""
    today = timezone.localdate()
    p = prefix
    return (
        ~Q(**{f'{p}status__in': ['Cancelled', 'Completed']})
        & Q(**{f'{p}start_date__gt': today})
    )
