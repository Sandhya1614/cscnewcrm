"""
Tests for:
  * HR is view-only on Student Attendance (no mark / edit / submit, API blocked)
  * Staff profile document container (2+ recent documents, working View button)
  * Recent Activity card (>= 4 items) + full history page (joining date -> today)
  * Call log duration markup

Run:  python manage.py test csc_crm.apps.staff.tests_hr_docs_activity
"""
import json
import os
import tempfile
from datetime import date, timedelta
from unittest import mock

from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from csc_crm.apps.leads.models import CallLog
from csc_crm.apps.staff.models import Attendance as StaffAttendance
from csc_crm.apps.staff.models import StaffDocument
from csc_crm.apps.staff.tests import (
    PLAIN_STATIC, enroll, make_batch, make_course, make_staff, make_student,
)
from csc_crm.apps.student_attendance.models import Attendance as StudentAttendance


def login(client, staff):
    assert client.login(username=staff.employee_id, password='pass12345')


def make_doc(staff, stored, when=None):
    doc = StaffDocument.objects.create(staff=staff, document=stored)
    if when:
        StaffDocument.objects.filter(pk=doc.pk).update(uploaded_at=when)
    return doc


# ----------------------------------------------------------------------------
# 1. HR view-only attendance
# ----------------------------------------------------------------------------
@PLAIN_STATIC
class HrViewOnlyAttendanceTests(TestCase):

    def setUp(self):
        today = timezone.localdate()
        self.course = make_course('Python')
        self.batch = make_batch(self.course, 'PY-1', today - timedelta(days=5),
                                today + timedelta(days=60))
        self.student = make_student()
        self.enrollment = enroll(self.student, self.course, self.batch)
        self.hr = make_staff('HR')
        self.admin = make_staff('Admin')
        self.url = reverse('mark_attendance_page', args=[self.batch.id])

    def _mark(self, status='Absent', remarks='sick'):
        return StudentAttendance.objects.create(
            enrollment=self.enrollment, batch=self.batch,
            attendance_date=timezone.now().date(), status=status,
            remarks=remarks, trainer=self.batch.trainer,
        )

    def test_hr_page_has_no_mark_edit_or_submit_controls(self):
        self._mark()
        login(self.client, self.hr)
        html = self.client.get(self.url).content.decode()
        self.assertIn('View Attendance', html)
        self.assertIn('View Only', html)
        self.assertIn('IS_VIEW_ONLY = true', html)
        self.assertNotIn('Submit Attendance', html)
        self.assertNotIn('attendanceModal', html)
        self.assertNotIn('openAttendanceModal()', html)
        self.assertNotIn('Submit Now', html)
        self.assertNotIn('Select status for each student', html)
        self.assertIn('status: "Absent"', html)

    def test_hr_sees_only_real_statuses_never_an_invented_present(self):
        login(self.client, self.hr)                     # nothing marked yet
        html = self.client.get(self.url).content.decode()
        self.assertIn('status: ""', html)
        self.assertNotIn('status: "Present"', html)

    def test_admin_page_keeps_full_controls(self):
        login(self.client, self.admin)
        html = self.client.get(self.url).content.decode()
        self.assertIn('Submit Attendance', html)
        self.assertIn('attendanceModal', html)
        self.assertIn('IS_VIEW_ONLY = false', html)
        self.assertIn('status: "Present"', html)

    def _payload(self):
        return {
            'batch': self.batch.id,
            'attendance': [{'enrollment': self.enrollment.id,
                            'status': 'Absent', 'remarks': 'x'}],
            'syllabus_log': {'topic_covered': 'Loops', 'duration': 60},
        }

    def test_hr_cannot_save_attendance_through_the_api(self):
        login(self.client, self.hr)
        resp = self.client.post(reverse('bulk_attendance'),
                                data=json.dumps(self._payload()),
                                content_type='application/json')
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(StudentAttendance.objects.count(), 0)

    def test_admin_can_still_save_attendance(self):
        login(self.client, self.admin)
        resp = self.client.post(reverse('bulk_attendance'),
                                data=json.dumps(self._payload()),
                                content_type='application/json')
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(StudentAttendance.objects.count(), 1)

    def test_history_detail_is_view_only_for_hr(self):
        self._mark()
        login(self.client, self.hr)
        day = timezone.now().date().isoformat()
        data = self.client.get(reverse('attendance_history_detail',
                                       args=[self.batch.id, day])).json()
        self.assertTrue(data['view_only'])
        self.assertFalse(data['can_edit'])
        self.assertEqual({s['status'] for s in data['students']}, {'Absent'})

    def test_history_detail_still_editable_for_admin(self):
        self._mark()
        login(self.client, self.admin)
        day = timezone.now().date().isoformat()
        data = self.client.get(reverse('attendance_history_detail',
                                       args=[self.batch.id, day])).json()
        self.assertFalse(data['view_only'])
        self.assertTrue(data['can_edit'])


# ----------------------------------------------------------------------------
# 2. Documents container on the staff profile + View button
# ----------------------------------------------------------------------------
@PLAIN_STATIC
class StaffDocumentTests(TestCase):

    def setUp(self):
        self.now = timezone.now()
        self.roles = {r: make_staff(r) for r in ('Admin', 'Manager', 'HR')}
        self.stored = [
            'image/upload/v1/staff/documents/aadhaar_card.pdf',
            'image/upload/v1/staff/documents/photo_one.jpg',
            'staff/documents/resume_legacy.pdf',
        ]

    def _docs_for(self, staff):
        return [make_doc(staff, name, self.now - timedelta(days=i))
                for i, name in enumerate(self.stored)]

    def test_model_helpers_never_raise_and_have_sensible_values(self):
        doc = self._docs_for(self.roles['Admin'])[0]
        self.assertEqual(doc.file_ext, 'PDF')
        self.assertEqual(doc.file_name, 'aadhaar_card.pdf')
        self.assertEqual(doc.display_type, 'Aadhaar Card')
        self.assertEqual(doc.icon_class, 'fa-file-pdf')
        self.assertEqual(doc.file.public_id, 'staff/documents/aadhaar_card')

    def test_profile_shows_recent_documents_with_working_view_links(self):
        for role, staff in self.roles.items():
            docs = self._docs_for(staff)
            login(self.client, staff)
            resp = self.client.get(reverse('staff_profile', args=[staff.id]))
            self.assertEqual(resp.status_code, 200, role)
            html = resp.content.decode()
            shown = resp.context['recent_documents']
            self.assertGreaterEqual(len(shown), 2, role)
            self.assertEqual([d.id for d in shown], [d.id for d in docs])   # newest first
            for d in shown:
                self.assertIn(reverse('view_document', args=[d.id]), html, role)
            self.assertNotIn('href="None"', html)
            self.assertNotIn('/None', html)
            self.client.logout()

    def test_profile_with_no_documents_still_renders(self):
        staff = self.roles['Manager']
        login(self.client, staff)
        resp = self.client.get(reverse('staff_profile', args=[staff.id]))
        self.assertEqual(resp.status_code, 200)
        self.assertIn('No documents uploaded yet.', resp.content.decode())

    def test_documents_page_uses_view_endpoint_and_no_stray_dot(self):
        staff = self.roles['Admin']
        doc = self._docs_for(staff)[0]
        login(self.client, staff)
        html = self.client.get(reverse('staff_documents', args=[staff.id])).content.decode()
        self.assertIn(reverse('view_document', args=[doc.id]), html)
        self.assertIn('aadhaar_card.pdf', html)
        self.assertNotIn('</a>\n.\n', html)

    def test_view_serves_local_file_inline(self):
        staff = self.roles['Admin']
        with tempfile.TemporaryDirectory() as media:
            os.makedirs(os.path.join(media, 'staff', 'documents'))
            with open(os.path.join(media, 'staff', 'documents', 'resume_legacy.pdf'), 'wb') as fh:
                fh.write(b'%PDF-1.4 legacy')
            doc = make_doc(staff, 'staff/documents/resume_legacy.pdf')
            login(self.client, staff)
            with override_settings(MEDIA_ROOT=media):
                resp = self.client.get(reverse('view_document', args=[doc.id]))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp['Content-Type'], 'application/pdf')
        self.assertTrue(resp['Content-Disposition'].startswith('inline'))
        self.assertEqual(resp.content, b'%PDF-1.4 legacy')

    def test_view_downloads_when_asked_and_for_word_files(self):
        staff = self.roles['Admin']
        pdf = make_doc(staff, 'image/upload/v1/staff/documents/a.pdf')
        docx = make_doc(staff, 'raw/upload/v1/staff/documents/cv.docx')
        login(self.client, staff)
        with mock.patch('csc_crm.apps.staff.views._fetch_document_bytes', return_value=b'DATA'):
            r1 = self.client.get(reverse('view_document', args=[pdf.id]) + '?download=1')
            r2 = self.client.get(reverse('view_document', args=[docx.id]))
        self.assertTrue(r1['Content-Disposition'].startswith('attachment'))
        self.assertTrue(r2['Content-Disposition'].startswith('attachment'))

    def test_view_falls_back_to_next_url_when_first_fails(self):
        staff = self.roles['Admin']
        doc = make_doc(staff, 'image/upload/v1/staff/documents/a.pdf')
        login(self.client, staff)
        calls = []

        def fake(url, timeout=12):
            calls.append(url)
            if len(calls) == 1:
                raise OSError('404')
            return b'%PDF second try'

        with mock.patch('csc_crm.apps.staff.views._fetch_document_bytes', side_effect=fake):
            resp = self.client.get(reverse('view_document', args=[doc.id]))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.content, b'%PDF second try')
        self.assertGreaterEqual(len(calls), 2)

    def test_missing_file_gives_a_message_not_an_empty_page(self):
        staff = self.roles['Admin']
        doc = make_doc(staff, 'staff/documents/gone.pdf')
        login(self.client, staff)
        with mock.patch('csc_crm.apps.staff.views._fetch_document_bytes',
                        side_effect=OSError('404')):
            resp = self.client.get(reverse('view_document', args=[doc.id]), follow=True)
        self.assertEqual(resp.redirect_chain[0][0], reverse('staff_documents', args=[staff.id]))
        self.assertIn('could not be opened', resp.content.decode())

    def test_other_staff_cannot_view_someone_elses_document(self):
        owner = make_staff('Trainer', 'Technical')
        other = make_staff('Trainer', 'Technical')
        doc = make_doc(owner, 'image/upload/v1/staff/documents/a.pdf')
        login(self.client, other)
        self.assertEqual(self.client.get(reverse('view_document', args=[doc.id])).status_code, 403)
        self.client.logout()
        login(self.client, owner)
        with mock.patch('csc_crm.apps.staff.views._fetch_document_bytes', return_value=b'x'):
            self.assertEqual(self.client.get(reverse('view_document', args=[doc.id])).status_code, 200)

    def test_local_path_cannot_escape_media_root(self):
        staff = self.roles['Admin']
        doc = make_doc(staff, 'staff/documents/../../../etc/passwd')
        from csc_crm.apps.staff.views import _document_local_paths
        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            for path in _document_local_paths(doc):
                self.assertTrue(path.startswith(os.path.realpath(media) + os.sep))


# ----------------------------------------------------------------------------
# 3. Recent Activity card + history page
# ----------------------------------------------------------------------------
@PLAIN_STATIC
class RecentActivityTests(TestCase):

    def setUp(self):
        self.staff = make_staff('Manager')         # joined 2024-01-01
        today = timezone.localdate()
        now = timezone.now()
        for i in range(1, 4):
            day = today - timedelta(days=i)
            StaffAttendance.objects.create(
                staff=self.staff, date=day, status='Present',
                log_in=now - timedelta(days=i, hours=2),
                log_out=now - timedelta(days=i, hours=1),
            )
        login(self.client, self.staff)

    def test_card_shows_at_least_four_items_and_the_history_button(self):
        resp = self.client.get(reverse('staff_profile', args=[self.staff.id]))
        feed = resp.context['activity_feed']
        self.assertGreaterEqual(len(feed), 4)
        html = resp.content.decode()
        self.assertIn('View Recent Activity History', html)
        self.assertIn(reverse('staff_activity_history', args=[self.staff.id]), html)

    def test_card_is_capped_but_history_has_everything(self):
        resp = self.client.get(reverse('staff_profile', args=[self.staff.id]))
        self.assertLessEqual(len(resp.context['activity_feed']), 5)
        hist = self.client.get(reverse('staff_activity_history', args=[self.staff.id]))
        self.assertEqual(hist.status_code, 200)
        self.assertEqual(hist.context['total_events'], resp.context['activity_total'])
        self.assertGreater(hist.context['total_events'], 5)

    def test_history_runs_from_joining_date_to_today(self):
        hist = self.client.get(reverse('staff_activity_history', args=[self.staff.id]))
        self.assertEqual(hist.context['start_date'], date(2024, 1, 1))
        self.assertEqual(hist.context['end_date'], timezone.localdate())
        html = hist.content.decode()
        self.assertIn('Joined CSC', html)
        self.assertIn('Checked In', html)
        self.assertIn('Checked Out', html)
        self.assertIn('01 Jan 2024', html)

    def test_history_excludes_events_before_joining_date(self):
        StaffAttendance.objects.create(
            staff=self.staff, date=date(2023, 6, 1), status='Present',
            log_in=timezone.make_aware(timezone.datetime(2023, 6, 1, 9, 5)),
        )
        hist = self.client.get(reverse('staff_activity_history', args=[self.staff.id]))
        self.assertNotIn('01 Jun 2023', hist.content.decode())

    def test_history_is_private_to_the_owner(self):
        other = make_staff('Admin')
        self.client.logout()
        login(self.client, other)
        resp = self.client.get(reverse('staff_activity_history', args=[self.staff.id]))
        self.assertEqual(resp.status_code, 403)

    def test_brand_new_staff_still_has_a_joined_item(self):
        fresh = make_staff('Admin')
        self.client.logout()
        login(self.client, fresh)
        resp = self.client.get(reverse('staff_profile', args=[fresh.id]))
        self.assertEqual([i['title'] for i in resp.context['activity_feed']], ['Joined CSC'])


# ----------------------------------------------------------------------------
# 4. Call log duration markup
# ----------------------------------------------------------------------------
@PLAIN_STATIC
class CallLogDurationMarkupTests(TestCase):

    def test_duration_is_in_its_own_aligned_element(self):
        admin = make_staff('Admin')
        CallLog.objects.create(lead_name='Asha', call_type='answered', call_date=timezone.localdate(),
                               duration=12, duration_seconds=30, call_outcome='Interested')
        CallLog.objects.create(lead_name='Ravi', call_type='did_not_connect', call_date=timezone.localdate(),
                               call_outcome='Not Reachable')
        login(self.client, admin)
        for name in ('leads:call_logs', 'leads:call_history'):
            html = self.client.get(reverse(name)).content.decode()
            self.assertIn('time-duration', html, name)
            self.assertIn('12 min 30 s', html, name)
            self.assertIn('time-duration-none', html, name)
