"""
Staff-module business rules (kept inside the staff app, so no other module or
the project settings file has to change).

Each value can still be overridden from settings.py with the same name.
"""
from django.conf import settings

# Staff check-in (Requirement 06): scheduled login time + grace period.
# Check-in up to and INCLUDING 09:30:00 is "Present"; after that it is "Late".
STAFF_LOGIN_TIME = getattr(settings, 'STAFF_LOGIN_TIME', (9, 0))          # (hour, minute)
STAFF_CHECKIN_GRACE_MINUTES = getattr(settings, 'STAFF_CHECKIN_GRACE_MINUTES', 30)

# Staff attendance (Requirement 05): official Total Working Days per month.
# The client has not given a formula yet, so it is fixed at 28.
STAFF_TOTAL_WORKING_DAYS = getattr(settings, 'STAFF_TOTAL_WORKING_DAYS', 28)

# Student overview (Requirement 01): a student of a running batch is
# "Long-Absent" when the latest attendance records are this many ABSENT days
# in a row.  PLACEHOLDER - definition still to be confirmed with the client.
LONG_ABSENT_CONSECUTIVE_DAYS = getattr(settings, 'LONG_ABSENT_CONSECUTIVE_DAYS', 7)