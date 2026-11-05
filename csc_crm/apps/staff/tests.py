"""
Tests for the Staff module change request (Requirements 01-07) and for the
numbers shown on the Staff Dashboard / Overview / Attendance pages.

Run:  python manage.py test csc_crm.apps.staff
"""

from datetime import date, datetime, time, timedelta
from unittest import mock

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from csc_crm.apps.admissions.models import Admission, Course, Enrollment, Student
from csc_crm.apps.leads.models import LeadCapture
from csc_crm.apps.staff.forms import StaffForm
from csc_crm.apps.staff.models import Attendance, Department, Staff, StaffRole
from csc_crm.apps.student_attendance.models import Attendance as StudentAttendance
from csc_crm.apps.student_attendance.models import Batch
from csc_crm.apps.staff.validators import get_phone_error, validate_indian_mobile


# Production uses a manifest static-files storage (needs `collectstatic`); the
# tests render real pages, so they use the plain storage instead.
PLAIN_STATIC = override_settings(STORAGES={
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
})


# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------
_counter = {'n': 0}


def _n():
    _counter['n'] += 1
    return _counter['n']


def make_staff(role_name, dept_name='Management', employee_id=None, with_user=True):
    n = _n()
    role, _ = StaffRole.objects.get_or_create(role_name=role_name)
    dept, _ = Department.objects.get_or_create(dept_name=dept_name)
    employee_id = employee_id or f'EMP{n:03d}'

    user = None
    if with_user:
        user = User.objects.create_user(username=employee_id, password='pass12345')

    return Staff.objects.create(
        employee_id=employee_id,
        first_name='Test',
        last_name=f'User{n}',
        email=f'staff{n}@example.com',
        phone=f'9{n:09d}'[:10],
        role=role,
        department=dept,
        date_of_joining=date(2024, 1, 1),
        user=user,
    )


def make_course(name, fee=10000):
    return Course.objects.create(course_name=name, duration=3, course_fee=fee)


def make_batch(course, name, start, end, status='Ongoing', trainer=None):
    # Every batch gets its own trainer: the Student Attendance module (not part of
    # the staff module) crashes when a batch is saved without a trainer.
    trainer = trainer or make_staff('Trainer', 'Technical')
    return Batch.objects.create(
        batch_name=name, course=course, timing='Morning',
        start_time=time(9, 0), end_time=time(11, 0),
        start_date=start, end_date=end, status=status, trainer=trainer,
    )


def make_student(phone=None):
    n = _n()
    return Student.objects.create(
        first_name='Stu', last_name='Dent', dob=date(2000, 1, 1),
        phone_no=phone or f'8{n:09d}'[:10], gender='M',
        email=f'student{n}@example.com', address='Somewhere',
        guardian_name='Guard', guardian_phone_no=f'7{n:09d}'[:10],
    )


def enroll(student, course, batch, start_date=None, status='enrolled'):
    admission = Admission.objects.create(
        student=student, course_name=course, status=status
    )
    return Enrollment.objects.create(
        admission=admission, batch=batch,
        start_date=start_date or batch.start_date,
    )


def make_lead(assigned_to, phone=None, next_date=None, status='new',
              completed=False):
    n = _n()
    today = timezone.localdate()
    return LeadCapture.objects.create(
        lead_id=f'L{n:04d}', lead_name=f'Lead {n}', email=f'lead{n}@x.com',
        phone_no=phone or f'9{n:09d}'[:10], course_interested='python',
        lead_source='walk_in', assigned_to=assigned_to,
        enquiry_date=today, next_followup_date=next_date or today,
        initial_status=status, followup_completed=completed,
    )


# ----------------------------------------------------------------------------
# Requirement 07 - phone validation
# ----------------------------------------------------------------------------
class PhoneValidationTests(TestCase):

    def test_valid_numbers(self):
        for number in ('9876543210', '8123456789', '7000000000', '6999999999'):
            validate_indian_mobile(number)          # must not raise

    def test_invalid_numbers(self):
        for number in ('+919876543210', '1234567890', '987654321',
                       '98765abc10', '98765432101', '', '5876543210'):
            self.assertIsNotNone(get_phone_error(number), number)
            with self.assertRaises(ValidationError):
                validate_indian_mobile(number)


# ----------------------------------------------------------------------------
# Requirement 03 - manual, unique Employee ID
# ----------------------------------------------------------------------------
class EmployeeIdTests(TestCase):

    def test_duplicate_employee_id_is_rejected_ignoring_case(self):
        make_staff('Manager', employee_id='EMP900')

        form = StaffForm(data={'employee_id': 'emp900'})
        form.is_valid()
        self.assertIn('employee_id', form.errors)

    def test_employee_id_is_required_and_has_no_spaces(self):
        form = StaffForm(data={'employee_id': ''})
        form.is_valid()
        self.assertIn('employee_id', form.errors)

        form = StaffForm(data={'employee_id': 'EMP 1'})
        form.is_valid()
        self.assertIn('employee_id', form.errors)

    def test_new_employee_id_is_accepted(self):
        form = StaffForm(data={'employee_id': 'EMP777'})
        form.is_valid()
        self.assertNotIn('employee_id', form.errors)


# ----------------------------------------------------------------------------
# Requirement 06 - 30 minute grace period
# ----------------------------------------------------------------------------
@PLAIN_STATIC
class CheckInGraceTests(TestCase):

    def _check_in_at(self, hour, minute, second=0):
        staff = make_staff('Sales Exec', 'Sales')
        self.client.force_login(staff.user)

        today = timezone.localdate()
        fake_now = timezone.make_aware(
            datetime.combine(today, time(hour, minute, second))
        )

        with mock.patch('django.utils.timezone.now', return_value=fake_now):
            self.client.post(
                reverse('staff_checkin', args=[staff.id]), {'action': 'checkin'}
            )

        return Attendance.objects.get(staff=staff, date=today).status

    def test_inside_grace_period_is_present(self):
        self.assertEqual(self._check_in_at(9, 0), 'Present')
        self.assertEqual(self._check_in_at(9, 18), 'Present')

    def test_exactly_at_boundary_is_present(self):
        self.assertEqual(self._check_in_at(9, 30, 0), 'Present')

    def test_after_boundary_is_late(self):
        self.assertEqual(self._check_in_at(9, 30, 1), 'Late')
        self.assertEqual(self._check_in_at(10, 15), 'Late')


# ----------------------------------------------------------------------------
# Requirement 05 - Total Working Days vs attendance records
# ----------------------------------------------------------------------------
@PLAIN_STATIC
class AttendanceNumbersTests(TestCase):

    def setUp(self):
        from csc_crm.apps.staff.views import get_staff_attendance_summary
        self.summary = get_staff_attendance_summary

        self.staff = make_staff('Sales Exec', 'Sales')
        today = timezone.localdate()
        self.first = today.replace(day=1)
        self.last_month = (self.first - timedelta(days=1)).replace(day=1)

        # this month: 2 present + 2 late (+1 absent, 1 leave)
        statuses = ['Present', 'Present', 'Late', 'Late', 'Absent', 'Leave']
        for offset, status in enumerate(statuses):
            Attendance.objects.create(
                staff=self.staff,
                date=self.first + timedelta(days=offset),
                status=status,
            )

        # last month: 5 present - must NOT leak into this month's numbers
        for offset in range(5):
            Attendance.objects.create(
                staff=self.staff,
                date=self.last_month + timedelta(days=offset),
                status='Present',
            )

    def test_only_selected_month_is_counted(self):
        data = self.summary(self.staff)
        self.assertEqual(data['present_days'], 2)
        self.assertEqual(data['late_days'], 2)
        self.assertEqual(data['absent_days'], 1)
        self.assertEqual(data['leave_days'], 1)
        # (2 + 2 * 0.5) / 28 = 10.7 % -> 11
        self.assertEqual(data['percentage'], 11)

    def test_previous_month(self):
        data = self.summary(self.staff, self.last_month.year, self.last_month.month)
        self.assertEqual(data['present_days'], 5)
        self.assertEqual(data['percentage'], round(5 / 28 * 100))

    def test_attendance_page_and_overview_agree(self):
        admin = make_staff('Admin')
        self.client.force_login(admin.user)

        page = self.client.get(reverse('attendance', args=[self.staff.id]))
        overview = self.client.get(reverse('overview', args=[self.staff.id]))

        for key in ('present_days', 'late_days', 'absent_days', 'leave_days',
                    'attendance_percentage', 'total_working_days'):
            self.assertEqual(page.context[key], overview.context[key], key)


# ----------------------------------------------------------------------------
# Performance graph (Staff Overview)
# ----------------------------------------------------------------------------
@PLAIN_STATIC
class PerformanceGraphTests(TestCase):

    def test_this_month_and_last_month_lines_have_data(self):
        admin = make_staff('Admin')
        seller = make_staff('Sales Exec', 'Sales')
        self.client.force_login(admin.user)

        today = timezone.localdate()
        last_month_day = (today.replace(day=1) - timedelta(days=1)).replace(day=10)

        python = make_course('Python', fee=10000)
        java = make_course('Java', fee=5000)
        py_batch = make_batch(python, 'B-py', date(2024, 1, 1), date(2030, 1, 1))
        java_batch = make_batch(java, 'B-java', date(2024, 1, 1), date(2030, 1, 1))

        stu_now = make_student()
        stu_last = make_student()
        make_lead(seller, phone=stu_now.phone_no, status='enrolled')
        make_lead(seller, phone=stu_last.phone_no, status='enrolled')

        enroll(stu_now, python, py_batch, start_date=today.replace(day=3))   # week 1
        enroll(stu_last, java, java_batch, start_date=last_month_day)        # week 2

        response = self.client.get(reverse('overview', args=[seller.id]))

        this_month = response.context['week_data_this']
        last_month = response.context['week_data_last']

        self.assertEqual(len(this_month), 5)
        self.assertEqual(len(last_month), 5)
        self.assertEqual(this_month[0], 10000)
        self.assertEqual(sum(this_month), 10000)
        self.assertEqual(sum(last_month), 5000)
        self.assertEqual(last_month[1], 5000)

    def test_week_five_covers_days_29_to_month_end(self):
        from csc_crm.apps.staff.views import get_weekly_performance

        seller = make_staff('Sales Exec', 'Sales')
        course = make_course('Data', fee=7000)
        batch = make_batch(course, 'B-w5', date(2024, 1, 1), date(2030, 1, 1))
        stu = make_student()
        make_lead(seller, phone=stu.phone_no, status='enrolled')
        enroll(stu, course, batch, start_date=date(2025, 1, 31))

        amounts = get_weekly_performance(seller, 2025, 1)
        self.assertEqual(amounts[5], 7000)
        self.assertEqual(sum(amounts.values()), 7000)


# ----------------------------------------------------------------------------
# Requirements 01 + 02 and the dashboard numbers
# ----------------------------------------------------------------------------
@PLAIN_STATIC
class DashboardNumbersTests(TestCase):

    def setUp(self):
        self.admin = make_staff('Admin')
        self.client.force_login(self.admin.user)
        self.today = timezone.localdate()

    def _dashboard(self):
        response = self.client.get(reverse('staff_dashboard'))
        self.assertEqual(response.status_code, 200)
        return response.context

    # ---- follow-up numbers use the same rules as the Follow-Up page ----
    def test_followup_numbers(self):
        seller = make_staff('Sales Exec', 'Sales')
        yesterday = self.today - timedelta(days=1)

        make_lead(seller, next_date=yesterday)                        # overdue
        make_lead(seller, next_date=yesterday, completed=True)        # done
        make_lead(seller, next_date=yesterday, status='enrolled')     # finished
        make_lead(seller, next_date=self.today)                       # due today
        make_lead(seller, next_date=self.today, status='lost')        # finished

        ctx = self._dashboard()
        self.assertEqual(ctx['overdue_count'], 1)
        self.assertEqual(ctx['due_today'], 1)

    def test_recent_leads_show_newest_first(self):
        seller = make_staff('Sales Exec', 'Sales')
        ids = [make_lead(seller).id for _ in range(7)]

        # leads created in the same instant (Windows clock is coarse) have an
        # identical created_at - the newest id must still come first
        LeadCapture.objects.filter(id__in=ids).update(created_at=timezone.now())

        recent = [lead.id for lead in self._dashboard()['recent_leads']]
        self.assertEqual(recent, sorted(ids, reverse=True)[:5])

    # ---- Requirement 01 ----
    def test_student_overview_counts_students_once(self):
        start = self.today - timedelta(days=30)
        future_end = self.today + timedelta(days=60)

        c1, c2, c3 = make_course('C1'), make_course('C2'), make_course('C3')
        b1 = make_batch(c1, 'B1', start, future_end)
        b2 = make_batch(c2, 'B2', start, future_end)
        b3 = make_batch(c3, 'B3', date(2024, 1, 1), date(2024, 6, 1), status='Completed')

        both = make_student()           # two running batches -> still ONE active student
        enroll(both, c1, b1)
        enroll(both, c2, b2)

        done = make_student()           # finished batch only
        enroll(done, c3, b3)

        make_student()                  # never enrolled

        ctx = self._dashboard()
        self.assertEqual(ctx['total_students'], 3)
        self.assertEqual(ctx['active_students'], 1)
        self.assertEqual(ctx['completed_students'], 1)
        self.assertEqual(ctx['long_absent_students'], 0)

        total_pct = (ctx['active_students_pct'] + ctx['completed_students_pct']
                     + ctx['long_absent_students_pct'])
        self.assertLessEqual(total_pct, 100)

    def test_long_absent_student_is_separate_group(self):
        start = self.today - timedelta(days=30)
        end = self.today + timedelta(days=60)

        c1, c2 = make_course('LA'), make_course('LA2')
        b1 = make_batch(c1, 'BLA', start, end)
        b2 = make_batch(c2, 'BLA2', start, end)

        absent_student, present_student = make_student(), make_student()
        e_absent = enroll(absent_student, c1, b1)
        e_present = enroll(present_student, c2, b2)

        for i in range(7):
            day = self.today - timedelta(days=i + 1)
            StudentAttendance.objects.create(
                enrollment=e_absent, batch=b1, status='Absent', attendance_date=day)
            StudentAttendance.objects.create(
                enrollment=e_present, batch=b2, status='Present', attendance_date=day)

        ctx = self._dashboard()
        self.assertEqual(ctx['long_absent_students'], 1)
        self.assertEqual(ctx['active_students'], 1)      # long-absent is NOT also active
        self.assertEqual(len(ctx['long_absent_list']), 1)

    # ---- Requirement 02 ----
    def test_batch_strength_total_follows_registrations(self):
        start = self.today - timedelta(days=5)
        course = make_course('Strength')
        batch = make_batch(course, 'Batch A', start, self.today + timedelta(days=60))
        other = make_batch(course, 'Batch B', start, self.today + timedelta(days=60))

        def row(b):
            return [r for r in self._dashboard()['batch_summary'] if r.pk == b.pk][0]

        students = [make_student() for _ in range(3)]
        for st in students:
            enroll(st, course, batch)
        self.assertEqual((row(batch).enrolled_students, row(batch).strength_total), (3, 33))

        # a new registration: 3/33 -> 4/34 (the strength total grows with it)
        extra = make_student()
        enroll(extra, course, batch)
        self.assertEqual((row(batch).enrolled_students, row(batch).strength_total), (4, 34))
        self.assertContains(self.client.get(reverse('staff_dashboard')), '4/34')

        # removal: 4/34 -> 3/33
        Enrollment.objects.filter(admission__student=extra).first().delete()
        self.assertEqual((row(batch).enrolled_students, row(batch).strength_total), (3, 33))

        # transfer: old batch -1, new batch +1
        moved = Enrollment.objects.filter(admission__student=students[0]).first()
        moved.batch = other
        moved.save()
        self.assertEqual((row(batch).enrolled_students, row(batch).strength_total), (2, 32))
        self.assertEqual((row(other).enrolled_students, row(other).strength_total), (1, 31))

        # nothing outside the staff module is changed: the stored base value stays
        batch.refresh_from_db()
        self.assertEqual(batch.max_students, 30)

    # ---- Dashboard Batch Strength: Ongoing / Upcoming / Completed + latest five ----
    def test_batch_strength_counts_and_latest_five(self):
        course = make_course('Counts')
        d = timedelta

        running   = make_batch(course, 'Running',   self.today - d(days=10), self.today + d(days=30), status='Upcoming')
        future    = make_batch(course, 'Future',    self.today + d(days=15), self.today + d(days=90), status='Ongoing')
        finished  = make_batch(course, 'Finished',  self.today - d(days=60), self.today - d(days=5),  status='Ongoing')
        marked    = make_batch(course, 'MarkedDone', self.today - d(days=10), self.today + d(days=30), status='Completed')
        cancelled = make_batch(course, 'Cancelled', self.today - d(days=10), self.today + d(days=30), status='Ongoing')
        Batch.objects.filter(pk=cancelled.pk).update(status='Cancelled', is_active=False)

        ctx = self._dashboard()
        # date-aware: stored status is ignored when the dates say otherwise
        self.assertEqual(ctx['ongoing_batches'], 1)     # Running
        self.assertEqual(ctx['upcoming_batches'], 1)    # Future
        self.assertEqual(ctx['completed_batches'], 2)   # Finished + MarkedDone
        self.assertEqual(ctx['total_batches'], 4)       # cancelled not counted

        # status changed to Completed reflects at once
        Batch.objects.filter(pk=running.pk).update(status='Completed')
        ctx = self._dashboard()
        self.assertEqual((ctx['ongoing_batches'], ctx['completed_batches']), (0, 3))

        # only the five most recently added are listed, newest first
        extra = [make_batch(course, f'Extra {i}', self.today - d(days=1), self.today + d(days=30)) for i in range(4)]
        ctx = self._dashboard()
        names = [b.batch_name for b in ctx['batch_summary']]
        self.assertEqual(len(names), 5)
        self.assertEqual(names, [b.batch_name for b in reversed(extra)] + ['MarkedDone'])
        self.assertTrue(all(hasattr(b, 'dash_status') for b in ctx['batch_summary']))

    # ---- Requirement 04 ----
    def test_view_all_shows_only_that_staff_members_leads(self):
        a = make_staff('Sales Exec', 'Sales')
        b = make_staff('Sales Exec', 'Sales')
        for _ in range(3):
            make_lead(a)
        for _ in range(2):
            make_lead(b)

        response = self.client.get(reverse('staff_assigned_leads', args=[a.id]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context['leads']), 3)
        self.assertContains(response, f'Leads assigned to {a.full_name()}')

        overview = self.client.get(reverse('overview', args=[a.id]))
        self.assertContains(overview, reverse('staff_assigned_leads', args=[a.id]))

    # ---- staff numbers ----
    def test_staff_attendance_percentage_without_other_staff(self):
        # only an Admin exists -> no active (non-admin) staff, must not crash
        Attendance.objects.create(staff=self.admin, date=self.today, status='Present')
        self.assertEqual(self._dashboard()['attendance_percentage'], 0)

    def test_average_rating_ignores_inactive_staff(self):
        a = make_staff('Developer', 'Technical')
        a.performance_rating = 5
        a.save()
        b = make_staff('Developer', 'Technical')
        b.performance_rating = 1
        b.status = 'terminated'
        b.save()

        self.assertEqual(self._dashboard()['average_rating'], 5)