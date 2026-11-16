"""
Tests for the CRM update:
  * 403 Access Denied for Staff Management / Leads URLs a role may not open
  * name fields: letters only, at most 20 characters
  * recent lists limited to the top five records
  * student dashboard counts + photo/payment indications + receipt preview

Run:  python manage.py test csc_crm.apps.staff.tests_access_and_names
"""
from datetime import date, timedelta

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from csc_crm.apps.admissions.models import Payment
from csc_crm.apps.leads.forms import LeadCaptureForm
from csc_crm.apps.leads.models import LeadCapture
from csc_crm.apps.staff.tests import (
    PLAIN_STATIC, enroll, make_batch, make_course, make_lead, make_staff,
    make_student,
)
from csc_crm.apps.staff.validators import (
    clean_person_name, get_name_error, validate_person_name,
)


def login(client, staff):
    assert client.login(username=staff.employee_id, password='pass12345')


# ----------------------------------------------------------------------------
# name rule
# ----------------------------------------------------------------------------
class NameRuleTests(TestCase):

    def test_valid_names(self):
        for name in ('Ravi', 'Mary Ann', 'A', 'a' * 20):
            validate_person_name(name)
            self.assertEqual(clean_person_name(f'  {name}  '), name)

    def test_invalid_names(self):
        for name in ('', '   ', 'Ravi1', 'Ravi_K', 'Ravi.K', 'a' * 21,
                     'Mary  Ann', "O'Neil", 'Ravi\u0b95'):
            self.assertIsNotNone(get_name_error(name), repr(name))
            with self.assertRaises(ValidationError):
                validate_person_name(name)

    def test_lead_form_enforces_name_rule(self):
        base = dict(
            lead_name='Valid Name', email='n@x.com', phone_no='9876543210',
            course_interested='python', lead_source='walk_in',
            enquiry_date=date.today(), initial_status='new',
        )
        form = LeadCaptureForm(dict(base, lead_name='x' * 21))
        self.assertIn('lead_name', form.errors)
        form = LeadCaptureForm(dict(base, lead_name='Bad123'))
        self.assertIn('lead_name', form.errors)
        form = LeadCaptureForm(base)
        self.assertNotIn('lead_name', form.errors)

    def test_lead_widget_has_maxlength(self):
        self.assertEqual(LeadCaptureForm().fields['lead_name'].widget.attrs['maxlength'], '20')


# ----------------------------------------------------------------------------
# 403 for Staff Management
# ----------------------------------------------------------------------------
@PLAIN_STATIC
class StaffManagementAccessTests(TestCase):

    def setUp(self):
        self.admin = make_staff('Admin')
        self.target = make_staff('Trainer', 'Technical')

    def test_roles_without_access_get_403(self):
        for role in ('Trainer', 'Sales Exec', 'Digital Marketing', 'Content Creator'):
            s = make_staff(role)
            login(self.client, s)
            for name in ('staff_management', 'export_staff'):
                self.assertEqual(self.client.get(reverse(name)).status_code, 403, (role, name))
            self.client.logout()

    def test_allowed_roles_open_management(self):
        for role in ('Admin', 'Manager', 'HR'):
            s = make_staff(role)
            login(self.client, s)
            self.assertEqual(self.client.get(reverse('staff_management')).status_code, 200, role)
            self.client.logout()

    def test_quick_edit_and_overview_export_are_admin_manager_only(self):
        hr = make_staff('HR')
        login(self.client, hr)
        self.assertEqual(self.client.post(reverse('quick_edit_staff', args=[self.target.id]), {}).status_code, 403)
        self.assertEqual(self.client.get(reverse('staff_export', args=[self.target.id])).status_code, 403)

    def test_cannot_open_other_staff_documents_or_attendance_export(self):
        trainer = make_staff('Trainer', 'Technical')
        login(self.client, trainer)
        self.assertEqual(self.client.get(reverse('staff_documents', args=[self.target.id])).status_code, 403)
        self.assertEqual(self.client.get(reverse('export_attendance', args=[self.target.id])).status_code, 403)
        self.assertEqual(self.client.get(reverse('attendance', args=[self.target.id])).status_code, 403)
        # check-in for someone else is refused as well
        self.assertEqual(self.client.post(reverse('staff_checkin', args=[self.target.id]), {}).status_code, 403)
        # ...but their own documents page works
        self.assertEqual(self.client.get(reverse('staff_documents', args=[trainer.id])).status_code, 200)

    def test_403_uses_the_access_denied_template(self):
        login(self.client, make_staff('Trainer', 'Technical'))
        response = self.client.get(reverse('staff_management'))
        self.assertEqual(response.status_code, 403)
        self.assertContains(response, 'Access Denied', status_code=403)


# ----------------------------------------------------------------------------
# 403 for Leads
# ----------------------------------------------------------------------------
@PLAIN_STATIC
class LeadsAccessTests(TestCase):

    def setUp(self):
        self.admin = make_staff('Admin')
        self.exec_a = make_staff('Sales Exec', 'Sales')
        self.exec_b = make_staff('Sales Exec', 'Sales')
        self.lead_a = make_lead(self.exec_a)
        self.lead_b = make_lead(self.exec_b)

    def urls(self):
        return [
            reverse('leads:lead_capture_list'),
            reverse('leads:lead_pipeline_view'),
            reverse('leads:followup_shedule'),
            reverse('leads:lead_conversion_report'),
            reverse('leads:call_logs'),
            reverse('leads:lead_capture_details', args=[self.lead_a.id]),
            reverse('leads:lead_capture_update', args=[self.lead_a.id]),
            reverse('leads:lead_capture_download_pdf', args=[self.lead_a.id]),
        ]

    def test_marketing_and_other_roles_get_403_on_every_lead_page(self):
        for role in ('Digital Marketing', 'Content Creator', 'Marketing Lead', 'Trainer', 'Developer'):
            login(self.client, make_staff(role))
            for url in self.urls():
                self.assertEqual(self.client.get(url).status_code, 403, (role, url))
            self.client.logout()

    def test_admin_opens_lead_pages(self):
        login(self.client, self.admin)
        for url in self.urls():
            self.assertEqual(self.client.get(url).status_code, 200, url)

    def test_sales_exec_cannot_open_a_lead_assigned_to_someone_else(self):
        login(self.client, self.exec_a)
        mine = reverse('leads:lead_capture_details', args=[self.lead_a.id])
        theirs = [
            reverse('leads:lead_capture_details', args=[self.lead_b.id]),
            reverse('leads:lead_capture_update', args=[self.lead_b.id]),
            reverse('leads:lead_capture_download_pdf', args=[self.lead_b.id]),
        ]
        self.assertEqual(self.client.get(mine).status_code, 200)
        for url in theirs:
            self.assertEqual(self.client.get(url).status_code, 403, url)

    def test_sales_exec_has_no_lead_list_page(self):
        login(self.client, self.exec_a)
        self.assertEqual(self.client.get(reverse('leads:lead_capture_list')).status_code, 403)
        self.assertEqual(self.client.get(reverse('leads:lead_pipeline_view')).status_code, 200)

    def test_target_urls_return_403_for_other_peoples_targets(self):
        login(self.client, make_staff('Trainer', 'Technical'))
        self.assertEqual(self.client.get(reverse('leads:lead_capture_target_assign')).status_code, 403)
        self.assertEqual(self.client.get(reverse('leads:my_lead_capture_target')).status_code, 403)

    def test_recent_leads_today_is_limited_to_five(self):
        for _ in range(8):
            make_lead(self.exec_a)
        login(self.client, self.admin)
        response = self.client.get(reverse('leads:lead_capture_list'))
        self.assertEqual(len(response.context['recent_leads']), 5)

    def test_recent_call_history_is_limited_to_five(self):
        from csc_crm.apps.leads.models import CallLog
        for i in range(8):
            CallLog.objects.create(
                lead_name=f'Caller {i}', call_type='outgoing',
                call_date=date.today(), call_outcome='Interested',
            )
        login(self.client, self.admin)
        response = self.client.get(reverse('leads:call_logs'))
        self.assertEqual(response.content.decode().count('class="card-link"'), 5)


# ----------------------------------------------------------------------------
# Student dashboard, recent lists, photos + payment indications, receipt preview
# ----------------------------------------------------------------------------
@PLAIN_STATIC
class DashboardAndPreviewTests(TestCase):

    def setUp(self):
        self.admin = make_staff('Admin')
        login(self.client, self.admin)
        self.course = make_course('Python', 10000)
        today = timezone.localdate()
        self.running = make_batch(self.course, 'Running', today - timedelta(days=10), today + timedelta(days=30))
        self.finished = make_batch(self.course, 'Finished', today - timedelta(days=90), today - timedelta(days=5), status='Completed')

    def test_student_counts_and_absent_label(self):
        s1, s2, s3 = make_student(), make_student(), make_student()
        enroll(s1, self.course, self.running)
        enroll(s2, self.course, self.finished)
        response = self.client.get(reverse('staff_dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['active_students'], 1)
        self.assertEqual(response.context['completed_students'], 1)
        self.assertEqual(response.context['long_absent_students'], 0)
        html = response.content.decode()
        self.assertIn('Absent <b>', html)
        self.assertNotIn('Long-Absent', html)

    def test_recent_lists_show_five_records(self):
        for _ in range(9):
            make_student()
        for _ in range(7):
            make_staff('Trainer', 'Technical')
        response = self.client.get(reverse('staff_dashboard'))
        self.assertEqual(len(response.context['recent_students']), 5)
        self.assertEqual(len(response.context['recent_staff']), 5)

    def test_recent_students_show_payment_status(self):
        s = make_student()
        enroll(s, self.course, self.running)
        Payment.objects.create(student=s, amount=4000, mode='CASH', status='SUCCESS')
        html = self.client.get(reverse('staff_dashboard')).content.decode()
        self.assertIn('pay-partial', html)

    def test_receipt_preview_renders_and_is_aligned_grid(self):
        s = make_student()
        enroll(s, self.course, self.running)
        pay = Payment.objects.create(student=s, amount=2500, mode='UPI', status='SUCCESS')
        response = self.client.get(reverse('preview_receipt', args=[pay.id]))
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertEqual(html.count('class="info-item"'), 5)
        self.assertIn('student-info-grid', html)

    def test_fee_pages_render_with_student_avatars(self):
        s = make_student()
        enroll(s, self.course, self.running)
        Payment.objects.create(student=s, amount=1000, mode='CASH', status='SUCCESS')
        for name in ('fee_dashboard', 'payment_history_all', 'search_students'):
            self.assertEqual(self.client.get(reverse(name)).status_code, 200, name)

    def test_edit_student_rejects_long_name(self):
        s = make_student()
        enroll(s, self.course, self.running)
        url = reverse('edit_student', args=[s.id])
        self.client.post(url, {'first_name': 'x' * 21, 'last_name': 'Ok'})
        s.refresh_from_db()
        self.assertEqual(s.first_name, 'Stu')
